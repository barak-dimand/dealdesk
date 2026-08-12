import { z } from "zod";
import { pgTimestamptz } from "@/lib/schema/timestamp";

/**
 * General-purpose document table, separate from `deal_documents` (ADR-0009).
 * `property_id` / `unit_id` / `lease_id` stay plain nullable uuids — no FK
 * yet, those tables don't exist until Phase 1 Tasks 2-4.
 */
export const documentSource = z.enum([
  "upload",
  "email",
  "whatsapp",
  "buildium",
  "portal",
  "settlement",
  "manual",
]);
export type DocumentSource = z.infer<typeof documentSource>;

export const documentSchema = z.object({
  id: z.uuid(),
  workspace_id: z.uuid(),
  name: z.string().min(1),
  file_type: z.string().min(1),
  storage_path: z.string().nullable(),
  file_size: z.number().int().nullable(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/, "Expected a hex-encoded sha256 digest"),
  source: documentSource,
  raw_text: z.string().nullable(),
  parse_confidence: z.string().nullable(),
  parse_warnings: z.array(z.string()),
  parsed_at: pgTimestamptz.nullable(),
  property_id: z.uuid().nullable(),
  unit_id: z.uuid().nullable(),
  lease_id: z.uuid().nullable(),
  counterparty_id: z.uuid().nullable(),
  deal_id: z.uuid().nullable(),
  created_at: pgTimestamptz,
});
export type Document = z.infer<typeof documentSchema>;

/**
 * Metadata accompanying an upload — everything the client supplies.
 * `sha256`, `storage_path`, and `file_size` are computed server-side from the
 * uploaded bytes, never trusted from the client (see handlers.ts).
 */
export const createDocumentMeta = z.object({
  name: z.string().min(1),
  file_type: z.string().min(1),
  source: documentSource.default("upload"),
  counterparty_id: z.uuid().nullable().default(null),
  deal_id: z.uuid().nullable().default(null),
});
export type CreateDocumentMeta = z.infer<typeof createDocumentMeta>;
