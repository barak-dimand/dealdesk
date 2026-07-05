import Anthropic from "@anthropic-ai/sdk";
import type { createAdminClient } from "@/lib/supabase/server";

type AdminClient = Awaited<ReturnType<typeof createAdminClient>>;

/**
 * Generates deal-specific DD notes after a successful parse and stores them
 * in deal_notes — but ONLY if no notes exist yet (never overwrites user notes).
 * Designed to be called fire-and-forget from the parse route.
 */
export async function generateDealNotesIfEmpty(
  supabase: AdminClient,
  dealId: string
): Promise<void> {
  const { data: existing } = await supabase
    .from("deal_notes")
    .select("id, content")
    .eq("deal_id", dealId)
    .maybeSingle();
  if (existing?.content && existing.content.trim() !== "") return;

  const [{ data: deal }, { data: units }, { data: fields }, { data: docs }] =
    await Promise.all([
      supabase.from("deals").select("name, address, city, state, unit_count, asking_price").eq("id", dealId).single(),
      supabase.from("deal_units").select("unit_number, unit_type, current_rent, market_rent, status, tenant_notes").eq("deal_id", dealId),
      supabase.from("deal_data_fields").select("category, field_label, field_value, ai_note").eq("deal_id", dealId),
      supabase.from("deal_documents").select("parse_warnings").eq("deal_id", dealId).eq("status", "parsed"),
    ]);
  if (!deal) return;

  const warnings = (docs ?? []).flatMap((d) => (d.parse_warnings as string[] | null) ?? []);

  const unitsSummary = (units ?? [])
    .map(
      (u) =>
        `${u.unit_number} (${u.unit_type ?? "?"}): rent ${u.current_rent != null ? `$${u.current_rent / 100}` : "n/a"}/mo, market ${u.market_rent != null ? `$${u.market_rent / 100}` : "n/a"}/mo, ${u.status}${u.tenant_notes ? ` — ${u.tenant_notes}` : ""}`
    )
    .join("\n");

  const fieldsSummary = (fields ?? [])
    .map((f) => `[${f.category}] ${f.field_label}: ${f.field_value ?? "—"}${f.ai_note ? ` (${f.ai_note})` : ""}`)
    .join("\n");

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const prompt = `You are a real estate due-diligence expert. Generate deal-specific notes for this deal.

Deal: ${deal.name}
Location: ${[deal.address, deal.city, deal.state].filter(Boolean).join(", ") || "unknown"}
Unit count: ${deal.unit_count ?? "unknown"}
Asking price: ${deal.asking_price != null ? `$${(deal.asking_price / 100).toLocaleString()}` : "unknown"}

Units:
${unitsSummary || "(no unit-level data)"}

Data fields:
${fieldsSummary || "(none)"}

Parse warnings:
${warnings.map((w) => `- ${w}`).join("\n") || "(none)"}

Produce HTML notes (h1, h2, p, ul, li tags ONLY — no markdown, no other tags) with exactly these sections:
<h1>Deal Notes — ${deal.name}</h1>
<h2>Deal Thesis</h2> — 2-3 sentences on the opportunity
<h2>Value-Add Opportunities</h2> — bullet list derived from the parsed data (rent upside, vacancy, below-market units)
<h2>Risk Flags & Mitigations</h2> — bullet list, each risk followed by a specific mitigation action
<h2>Due Diligence Checklist</h2> — deal-specific items based on what was found (e.g. elevated R&M → "Request 3yr R&M invoices"; vacant units → "Get make-ready cost estimates"), plus standard items (T12, rent roll, leases, tax bills, insurance, utility history, title)
<h2>Questions for Seller</h2> — 5-7 specific questions based on the parsed data
<h2>Negotiation Notes</h2> — deal-specific leverage points identified from the data

Respond with ONLY the HTML. No preamble, no code fences.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 3000,
    messages: [{ role: "user", content: prompt }],
  });

  let html = response.content[0].type === "text" ? response.content[0].text.trim() : "";
  // Strip code fences if the model added them anyway
  html = html.replace(/^```(?:html)?\s*/i, "").replace(/```\s*$/, "").trim();
  if (!html.startsWith("<")) return;

  await supabase
    .from("deal_notes")
    .upsert({ deal_id: dealId, content: html }, { onConflict: "deal_id" });
}
