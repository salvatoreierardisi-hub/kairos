import { describe, it, expect } from "vitest";
import { setStatusLine, toggleLine } from "../src/core/toggleLine";

describe("toggleLine", () => {
  it("da aperto a fatto: spunta e aggiunge la data di completamento", () => {
    expect(toggleLine("- [ ] Comprare il latte", "open", "2026-07-05"))
      .toBe("- [x] Comprare il latte ✅ 2026-07-05");
  });

  it("da fatto ad aperto: despunta e rimuove il marcatore", () => {
    expect(toggleLine("- [x] Comprare il latte ✅ 2026-07-05", "done", "2026-07-05"))
      .toBe("- [ ] Comprare il latte");
  });

  it("rimuove un marcatore con data diversa da oggi quando si riapre", () => {
    expect(toggleLine("- [x] Fatto ✅ 2026-07-01", "done", "2026-07-05"))
      .toBe("- [ ] Fatto");
  });

  it("preserva rientro e asterisco come bullet", () => {
    expect(toggleLine("  * [ ] Task", "open", "2026-07-05"))
      .toBe("  * [x] Task ✅ 2026-07-05");
  });

  it("ignora una riga senza checkbox", () => {
    expect(toggleLine("solo testo", "open", "2026-07-05")).toBe("solo testo");
  });

  it("gestisce la X maiuscola come stato fatto", () => {
    expect(toggleLine("- [X] Fatto ✅ 2026-07-01", "done", "2026-07-05"))
      .toBe("- [ ] Fatto");
  });

  it("una riga [/] in corso torna open al toggle", () => {
    expect(toggleLine("- [/] task", "inProgress", "2026-07-05")).toBe("- [ ] task");
  });

  it("setStatusLine mette in corso", () => {
    expect(setStatusLine("- [ ] task", "inProgress", "2026-07-05")).toBe("- [/] task");
  });

  it("setStatusLine done aggiunge il marcatore ✅", () => {
    expect(setStatusLine("- [/] task", "done", "2026-07-05")).toBe("- [x] task ✅ 2026-07-05");
  });

  it("setStatusLine da done a cancelled rimuove ✅", () => {
    expect(setStatusLine("- [x] task ✅ 2026-07-05", "cancelled", "2026-07-05")).toBe("- [-] task");
  });

  it("mantiene il block ID in coda quando completa e riapre", () => {
    const done = toggleLine(
      "- [ ] task [[Dettagli/task|Dettagli]] ^kairos-a1b2",
      "open",
      "2026-07-05",
    );
    expect(done).toBe("- [x] task [[Dettagli/task|Dettagli]] ✅ 2026-07-05 ^kairos-a1b2");
    expect(toggleLine(done, "done", "2026-07-05"))
      .toBe("- [ ] task [[Dettagli/task|Dettagli]] ^kairos-a1b2");
  });
});
