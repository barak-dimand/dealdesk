import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import type { LOISection, LOITerm } from "@/types";

// GET — all LOI versions for this deal, oldest first
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: dealId } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createAdminClient();
  const { data: versions, error } = await supabase
    .from("deal_loi_versions")
    .select("*")
    .eq("deal_id", dealId)
    .order("version_number", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ versions: versions ?? [] });
}

// POST — create a new version
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: dealId } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    sections?: LOISection[];
    terms?: LOITerm[];
    source?: "chat" | "ai_generated" | "manual";
    label?: string;
  };
  if (!Array.isArray(body.sections) || !Array.isArray(body.terms)) {
    return NextResponse.json(
      { error: "sections and terms are required" },
      { status: 400 }
    );
  }

  const supabase = await createAdminClient();

  const { count } = await supabase
    .from("deal_loi_versions")
    .select("id", { count: "exact", head: true })
    .eq("deal_id", dealId);

  const versionNumber = (count ?? 0) + 1;
  const source = body.source ?? "ai_generated";
  const label =
    body.label ??
    `v${versionNumber} · ${source === "chat" ? "From chat" : source === "manual" ? "Manual" : "AI generated"}`;

  const { data: version, error } = await supabase
    .from("deal_loi_versions")
    .insert({
      deal_id: dealId,
      version_number: versionNumber,
      label,
      source,
      sections: body.sections,
      terms: body.terms,
      loi_state: "draft",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ version });
}
