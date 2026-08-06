import { describe, expect, it } from "vitest";
import {
  addTagField,
  parseTaskSyntax,
  rewriteDateField,
  rewriteDescriptionField,
  rewritePriorityField,
  serializeTaskSyntax,
  transitionStatusField,
} from "../src/core/taskSyntax";

describe("taskSyntax lossless", () => {
  const fixtures = [
    "- [ ] Task semplice",
    "  * [/] Task 🔺 ⏳ 2026-08-06 📅 2026-08-07 #progetto/città [[Nota|Contesto]]",
    "3. [x] Fatto 🛫 2026-08-01 ➕ 2026-07-01 ✅ 2026-08-05 ^abc-1",
    "- [ ] Ricorrente 🔁 every 2 weeks when done 📅 2026-08-10",
    "- [ ] Dettaglio 📅 2026-08-10 [[_inbox/Dettagli/Dettaglio|Dettagli]] ^kairos-abc",
  ];

  it.each(fixtures)("round-trip byte-identico: %s", (line) => {
    const parsed = parseTaskSyntax(line);
    expect(parsed).not.toBeNull();
    expect(serializeTaskSyntax(parsed!)).toBe(line);
  });

  it("preserva campi sconosciuti quando modifica il testo", () => {
    expect(rewriteDescriptionField(
      "- [ ] Vecchio 🔁 every week 🛫 2026-08-01 📅 2026-08-10 ^abc",
      "Nuovo",
    )).toBe("- [ ] Nuovo 🔁 every week 🛫 2026-08-01 📅 2026-08-10 ^abc");
  });

  it("preserva Dettagli e block ID attraverso le trasformazioni", () => {
    const source = "- [ ] Task [[_inbox/Dettagli/Task|Dettagli]] ^kairos-abc";
    const dated = rewriteDateField(source, "📅", "2026-08-10");
    const prioritized = rewritePriorityField(dated, "highest");
    const done = transitionStatusField(prioritized, "done", "2026-08-05");
    expect(done).toBe(
      "- [x] Task 🔺 📅 2026-08-10 [[_inbox/Dettagli/Task|Dettagli]] ✅ 2026-08-05 ^kairos-abc",
    );
  });

  it("gestisce tag Unicode senza duplicarli", () => {
    const source = "- [ ] Visitare città #progetto/città";
    expect(addTagField(source, "#progetto/città")).toBe(source);
    expect(addTagField(source, "area/qualità")).toBe(
      "- [ ] Visitare città #progetto/città #area/qualità",
    );
  });

  it("non modifica stati checkbox sconosciuti", () => {
    expect(transitionStatusField("- [?] Da verificare", "done", "2026-08-05"))
      .toBe("- [?] Da verificare");
  });

  it("rifiuta date di calendario non valide", () => {
    expect(rewriteDateField("- [ ] Task", "📅", "2026-02-30")).toBe("- [ ] Task");
  });
});
