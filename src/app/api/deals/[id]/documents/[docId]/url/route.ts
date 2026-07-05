import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const { id: dealId, docId } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createAdminClient();

  const { data: doc } = await supabase
    .from("deal_documents")
    .select("storage_path, deal_id")
    .eq("id", docId)
    .eq("deal_id", dealId)
    .single();

  if (!doc?.storage_path) {
    return NextResponse.json({ url: null });
  }

  const { data } = await supabase.storage
    .from("deal-documents")
    .createSignedUrl(doc.storage_path, 120);

  return NextResponse.json({ url: data?.signedUrl ?? null });
}
