import { describe, expect, it } from "vitest";
import { displayTaskText } from "../src/core/taskText";

describe("displayTaskText", () => {
  it("mostra etichette leggibili senza cambiare il Markdown sorgente", () => {
    expect(displayTaskText("Leggi [[Cartella/Nota|questa nota]] e [la guida](https://example.com)"))
      .toBe("Leggi questa nota e la guida");
    expect(displayTaskText("Apri [[Cartella/Nota]]")).toBe("Apri Nota");
  });
});
