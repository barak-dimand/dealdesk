import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { inferFileType } from "@/lib/utils";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: dealId } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createAdminClient();
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const fileType = inferFileType(file.name, file.type);
    const storagePath = `${userId}/${dealId}/${Date.now()}-${file.name}`;

    // Upload to Supabase Storage
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: storageError } = await supabase.storage
      .from("deal-documents")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (storageError) {
      // Store without file if storage fails (e.g. bucket not created yet)
      console.error("Storage upload failed:", storageError.message);
    }

    const { data: document, error } = await supabase
      .from("deal_documents")
      .insert({
        deal_id: dealId,
        name: file.name,
        file_type: fileType,
        storage_path: storageError ? null : storagePath,
        file_size: file.size,
        status: "pending",
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ document }, { status: 201 });

  } else {
    // JSON body — pasted text
    const body = await req.json();
    const { pastedText, name } = body;

    if (!pastedText?.trim()) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    const { data: document, error } = await supabase
      .from("deal_documents")
      .insert({
        deal_id: dealId,
        name: name ?? `Pasted text · ${new Date().toLocaleDateString()}`,
        file_type: "pasted_text",
        storage_path: null,
        file_size: pastedText.length,
        raw_text: pastedText,
        status: "pending",
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ document }, { status: 201 });
  }
}
