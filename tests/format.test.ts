import { describe, it, expect } from "vitest";
import { formatTaskLine } from "../src/core/format";

describe("formatTaskLine", () => {
  it("formatta un task semplice", () => {
    expect(formatTaskLine({ text: "Comprare latte", due: null, important: false }))
      .toBe("- [ ] Comprare latte");
  });

  it("aggiunge il flag importante", () => {
    expect(formatTaskLine({ text: "Urgente", due: null, important: true }))
      .toBe("- [ ] Urgente ⏫");
  });

  it("aggiunge una priorità esplicita", () => {
    expect(formatTaskLine({ text: "Urgente", due: null, important: false, priority: "highest" }))
      .toBe("- [ ] Urgente 🔺");
  });

  it("la priorità esplicita ha precedenza sul vecchio flag importante", () => {
    expect(formatTaskLine({ text: "Basso", due: null, important: true, priority: "low" }))
      .toBe("- [ ] Basso 🔽");
  });

  it("aggiunge la scadenza", () => {
    expect(formatTaskLine({ text: "Voltura", due: "2026-07-05", important: false }))
      .toBe("- [ ] Voltura 📅 2026-07-05");
  });

  it("mette importante prima della scadenza", () => {
    expect(formatTaskLine({ text: "X", due: "2026-07-05", important: true }))
      .toBe("- [ ] X ⏫ 📅 2026-07-05");
  });

  it("aggiunge link Dettagli e block ID in coda", () => {
    expect(formatTaskLine({
      text: "Approfondire",
      due: null,
      important: false,
      detailPath: "_inbox/Dettagli/Approfondire.md",
      blockId: "kairos-a1b2",
    })).toBe("- [ ] Approfondire [[_inbox/Dettagli/Approfondire|Dettagli]] ^kairos-a1b2");
  });
});
