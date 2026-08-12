/**
 * PHASE-1 Task 1: counterparties table + Zod schema + withWorkspace() route.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakeSupabase } from "@/test/supabaseMock";
import { SAMPLE_COUNTERPARTIES } from "@/test/fixtures";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));

vi.mock("@clerk/nextjs/server", () => ({
  auth: authMock,
}));

let fakeSupabase: ReturnType<typeof createFakeSupabase>;

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(async () => fakeSupabase),
}));

const WORKSPACE_A = "11111111-1111-4111-8111-111111111111";
const WORKSPACE_B = "22222222-2222-4222-8222-222222222222";
const USER_A = "user-a";
const USER_B = "user-b";

function seedData() {
  return {
    workspace_members: [
      { workspace_id: WORKSPACE_A, clerk_user_id: USER_A, role: "owner" },
      { workspace_id: WORKSPACE_B, clerk_user_id: USER_B, role: "owner" },
    ],
    counterparties: [] as Record<string, unknown>[],
  };
}

async function postCounterparty(body: Record<string, unknown>) {
  const { POST } = await import("../route");
  const req = new Request("http://test/api/counterparties", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return POST(req, {});
}

async function getCounterparties() {
  const { GET } = await import("../route");
  return GET(new Request("http://test/api/counterparties"), {});
}

describe("POST/GET /api/counterparties", () => {
  beforeEach(() => {
    vi.resetModules();
    authMock.mockReset();
    fakeSupabase = createFakeSupabase(seedData());
  });

  it("creates counterparties of different kinds and lists them back", async () => {
    authMock.mockResolvedValue({ userId: USER_A });

    for (const cp of SAMPLE_COUNTERPARTIES) {
      const res = await postCounterparty(cp);
      expect(res.status).toBe(201);
    }

    const listRes = await getCounterparties();
    const { counterparties } = await listRes.json();

    expect(counterparties).toHaveLength(2);
    expect(counterparties.map((c: { name: string }) => c.name)).toEqual([
      "Doug",
      "Leera Pest Control",
    ]);
    expect(counterparties[0].kind).toBe("management_co");
    expect(counterparties[1].kind).toBe("contractor");
  });

  it("rejects an unknown kind via Zod validation", async () => {
    authMock.mockResolvedValue({ userId: USER_A });

    const res = await postCounterparty({ name: "Mystery Corp", kind: "not_a_real_kind" });
    expect(res.status).toBe(400);
  });

  it("does not list a foreign workspace's counterparties", async () => {
    authMock.mockResolvedValue({ userId: USER_A });
    await postCounterparty(SAMPLE_COUNTERPARTIES[0]);

    authMock.mockResolvedValue({ userId: USER_B });
    const listRes = await getCounterparties();
    const { counterparties } = await listRes.json();

    expect(counterparties).toHaveLength(0);
  });
});
