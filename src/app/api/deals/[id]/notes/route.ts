import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: dealId } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createAdminClient();
  const { data: note } = await supabase
    .from("deal_notes")
    .select("*")
    .eq("deal_id", dealId)
    .maybeSingle();

  return NextResponse.json({ note: note ?? null });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: dealId } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { content } = (await req.json()) as { content?: string };
  if (typeof content !== "string") {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  const supabase = await createAdminClient();
  const { data: note, error } = await supabase
    .from("deal_notes")
    .upsert(
      { deal_id: dealId, content, updated_at: new Date().toISOString() },
      { onConflict: "deal_id" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ note });
}
