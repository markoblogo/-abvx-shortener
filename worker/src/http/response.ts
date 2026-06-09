export type ErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "method_not_allowed"
  | "conflict"
  | "rate_limited"
  | "internal_error";

export interface ErrorEnvelope {
  code: ErrorCode;
  message: string;
  requestId: string;
  details?: Record<string, unknown>;
}

export interface SuccessEnvelope<TData = Record<string, unknown>> {
  ok: true;
  requestId: string;
  data: TData;
}

export interface ServiceResponse<T = Record<string, unknown>> {
  success: true;
  requestId: string;
  data: T;
}

export function requestIdFromReq(request: Request): string {
  const header = request.headers.get("cf-ray") || request.headers.get("CF-Ray");
  if (header) return header;
  return crypto.randomUUID();
}

export function json<T>(data: T, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function jsonError(code: ErrorCode, message: string, requestId: string, status: number, details?: Record<string, unknown>): Response {
  return json({ code, message, requestId, ...(details ? { details } : {}) }, { status });
}
