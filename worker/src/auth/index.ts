import type { WorkerEnv } from "../env";

function extractOrigin(value: string | null): string {
  if (!value) return "";
  try {
    return new URL(value).origin.toLowerCase();
  } catch {
    return "";
  }
}

export function getApiKey(request: Request, env: WorkerEnv): string {
  return request.headers.get("X-API-Key") || "";
}

export function isAuthenticatedKey(provided: string, env: WorkerEnv): boolean {
  return Boolean(env.API_KEY) && provided === env.API_KEY;
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
