import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { extractTextFromFile } from "@/lib/parsers/extractText";
import { parseDocumentWithAI } from "@/lib/ai/parseDocument";
import { generateDealNotesIfEmpty } from "@/lib/ai/generateNotes";
import { buildReparseHistory } from "@/lib/provenance";

const MAX_PROMPT_CHARS = 90000;

// For tabular types, preserve column headers + first 200 data rows per section
// rather than blindly slicing mid-row.
function smartTruncate(text: string, fileType: string): string {
  if (text.length <= MAX_PROMPT_CHARS) return text;

  if (fileType === "csv" || fileType === "xlsx") {
    const lines = text.split("\n");
    const kept: string[] = [];
    let inData = false;
    let dataRows = 0;
    let skipped = 0;

    for (const line of lines) {
      if (line.startsWith("=== Sheet:") || line.startsWith("CSV Data")) {
        // New section header — reset row counter, always include
        inData = false;
        dataRows = 0;
        kept.push(line);
      } else if (line.startsWith("-".repeat(10))) {
        // Separator line — marks start of data rows
        inData = true;
        kept.push(line);
      } else if (inData) {
        if (dataRows < 200) {
          kept.push(line);
          dataRows++;
        } else {
          skipped++;
        }
      } else {
        kept.push(line);
      }
    }

    let result = kept.join("\n");
    if (skipped > 0) {
      result += `\n[Truncated — ${skipped} additional rows not shown]`;
    }
    // Final safety clamp
    return result.length <= MAX_PROMPT_CHARS
      ? result
      : result.slice(0, MAX_PROMPT_CHARS) + "\n[Truncated]";
  }

  return text.slice(0, MAX_PROMPT_CHARS) + "\n[Truncated]";
}

function confidenceLabel(c: number): "high" | "medium" | "low" {
  if (c >= 0.75) return "high";
  if (c >= 0.45) return "medium";
  return "low";
}

function mimeTypeFromFileName(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/jpeg"; // jpg, jpeg, and fallback
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: dealId } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { documentId } = await req.json();
  const supabase = await createAdminClient();

  // Fetch the document record
  const { data: doc, error: docError } = await supabase
    .from("deal_documents")
    .select("*")
    .eq("id", documentId)
    .eq("deal_id", dealId)
    .single();

  if (docError || !doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // Mark as parsing
  await supabase
    .from("deal_documents")
    .update({ status: "parsing" })
    .eq("id", documentId);

  try {
    let rawText = doc.raw_text ?? "";

    // If we have a stored file, download and extract text
    if (!rawText && doc.storage_path) {
      const { data: fileData } = await supabase.storage
        .from("deal-documents")
        .download(doc.storage_path);

      if (fileData) {
        const buffer = Buffer.from(await fileData.arrayBuffer());

        if (doc.file_type === "image") {
          // For images, use Claude vision directly
          rawText = await extractImageWithVision(buffer, doc.name);
        } else {
          rawText = await extractTextFromFile(buffer, doc.file_type, doc.name);
        }

        // Store extracted text for future use
        await supabase
          .from("deal_documents")
          .update({ raw_text: rawText.slice(0, 100000) })
          .eq("id", documentId);
      }
    }

    if (!rawText) {
      throw new Error("Could not extract text from document");
    }

    // Get existing deal context
    const { data: existingFields } = await supabase
      .from("deal_data_fields")
      .select("field_label, field_value, category")
      .eq("deal_id", dealId)
      .limit(20);

    const context = existingFields
      ?.map((f) => `${f.category}/${f.field_label}: ${f.field_value}`)
      .join("\n");

    // Truncate intelligently before sending to Claude
    const promptText = smartTruncate(rawText, doc.file_type);

    // Parse with AI
    const parsed = await parseDocumentWithAI(
      promptText,
      doc.name,
      doc.file_type,
      context
    );

    // Persist units (rent roll) — merge by unit_number so re-parses and new
    // documents override values while preserving the audit history
    if (parsed.units.length > 0) {
      const { data: existingUnits } = await supabase
        .from("deal_units")
        .select("*")
        .eq("deal_id", dealId);
      const unitByNumber = new Map(
        (existingUnits ?? []).map((u) => [u.unit_number, u])
      );

      for (const [i, u] of parsed.units.entries()) {
        const provenance = {
          source_type: u.source_type ?? "ai_parsed",
          source_document_id: documentId,
          source_text_snippet: u.source_text_snippet?.slice(0, 200) ?? null,
          source_confidence: u.source_confidence ?? confidenceLabel(parsed.confidence),
        };
        const values = {
          unit_type: u.unit_type,
          current_rent: u.current_rent != null ? Math.round(u.current_rent * 100) : null,
          market_rent: u.market_rent != null ? Math.round(u.market_rent * 100) : null,
          status: u.status,
          lease_start: u.lease_start,
          lease_end: u.lease_end,
          tenant_notes: u.tenant_notes,
          sort_order: i,
        };

        const existing = unitByNumber.get(u.unit_number);
        if (existing) {
          const oldValue =
            existing.current_rent != null
              ? `$${(existing.current_rent / 100).toLocaleString("en-US")}/mo`
              : String(existing.status ?? "");
          await supabase
            .from("deal_units")
            .update({
              ...values,
              ...provenance,
              value_history: buildReparseHistory(
                existing,
                oldValue,
                existing.current_rent,
                doc.name
              ),
            })
            .eq("id", existing.id);
        } else {
          await supabase.from("deal_units").insert({
            deal_id: dealId,
            document_id: documentId,
            unit_number: u.unit_number,
            ...values,
            ...provenance,
            is_verified: false,
            value_history: [],
          });
        }
      }
    }

    // Persist income, expense, and summary items — merge by field_key so
    // re-parses override values while preserving the audit history (this also
    // stops duplicate rows from repeated parse runs)
    const parsedItems = [
      ...parsed.incomeItems.map((item, i) => ({ item, category: "income" as const, i })),
      ...parsed.expenseItems.map((item, i) => ({ item, category: "expense" as const, i })),
      ...parsed.summaryItems.map((item, i) => ({ item, category: "summary" as const, i })),
    ];

    if (parsedItems.length > 0) {
      const { data: allExistingFields } = await supabase
        .from("deal_data_fields")
        .select("*")
        .eq("deal_id", dealId);
      const fieldByKey = new Map(
        (allExistingFields ?? []).map((f) => [f.field_key, f])
      );

      for (const { item, category, i } of parsedItems) {
        const fieldValue =
          item.value_numeric == null
            ? null
            : category === "summary"
              ? String(item.value_numeric)
              : `$${item.value_numeric.toLocaleString()}/yr`;
        const values = {
          field_label: item.field_label,
          field_value: fieldValue,
          field_value_numeric: item.value_numeric,
          field_period: item.period,
          ai_confidence: item.confidence,
          ai_note: item.ai_note,
          sort_order: i,
        };
        const provenance = {
          source_type: item.source_type ?? "ai_parsed",
          source_document_id: documentId,
          source_text_snippet: item.source_text_snippet?.slice(0, 200) ?? null,
          source_confidence: confidenceLabel(item.confidence),
        };

        const existing = fieldByKey.get(item.field_key);
        if (existing) {
          await supabase
            .from("deal_data_fields")
            .update({
              ...values,
              ...provenance,
              document_id: documentId,
              value_history: buildReparseHistory(
                existing,
                existing.field_value ?? String(existing.field_value_numeric ?? ""),
                existing.field_value_numeric,
                doc.name
              ),
            })
            .eq("id", existing.id);
        } else {
          await supabase.from("deal_data_fields").insert({
            deal_id: dealId,
            document_id: documentId,
            category,
            field_key: item.field_key,
            ...values,
            ...provenance,
            value_history: [],
          });
        }
      }
    }

    // Count all units across this deal and update unit_count
    const { count: totalUnits } = await supabase
      .from("deal_units")
      .select("id", { count: "exact", head: true })
      .eq("deal_id", dealId);

    const extractedFieldCount =
      parsed.incomeItems.length + parsed.expenseItems.length + parsed.summaryItems.length;

    // Mark document as parsed with metadata
    await supabase
      .from("deal_documents")
      .update({
        status: "parsed",
        parsed_at: new Date().toISOString(),
        raw_text: rawText.slice(0, 100000),
        document_type: parsed.documentType,
        parse_confidence: confidenceLabel(parsed.confidence),
        parse_warnings: parsed.warnings ?? [],
        extracted_unit_count: parsed.units.length,
        extracted_field_count: extractedFieldCount,
      })
      .eq("id", documentId);

    // Update deal parsed_at and unit_count
    await supabase
      .from("deals")
      .update({
        parsed_at: new Date().toISOString(),
        unit_count: totalUnits ?? 0,
      })
      .eq("id", dealId);

    // AI-generated DD notes (skips if deal_notes already has content).
    // Awaited: fire-and-forget gets killed after the response returns on
    // serverless (and often in dev). Adds ~3-5s to an already-long parse.
    try {
      await generateDealNotesIfEmpty(supabase, dealId);
    } catch (err) {
      console.error("Notes generation failed:", err);
    }

    const parseConfidenceLabel = confidenceLabel(parsed.confidence);
    return NextResponse.json({
      success: true,
      parsed: {
        unitCount: parsed.units.length,
        incomeItems: parsed.incomeItems.length,
        expenseItems: parsed.expenseItems.length,
        fieldCount: extractedFieldCount,
        warnings: parsed.warnings,
        documentType: parsed.documentType,
        confidence: parsed.confidence,
        parse_confidence: parseConfidenceLabel,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase
      .from("deal_documents")
      .update({ status: "error", parse_error: msg })
      .eq("id", documentId);

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function extractImageWithVision(
  buffer: Buffer,
  fileName: string
): Promise<string> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const c = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const base64 = buffer.toString("base64");
  const mediaType = mimeTypeFromFileName(fileName) as
    | "image/jpeg"
    | "image/png"
    | "image/gif"
    | "image/webp";

  const response = await c.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType,
              data: base64,
            },
          },
          {
            type: "text",
            text: `This is a real estate document image called "${fileName}".
Extract ALL text, numbers, tables, and data from this image exactly as shown.
If this is a rent roll, extract each unit's number, rent, status.
If this is a financial statement, extract all line items and amounts.
Format clearly with labels and values.`,
          },
        ],
      },
    ],
  });

  return response.content[0].type === "text"
    ? response.content[0].text
    : "[Could not extract from image]";
}
