import { z } from "zod";

export const shortenRequestSchema = z.object({
  url: z.string().trim().min(1, "url is required").max(8192, "url is too long"),
  customSlug: z.string().trim().min(3, "customSlug too short").max(64, "customSlug too long").regex(/^[a-zA-Z0-9_-]+$/u, "customSlug format").optional(),
  overwrite: z.boolean().optional().default(false),
  force: z.boolean().optional().default(false),
  ttl: z
    .number({ invalid_type_error: "ttl must be number" })
    .int("ttl must be integer")
    .positive("ttl must be positive")
    .max(60 * 60 * 24 * 365, "ttl is too long")
    .optional(),
  expiresAt: z.string().datetime().optional(),
  redirectType: z.enum(["302", "301"]).optional(),
  fallbackUrl: z.string().trim().max(2048, "fallbackUrl is too long").optional(),
  private: z.boolean().optional().default(false),
  privateTokenRequired: z.boolean().optional(),
  visibility: z.enum(["public", "private"]).optional(),
});

export const updateLinkRequestSchema = z
  .object({
    url: z.string().trim().min(1, "url is required").max(8192, "url is too long").optional(),
    overwrite: z.boolean().optional().default(false),
    force: z.boolean().optional().default(false),
    disabled: z.boolean().optional(),
    ttl: z
      .number({ invalid_type_error: "ttl must be number" })
      .int("ttl must be integer")
      .positive("ttl must be positive")
      .max(60 * 60 * 24 * 365, "ttl is too long")
      .optional(),
    expiresAt: z.string().datetime().optional(),
    redirectType: z.enum(["302", "301"]).optional(),
    fallbackUrl: z.string().trim().max(2048, "fallbackUrl is too long").optional(),
    private: z.boolean().optional(),
    privateTokenRequired: z.boolean().optional(),
    visibility: z.enum(["public", "private"]).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.url === undefined && data.disabled === undefined && data.ttl === undefined && data.expiresAt === undefined && data.redirectType === undefined && data.fallbackUrl === undefined && data.private === undefined && data.privateTokenRequired === undefined && data.visibility === undefined) {
      ctx.addIssue({ code: "custom", path: ["url"], message: "Provide at least one field" });
    }
  });

export const listLinksQuerySchema = z.object({
  cursor: z.string().trim().optional(),
  limit: z
    .string()
    .transform((value) => Number(value))
    .pipe(z.number().int().positive().max(200).default(50))
    .optional(),
  disabled: z
    .string()
    .transform((value) => value === "true")
    .pipe(z.boolean())
    .optional(),
  expired: z
    .string()
    .transform((value) => value === "true")
    .pipe(z.boolean())
    .optional(),
  customSlug: z
    .string()
    .transform((value) => value === "true")
    .pipe(z.boolean())
    .optional(),
  createdBy: z.string().trim().min(1).optional(),
  q: z.string().trim().min(1).optional(),
});

export const bulkLinkActionSchema = z.object({
  action: z.enum(["disable", "restore", "delete"]),
  slugs: z.array(z.string().trim().min(1, "slug is required").max(64, "slug too long")).min(1, "slugs required"),
  dryRun: z.boolean().default(false),
});

export const statsQuerySchema = z.object({
  window: z.enum(["minute", "hour", "day"]).default("minute"),
  since: z
    .string()
    .datetime()
    .transform((value) => Date.parse(value))
    .refine((value) => Number.isFinite(value), { message: "Invalid since value" })
    .optional(),
  until: z
    .string()
    .datetime()
    .transform((value) => Date.parse(value))
    .refine((value) => Number.isFinite(value), { message: "Invalid until value" })
    .optional(),
});

export const eventsQuerySchema = z.object({
  cursor: z.string().trim().optional(),
  limit: z
    .string()
    .transform((value) => Number(value))
    .pipe(z.number().int().positive().max(200).default(50))
    .optional(),
  type: z.enum(["create", "update", "delete", "soft-delete", "restore"]).optional(),
});

export const exportQuerySchema = z.object({
  format: z.enum(["json", "csv"]).default("json"),
  limit: z
    .string()
    .transform((value) => Number(value))
    .pipe(z.number().int().positive().max(5000).default(1000))
    .optional(),
  disabled: z
    .string()
    .transform((value) => value === "true")
    .pipe(z.boolean())
    .optional(),
  expired: z
    .string()
    .transform((value) => value === "true")
    .pipe(z.boolean())
    .optional(),
  customSlug: z
    .string()
    .transform((value) => value === "true")
    .pipe(z.boolean())
    .optional(),
  createdBy: z.string().trim().min(1).optional(),
  q: z.string().trim().min(1).optional(),
  cursor: z.string().trim().optional(),
});

export type ShortenInput = z.infer<typeof shortenRequestSchema>;
export type UpdateLinkInput = z.infer<typeof updateLinkRequestSchema>;
export type ListLinksQuery = z.infer<typeof listLinksQuerySchema>;
export type BulkLinkInput = z.infer<typeof bulkLinkActionSchema>;
export type StatsQuery = z.infer<typeof statsQuerySchema>;
export type EventsQuery = z.infer<typeof eventsQuerySchema>;
export type ExportQuery = z.infer<typeof exportQuerySchema>;
