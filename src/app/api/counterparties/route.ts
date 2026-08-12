import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { withWorkspace, type WorkspaceScope } from "@/lib/auth/withWorkspace";
import { createCounterparty, listCounterparties } from "@/domains/counterparties/handlers";

export const GET = withWorkspace(async function (
  _req: Request,
  { workspaceId, supabase }: WorkspaceScope
) {
  const counterparties = await listCounterparties(supabase, workspaceId);
  return NextResponse.json({ counterparties });
});

export const POST = withWorkspace(async function (
  req: Request,
  { workspaceId, supabase }: WorkspaceScope
) {
  try {
    const body = await req.json();
    const counterparty = await createCounterparty(supabase, workspaceId, body);
    return NextResponse.json({ counterparty }, { status: 201 });
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
