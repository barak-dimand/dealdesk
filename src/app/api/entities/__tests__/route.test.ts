/**
 * Reference route test (PHASE-0 Task 5): entities is the vertical slice every
 * later route copies — migration -> Zod schema -> withWorkspace() -> handler
 * -> test. Proves the four LLC records (BUILD.md §1) can be created through
 * the route and are workspace-scoped like every other withWorkspace() route.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakeSupabase } from "@/test/supabaseMock";
import { FOUR_ENTITIES } from "@/test/fixtures";

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
    entities: [] as Record<string, unknown>[],
  };
}

async function postEntity(body: Record<string, unknown>) {
  const { POST } = await import("../route");
  const req = new Request("http://test/api/entities", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return POST(req, {});
}

async function getEntities() {
  const { GET } = await import("../route");
  const req = new Request("http://test/api/entities");
  return GET(req, {});
}

describe("POST/GET /api/entities", () => {
  beforeEach(() => {
    vi.resetModules();
    authMock.mockReset();
    fakeSupabase = createFakeSupabase(seedData());
  });

  it("creates the four LLC entities and lists them back for the owning workspace", async () => {
    authMock.mockResolvedValue({ userId: USER_A });

    for (const entity of FOUR_ENTITIES) {
      const res = await postEntity(entity);
      expect(res.status).toBe(201);
    }

    const listRes = await getEntities();
    const { entities } = await listRes.json();

    expect(entities).toHaveLength(4);
    expect(entities.map((e: { name: string }) => e.name)).toEqual([
      "Easy Breezy LLC",
      "Imagine Investments LLC",
      "Everest Realty Solutions LLC",
      "Personal",
    ]);

    const everest = entities.find((e: { name: string }) => e.name === "Everest Realty Solutions LLC");
    expect(everest.status).toBe("winding_down");
    expect(everest.formation_state).toBe("OH");

    const personal = entities.find((e: { name: string }) => e.name === "Personal");
    expect(personal.entity_type).toBe("personal");
    expect(personal.formation_state).toBeNull();
  });

  it("rejects an entity with an invalid formation_state via Zod validation", async () => {
    authMock.mockResolvedValue({ userId: USER_A });

    const res = await postEntity({ name: "Bad Entity", formation_state: "Pennsylvania" });
    expect(res.status).toBe(400);
  });

  it("does not list a foreign workspace's entities", async () => {
    authMock.mockResolvedValue({ userId: USER_A });
    await postEntity(FOUR_ENTITIES[0]);

    authMock.mockResolvedValue({ userId: USER_B });
    const listRes = await getEntities();
    const { entities } = await listRes.json();

    expect(entities).toHaveLength(0);
  });
});
