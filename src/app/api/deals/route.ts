import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";

async function getOrCreateWorkspace(supabase: Awaited<ReturnType<typeof createAdminClient>>, clerkUserId: string) {
  const { data: existing } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_clerk_id", clerkUserId)
    .single();

  if (existing) return existing.id;

  const { data: created, error: insertError } = await supabase
    .from("workspaces")
    .insert({ name: "My Workspace", owner_clerk_id: clerkUserId })
    .select("id")
    .single();

  if (insertError) console.error("[workspace insert error]", insertError);
  return created?.id;
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createAdminClient();
  const workspaceId = await getOrCreateWorkspace(supabase, userId);
  if (!workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 500 });

  const { data: deals, error } = await supabase
    .from("deals")
    .select(`
      *,
      deal_documents(count)
    `)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Attach document counts
  const enriched = await Promise.all(
    (deals ?? []).map(async (deal) => {
      const { count: totalCount } = await supabase
        .from("deal_documents")
        .select("id", { count: "exact", head: true })
        .eq("deal_id", deal.id);

      const { count: parsedCount } = await supabase
        .from("deal_documents")
        .select("id", { count: "exact", head: true })
        .eq("deal_id", deal.id)
        .eq("status", "parsed");

      return {
        ...deal,
        document_count: totalCount ?? 0,
        parsed_document_count: parsedCount ?? 0,
      };
    })
  );

  return NextResponse.json({ deals: enriched });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const supabase = await createAdminClient();
  const workspaceId = await getOrCreateWorkspace(supabase, userId);
  if (!workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 500 });

  const { data: deal, error } = await supabase
    .from("deals")
    .insert({
      workspace_id: workspaceId,
      name: body.name,
      address: body.address ?? null,
      city: body.city ?? null,
      state: body.state ?? null,
      deal_type: body.deal_type ?? "multifamily",
      status: body.status ?? "evaluating",
      asking_price: body.asking_price ?? null,
      unit_count: body.unit_count ?? null,
      sqft: body.sqft ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ deal }, { status: 201 });
}
