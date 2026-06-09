export const RESERVED_SLUGS = new Set([
  "api",
  "health",
  "assets",
  "favicon.ico",
  ".well-known",
  "robots.txt",
  "robots",
  "admin",
  "internal",
  "shorten",
]);

const MIN_SLUG = 3;
const MAX_SLUG = 64;

export interface LinkRecord {
  slug: string;
  url: string;
  createdAt: number;
  updatedAt: number;
  createdBy?: string;
  expiresAt?: number;
  disabled?: boolean;
  customSlug?: boolean;
}

interface RawLinkRecord {
  slug?: unknown;
  url?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy?: unknown;
  expiresAt?: unknown;
  disabled?: unknown;
  customSlug?: unknown;
}

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function isNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isBoolean(v: unknown): v is boolean {
  return typeof v === "boolean";
}

function normalizeRecord(slug: string, input: string | null): LinkRecord | null {
  if (!input) return null;

  try {
    const parsed = JSON.parse(input) as RawLinkRecord;
    if (
      !parsed ||
      !isString(parsed.url) ||
      !parsed.slug ||
      !isString(parsed.slug) ||
      !isNumber(parsed.createdAt) ||
      !isNumber(parsed.updatedAt)
    ) {
      return null;
    }

    return {
      slug: parsed.slug,
      url: parsed.url,
      createdAt: parsed.createdAt,
      updatedAt: parsed.updatedAt,
      createdBy: isString(parsed.createdBy) ? parsed.createdBy : undefined,
      expiresAt: isNumber(parsed.expiresAt) ? parsed.expiresAt : undefined,
      disabled: isBoolean(parsed.disabled) ? parsed.disabled : false,
      customSlug: isBoolean(parsed.customSlug) ? parsed.customSlug : undefined,
    };
  } catch {
    // Legacy value: plain URL string
    return {
      slug,
      url: input,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      disabled: false,
      customSlug: false,
    };
  }
}

export function validateSlug(slug: string): boolean {
  if (slug.length < MIN_SLUG || slug.length > MAX_SLUG) return false;
  if (!/^[a-zA-Z0-9_-]+$/.test(slug)) return false;
  if (RESERVED_SLUGS.has(slug.toLowerCase())) return false;
  return true;
}

export async function getLink(namespace: KVNamespace, slug: string, includeDisabled = false, includeExpired = false): Promise<LinkRecord | null> {
  const raw = await namespace.get(slug);
  const normalized = normalizeRecord(slug, raw);
  if (!normalized) return null;

  if (!includeDisabled && normalized.disabled) {
    return null;
  }

  if (!includeExpired && normalized.expiresAt && normalized.expiresAt <= Date.now()) {
    await namespace.delete(slug);
    return null;
  }

  return normalized;
}

export async function saveLink(namespace: KVNamespace, record: LinkRecord): Promise<void> {
  await namespace.put(record.slug, JSON.stringify(record));
}

export async function putExpiredOrDisabled(namespace: KVNamespace, slug: string): Promise<void> {
  const existing = await getLink(namespace, slug, true, true);
  if (!existing) return;
  existing.disabled = true;
  existing.updatedAt = Date.now();
  await namespace.put(slug, JSON.stringify(existing));
}

export async function hardDeleteLink(namespace: KVNamespace, slug: string): Promise<void> {
  await namespace.delete(slug);
}

export async function touchLink(namespace: KVNamespace, record: LinkRecord): Promise<void> {
  const now = Date.now();
  await namespace.put(
    record.slug,
    JSON.stringify({
      ...record,
      updatedAt: now,
    }),
  );
}

export { MIN_SLUG, MAX_SLUG };
