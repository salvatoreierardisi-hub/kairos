import { describe, it, expect } from "vitest";
import { addTagLine, setDueLine, setPriorityLine } from "../src/core/updateLine";

describe("setDueLine", () => {
  it("aggiunge una scadenza a una riga senza data", () => {
    expect(setDueLine("- [ ] Chiamare Marco", "2026-07-06"))
      .toBe("- [ ] Chiamare Marco 📅 2026-07-06");
  });

  it("sostituisce una scadenza esistente", () => {
    expect(setDueLine("- [ ] Chiamare Marco 📅 2026-07-05", "2026-07-06"))
      .toBe("- [ ] Chiamare Marco 📅 2026-07-06");
  });

  it("rimuove la scadenza quando due è null", () => {
    expect(setDueLine("- [ ] Chiamare Marco 📅 2026-07-05", null))
      .toBe("- [ ] Chiamare Marco");
  });

  it("preserva il marcatore di completamento in coda", () => {
    expect(setDueLine("- [x] Fatto ✅ 2026-07-05", "2026-07-10"))
      .toBe("- [x] Fatto 📅 2026-07-10 ✅ 2026-07-05");
  });

  it("ignora righe non task", () => {
    expect(setDueLine("solo testo", "2026-07-06")).toBe("solo testo");
  });
});

describe("addTagLine", () => {
  it("aggiunge un tag normalizzato", () => {
    expect(addTagLine("- [ ] Chiamare Marco", "#progetto/casa"))
      .toBe("- [ ] Chiamare Marco #progetto/casa");
  });

  it("non duplica un tag già presente", () => {
    expect(addTagLine("- [ ] Chiamare Marco #progetto/casa", "progetto/casa"))
      .toBe("- [ ] Chiamare Marco #progetto/casa");
  });

  it("inserisce il tag prima del marcatore di completamento", () => {
    expect(addTagLine("- [x] Fatto ✅ 2026-07-05", "area/finanze"))
      .toBe("- [x] Fatto #area/finanze ✅ 2026-07-05");
  });
});

describe("setPriorityLine", () => {
  it("aggiunge l'emoji priorità preservando 📅 e testo", () => {
    expect(setPriorityLine("- [ ] Task 📅 2026-07-05", "high")).toBe("- [ ] Task ⏫ 📅 2026-07-05");
  });
  it("sostituisce una priorità esistente", () => {
    expect(setPriorityLine("- [ ] Task ⏫", "lowest")).toBe("- [ ] Task ⏬");
  });
  it("rimuove la priorità con null", () => {
    expect(setPriorityLine("- [ ] Task ⏫ 📅 2026-07-05", null)).toBe("- [ ] Task 📅 2026-07-05");
  });
  it("preserva il marcatore ✅ in coda", () => {
    expect(setPriorityLine("- [x] Task ✅ 2026-07-05", "medium")).toBe("- [x] Task 🔼 ✅ 2026-07-05");
  });
});
