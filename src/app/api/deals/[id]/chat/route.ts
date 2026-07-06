import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import { parseActionBlock } from "@/lib/parseActionBlock";
import type { ChatProposal } from "@/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: dealId } = await params;
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const { message } = await req.json();
  if (!message?.trim()) return new Response("No message", { status: 400 });

  const supabase = await createAdminClient();

  // Gather deal context
  const [dealResult, docsResult, incomeResult, expenseResult, unitsResult, offersResult, historyResult] =
    await Promise.all([
      supabase.from("deals").select("*").eq("id", dealId).single(),
      supabase
        .from("deal_documents")
        .select("name, file_type, status, parsed_at")
        .eq("deal_id", dealId)
        .order("created_at", { ascending: false }),
      supabase
        .from("deal_data_fields")
        .select("field_key, field_label, field_value, field_value_numeric, category, ai_note")
        .eq("deal_id", dealId)
        .in("category", ["income", "expense", "summary"]),
      supabase
        .from("deal_units")
        .select("id, unit_number, unit_type, current_rent, market_rent, status, tenant_notes")
        .eq("deal_id", dealId),
      supabase
        .from("deal_units")
        .select("id, unit_number, unit_type, current_rent, market_rent, status")
        .eq("deal_id", dealId),
      supabase
        .from("deal_offer_structures")
        .select("*")
        .eq("deal_id", dealId),
      supabase
        .from("deal_messages")
        .select("role, content")
        .eq("deal_id", dealId)
        .order("created_at", { ascending: true })
        .limit(20),
    ]);

  const [loiVersionsResult, pendingProposalsResult] = await Promise.all([
    supabase
      .from("deal_loi_versions")
      .select("id, label, version_number")
      .eq("deal_id", dealId)
      .order("version_number", { ascending: true }),
    supabase
      .from("deal_chat_proposals")
      .select("changes")
      .eq("deal_id", dealId)
      .eq("status", "pending"),
  ]);

  const deal = dealResult.data;
  if (!deal) return new Response("Deal not found", { status: 404 });

  // Build system context
  const docs = docsResult.data ?? [];
  const fields = incomeResult.data ?? [];
  const units = unitsResult.data ?? [];
  const offers = offersResult.data ?? [];
  const history = historyResult.data ?? [];

  const incomeFields = fields.filter((f) => f.category === "income");
  const expenseFields = fields.filter((f) => f.category === "expense");
  const summaryFields = fields.filter((f) => f.category === "summary");

  const grossIncome = incomeFields.reduce(
    (s, f) => s + (f.field_value_numeric ?? 0),
    0
  );
  const totalExpenses = expenseFields.reduce(
    (s, f) => s + (f.field_value_numeric ?? 0),
    0
  );
  const reportedNOI = grossIncome - totalExpenses;

  const totalCurrentRent =
    (unitsResult.data ?? []).reduce(
      (s, u) => s + (u.current_rent ?? 0),
      0
    ) / 100;
  const totalMarketRent =
    (unitsResult.data ?? []).reduce(
      (s, u) => s + (u.market_rent ?? 0),
      0
    ) / 100;

  const askingDollars = deal.asking_price ? deal.asking_price / 100 : null;

  const loiVersions = loiVersionsResult.data ?? [];
  const pendingProposalCount = (pendingProposalsResult.data ?? []).length;
  const latestVersionLabel =
    loiVersions.length > 0 ? loiVersions[loiVersions.length - 1].label : null;

  const systemPrompt = `You are an AI analyst and deal assistant for a real estate investment app. You
have full context of the deal's spreadsheet data, units, income, expenses, and
any existing LOI. You specialize in creative finance, seller finance, subject-to, wrap mortgages,
and no/low-money-down deal structuring.

When the user asks you to draft an LOI, create offer terms, or update any deal
data, you MUST respond with a structured JSON action block in addition to your
conversational response. Format it as:

<action>
{
  "type": "propose_changes",
  "changes": [
    {
      "id": "uuid-here",
      "type": "loi_draft|loi_term|data_field|unit|deal_status|notes",
      "label": "Human readable label",
      "oldValue": "current value or null",
      "newValue": "proposed value",
      "payload": { ... type-specific payload ... }
    }
  ]
}
</action>

Payload shapes by change type:
- loi_draft: { "loiDraft": { "sections": [{ "id", "label", "content", "sort_order" }], "terms": [{ "id", "label", "value", "value_numeric", "confidence": "verified|inferred|missing", "source", "is_required", "affected_section_ids": [] }] } } — include the FULL sections and terms
- loi_term: { "termId": "...", "termValue": "..." }
- data_field: { "fieldKey": "...", "fieldValueNumeric": 72000, "fieldValue": "$72,000/yr" } — fieldValueNumeric in the same units the field currently uses (annual dollars for income/expense/summary fields)
- unit: { "unitId": "...", "unitRent": cents, "unitStatus": "occupied|vacant|leased|credit|other" } — use the unit id from the rent roll below
- deal_status: { "dealStatus": "evaluating|off_market|marketed|under_loi|under_contract|closed|dead" }
- notes: { "notesContent": "<full HTML notes content>" }

Always write your conversational explanation BEFORE the <action> block.
The <action> block is parsed by the app — do not explain it to the user.

When the user asks about the deal, answer conversationally without an action block.
Only include action blocks when the user is asking you to make or propose a change.

CURRENT DEAL: ${deal.name}
Type: ${deal.deal_type}
Status: ${deal.status}
LOI state: ${deal.loi_state ?? "none"}
${deal.city ? `Location: ${deal.city}, ${deal.state}` : ""}
${deal.unit_count ? `Units: ${deal.unit_count}` : ""}
${askingDollars ? `Asking price: $${askingDollars.toLocaleString()}` : ""}

APP STATE:
LOI versions: ${loiVersions.length}${latestVersionLabel ? ` (latest: ${latestVersionLabel})` : ""}
Pending proposals awaiting user review: ${pendingProposalCount}${pendingProposalCount > 0 ? " — do not re-propose changes that are already pending" : ""}

DOCUMENTS IN THIS DEAL (${docs.length} total):
${docs.map((d) => `- ${d.name} [${d.file_type}] — ${d.status}`).join("\n")}

FINANCIAL SUMMARY:
Gross income: $${grossIncome.toLocaleString()}/yr
Total expenses: $${totalExpenses.toLocaleString()}/yr
Reported NOI: $${reportedNOI.toLocaleString()}/yr
${askingDollars && reportedNOI > 0 ? `Cap rate @ ask: ${((reportedNOI / askingDollars) * 100).toFixed(1)}%` : ""}

INCOME ITEMS (field_key in brackets for data_field payloads):
${incomeFields.map((f) => `- [${f.field_key}] ${f.field_label}: $${(f.field_value_numeric ?? 0).toLocaleString()}/yr`).join("\n")}

EXPENSE ITEMS (field_key in brackets for data_field payloads):
${expenseFields.map((f) => `- [${f.field_key}] ${f.field_label}: $${(f.field_value_numeric ?? 0).toLocaleString()}/yr${f.ai_note ? ` ⚑ ${f.ai_note}` : ""}`).join("\n")}

RENT ROLL SUMMARY:
In-place monthly rent: $${totalCurrentRent.toLocaleString()}/mo ($${(totalCurrentRent * 12).toLocaleString()}/yr)
Market monthly rent: $${totalMarketRent.toLocaleString()}/mo ($${(totalMarketRent * 12).toLocaleString()}/yr)
Rent upside: $${((totalMarketRent - totalCurrentRent) * 12).toLocaleString()}/yr
Units (with ids for unit-update payloads):
${(unitsResult.data ?? []).slice(0, 20).map((u) => `- [id: ${u.id}] Unit ${u.unit_number} (${u.unit_type ?? "?"}): $${(u.current_rent ?? 0) / 100}/mo in-place, $${(u.market_rent ?? 0) / 100}/mo market, ${u.status}`).join("\n")}

${offers.length > 0 ? `CURRENT OFFER STRUCTURES:
${offers.map((o) => `- ${o.name}: $${(o.purchase_price ?? 0) / 100} ask, $${(o.annual_debt_service ?? 0) / 100}/yr debt service, $${(o.net_cash_flow ?? 0) / 100}/yr NCF, ${o.dscr}x DSCR`).join("\n")}` : ""}

${summaryFields.length > 0 ? `OTHER METRICS:
${summaryFields.map((f) => `- ${f.field_label}: ${f.field_value}`).join("\n")}` : ""}

GUIDELINES FOR RESPONSES:
- Be direct and specific — use actual numbers from the deal data
- Flag data quality issues (e.g., if expenses seem elevated, explain why)
- For offer structuring: focus on creative finance, seller finance, and minimum capital structures
- Always show: debt service, cash to close, net cash flow, and DSCR for any structure
- If asked to draft a document (offer letter, LOI, email), write the full draft — for LOIs use a loi_draft action block
- To update the spreadsheet, propose the change via a data_field action block
- Keep responses concise but complete — investors are busy`;

  // Save user message
  await supabase.from("deal_messages").insert({
    deal_id: dealId,
    role: "user",
    content: message,
  });

  // Build messages array for Claude
  const claudeMessages: Anthropic.MessageParam[] = [
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: message },
  ];

  // Stream response
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let fullContent = "";

      try {
        const messageStream = await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 4096,
          system: systemPrompt,
          messages: claudeMessages,
          stream: true,
        });

        for await (const event of messageStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            const delta = event.delta.text;
            fullContent += delta;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ delta: { text: delta } })}\n\n`)
            );
          }
        }

        // Split conversational text from any <action> block
        const { message: cleanMessage, changes } = parseActionBlock(fullContent);

        // Save assistant message (clean text only — the action block lives in the proposal)
        const { data: savedMsg } = await supabase
          .from("deal_messages")
          .insert({
            deal_id: dealId,
            role: "assistant",
            content: cleanMessage || fullContent,
          })
          .select("id")
          .single();

        if (changes) {
          const { data: proposalRow } = await supabase
            .from("deal_chat_proposals")
            .insert({
              deal_id: dealId,
              message_id: savedMsg?.id ?? `msg-${Date.now()}`,
              changes,
              status: "pending",
              applied_change_ids: [],
            })
            .select()
            .single();

          if (proposalRow) {
            const proposal: ChatProposal = {
              id: proposalRow.id,
              messageId: proposalRow.message_id,
              dealId,
              changes,
              status: "pending",
              appliedChangeIds: [],
              createdAt: proposalRow.created_at,
            };
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ proposal })}\n\n`)
            );
          }
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (e) {
        console.error("Chat stream error:", e);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ delta: { text: "Sorry, I encountered an error. Please try again." } })}\n\n`
          )
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        await supabase.from("deal_messages").insert({
          deal_id: dealId,
          role: "assistant",
          content: "Error processing request.",
        });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// PATCH — persist proposal status after apply/reject
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: dealId } = await params;
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const { proposalId, status, appliedChangeIds } = (await req.json()) as {
    proposalId?: string;
    status?: string;
    appliedChangeIds?: string[];
  };
  if (!proposalId) return new Response("proposalId required", { status: 400 });

  const supabase = await createAdminClient();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (status !== undefined) updates.status = status;
  if (appliedChangeIds !== undefined) updates.applied_change_ids = appliedChangeIds;

  const { error } = await supabase
    .from("deal_chat_proposals")
    .update(updates)
    .eq("id", proposalId)
    .eq("deal_id", dealId);

  if (error) return new Response(error.message, { status: 500 });
  return Response.json({ success: true });
}
