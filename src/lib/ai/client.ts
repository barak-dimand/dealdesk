import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

/**
 * Single Anthropic client instantiation (PHASE-0 Task 4). Previously six ad-hoc
 * client constructor call sites with models hardcoded inline meant a model
 * change required a grep across the codebase. Import `client` and the model
 * constants from here instead of constructing a client anywhere else.
 */
export const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/** Fast, default model — parsing, chat, notes, LOI drafting, vision. */
export const MODEL_FAST = "claude-sonnet-4-6";

/** Slower, stronger reasoning model — reserved for the recommendation engine. */
export const MODEL_DEEP = "claude-opus-4-7";

/**
 * Tool-use helper for the Phase 1+ query layer (BUILD.md P4/P5: structured
 * questions get structured tools, not RAG). Takes a Zod schema and returns a
 * validated, typed result instead of hand-parsed JSON text.
 *
 * Not wired into any existing call site. Every current call parses raw JSON
 * from a text response — converting those to tool use is explicitly deferred
 * to Phase 1 (PHASE-0 Task 4 step 3 / "Explicitly not in Phase 0" table).
 * This exists so the query layer doesn't have to invent it from scratch.
 */
export async function callWithTool<Schema extends z.ZodTypeAny>(params: {
  prompt: string;
  toolName: string;
  toolDescription: string;
  schema: Schema;
  model?: string;
  system?: string;
  maxTokens?: number;
}): Promise<z.infer<Schema>> {
  const {
    prompt,
    toolName,
    toolDescription,
    schema,
    model = MODEL_FAST,
    system,
    maxTokens = 4096,
  } = params;

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: prompt }],
    tools: [
      {
        name: toolName,
        description: toolDescription,
        input_schema: z.toJSONSchema(schema) as Anthropic.Tool["input_schema"],
      },
    ],
    tool_choice: { type: "tool", name: toolName },
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(`Expected a tool_use block from "${toolName}", got none.`);
  }

  return schema.parse(toolUse.input);
}
