import { describe, expect, it } from "vitest";
import { normalizeExcludedFolders } from "../src/core/settings";

describe("normalizeExcludedFolders", () => {
  it("normalizza, deduplica e rifiuta traversal e .obsidian", () => {
    expect(normalizeExcludedFolders([" /Archivio/ ", "Archivio", "../fuori", ".obsidian", 4]))
      .toEqual(["Archivio"]);
  });
  it("migra valori precedenti non-array al default vuoto", () => {
    expect(normalizeExcludedFolders("Archivio")).toEqual([]);
  });
});
