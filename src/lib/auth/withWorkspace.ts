import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Single authorization path for route handlers (ADR-0004). No handler resolves
 * workspace scope itself — that was the "getWorkspaceId() copied per route" gap.
 * RLS is documented as intentionally inert (see 0001_baseline.sql); this wrapper
 * is what actually enforces workspace isolation, since every route uses the
 * service-role client.
 *
 * Resolves through workspace_members rather than workspaces.owner_clerk_id, so
 * a second member is a row insert + role check, not a rewrite.
 */

export type SupabaseAdminClient = Awaited<ReturnType<typeof createAdminClient>>;

export interface WorkspaceScope {
  workspaceId: string;
  role: string;
  clerkUserId: string;
  supabase: SupabaseAdminClient;
}

type RouteContext = Record<string, unknown>;

type WorkspaceHandler<Ctx extends RouteContext> = (
  req: Request,
  ctx: Ctx & WorkspaceScope
) => Promise<Response>;

export function withWorkspace<Ctx extends RouteContext = RouteContext>(
  handler: WorkspaceHandler<Ctx>
) {
  return async (req: Request, routeCtx: Ctx): Promise<Response> => {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createAdminClient();
    const { data: membership, error } = await supabase
      .from("workspace_members")
      .select("workspace_id, role")
      .eq("clerk_user_id", userId)
      .single();

    if (error || !membership) {
      return NextResponse.json({ error: "No workspace" }, { status: 403 });
    }

    return handler(req, {
      ...routeCtx,
      workspaceId: membership.workspace_id as string,
      role: membership.role as string,
      clerkUserId: userId,
      supabase,
    });
  };
}
