import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";

async function getWorkspaceId(supabase: Awaited<ReturnType<typeof createAdminClient>>, userId: string) {
  const { data } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_clerk_id", userId)
    .single();
  return data?.id as string | undefined;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createAdminClient();
  const workspaceId = await getWorkspaceId(supabase, userId);
  if (!workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 404 });

  const { data: deal, error } = await supabase
    .from("deals")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .single();

  if (error || !deal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [documents, units, dataFields, messages, offerStructures, recResult] =
    await Promise.all([
      supabase
        .from("deal_documents")
        .select("*")
        .eq("deal_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("deal_units")
        .select("*")
        .eq("deal_id", id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("deal_data_fields")
        .select("*")
        .eq("deal_id", id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("deal_messages")
        .select("*")
        .eq("deal_id", id)
        .order("created_at", { ascending: true }),
      supabase
        .from("deal_offer_structures")
        .select("*")
        .eq("deal_id", id)
        .order("created_at", { ascending: true }),
      supabase
        .from("deal_recommendations")
        .select("*")
        .eq("deal_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  return NextResponse.json({
    deal,
    documents: documents.data ?? [],
    units: units.data ?? [],
    dataFields: dataFields.data ?? [],
    messages: messages.data ?? [],
    offerStructures: offerStructures.data ?? [],
    recommendation: recResult.data ?? null,
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const supabase = await createAdminClient();
  const workspaceId = await getWorkspaceId(supabase, userId);
  if (!workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 404 });

  const { data: deal, error } = await supabase
    .from("deals")
    .update(body)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deal });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createAdminClient();
  const workspaceId = await getWorkspaceId(supabase, userId);
  if (!workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 404 });

  await supabase.from("deals").delete().eq("id", id).eq("workspace_id", workspaceId);
  return NextResponse.json({ success: true });
}
