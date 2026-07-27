import { describe, expect, it } from "vitest";
import { isAutomaticTaskPath, resolveAutomaticTarget } from "../src/core/placement";

describe("isAutomaticTaskPath", () => {
  it("riconosce Inbox e file nella cartella daily", () => {
    expect(isAutomaticTaskPath("_inbox/Inbox.md", "_inbox/Inbox.md", "02 Daily")).toBe(true);
    expect(isAutomaticTaskPath("_inbox/Inbox.md", "_inbox/Inbox", "02 Daily")).toBe(true);
    expect(isAutomaticTaskPath("02 Daily/2026-07-10.md", "_inbox/Inbox.md", "02 Daily")).toBe(true);
  });

  it("lascia ancorati i task nelle note progetto", () => {
    expect(isAutomaticTaskPath("04 Projects/Casa.md", "_inbox/Inbox.md", "02 Daily")).toBe(false);
  });

  it("rispetta i confini della cartella", () => {
    expect(isAutomaticTaskPath("02 Daily Extra/x.md", "_inbox/Inbox.md", "02 Daily")).toBe(false);
  });
});

describe("resolveAutomaticTarget", () => {
  it("senza data risolve Inbox", () => {
    expect(resolveAutomaticTarget(null, "_inbox/Inbox.md", null)).toBe("_inbox/Inbox.md");
    expect(resolveAutomaticTarget(null, "_inbox/Inbox", null)).toBe("_inbox/Inbox.md");
  });

  it("con data usa il path daily già formattato", () => {
    expect(resolveAutomaticTarget("2026-07-10", "_inbox/Inbox.md", "02 Daily/2026/07/10.md"))
      .toBe("02 Daily/2026/07/10.md");
  });
});
