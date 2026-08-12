import type { SupabaseAdminClient } from "@/lib/auth/withWorkspace";
import { createCounterpartyInput, counterpartySchema, type Counterparty } from "./schema";

export async function listCounterparties(
  supabase: SupabaseAdminClient,
  workspaceId: string
): Promise<Counterparty[]> {
  const { data, error } = await supabase
    .from("counterparties")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return counterpartySchema.array().parse(data ?? []);
}

export async function createCounterparty(
  supabase: SupabaseAdminClient,
  workspaceId: string,
  input: unknown
): Promise<Counterparty> {
  const parsed = createCounterpartyInput.parse(input);

  const { data, error } = await supabase
    .from("counterparties")
    .insert({ ...parsed, workspace_id: workspaceId })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return counterpartySchema.parse(data);
}
