import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { generateLOI } from "@/lib/ai/generateLOI";
import { sendLOIEmail } from "@/lib/email/sendLOI";
import type { LOITerm, LOISection } from "@/types";

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

// GET /api/deals/[id]/loi — fetch current LOI (null if none yet)
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

  const { data: deal } = await supabase
    .from("deals")
    .select("id")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .single();
  if (!deal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: loi } = await supabase
    .from("deal_loi")
    .select("*")
    .eq("deal_id", id)
    .maybeSingle();

  return NextResponse.json({ loi: loi ?? null });
}

// POST /api/deals/[id]/loi — generate LOI (replaces existing if present)
// Optional body: { scenario?: { purchase_price, down_payment, financed_amount, interest_rate,
//   term_years, first_payment_defer_months, has_balloon, name, structure_type } }
// When scenario is provided it becomes the recommended offer structure for LOI generation.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createAdminClient();
  const workspaceId = await getWorkspaceId(supabase, userId);
  if (!workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 404 });

  const { data: deal } = await supabase
    .from("deals")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .single();
  if (!deal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Read optional body: scenario override + buyer_entity + dd_period
  type ScenarioHint = {
    purchase_price?: number | null;
    down_payment?: number | null;
    financed_amount?: number | null;
    interest_rate?: number | null;
    term_years?: number | null;
    first_payment_defer_months?: number;
    has_balloon?: boolean;
    name?: string;
    structure_type?: string;
  };
  let scenarioHint: ScenarioHint | null = null;
  let buyerEntity: string | null = null;
  let ddPeriodDays: number | null = null;
  try {
    const body = await req.json();
    if (body?.scenario && typeof body.scenario === "object") {
      scenarioHint = body.scenario as ScenarioHint;
    }
    if (typeof body?.buyer_entity === "string" && body.buyer_entity.trim()) {
      buyerEntity = body.buyer_entity.trim();
    }
    if (typeof body?.dd_period === "number" && body.dd_period > 0) {
      ddPeriodDays = body.dd_period;
    }
  } catch { /* no body or invalid JSON — proceed without override */ }

  const [dataFieldsResult, offerStructuresResult] = await Promise.all([
    supabase.from("deal_data_fields").select("*").eq("deal_id", id),
    supabase
      .from("deal_offer_structures")
      .select("*")
      .eq("deal_id", id)
      .order("created_at", { ascending: true }),
  ]);

  // If a scenario was passed, inject it as the recommended offer structure.
  // Mark all existing DB structures as non-recommended so generateLOI picks the injected one.
  const baseStructures = (offerStructuresResult.data ?? []).map((s) => ({
    ...s,
    is_recommended: false,
  }));
  const offerStructures = scenarioHint
    ? [
        {
          structure_type: scenarioHint.structure_type ?? "seller_finance",
          name: scenarioHint.name ?? "Selected Scenario",
          purchase_price: scenarioHint.purchase_price ?? null,
          down_payment: scenarioHint.down_payment ?? null,
          financed_amount: scenarioHint.financed_amount ?? null,
          interest_rate: scenarioHint.interest_rate ?? null,
          term_years: scenarioHint.term_years ?? null,
          first_payment_defer_months: scenarioHint.first_payment_defer_months ?? 0,
          has_balloon: scenarioHint.has_balloon ?? false,
          is_recommended: true,
        },
        ...baseStructures,
      ]
    : baseStructures;

  await supabase.from("deals").update({ loi_state: "generating" }).eq("id", id);

  const { terms, sections } = await generateLOI({
    dealName: deal.name,
    dealAddress: deal.address,
    dealCity: deal.city,
    dealState: deal.state,
    contactName: deal.contact_name,
    contactEmail: deal.contact_email,
    buyerEntity,
    ddPeriodDays,
    dataFields: dataFieldsResult.data ?? [],
    offerStructures,
  });

  const { data: loi, error } = await supabase
    .from("deal_loi")
    .upsert(
      {
        deal_id: id,
        terms,
        sections,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "deal_id" }
    )
    .select()
    .single();

  if (error) {
    await supabase.from("deals").update({ loi_state: "none" }).eq("id", id);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Versioning: every generation also creates a deal_loi_versions row so
  // drafts accumulate instead of overwriting. deal_loi stays as the "current"
  // document for existing PATCH/term-sync/send consumers.
  const { count: versionCount } = await supabase
    .from("deal_loi_versions")
    .select("id", { count: "exact", head: true })
    .eq("deal_id", id);
  const versionNumber = (versionCount ?? 0) + 1;
  const { data: version } = await supabase
    .from("deal_loi_versions")
    .insert({
      deal_id: id,
      version_number: versionNumber,
      label: `v${versionNumber} · ${scenarioHint?.name ?? "AI generated"}`,
      source: "ai_generated",
      sections,
      terms,
      loi_state: "draft",
    })
    .select()
    .single();

  await supabase.from("deals").update({ loi_state: "draft" }).eq("id", id);

  return NextResponse.json({ loi, version: version ?? null });
}

// PATCH /api/deals/[id]/loi — update terms, sections, contact info, or send
// Body: { terms?, sections?, contact_name?, contact_email?, loi_state? }
// When loi_state === 'sent': creates a versioned snapshot + sets loi_sent_at on deal
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    terms?: LOITerm[];
    sections?: LOISection[];
    contact_name?: string;
    contact_email?: string;
    loi_state?: string;
    subject?: string;
    cover_note?: string;
  };

  const supabase = await createAdminClient();
  const workspaceId = await getWorkspaceId(supabase, userId);
  if (!workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 404 });

  const { data: deal } = await supabase
    .from("deals")
    .select("id, name, contact_name, contact_email")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .single();
  if (!deal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const loiUpdates: Record<string, unknown> = {};
  if (body.terms !== undefined) loiUpdates.terms = body.terms;
  if (body.sections !== undefined) loiUpdates.sections = body.sections;

  let loi = null;
  if (Object.keys(loiUpdates).length > 0) {
    const { data, error } = await supabase
      .from("deal_loi")
      .update(loiUpdates)
      .eq("deal_id", id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    loi = data;
  }

  const dealUpdates: Record<string, unknown> = {};
  if (body.contact_name !== undefined) dealUpdates.contact_name = body.contact_name;
  if (body.contact_email !== undefined) dealUpdates.contact_email = body.contact_email;
  if (body.loi_state !== undefined) dealUpdates.loi_state = body.loi_state;

  let emailSent: boolean | null = null;
  if (body.loi_state === "sent") {
    dealUpdates.loi_sent_at = new Date().toISOString();

    const { data: currentLoi } = await supabase
      .from("deal_loi")
      .select("id, terms, sections")
      .eq("deal_id", id)
      .maybeSingle();

    if (currentLoi) {
      const { count } = await supabase
        .from("deal_loi_snapshots")
        .select("id", { count: "exact", head: true })
        .eq("loi_id", currentLoi.id);

      await supabase.from("deal_loi_snapshots").insert({
        deal_id: id,
        loi_id: currentLoi.id,
        version: (count ?? 0) + 1,
        terms: currentLoi.terms,
        sections: currentLoi.sections,
        sent_at: dealUpdates.loi_sent_at,
      });
    }

    // Deliver the LOI by email — versions-only deals fall back to the latest version
    let sections: LOISection[] | null = currentLoi?.sections ?? null;
    if (!sections) {
      const { data: latestVersion } = await supabase
        .from("deal_loi_versions")
        .select("sections")
        .eq("deal_id", id)
        .order("version_number", { ascending: false })
        .limit(1)
        .maybeSingle();
      sections = latestVersion?.sections ?? null;
    }

    const toEmail = body.contact_email ?? deal.contact_email;
    if (toEmail && sections) {
      const emailResult = await sendLOIEmail({
        toEmail,
        toName: body.contact_name ?? deal.contact_name ?? "there",
        dealName: deal.name,
        subject: body.subject ?? `Letter of Intent — ${deal.name}`,
        coverNote: body.cover_note ?? "",
        sections,
      });
      emailSent = emailResult.success;
      if (!emailResult.success) {
        // LOI state is still saved — email failure is surfaced to the client
        console.error("[LOI send] email delivery failed:", emailResult.error);
      }
    } else {
      emailSent = false;
      console.error("[LOI send] missing recipient email or LOI sections — email skipped");
    }
  }

  if (Object.keys(dealUpdates).length > 0) {
    await supabase.from("deals").update(dealUpdates).eq("id", id);
  }

  if (!loi) {
    const { data } = await supabase
      .from("deal_loi")
      .select("*")
      .eq("deal_id", id)
      .maybeSingle();
    loi = data;
  }

  return NextResponse.json({ loi, emailSent });
}
