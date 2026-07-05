import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";

async function getWorkspaceId(
  supabase: Awaited<ReturnType<typeof createAdminClient>>,
  userId: string
) {
  const { data } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_clerk_id", userId)
    .single();
  return data?.id as string | undefined;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; fieldId: string }> }
) {
  const { id, fieldId } = await params;
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const supabase = await createAdminClient();
  const workspaceId = await getWorkspaceId(supabase, userId);
  if (!workspaceId)
    return NextResponse.json({ error: "No workspace" }, { status: 404 });

  const { data: deal } = await supabase
    .from("deals")
    .select("id")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .single();
  if (!deal)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: field, error } = await supabase
    .from("deal_data_fields")
    .update(body)
    .eq("id", fieldId)
    .eq("deal_id", id)
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ field });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; fieldId: string }> }
) {
  const { id, fieldId } = await params;
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createAdminClient();
  const workspaceId = await getWorkspaceId(supabase, userId);
  if (!workspaceId)
    return NextResponse.json({ error: "No workspace" }, { status: 404 });

  const { data: deal } = await supabase
    .from("deals")
    .select("id")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .single();
  if (!deal)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await supabase
    .from("deal_data_fields")
    .delete()
    .eq("id", fieldId)
    .eq("deal_id", id);

  return NextResponse.json({ success: true });
}
