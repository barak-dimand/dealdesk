import { createHash } from "crypto";
import type { SupabaseAdminClient } from "@/lib/auth/withWorkspace";
import { createDocumentMeta, documentSchema, type Document } from "./schema";

export function sha256Hex(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export class DuplicateDocumentError extends Error {
  constructor() {
    super("A document with this content already exists in this workspace.");
    this.name = "DuplicateDocumentError";
  }
}

export async function listDocuments(
  supabase: SupabaseAdminClient,
  workspaceId: string
): Promise<Document[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return documentSchema.array().parse(data ?? []);
}

/**
 * `file` is the uploaded content already read into memory by the route
 * handler; `storagePath` is null if the storage upload itself failed (the
 * document row is still created, matching the existing deal_documents
 * convention of degrading gracefully rather than losing the upload).
 */
export async function createDocument(
  supabase: SupabaseAdminClient,
  workspaceId: string,
  meta: unknown,
  file: { buffer: Buffer; storagePath: string | null }
): Promise<Document> {
  const parsedMeta = createDocumentMeta.parse(meta);
  const sha256 = sha256Hex(file.buffer);

  // Explicit pre-check gives a clean 409 instead of a raw constraint error.
  // The DB's unique(workspace_id, sha256) constraint (0005_documents.sql)
  // remains the actual backstop against the race between this check and the
  // insert below.
  const { data: existing } = await supabase
    .from("documents")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("sha256", sha256)
    .maybeSingle();

  if (existing) throw new DuplicateDocumentError();

  const { data, error } = await supabase
    .from("documents")
    .insert({
      ...parsedMeta,
      workspace_id: workspaceId,
      storage_path: file.storagePath,
      file_size: file.buffer.byteLength,
      sha256,
      // Explicit, not left to DB defaults — raw_text/parse_confidence/parsed_at
      // and property_id/unit_id/lease_id are populated later, by the parsing
      // pipeline (Task 5) and by Tasks 2-4 respectively, not at upload time.
      raw_text: null,
      parse_confidence: null,
      parse_warnings: [],
      parsed_at: null,
      property_id: null,
      unit_id: null,
      lease_id: null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") throw new DuplicateDocumentError();
    throw new Error(error.message);
  }
  return documentSchema.parse(data);
}
