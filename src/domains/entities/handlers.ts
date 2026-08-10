import type { SupabaseAdminClient } from "@/lib/auth/withWorkspace";
import { createEntityInput, entitySchema, type Entity } from "./schema";

/**
 * Domain-first structure (BUILD.md §10): schema, handlers, and (later) rules
 * live together under src/domains/entities/. Route handlers stay thin —
 * withWorkspace() plus a call into here.
 */

export async function listEntities(
  supabase: SupabaseAdminClient,
  workspaceId: string
): Promise<Entity[]> {
  const { data, error } = await supabase
    .from("entities")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return entitySchema.array().parse(data ?? []);
}

export async function createEntity(
  supabase: SupabaseAdminClient,
  workspaceId: string,
  input: unknown
): Promise<Entity> {
  const parsed = createEntityInput.parse(input);

  const { data, error } = await supabase
    .from("entities")
    .insert({ ...parsed, workspace_id: workspaceId })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return entitySchema.parse(data);
}
