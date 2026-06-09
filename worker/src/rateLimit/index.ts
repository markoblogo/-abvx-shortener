import type { WorkerEnv } from "../env";

function getClientIp(request: Request): string {
  return request.headers.get("CF-Connecting-IP") || "unknown";
}

function simpleHash(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) % 0xffffffff;
  }
  return Math.abs(hash).toString(16);
}

export async function rateLimitOk(env: WorkerEnv, request: Request, windowSec: number, max: number): Promise<boolean> {
  const ip = getClientIp(request);
  const key = request.headers.get("X-API-Key") || "";
  const keyId = key ? simpleHash(key) : "nokey";
  const bucket = Math.floor(Date.now() / (windowSec * 1000));
  const checks = [
    `rl:ip:${ip}:${bucket}`,
    `rl:key:${keyId}:${bucket}`,
  ];

  for (const bucketKey of checks) {
    const current = Number((await env.LINKS.get(bucketKey)) || 0);
    if (current >= max) {
      return false;
    }
    await env.LINKS.put(bucketKey, String(current + 1), { expirationTtl: windowSec + 5 });
  }

  return true;
}
