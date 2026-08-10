import { NextResponse } from "next/server";
import { withWorkspace, type WorkspaceScope } from "@/lib/auth/withWorkspace";

export const POST = withWorkspace(async function (
  req: Request,
  { params, workspaceId, supabase }: WorkspaceScope & {
    params: Promise<{ id: string }>;
  }
) {
  const { id } = await params;
  const body = await req.json();

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
});
