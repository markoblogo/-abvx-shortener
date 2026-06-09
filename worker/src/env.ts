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
}

export interface ResolvedConfig {
  rateLimitWindowSec: number;
  rateLimitMax: number;
  allowedOrigins: string[];
  allowNoOrigin: boolean;
  stripTrailingSlash: boolean;
  maxUrlLength: number;
  defaultTtlSeconds: number;
}

export function getConfig(env: WorkerEnv): ResolvedConfig {
  const rateLimitWindowSec = Number(env.RATE_LIMIT_WINDOW_SEC ?? "60");
  const rateLimitMax = Number(env.RATE_LIMIT_MAX ?? "30");
  const allowedOrigins = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean)
    .map((v) => v.replace(/\/$/, ""));
  const allowNoOrigin = env.ALLOW_NO_ORIGIN === "1" || env.ALLOW_NO_ORIGIN === "true";
  const stripTrailingSlash = env.STRIP_TRAILING_SLASH !== "false";
  const maxUrlLength = Number(env.MAX_URL_LENGTH ?? "2048");
  const defaultTtlSeconds = Number(env.DEFAULT_TTL_SECONDS ?? "0");

  return {
    rateLimitWindowSec: Number.isFinite(rateLimitWindowSec) && rateLimitWindowSec > 0 ? rateLimitWindowSec : 60,
    rateLimitMax: Number.isFinite(rateLimitMax) && rateLimitMax > 0 ? rateLimitMax : 30,
    allowedOrigins,
    allowNoOrigin,
    stripTrailingSlash,
    maxUrlLength: Number.isFinite(maxUrlLength) && maxUrlLength > 0 ? maxUrlLength : 2048,
    defaultTtlSeconds: Number.isFinite(defaultTtlSeconds) && defaultTtlSeconds >= 0 ? defaultTtlSeconds : 0,
  };
}
