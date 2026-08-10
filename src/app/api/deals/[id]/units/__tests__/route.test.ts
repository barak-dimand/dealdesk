/**
 * Reference isolation test for withWorkspace() (ADR-0004, PHASE-0 Task 3).
 * The critical case: a caller belonging to workspace A must not be able to
 * read or write a deal that belongs to workspace B, even though both are
 * addressed by the same route.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakeSupabase } from "@/test/supabaseMock";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));

vi.mock("@clerk/nextjs/server", () => ({
  auth: authMock,
}));

let seed: ReturnType<typeof seedData>;
let fakeSupabase: ReturnType<typeof createFakeSupabase>;

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(async () => fakeSupabase),
}));

const WORKSPACE_A = "workspace-a";
const WORKSPACE_B = "workspace-b";
const USER_A = "user-a";
const DEAL_IN_A = "deal-in-a";
const DEAL_IN_B = "deal-in-b";

function seedData() {
  return {
    workspace_members: [
      { workspace_id: WORKSPACE_A, clerk_user_id: USER_A, role: "owner" },
    ],
    deals: [
      { id: DEAL_IN_A, workspace_id: WORKSPACE_A },
      { id: DEAL_IN_B, workspace_id: WORKSPACE_B },
    ],
    deal_units: [],
  };
}

async function postUnit(dealId: string, body: Record<string, unknown>) {
  const { POST } = await import("../route");
  const req = new Request(`http://test/api/deals/${dealId}/units`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return POST(req, { params: Promise.resolve({ id: dealId }) });
}

describe("POST /api/deals/[id]/units — workspace isolation (withWorkspace)", () => {
  beforeEach(() => {
    vi.resetModules();
    authMock.mockReset();
    seed = seedData();
    fakeSupabase = createFakeSupabase(seed);
  });

  it("creates a unit when the deal belongs to the caller's workspace", async () => {
    authMock.mockResolvedValue({ userId: USER_A });

    const res = await postUnit(DEAL_IN_A, { unit_number: "1A" });
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.unit.unit_number).toBe("1A");
    expect(json.unit.deal_id).toBe(DEAL_IN_A);
  });

  it("does not return or create data for a deal in a foreign workspace", async () => {
    authMock.mockResolvedValue({ userId: USER_A });

    const res = await postUnit(DEAL_IN_B, { unit_number: "should-not-exist" });
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe("Not found");
    expect(json.unit).toBeUndefined();
    expect(seed.deal_units).toHaveLength(0);
  });

  it("returns 401 when there is no authenticated user", async () => {
    authMock.mockResolvedValue({ userId: null });

    const res = await postUnit(DEAL_IN_A, { unit_number: "1A" });
    expect(res.status).toBe(401);
  });

  it("returns 403 when the caller has no workspace membership", async () => {
    authMock.mockResolvedValue({ userId: "user-with-no-membership" });

    const res = await postUnit(DEAL_IN_A, { unit_number: "1A" });
    expect(res.status).toBe(403);
  });
});
