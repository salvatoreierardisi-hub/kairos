import { describe, expect, it } from "vitest";
import { addTaskReference, parseTaskReferences, referenceQuery, serializeTaskReferences, updateTaskReferences } from "../src/core/taskReferences";

describe("taskReferences", () => {
  it("estrae file e cartelle in testo pulito", () => {
    const parsed = parseTaskReferences(
      "Chiama [[Projects/Kairos/_indice|@Kairos]] e [@Materiali](obsidian://kairos-folder?path=Projects%2FMateriali)",
    );
    expect(parsed.text).toBe("Chiama @Kairos e @Materiali");
    expect(parsed.references).toMatchObject([
      { kind: "file", label: "Kairos", target: "Projects/Kairos/_indice", start: 7, end: 14 },
      { kind: "folder", label: "Materiali", target: "Projects/Materiali" },
    ]);
    expect(serializeTaskReferences(parsed.text, parsed.references)).toBe(
      "Chiama [[Projects/Kairos/_indice|@Kairos]] e [@Materiali](obsidian://kairos-folder?path=Projects%2FMateriali)",
    );
  });

  it("lascia intatti link normali e @ digitati a mano", () => {
    const source = "Scrivi a @Barbara e apri [[Nota|questa]]";
    expect(parseTaskReferences(source)).toEqual({ text: source, references: [] });
  });

  it("non va in errore con una cartella codificata male", () => {
    const parsed = parseTaskReferences("Vai a [@Progetto](obsidian://kairos-folder?path=Progetti%ZZ)");
    expect(parsed.text).toBe("Vai a @Progetto");
    expect(parsed.references[0]?.target).toBe("Progetti%ZZ");
  });

  it("sposta gli intervalli dopo una modifica esterna e scarta una menzione modificata", () => {
    const parsed = parseTaskReferences("A [[X|@X]] B");
    expect(updateTaskReferences(parsed.text, `Prima ${parsed.text}`, parsed.references)[0]).toMatchObject({ start: 8, end: 10 });
    expect(updateTaskReferences(parsed.text, "A @Y B", parsed.references)).toEqual([]);
  });

  it("aggiunge una scelta sostituendo soltanto la query", () => {
    const result = addTaskReference("Chiama @sel domani", [], 7, 11, {
      kind: "file", label: "Selezione", target: "Projects/Selezione/_indice",
    });
    expect(result.text).toBe("Chiama @Selezione domani");
    expect(serializeTaskReferences(result.text, result.references)).toContain(
      "[[Projects/Selezione/_indice|@Selezione]]",
    );
  });

  it("riconosce la query soltanto alla posizione del cursore", () => {
    expect(referenceQuery("Chiama @sel", 11)).toEqual({ start: 7, end: 11, query: "sel" });
    expect(referenceQuery("mail@test.it", 12)).toBeNull();
  });
});
