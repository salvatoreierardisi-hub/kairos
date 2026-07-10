import { describe, it, expect } from "vitest";
import { parseLine, parseFileContent } from "../src/core/parser";

describe("parseLine", () => {
  it("ignora le righe che non sono task", () => {
    expect(parseLine("solo testo", "f.md", 0)).toBeNull();
    expect(parseLine("## titolo", "f.md", 0)).toBeNull();
  });

  it("legge un task aperto semplice", () => {
    const t = parseLine("- [ ] Comprare il latte", "f.md", 3);
    expect(t).toMatchObject({
      text: "Comprare il latte", status: "open", due: null, priority: null,
      tags: [], file: "f.md", line: 3, source: "- [ ] Comprare il latte",
    });
  });

  it("legge un task completato", () => {
    expect(parseLine("- [x] Fatto", "f.md", 0)?.status).toBe("done");
    expect(parseLine("- [X] Fatto", "f.md", 0)?.status).toBe("done");
  });

  it("riconosce [/] come inProgress", () => {
    const t = parseLine("- [/] scrivere bozza 📅 2026-07-10", "a.md", 0);
    expect(t?.status).toBe("inProgress");
    expect(t?.due).toBe("2026-07-10");
    expect(t?.text).toBe("scrivere bozza");
  });

  it("riconosce [-] come cancelled", () => {
    const t = parseLine("- [-] idea scartata #progetto/x", "a.md", 3);
    expect(t?.status).toBe("cancelled");
    expect(t?.tags).toContain("progetto/x");
  });

  it("estrae la scadenza e la toglie dal testo", () => {
    const t = parseLine("- [ ] Voltura acqua 📅 2026-07-05", "f.md", 0);
    expect(t?.due).toBe("2026-07-05");
    expect(t?.text).toBe("Voltura acqua");
  });

  it("estrae le 5 priorità", () => {
    expect(parseLine("- [ ] a 🔺", "f.md", 0)?.priority).toBe("highest");
    expect(parseLine("- [ ] a ⏫", "f.md", 0)?.priority).toBe("high");
    expect(parseLine("- [ ] a 🔼", "f.md", 0)?.priority).toBe("medium");
    expect(parseLine("- [ ] a 🔽", "f.md", 0)?.priority).toBe("low");
    expect(parseLine("- [ ] a ⏬", "f.md", 0)?.priority).toBe("lowest");
    expect(parseLine("- [ ] a", "f.md", 0)?.priority).toBeNull();
  });

  it("toglie l'emoji priorità dal testo", () => {
    const t = parseLine("- [ ] Pagare psicologa ⏫", "f.md", 0);
    expect(t?.priority).toBe("high");
    expect(t?.text).toBe("Pagare psicologa");
  });

  it("estrae la data di completamento e la toglie dal testo", () => {
    const t = parseLine("- [x] Fatto ✅ 2026-07-05", "f.md", 0);
    expect(t?.completed).toBe("2026-07-05");
    expect(t?.text).toBe("Fatto");
  });

  it("completed è null se il marcatore manca", () => {
    const t = parseLine("- [ ] Da fare", "f.md", 0);
    expect(t?.completed).toBeNull();
  });

  it("estrae i tag progetto/area", () => {
    const t = parseLine("- [ ] Pulire #progetto/casa #area/benessere", "f.md", 0);
    expect(t?.tags).toEqual(["progetto/casa", "area/benessere"]);
    expect(t?.text).toBe("Pulire");
  });

  it("gestisce tutti i metadati insieme, in qualsiasi ordine", () => {
    const t = parseLine("- [ ] Voltura ⏫ 📅 2026-07-05 #progetto/casa", "f.md", 0);
    expect(t).toMatchObject({ text: "Voltura", priority: "high", due: "2026-07-05", tags: ["progetto/casa"] });
  });

  it("accetta trattino o asterisco e rientri", () => {
    expect(parseLine("  * [ ] Task", "f.md", 0)?.text).toBe("Task");
  });
});

describe("parseFileContent", () => {
  it("estrae solo le righe task, con numero di riga corretto", () => {
    const content = "# Titolo\n- [ ] Uno\ntesto\n- [x] Due";
    const tasks = parseFileContent(content, "f.md");
    expect(tasks).toHaveLength(2);
    expect(tasks[0]).toMatchObject({ text: "Uno", line: 1 });
    expect(tasks[1]).toMatchObject({ text: "Due", status: "done", line: 3 });
  });
});
