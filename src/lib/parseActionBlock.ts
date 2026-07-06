import type { ProposedChange } from "@/types";

export interface ParsedActionBlock {
  /** Conversational text with the <action> block removed */
  message: string;
  /** Proposed changes from the action block, or null if none/invalid */
  changes: ProposedChange[] | null;
}

/**
 * Splits an AI chat response into its conversational text and an optional
 * structured <action>{...}</action> block. Malformed JSON or an unknown
 * action type degrades gracefully to a plain message with null changes.
 */
export function parseActionBlock(raw: string): ParsedActionBlock {
  const openIdx = raw.indexOf("<action>");
  if (openIdx === -1) {
    return { message: raw.trim(), changes: null };
  }

  const closeIdx = raw.indexOf("</action>", openIdx);
  const inner =
    closeIdx === -1
      ? raw.slice(openIdx + "<action>".length)
      : raw.slice(openIdx + "<action>".length, closeIdx);

  const before = raw.slice(0, openIdx);
  const after = closeIdx === -1 ? "" : raw.slice(closeIdx + "</action>".length);
  const message = `${before}\n${after}`.trim();

  try {
    const parsed = JSON.parse(inner.trim()) as {
      type?: string;
      changes?: ProposedChange[];
    };
    if (parsed.type !== "propose_changes" || !Array.isArray(parsed.changes)) {
      return { message, changes: null };
    }
    const valid = parsed.changes.filter(
      (c) =>
        c &&
        typeof c.id === "string" &&
        typeof c.type === "string" &&
        typeof c.label === "string" &&
        typeof c.newValue === "string" &&
        typeof c.payload === "object"
    );
    return { message, changes: valid.length > 0 ? valid : null };
  } catch {
    return { message, changes: null };
  }
}
