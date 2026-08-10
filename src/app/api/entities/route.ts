import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { withWorkspace, type WorkspaceScope } from "@/lib/auth/withWorkspace";
import { createEntity, listEntities } from "@/domains/entities/handlers";

export const GET = withWorkspace(async function (
  _req: Request,
  { workspaceId, supabase }: WorkspaceScope
) {
  const entities = await listEntities(supabase, workspaceId);
  return NextResponse.json({ entities });
});

export const POST = withWorkspace(async function (
  req: Request,
  { workspaceId, supabase }: WorkspaceScope
) {
  try {
    const body = await req.json();
    const entity = await createEntity(supabase, workspaceId, body);
    return NextResponse.json({ entity }, { status: 201 });
  } catch (e) {
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
