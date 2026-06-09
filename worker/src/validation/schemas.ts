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
  })
  .superRefine((data, ctx) => {
    if (data.url === undefined && data.disabled === undefined && data.ttl === undefined && data.expiresAt === undefined) {
      ctx.addIssue({ code: "custom", path: ["url"], message: "Provide at least one field" });
    }
  });

export type ShortenInput = z.infer<typeof shortenRequestSchema>;
export type UpdateLinkInput = z.infer<typeof updateLinkRequestSchema>;
