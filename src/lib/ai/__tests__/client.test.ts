import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: createMock };
  },
}));

describe("callWithTool", () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it("validates and returns the tool_use block's input against the schema", async () => {
    createMock.mockResolvedValue({
      content: [{ type: "tool_use", name: "extract_entity", input: { name: "Easy Breezy LLC" } }],
    });

    const { callWithTool } = await import("../client");
    const schema = z.object({ name: z.string() });

    const result = await callWithTool({
      prompt: "extract the entity name",
      toolName: "extract_entity",
      toolDescription: "Extracts an entity name",
      schema,
    });

    expect(result).toEqual({ name: "Easy Breezy LLC" });
  });

  it("throws when the model responds without a tool_use block", async () => {
    createMock.mockResolvedValue({
      content: [{ type: "text", text: "I don't want to use the tool." }],
    });

    const { callWithTool } = await import("../client");
    const schema = z.object({ name: z.string() });

    await expect(
      callWithTool({
        prompt: "extract the entity name",
        toolName: "extract_entity",
        toolDescription: "Extracts an entity name",
        schema,
      })
    ).rejects.toThrow(/tool_use/);
  });

  it("throws when the tool input fails schema validation", async () => {
    createMock.mockResolvedValue({
      content: [{ type: "tool_use", name: "extract_entity", input: { name: 42 } }],
    });

    const { callWithTool } = await import("../client");
    const schema = z.object({ name: z.string() });

    await expect(
      callWithTool({
        prompt: "extract the entity name",
        toolName: "extract_entity",
        toolDescription: "Extracts an entity name",
        schema,
      })
    ).rejects.toThrow();
  });
});
