import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { withWorkspace, type WorkspaceScope } from "@/lib/auth/withWorkspace";
import {
  createDocument,
  listDocuments,
  DuplicateDocumentError,
} from "@/domains/documents/handlers";
import { inferFileType } from "@/lib/utils";

export const GET = withWorkspace(async function (
  _req: Request,
  { workspaceId, supabase }: WorkspaceScope
) {
  const documents = await listDocuments(supabase, workspaceId);
  return NextResponse.json({ documents });
});

export const POST = withWorkspace(async function (
  req: Request,
  { workspaceId, supabase }: WorkspaceScope
) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file" }, { status: 400 });
    }

    const source = (formData.get("source") as string | null) ?? "upload";
    const counterpartyId = (formData.get("counterparty_id") as string | null) || null;
    const dealId = (formData.get("deal_id") as string | null) || null;

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileType = inferFileType(file.name, file.type);
    const storagePath = `${workspaceId}/${Date.now()}-${file.name}`;

    const { error: storageError } = await supabase.storage
      .from("documents")
      .upload(storagePath, buffer, { contentType: file.type, upsert: false });

    if (storageError) {
      console.error("[documents] storage upload failed:", storageError.message);
    }

    const document = await createDocument(
      supabase,
      workspaceId,
      {
        name: file.name,
        file_type: fileType,
        source,
        counterparty_id: counterpartyId,
        deal_id: dealId,
      },
      { buffer, storagePath: storageError ? null : storagePath }
    );

    return NextResponse.json({ document }, { status: 201 });
  } catch (e) {
    if (e instanceof DuplicateDocumentError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: e.issues },
        { status: 400 }
      );
    }
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
