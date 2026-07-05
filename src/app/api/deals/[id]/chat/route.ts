import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

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
        .select("field_label, field_value, field_value_numeric, category, ai_note")
        .eq("deal_id", dealId)
        .in("category", ["income", "expense", "summary"]),
      supabase
        .from("deal_units")
        .select("unit_number, unit_type, current_rent, market_rent, status, tenant_notes")
        .eq("deal_id", dealId),
      supabase
        .from("deal_units")
        .select("unit_number, unit_type, current_rent, market_rent, status")
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

  const systemPrompt = `You are an expert real estate investment analyst and advisor named "AI Analyst" for the platform Dealdesk.
You specialize in creative finance, seller finance, subject-to, wrap mortgages, and no/low-money-down deal structuring.
You help investors analyze deals, identify risks, structure creative offers, and maximize returns.

CURRENT DEAL: ${deal.name}
Type: ${deal.deal_type}
Status: ${deal.status}
${deal.city ? `Location: ${deal.city}, ${deal.state}` : ""}
${deal.unit_count ? `Units: ${deal.unit_count}` : ""}
${askingDollars ? `Asking price: $${askingDollars.toLocaleString()}` : ""}

DOCUMENTS IN THIS DEAL (${docs.length} total):
${docs.map((d) => `- ${d.name} [${d.file_type}] — ${d.status}`).join("\n")}

FINANCIAL SUMMARY:
Gross income: $${grossIncome.toLocaleString()}/yr
Total expenses: $${totalExpenses.toLocaleString()}/yr
Reported NOI: $${reportedNOI.toLocaleString()}/yr
${askingDollars && reportedNOI > 0 ? `Cap rate @ ask: ${((reportedNOI / askingDollars) * 100).toFixed(1)}%` : ""}

INCOME ITEMS:
${incomeFields.map((f) => `- ${f.field_label}: $${(f.field_value_numeric ?? 0).toLocaleString()}/yr`).join("\n")}

EXPENSE ITEMS:
${expenseFields.map((f) => `- ${f.field_label}: $${(f.field_value_numeric ?? 0).toLocaleString()}/yr${f.ai_note ? ` ⚑ ${f.ai_note}` : ""}`).join("\n")}

RENT ROLL SUMMARY:
In-place monthly rent: $${totalCurrentRent.toLocaleString()}/mo ($${(totalCurrentRent * 12).toLocaleString()}/yr)
Market monthly rent: $${totalMarketRent.toLocaleString()}/mo ($${(totalMarketRent * 12).toLocaleString()}/yr)
Rent upside: $${((totalMarketRent - totalCurrentRent) * 12).toLocaleString()}/yr
Units:
${(unitsResult.data ?? []).slice(0, 20).map((u) => `- Unit ${u.unit_number} (${u.unit_type ?? "?"}): $${(u.current_rent ?? 0) / 100}/mo in-place, $${(u.market_rent ?? 0) / 100}/mo market, ${u.status}`).join("\n")}

${offers.length > 0 ? `CURRENT OFFER STRUCTURES:
${offers.map((o) => `- ${o.name}: $${(o.purchase_price ?? 0) / 100} ask, $${(o.annual_debt_service ?? 0) / 100}/yr debt service, $${(o.net_cash_flow ?? 0) / 100}/yr NCF, ${o.dscr}x DSCR`).join("\n")}` : ""}

${summaryFields.length > 0 ? `OTHER METRICS:
${summaryFields.map((f) => `- ${f.field_label}: ${f.field_value}`).join("\n")}` : ""}

GUIDELINES FOR RESPONSES:
- Be direct and specific — use actual numbers from the deal data
- Flag data quality issues (e.g., if expenses seem elevated, explain why)
- For offer structuring: focus on creative finance, seller finance, and minimum capital structures
- Always show: debt service, cash to close, net cash flow, and DSCR for any structure
- If asked to draft a document (offer letter, LOI, email), write the full draft
- You can update the spreadsheet by noting "I recommend updating [field] to [value]"
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

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (e) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ delta: { text: "Sorry, I encountered an error. Please try again." } })}\n\n`
          )
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        fullContent = "Error processing request.";
      }

      // Save assistant message
      await supabase.from("deal_messages").insert({
        deal_id: dealId,
        role: "assistant",
        content: fullContent,
      });

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
