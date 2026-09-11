import { z } from "zod";

export const UNLOCK_DELAY_SECONDS = [60, 3600, 86400, 604800] as const;

const emptyToNull = (value: string | undefined) =>
  value === undefined || value.trim() === "" ? null : value;

export const createCapsuleSchema = z.strictObject({
  title: z.string().trim().min(1).max(120),
  note: z.string().max(1000).optional().transform(emptyToNull),
  probability: z.number().int().min(0).max(100),
  unlockDelaySeconds: z.union([
    z.literal(60),
    z.literal(3600),
    z.literal(86400),
    z.literal(604800),
  ]),
});

export const resolveCapsuleSchema = z.strictObject({
  outcome: z.boolean(),
  reflection: z.string().max(500).optional().transform(emptyToNull),
});

// Postgres accepts any 8-4-4-4-12 hex UUID; match that rather than RFC-4122
// variant rules so well-formed ids never produce a database error.
export const capsuleIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/);

export type CreateCapsuleInput = z.infer<typeof createCapsuleSchema>;
export type ResolveCapsuleInput = z.infer<typeof resolveCapsuleSchema>;
