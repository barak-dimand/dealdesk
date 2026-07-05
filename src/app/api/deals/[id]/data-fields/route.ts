import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";

async function getWorkspaceId(
  supabase: Awaited<ReturnType<typeof createAdminClient>>,
  userId: string
) {
  const { data } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_clerk_id", userId)
    .single();
  return data?.id as string | undefined;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const supabase = await createAdminClient();
  const workspaceId = await getWorkspaceId(supabase, userId);
  if (!workspaceId)
    return NextResponse.json({ error: "No workspace" }, { status: 404 });

  const { data: deal } = await supabase
    .from("deals")
    .select("id")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .single();
  if (!deal)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { count } = await supabase
    .from("deal_data_fields")
    .select("id", { count: "exact", head: true })
    .eq("deal_id", id)
    .eq("category", body.category);

  const { data: field, error } = await supabase
    .from("deal_data_fields")
    .insert({
      deal_id: id,
      document_id: null,
      category: body.category,
      field_key: body.field_key,
      field_label: body.field_label,
      field_value: body.field_value ?? null,
      field_value_numeric: body.field_value_numeric ?? null,
      field_period: body.field_period ?? "annual",
      is_verified: true,
      ai_confidence: null,
      ai_note: null,
      sort_order: (count ?? 0) + 1,
    })
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ field }, { status: 201 });
}
