import { LANDING_HTML } from "./landing";
import { getConfig, WorkerEnv } from "./env";
import { canonicalizeUrl } from "./validation/url";
import { json, jsonError, requestIdFromReq } from "./http/response";
import { isAuthenticatedKey, isAllowedRequestOrigin, getApiKey } from "./auth/index";
import { rateLimitOk } from "./rateLimit/index";
import { sha256Base32 } from "./slug/generator";
import { validateSlug, getLink, saveLink, hardDeleteLink, putExpiredOrDisabled, RESERVED_SLUGS } from "./storage/links";
import { shortenRequestSchema, updateLinkRequestSchema } from "./validation/schemas";

const DEFAULT_SHORTEN_LENGTH = 6;
const COLLISION_SHORTEN_LENGTH = 10;

function html(body: string, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(body, { ...init, headers });
}

function makeShortUrl(baseUrl: string, slug: string) {
  return `${baseUrl.replace(/\/$/, "")}/${slug}`;
}

function extractSlug(pathname: string): string {
  const value = pathname.replace(/^\//, "");
  try {
    return decodeURIComponent(value || "");
  } catch {
    return value || "";
  }
}

function parseJsonBody(req: Request) {
  return req.json().catch(() => null);
}

function mapError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Invalid request";
}

function getExpiresAt(ttl?: number, expiresAt?: string): number | undefined {
  if (ttl !== undefined) {
    return Date.now() + ttl * 1000;
  }
  if (expiresAt) {
    const ts = Date.parse(expiresAt);
    return Number.isNaN(ts) ? undefined : ts;
  }
  return undefined;
}

function toManagedResponse(
  baseUrl: string,
  slug: string,
  requestId: string,
  record: {
    url: string;
    createdAt: number;
    updatedAt: number;
    createdBy?: string;
    expiresAt?: number;
    disabled?: boolean;
    customSlug?: boolean;
  },
  created: boolean,
) {
  return json({
    slug,
    shortUrl: makeShortUrl(baseUrl, slug),
    url: record.url,
    created,
    alreadyExisted: !created,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    createdBy: record.createdBy,
    disabled: Boolean(record.disabled),
    expiresAt: record.expiresAt,
    customSlug: Boolean(record.customSlug),
    requestId,
  });
}

async function ensureAuthorized(request: Request, env: WorkerEnv, requestId: string) {
  const apiKey = getApiKey(request, env);
  if (!isAuthenticatedKey(apiKey, env)) {
    return jsonError("unauthorized", "Invalid API key", requestId, 401);
  }

  const config = getConfig(env);
  if (!isAllowedRequestOrigin(request, config.allowedOrigins, config.allowNoOrigin)) {
    return jsonError("forbidden", "Origin is not allowed", requestId, 403);
  }

  const allowed = await rateLimitOk(env, request, config.rateLimitWindowSec, config.rateLimitMax);
  if (!allowed) {
    return jsonError("rate_limited", "Rate limit exceeded", requestId, 429);
  }

  return null;
}

async function handleShorten(request: Request, env: WorkerEnv, requestId: string): Promise<Response> {
  const unauthorized = await ensureAuthorized(request, env, requestId);
  if (unauthorized) return unauthorized;

  const body = await parseJsonBody(request);
  if (!body || typeof body !== "object") {
    return jsonError("bad_request", "Invalid JSON", requestId, 400);
  }

  const parsed = shortenRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("bad_request", parsed.error.issues[0]?.message || "Invalid request", requestId, 400, {
      issues: parsed.error.issues.map((issue) => ({ path: issue.path, message: issue.message })),
    });
  }

  const cfg = getConfig(env);
  let normalizedUrl: string;
  try {
    normalizedUrl = canonicalizeUrl(parsed.data.url, env, {
      stripTrailingSlash: cfg.stripTrailingSlash,
      maxLength: cfg.maxUrlLength,
    });
  } catch (err) {
    return jsonError("bad_request", mapError(err), requestId, 400);
  }

  const requestedSlug = parsed.data.customSlug?.trim().toLowerCase();

  if (requestedSlug) {
    if (RESERVED_SLUGS.has(requestedSlug.toLowerCase())) {
      return jsonError("bad_request", "Reserved slug", requestId, 400);
    }
    if (!validateSlug(requestedSlug)) {
      return jsonError("bad_request", "Invalid custom slug", requestId, 400);
    }

    const existing = await getLink(env.LINKS, requestedSlug, true, true);
    if (existing) {
      if (existing.url === normalizedUrl && existing.disabled !== true) {
        return toManagedResponse(env.BASE_URL, requestedSlug, requestId, existing, false);
      }
      if (!parsed.data.overwrite && !parsed.data.force) {
        return jsonError("conflict", "Slug already exists", requestId, 409);
      }
    }

    const key = request.headers.get("X-API-Key") || "";
    const now = Date.now();
    const expiresAt = getExpiresAt(parsed.data.ttl, parsed.data.expiresAt);
    const next = {
      slug: requestedSlug,
      url: normalizedUrl,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      createdBy: key,
      expiresAt,
      disabled: false,
      customSlug: true,
    };
    await saveLink(env.LINKS, next);
    return toManagedResponse(env.BASE_URL, requestedSlug, requestId, next, !existing);
  }

  const hash = await sha256Base32(normalizedUrl);
  const preferred = hash.slice(0, DEFAULT_SHORTEN_LENGTH);
  const fallback = hash.slice(0, COLLISION_SHORTEN_LENGTH);

  const existing = await getLink(env.LINKS, preferred, true, true);
  if (!existing) {
    const now = Date.now();
    const key = request.headers.get("X-API-Key") || "";
    const expiresAt = getExpiresAt(parsed.data.ttl, parsed.data.expiresAt);
    const created = {
      slug: preferred,
      url: normalizedUrl,
      createdAt: now,
      updatedAt: now,
      createdBy: key,
      expiresAt,
      disabled: false,
      customSlug: false,
    };
    await saveLink(env.LINKS, created);
    return toManagedResponse(env.BASE_URL, preferred, requestId, created, true);
  }

  if (existing.url === normalizedUrl && existing.disabled !== true) {
    return toManagedResponse(env.BASE_URL, preferred, requestId, existing, false);
  }

  const existingFallback = await getLink(env.LINKS, fallback, true, true);
  if (existingFallback) {
    if (existingFallback.url === normalizedUrl && existingFallback.disabled !== true) {
      return toManagedResponse(env.BASE_URL, fallback, requestId, existingFallback, false);
    }
    return jsonError("conflict", "Slug collision", requestId, 409);
  }

  const created = {
    slug: fallback,
    url: normalizedUrl,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    createdBy: request.headers.get("X-API-Key") || "",
    expiresAt: getExpiresAt(parsed.data.ttl, parsed.data.expiresAt),
    disabled: false,
    customSlug: false,
  };
  await saveLink(env.LINKS, created);
  return toManagedResponse(env.BASE_URL, fallback, requestId, created, true);
}

async function handleGetLink(slug: string, env: WorkerEnv, requestId: string, request: Request): Promise<Response> {
  const unauthorized = await ensureAuthorized(request, env, requestId);
  if (unauthorized) return unauthorized;

  if (!validateSlug(slug) && !/^[a-z0-9]{6,10}$/i.test(slug)) {
    return jsonError("bad_request", "Invalid slug", requestId, 400);
  }

  const link = await getLink(env.LINKS, slug, true, true);
  if (!link) {
    return jsonError("not_found", "Link not found", requestId, 404);
  }

  return json({
    slug: link.slug,
    url: link.url,
    createdAt: link.createdAt,
    updatedAt: link.updatedAt,
    createdBy: link.createdBy,
    expiresAt: link.expiresAt,
    disabled: Boolean(link.disabled),
    customSlug: Boolean(link.customSlug),
    requestId,
  });
}

async function handleUpdateLink(slug: string, env: WorkerEnv, requestId: string, request: Request): Promise<Response> {
  const unauthorized = await ensureAuthorized(request, env, requestId);
  if (unauthorized) return unauthorized;

  const body = await parseJsonBody(request);
  if (!body || typeof body !== "object") {
    return jsonError("bad_request", "Invalid JSON", requestId, 400);
  }

  const parsed = updateLinkRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("bad_request", parsed.error.issues[0]?.message || "Invalid request", requestId, 400);
  }

  if (!validateSlug(slug)) {
    return jsonError("bad_request", "Invalid slug", requestId, 400);
  }

  const existing = await getLink(env.LINKS, slug, true, true);
  if (!existing) {
    return jsonError("not_found", "Link not found", requestId, 404);
  }

  if (parsed.data.url !== undefined && existing.url !== parsed.data.url && !parsed.data.overwrite && !parsed.data.force) {
    return jsonError("conflict", "Need overwrite/force to change url", requestId, 409);
  }

  const cfg = getConfig(env);
  let nextUrl = existing.url;
  if (parsed.data.url) {
    try {
      nextUrl = canonicalizeUrl(parsed.data.url, env, {
        stripTrailingSlash: cfg.stripTrailingSlash,
        maxLength: cfg.maxUrlLength,
      });
    } catch (err) {
      return jsonError("bad_request", mapError(err), requestId, 400);
    }
  }

  const next: typeof existing = {
    ...existing,
    url: nextUrl,
    disabled: parsed.data.disabled ?? existing.disabled,
    expiresAt: parsed.data.expiresAt
      ? Date.parse(parsed.data.expiresAt)
      : parsed.data.ttl
        ? Date.now() + parsed.data.ttl * 1000
        : existing.expiresAt,
    updatedAt: Date.now(),
  };

  await saveLink(env.LINKS, next);
  return json({
    slug: next.slug,
    url: next.url,
    createdAt: next.createdAt,
    updatedAt: next.updatedAt,
    createdBy: next.createdBy,
    expiresAt: next.expiresAt,
    disabled: Boolean(next.disabled),
    customSlug: Boolean(next.customSlug),
    requestId,
  });
}

async function handleDeleteLink(slug: string, env: WorkerEnv, requestId: string, request: Request): Promise<Response> {
  const unauthorized = await ensureAuthorized(request, env, requestId);
  if (unauthorized) return unauthorized;

  const hard = request.url.includes("hard=true");
  if (!validateSlug(slug)) {
    return jsonError("bad_request", "Invalid slug", requestId, 400);
  }

  const existing = await getLink(env.LINKS, slug, true, true);
  if (!existing) {
    return jsonError("not_found", "Link not found", requestId, 404);
  }

  if (hard) {
    await hardDeleteLink(env.LINKS, slug);
    return json({ slug, deleted: true, hard, requestId });
  }

  await putExpiredOrDisabled(env.LINKS, slug);
  return json({ slug, disabled: true, requestId });
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const requestId = requestIdFromReq(request);
    const url = new URL(request.url);
    const pathname = url.pathname;
    const normalizedPath = pathname === "/" ? "/" : pathname.replace(/\/$/, "");

    try {
      if (normalizedPath === "/" && (request.method === "GET" || request.method === "HEAD")) {
        return html(LANDING_HTML, { status: 200 });
      }

      if (normalizedPath === "/health") {
        return json({ ok: true, requestId });
      }

      if (normalizedPath === "/api/shorten") {
        if (request.method !== "POST") {
          return jsonError("method_not_allowed", "Method not allowed", requestId, 405);
        }
        return handleShorten(request, env, requestId);
      }

      if (normalizedPath.startsWith("/api/link/")) {
        const slug = extractSlug(normalizedPath.slice("/api/link/".length));
        if (!slug) {
          return jsonError("bad_request", "Slug is required", requestId, 400);
        }
        if (request.method === "GET") {
          return handleGetLink(slug, env, requestId, request);
        }
        if (request.method === "PUT") {
          return handleUpdateLink(slug, env, requestId, request);
        }
        if (request.method === "DELETE") {
          return handleDeleteLink(slug, env, requestId, request);
        }
        return jsonError("method_not_allowed", "Method not allowed", requestId, 405);
      }

      if (request.method === "GET" || request.method === "HEAD") {
        const slug = extractSlug(normalizedPath);
        if (!slug || slug === "api" || slug === "health") {
          return jsonError("not_found", "Not found", requestId, 404);
        }

        const link = await getLink(env.LINKS, slug, false, false);
        if (!link) {
          return jsonError("not_found", "Not found", requestId, 404);
        }
        return Response.redirect(link.url, 302);
      }

      return new Response("Not found", { status: 404 });
    } catch (error) {
      return jsonError("internal_error", mapError(error), requestId, 500);
    }
  },
};
