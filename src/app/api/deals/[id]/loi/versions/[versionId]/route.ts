import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import type { LOISection, LOITerm } from "@/types";

// PATCH — update a version's sections, terms, loi_state, or sent_at
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const { id: dealId, versionId } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    sections?: LOISection[];
    terms?: LOITerm[];
    loi_state?: string;
    sent_at?: string | null;
  };

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.sections !== undefined) updates.sections = body.sections;
  if (body.terms !== undefined) updates.terms = body.terms;
  if (body.loi_state !== undefined) updates.loi_state = body.loi_state;
  if (body.sent_at !== undefined) updates.sent_at = body.sent_at;

  const supabase = await createAdminClient();
  const { data: version, error } = await supabase
    .from("deal_loi_versions")
    .update(updates)
    .eq("id", versionId)
    .eq("deal_id", dealId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ version });
}
