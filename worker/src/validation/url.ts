import type { WorkerEnv } from "../env";

export interface CanonicalizeOptions {
  stripTrailingSlash?: boolean;
  maxLength?: number;
}

function isLocalOrPrivateHost(host: string): boolean {
  if (!host) return true;
  const lowered = host.toLowerCase();

  if (lowered === "localhost" || lowered.endsWith(".localhost") || lowered === "::1" || lowered === "0.0.0.0") {
    return true;
  }

  if (/^127\./.test(lowered) || /^10\./.test(lowered) || /^192\.168\./.test(lowered) || /^169\.254\./.test(lowered)) {
    return true;
  }

  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(lowered)) {
    return true;
  }

  // IPv6 private/loopback heuristics
  if (lowered.startsWith("fc") || lowered.startsWith("fd") || lowered.startsWith("fe80") || lowered === "::1") {
    return true;
  }

  return false;
}

export function canonicalizeUrl(input: string, env: WorkerEnv, options: CanonicalizeOptions = {}): string {
  const raw = input.trim();
  if (!raw) {
    throw new Error("Missing URL");
  }

  const maxLen = options.maxLength ?? Number(env.MAX_URL_LENGTH ?? 2048);
  if (raw.length > maxLen) {
    throw new Error("URL is too long");
  }

  const parsed = new URL(raw);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http/https URLs are allowed");
  }

  if ((parsed.protocol === "http:" && parsed.port === "80") || (parsed.protocol === "https:" && parsed.port === "443")) {
    parsed.port = "";
  }

  if (parsed.username || parsed.password) {
    throw new Error("URL credentials are not allowed");
  }

  parsed.hash = "";
  parsed.hostname = parsed.hostname.toLowerCase();

  if (options.stripTrailingSlash !== false) {
    const path = parsed.pathname;
    if (path.length > 1 && path.endsWith("/")) {
      parsed.pathname = path.replace(/\/+$/, "");
    }
  }

  if (isLocalOrPrivateHost(parsed.hostname)) {
    throw new Error("Local/private hosts are not allowed");
  }

  return parsed.toString();
}

export function isAllowedScheme(input: string): boolean {
  const lowered = input.toLowerCase();
  return lowered.startsWith("http:") || lowered.startsWith("https:");
}
