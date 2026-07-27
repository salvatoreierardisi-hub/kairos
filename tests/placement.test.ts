import { describe, expect, it } from "vitest";
import { resolveInboxTarget } from "../src/core/placement";

describe("resolveInboxTarget", () => {
  it("normalizza la casa stabile della cattura globale", () => {
    expect(resolveInboxTarget("_inbox/Inbox.md")).toBe("_inbox/Inbox.md");
    expect(resolveInboxTarget("_inbox/Inbox")).toBe("_inbox/Inbox.md");
  });
});
