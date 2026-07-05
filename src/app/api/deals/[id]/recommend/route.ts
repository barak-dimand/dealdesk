import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { generateRecommendation } from "@/lib/ai/recommend";

// GET /api/deals/[id]/recommend — fetch stored recommendation (null if none)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = await createAdminClient();

    const { data: rec, error } = await supabase
      .from("deal_recommendations")
      .select("*")
      .eq("deal_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) console.error("[recommend GET] supabase error:", error);

    return NextResponse.json({ recommendation: rec ?? null });
  } catch (e) {
    console.error("[recommend GET] unexpected error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/deals/[id]/recommend — generate (or regenerate) recommendation
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: dealId } = await params;
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = await createAdminClient();

    // Fetch all deal data needed for generation
    let dealResult, dataFieldsResult, unitsResult;
    try {
      [dealResult, dataFieldsResult, unitsResult] = await Promise.all([
        supabase.from("deals").select("*").eq("id", dealId).single(),
        supabase.from("deal_data_fields").select("*").eq("deal_id", dealId),
        supabase.from("deal_units").select("*").eq("deal_id", dealId),
      ]);
    } catch (e) {
      console.error("[recommend POST] data fetch error:", e);
      return NextResponse.json({ error: "Failed to fetch deal data" }, { status: 500 });
    }

    const deal = dealResult.data;
    if (!deal) {
      console.error("[recommend POST] deal not found:", dealId);
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    if (dealResult.error) {
      console.error("[recommend POST] deal fetch error:", dealResult.error);
      return NextResponse.json({ error: dealResult.error.message }, { status: 500 });
    }

    const units = (unitsResult.data ?? []).map((u) => ({
      unit_number: u.unit_number as string,
      unit_type: u.unit_type as string | null,
      current_rent: u.current_rent as number | null,
      market_rent: u.market_rent as number | null,
      status: u.status as string,
    }));

    // Generate recommendation via Claude
    let result;
    try {
      result = await generateRecommendation({
        dealName: deal.name,
        address: deal.address,
        city: deal.city,
        state: deal.state,
        assetClass: deal.deal_type,
        askPrice: deal.asking_price ?? 0,
        unitCount: deal.unit_count ?? units.length,
        dataFields: (dataFieldsResult.data ?? []).map((f) => ({
          field_key: f.field_key as string,
          field_value: f.field_value as string | null,
          field_value_numeric: f.field_value_numeric as number | null,
        })),
        units,
      });
    } catch (e) {
      console.error("[recommend POST] generation error:", e);
      return NextResponse.json(
        { error: "Generation failed", detail: e instanceof Error ? e.message : String(e) },
        { status: 500 }
      );
    }

    // Replace any existing recommendation for this deal
    const { error: deleteError } = await supabase
      .from("deal_recommendations")
      .delete()
      .eq("deal_id", dealId);

    if (deleteError) {
      console.error("[recommend POST] delete error:", deleteError);
      // Non-fatal — proceed with insert
    }

    const { data: rec, error: insertError } = await supabase
      .from("deal_recommendations")
      .insert({
        deal_id: dealId,
        tier: result.tier,
        verdict: result.verdict,
        verdict_detail: result.verdict_detail,
        at_asking_price: result.at_asking_price,
        scenarios: result.scenarios,
        risk_flags: result.risk_flags,
        documents_needed: result.documents_needed,
        appreciation_case: result.appreciation_case,
        market_context: result.market_context,
        generated_at: result.generated_at,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[recommend POST] insert error:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ recommendation: rec });
  } catch (e) {
    console.error("[recommend POST] unexpected top-level error:", e);
    return NextResponse.json(
      { error: "Internal server error", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
