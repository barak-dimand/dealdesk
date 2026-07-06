import { describe, it, expect } from "vitest";
import { parseActionBlock } from "../parseActionBlock";

const VALID_ACTION = `{
  "type": "propose_changes",
  "changes": [
    {
      "id": "chg-1",
      "type": "data_field",
      "label": "Reported NOI",
      "oldValue": "$35,761",
      "newValue": "$72,000",
      "payload": { "fieldKey": "reported_noi", "fieldValueNumeric": 72000 }
    }
  ]
}`;

describe("parseActionBlock", () => {
  it("correctly extracts text before the <action> tag", () => {
    const raw = `I've updated the NOI based on your instruction.\n\n<action>${VALID_ACTION}</action>`;
    const result = parseActionBlock(raw);
    expect(result.message).toBe("I've updated the NOI based on your instruction.");
    expect(result.message).not.toContain("<action>");
  });

  it("correctly parses JSON inside the <action> tag", () => {
    const raw = `Here's the change.\n<action>${VALID_ACTION}</action>`;
    const result = parseActionBlock(raw);
    expect(result.changes).toHaveLength(1);
    expect(result.changes![0].id).toBe("chg-1");
    expect(result.changes![0].type).toBe("data_field");
    expect(result.changes![0].label).toBe("Reported NOI");
    expect(result.changes![0].newValue).toBe("$72,000");
    expect(result.changes![0].payload.fieldValueNumeric).toBe(72000);
  });

  it("returns null changes when no <action> tag is present", () => {
    const raw = "The cap rate at asking is 3.2%, which is quite low for this market.";
    const result = parseActionBlock(raw);
    expect(result.changes).toBeNull();
    expect(result.message).toBe(raw);
  });

  it("handles malformed JSON gracefully", () => {
    const raw = `Let me update that.\n<action>{ this is not valid json }</action>`;
    const result = parseActionBlock(raw);
    expect(result.changes).toBeNull();
    expect(result.message).toBe("Let me update that.");
  });

  it("handles a missing closing tag without throwing", () => {
    const raw = `Updating now.\n<action>${VALID_ACTION}`;
    const result = parseActionBlock(raw);
    expect(result.message).toBe("Updating now.");
    expect(result.changes).toHaveLength(1);
  });

  it("returns null changes for an unknown action type", () => {
    const raw = `Done.\n<action>{"type": "something_else", "changes": []}</action>`;
    const result = parseActionBlock(raw);
    expect(result.changes).toBeNull();
    expect(result.message).toBe("Done.");
  });
});
