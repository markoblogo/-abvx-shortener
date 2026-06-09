export type TrustMode = "personal" | "readonly" | "readonly-create";

export interface ApiKeyConfig {
  id: string;
  role: "admin" | "writer" | "reader";
  secret?: string;
  secret_hash?: string;
}

export interface WorkerEnv {
  LINKS: KVNamespace;
  API_KEY: string;
  BASE_URL: string;
  RATE_LIMIT_WINDOW_SEC?: string;
  RATE_LIMIT_MAX?: string;
  ALLOWED_ORIGINS?: string;
  ALLOW_NO_ORIGIN?: string;
  STRIP_TRAILING_SLASH?: string;
  MAX_URL_LENGTH?: string;
  DEFAULT_TTL_SECONDS?: string;
  TRUST_MODE?: string;
  ALLOW_URL_DOMAINS?: string;
  DENY_URL_DOMAINS?: string;
  URL_PRECHECK_URL?: string;
  URL_PRECHECK_TIMEOUT_MS?: string;
  URL_PRECHECK_FAIL_OPEN?: string;
  DEFAULT_REDIRECT_TYPE?: string;
  STATS_RETENTION_DAYS?: string;
  API_KEYS_JSON?: string;
  LINKS_INDEX_D1_URL?: string;
}

export interface ResolvedConfig {
  rateLimitWindowSec: number;
  rateLimitMax: number;
  allowedOrigins: string[];
  allowNoOrigin: boolean;
  stripTrailingSlash: boolean;
  maxUrlLength: number;
  defaultTtlSeconds: number;
  trustMode: TrustMode;
  allowUrlDomains: string[];
  denyUrlDomains: string[];
  urlPrecheckUrl: string | undefined;
  urlPrecheckTimeoutMs: number;
  urlPrecheckFailOpen: boolean;
  defaultRedirectType: "302" | "301";
  statsRetentionDays: number;
  apiKeys: ApiKeyConfig[];
}

function normalizeDomainList(raw: string): string[] {
  return raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .map((value) => value.replace(/^\./, ""));
}

function parseTrustMode(raw: string | undefined): TrustMode {
  if (raw === "readonly" || raw === "readonly-create") return raw;
  return "personal";
}

function parsePositiveInt(raw: string | undefined, fallback: number, min = 1): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < min) {
    return fallback;
  }
  return Math.floor(parsed);
}

export function getConfig(env: WorkerEnv): ResolvedConfig {
  const rateLimitWindowSec = parsePositiveInt(env.RATE_LIMIT_WINDOW_SEC, 60);
  const rateLimitMax = parsePositiveInt(env.RATE_LIMIT_MAX, 30);
  const allowedOrigins = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean)
    .map((v) => v.replace(/\/$/, ""));

  const allowUrlDomains = normalizeDomainList(env.ALLOW_URL_DOMAINS || "");
  const denyUrlDomains = normalizeDomainList(env.DENY_URL_DOMAINS || "");
  const urlPrecheckTimeoutMs = parsePositiveInt(env.URL_PRECHECK_TIMEOUT_MS, 1500, 100);
  const statsRetentionDays = parsePositiveInt(env.STATS_RETENTION_DAYS, 30, 1);

  let defaultRedirectType: "302" | "301" = "302";
  if ((env.DEFAULT_REDIRECT_TYPE || "").toLowerCase() === "301") {
    defaultRedirectType = "301";
  }

  let apiKeys: ApiKeyConfig[] = [];
  try {
    if (env.API_KEYS_JSON) {
      const parsed = JSON.parse(env.API_KEYS_JSON);
      if (Array.isArray(parsed)) {
        apiKeys = parsed
          .filter((item) => item && typeof item.id === "string" && typeof item.role === "string")
          .map((item) => ({
            id: String(item.id),
            role: item.role === "reader" ? "reader" : item.role === "admin" ? "admin" : "writer",
            secret: typeof item.secret === "string" ? item.secret : undefined,
            secret_hash: typeof item.secret_hash === "string" ? item.secret_hash : undefined,
          }))
          .filter((key) => key.id);
      }
    }
  } catch {
    apiKeys = [];
  }

  return {
    rateLimitWindowSec,
    rateLimitMax,
    allowedOrigins,
    allowNoOrigin: env.ALLOW_NO_ORIGIN === "1" || env.ALLOW_NO_ORIGIN === "true",
    stripTrailingSlash: env.STRIP_TRAILING_SLASH !== "false",
    maxUrlLength: parsePositiveInt(env.MAX_URL_LENGTH, 2048, 1),
    defaultTtlSeconds: Number.isFinite(Number(env.DEFAULT_TTL_SECONDS)) && Number(env.DEFAULT_TTL_SECONDS) >= 0 ? Number(env.DEFAULT_TTL_SECONDS) : 0,
    trustMode: parseTrustMode(env.TRUST_MODE),
    allowUrlDomains,
    denyUrlDomains,
    urlPrecheckUrl: env.URL_PRECHECK_URL,
    urlPrecheckTimeoutMs,
    urlPrecheckFailOpen: env.URL_PRECHECK_FAIL_OPEN === "1" || env.URL_PRECHECK_FAIL_OPEN === "true",
    defaultRedirectType,
    statsRetentionDays,
    apiKeys,
  };
}
