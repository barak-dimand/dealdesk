/**
 * PHASE-1 Task 1: documents table + Zod schema + withWorkspace() route.
 * Covers the two literal "Done when" requirements: a document can be
 * uploaded and its sha256 computed, and a duplicate upload is rejected.
 * File content here is synthetic test bytes, not a real lease document —
 * this task only proves the upload/hash/dedup mechanics, not lease content
 * (that's Task 4/5, with the real fixture leases already in hand).
 *
 * @vitest-environment node
 *
 * jsdom's Request/FormData/File do not correctly round-trip multipart bodies
 * — a File's `name` comes back as the literal string "blob" and
 * `instanceof File` is false against the realm's own global File class. Real
 * Next.js route handlers run on Node's native fetch (undici), which doesn't
 * have this gap, so testing under the Node environment here matches
 * production more closely than jsdom would.
 */
import { createHash } from "crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakeSupabase } from "@/test/supabaseMock";

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
    documents: [] as Record<string, unknown>[],
  };
}

function makeFile(content: string, name = "test-document.txt") {
  return new File([content], name, { type: "text/plain" });
}

async function postDocument(file: File, extra?: Record<string, string>) {
  const { POST } = await import("../route");
  const form = new FormData();
  // jsdom's FormData doesn't reliably round-trip a File's `name` through
  // Request's multipart encode/decode unless passed explicitly here.
  form.append("file", file, file.name);
  for (const [k, v] of Object.entries(extra ?? {})) form.append(k, v);
  const req = new Request("http://test/api/documents", { method: "POST", body: form });
  return POST(req, {});
}

async function getDocuments() {
  const { GET } = await import("../route");
  return GET(new Request("http://test/api/documents"), {});
}

describe("POST/GET /api/documents", () => {
  beforeEach(() => {
    vi.resetModules();
    authMock.mockReset();
    fakeSupabase = createFakeSupabase(seedData());
  });

  it("uploads a document and computes its sha256", async () => {
    authMock.mockResolvedValue({ userId: USER_A });

    const content = "lease-like test content, version 1";
    const res = await postDocument(makeFile(content));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.document.name).toBe("test-document.txt");
    expect(json.document.source).toBe("upload");
    expect(json.document.sha256).toBe(
      createHash("sha256").update(content).digest("hex")
    );
  });

  it("rejects a duplicate upload (same content) with 409", async () => {
    authMock.mockResolvedValue({ userId: USER_A });

    const content = "identical content both times";
    const first = await postDocument(makeFile(content, "first-name.txt"));
    expect(first.status).toBe(201);

    const second = await postDocument(makeFile(content, "different-name.txt"));
    const secondJson = await second.json();

    expect(second.status).toBe(409);
    expect(secondJson.error).toMatch(/already exists/i);

    const listRes = await getDocuments();
    const { documents } = await listRes.json();
    expect(documents).toHaveLength(1);
  });

  it("accepts two uploads with different content", async () => {
    authMock.mockResolvedValue({ userId: USER_A });

    await postDocument(makeFile("content A"));
    const res = await postDocument(makeFile("content B"));
    expect(res.status).toBe(201);

    const listRes = await getDocuments();
    const { documents } = await listRes.json();
    expect(documents).toHaveLength(2);
  });

  it("does not list a foreign workspace's documents", async () => {
    authMock.mockResolvedValue({ userId: USER_A });
    await postDocument(makeFile("workspace A content"));

    authMock.mockResolvedValue({ userId: USER_B });
    const listRes = await getDocuments();
    const { documents } = await listRes.json();

    expect(documents).toHaveLength(0);
  });
});
