import { describe, expect, it } from "vitest";
import { TaskLineConflictError, locateTaskLine, locateTaskLines } from "../src/core/taskLine";

describe("locateTaskLine", () => {
  const source = "- [ ] Comprare latte";

  it("usa la posizione attesa quando coincide", () => {
    expect(locateTaskLine(["# Nota", source], 1, source)).toBe(1);
  });

  it("recupera una riga spostata quando la corrispondenza è unica", () => {
    expect(locateTaskLine(["nuova riga", "# Nota", source], 1, source)).toBe(2);
  });

  it("rifiuta una riga mancante", () => {
    expect(() => locateTaskLine(["# Nota"], 1, source)).toThrow(TaskLineConflictError);
  });

  it("rifiuta corrispondenze ambigue se la posizione attesa non coincide", () => {
    expect(() => locateTaskLine([source, source], 4, source)).toThrow(TaskLineConflictError);
  });

  it("risolve un gruppo contro lo stesso snapshot", () => {
    expect(locateTaskLines(["a", "b", "c"], [{ line: 2, source: "c" }, { line: 0, source: "a" }]))
      .toEqual([2, 0]);
  });
});
