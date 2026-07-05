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
    .from("deal_units")
    .select("id", { count: "exact", head: true })
    .eq("deal_id", id);

  const { data: unit, error } = await supabase
    .from("deal_units")
    .insert({
      deal_id: id,
      document_id: null,
      unit_number: body.unit_number,
      unit_type: body.unit_type ?? null,
      bedrooms: body.bedrooms ?? null,
      bathrooms: body.bathrooms ?? null,
      sqft: body.sqft ?? null,
      current_rent: body.current_rent ?? null,
      market_rent: body.market_rent ?? null,
      status: body.status ?? "occupied",
      lease_start: body.lease_start ?? null,
      lease_end: body.lease_end ?? null,
      tenant_notes: body.tenant_notes ?? null,
      is_verified: true,
      sort_order: (count ?? 0) + 1,
    })
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ unit }, { status: 201 });
}
