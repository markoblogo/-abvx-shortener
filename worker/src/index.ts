export interface Env {
  LINKS: KVNamespace;
  API_KEY: string;
  BASE_URL: string;
  RATE_LIMIT_WINDOW_SEC?: string;
  RATE_LIMIT_MAX?: string;
}

const encoder = new TextEncoder();

function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

function badRequest(message: string) {
  return json({ error: message }, { status: 400 });
}

function unauthorized() {
  return json({ error: "unauthorized" }, { status: 401 });
}

function notFound() {
  return json({ error: "not_found" }, { status: 404 });
}

function normalizeUrl(input: string): string {
  // Basic normalization: trim + require http/https.
  const raw = input.trim();
  const url = new URL(raw);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http/https URLs are allowed");
  }

  // Remove default ports
  if ((url.protocol === "http:" && url.port === "80") || (url.protocol === "https:" && url.port === "443")) {
    url.port = "";
  }

  // Drop hash fragment (usually not desired for sharing)
  url.hash = "";

  // Normalize hostname to lowercase
  url.hostname = url.hostname.toLowerCase();

  // Keep query as-is; keep trailing slash as-is.
  return url.toString();
}

async function sha256Base32(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  const bytes = new Uint8Array(digest);
  // base32 (RFC4648) without padding, lowercase
  const alphabet = "abcdefghijklmnopqrstuvwxyz234567";
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += alphabet[(value << (5 - bits)) & 31];
  }
  return out;
}

function getClientIp(req: Request): string {
  // Cloudflare provides CF-Connecting-IP
  return req.headers.get("CF-Connecting-IP") || "unknown";
}

async function rateLimitOk(env: Env, ip: string): Promise<boolean> {
  const windowSec = Number(env.RATE_LIMIT_WINDOW_SEC ?? "60");
  const max = Number(env.RATE_LIMIT_MAX ?? "30");

  // KV isn't perfect for strict rate limiting, but good enough for personal use.
  const key = `rl:${ip}:${Math.floor(Date.now() / (windowSec * 1000))}`;
  const curStr = await env.LINKS.get(key);
  const cur = curStr ? Number(curStr) : 0;
  if (cur >= max) return false;
  const next = cur + 1;
  await env.LINKS.put(key, String(next), { expirationTtl: windowSec + 5 });
  return true;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Health
    if (url.pathname === "/health") {
      return json({ ok: true });
    }

    // API: shorten
    if (url.pathname === "/api/shorten") {
      if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

      const key = request.headers.get("X-API-Key") || "";
      if (!env.API_KEY || key !== env.API_KEY) return unauthorized();

      const ip = getClientIp(request);
      if (!(await rateLimitOk(env, ip))) {
        return json({ error: "rate_limited" }, { status: 429 });
      }

      let body: any;
      try {
        body = await request.json();
      } catch {
        return badRequest("Invalid JSON");
      }

      const inputUrl = body?.url;
      if (typeof inputUrl !== "string" || inputUrl.trim().length === 0) {
        return badRequest("Missing 'url'");
      }

      let normalized: string;
      try {
        normalized = normalizeUrl(inputUrl);
      } catch (e: any) {
        return badRequest(e?.message || "Invalid URL");
      }

      // Deterministic slug: first 6 chars of base32(sha256(normalized))
      const hash = await sha256Base32(normalized);
      const slug = hash.slice(0, 6);

      const existing = await env.LINKS.get(slug);
      if (existing && existing !== normalized) {
        // Extremely unlikely collision; extend slug length to 10
        const slug10 = hash.slice(0, 10);
        await env.LINKS.put(slug10, normalized);
        return json({ slug: slug10, shortUrl: `${env.BASE_URL.replace(/\/$/, "")}/${slug10}` });
      }

      if (!existing) {
        await env.LINKS.put(slug, normalized);
      }

      return json({ slug, shortUrl: `${env.BASE_URL.replace(/\/$/, "")}/${slug}` });
    }

    // Redirect handler: /:slug
    if (request.method === "GET" || request.method === "HEAD") {
      const slug = url.pathname.replace(/^\//, "");
      if (!slug) return notFound();

      // disallow API paths
      if (slug.startsWith("api") || slug.startsWith("health")) {
        return notFound();
      }

      const target = await env.LINKS.get(slug);
      if (!target) return notFound();

      return Response.redirect(target, 302);
    }

    return new Response("Not Found", { status: 404 });
  }
};
