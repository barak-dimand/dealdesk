import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";

const URL_TTL_SECONDS = 3600; // 1 hour
const CACHE_TTL_MS = 55 * 60 * 1000; // regenerate 5 min before expiry

// Module-level cache so repeated provenance-popover opens don't regenerate
// the signed URL on every hover
const urlCache = new Map<
  string,
  { url: string; fileName: string; fileType: string; expiresAt: number }
>();

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const { id: dealId, docId } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cached = urlCache.get(docId);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({
      url: cached.url,
      fileName: cached.fileName,
      fileType: cached.fileType,
    });
  }

  const supabase = await createAdminClient();

  const { data: doc } = await supabase
    .from("deal_documents")
    .select("storage_path, deal_id, name, file_type")
    .eq("id", docId)
    .eq("deal_id", dealId)
    .single();

  if (!doc?.storage_path) {
    return NextResponse.json({ url: null, fileName: doc?.name ?? null, fileType: doc?.file_type ?? null });
  }

  const { data } = await supabase.storage
    .from("deal-documents")
    .createSignedUrl(doc.storage_path, URL_TTL_SECONDS);

  const url = data?.signedUrl ?? null;
  if (url) {
    urlCache.set(docId, {
      url,
      fileName: doc.name,
      fileType: doc.file_type,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
  }

  return NextResponse.json({ url, fileName: doc.name, fileType: doc.file_type });
}
