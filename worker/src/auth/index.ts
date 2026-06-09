import type { WorkerEnv } from "../env";
import { getConfig, type TrustMode } from "../env";

export type ApiRole = "admin" | "writer" | "reader";

export interface ApiActor {
  id: string;
  role: ApiRole;
  requestApiKey: string;
}

function extractOrigin(value: string | null): string {
  if (!value) return "";
  try {
    return new URL(value).origin.toLowerCase();
  } catch {
    return "";
  }
}

function hashLegacy(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function safeEquals(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return diff === 0;
}

function parseApiKeys(raw: string | undefined): Array<{ id: string; role: ApiRole; secret?: string; secret_hash?: string }> {
  try {
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry: any) => entry && typeof entry.id === "string")
      .map((entry: any) => ({
        id: String(entry.id),
        role: entry.role === "reader" ? "reader" : entry.role === "admin" ? "admin" : "writer",
        secret: typeof entry.secret === "string" ? entry.secret : undefined,
        secret_hash: typeof entry.secret_hash === "string" ? entry.secret_hash : undefined,
      }));
  } catch {
    return [];
  }
}

export function getApiKey(request: Request): string {
  return request.headers.get("X-API-Key") || "";
}

export function getActorIdFromKey(key: string): string {
  return key ? `key-${hashLegacy(key).slice(0, 10)}` : "anonymous";
}

export function isAllowedRequestOrigin(request: Request, allowedOrigins: string[], allowNoOrigin: boolean): boolean {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const integrationFlag = request.headers.get("X-Integration") === "true";
  const candidate = extractOrigin(origin || "") || extractOrigin(referer || "");

  if (!candidate) {
    return (allowNoOrigin || integrationFlag) || false;
  }

  if (candidate.startsWith("chrome-extension://")) {
    return true;
  }

  if (!allowedOrigins.length) {
    return true;
  }

  return allowedOrigins.includes(candidate);
}

export async function authenticateRequest(request: Request, env: WorkerEnv): Promise<ApiActor | null> {
  const key = getApiKey(request);
  if (!key) {
    return null;
  }

  const configuredKeys = parseApiKeys(env.API_KEYS_JSON);
  if (configuredKeys.length) {
    const keyId = request.headers.get("X-API-Key-Id") || "";
    if (!keyId) {
      return null;
    }

    const match = configuredKeys.find((item) => item.id === keyId);
    if (!match) {
      return null;
    }

    if (match.secret_hash) {
      const hashed = hashLegacy(key);
      if (safeEquals(hashed, match.secret_hash)) {
        return { id: match.id, role: match.role, requestApiKey: key };
      }
      return null;
    }

    if (match.secret && safeEquals(key, match.secret)) {
      return { id: match.id, role: match.role, requestApiKey: key };
    }
    return null;
  }

  if (Boolean(env.API_KEY) && safeEquals(key, env.API_KEY)) {
    return {
      id: getActorIdFromKey(key),
      role: "admin",
      requestApiKey: key,
    };
  }

  return null;
}

export function hasPermission(actor: ApiActor | null, operation: string, configMode: TrustMode): boolean {
  if (!actor) return false;

  const isReadOnly = configMode === "readonly";
  const isReadOnlyCreate = configMode === "readonly-create";

  if (isReadOnlyCreate && operation !== "shorten" && operation !== "redirect") {
    return false;
  }

  if (
    isReadOnly &&
    operation !== "read_link" &&
    operation !== "read_links" &&
    operation !== "stats" &&
    operation !== "events" &&
    operation !== "redirect"
  ) {
    return false;
  }

  if (actor.role === "admin") {
    return true;
  }

  if (actor.role === "writer") {
    return (
      operation === "shorten" ||
      operation === "read_link" ||
      operation === "manage_link" ||
      operation === "read_links"
    );
  }

  return operation === "read_link" || operation === "read_links" || operation === "redirect";
}
