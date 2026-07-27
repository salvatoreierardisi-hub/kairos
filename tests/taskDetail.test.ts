import { describe, expect, it } from "vitest";
import { detailFolder, detailNoteContent, detailTitle } from "../src/core/taskDetail";

describe("taskDetail", () => {
  it("ricava un titolo file sicuro dal testo", () => {
    expect(detailTitle("  Preparare: corso? #progetto/scuola  ")).toBe("Preparare corso");
  });

  it("colloca Dettagli accanto al file Inbox configurato", () => {
    expect(detailFolder("_inbox/Inbox.md")).toBe("_inbox/Dettagli");
    expect(detailFolder("Inbox.md")).toBe("Dettagli");
  });

  it("crea un riferimento stabile al blocco task", () => {
    expect(detailNoteContent("Preparare corso", "_inbox/Inbox.md", "kairos-a1b2"))
      .toContain("[[_inbox/Inbox#^kairos-a1b2|Apri il task]]");
  });
});
