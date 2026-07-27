import { describe, expect, it } from "vitest";
import { reconcileTaskSelection } from "../src/core/selection";
import { Task } from "../src/types";

function task(line: number, source: string, file = "nota.md"): Task {
  return {
    text: source,
    status: "open",
    due: null,
    completed: null,
    priority: null,
    tags: [],
    file,
    line,
    source,
  };
}

describe("reconcileTaskSelection", () => {
  it("mantiene una corrispondenza esatta", () => {
    const current = task(3, "- [ ] scelto");
    expect(reconcileTaskSelection([task(3, "- [ ] scelto")], [current])).toEqual([current]);
  });

  it("recupera uno spostamento di riga quando la sorgente è unica", () => {
    const moved = task(4, "- [ ] scelto");
    expect(reconcileTaskSelection([task(3, "- [ ] scelto")], [task(3, "- [ ] altro"), moved]))
      .toEqual([moved]);
  });

  it("non trasferisce la selezione al task che occupa la vecchia riga", () => {
    expect(reconcileTaskSelection([task(3, "- [ ] scelto")], [task(3, "- [ ] altro")])).toEqual([]);
  });

  it("scarta una sorgente spostata diventata ambigua", () => {
    const source = "- [ ] duplicato";
    expect(reconcileTaskSelection([task(1, source)], [task(2, source), task(5, source)])).toEqual([]);
  });

  it("non usa una sorgente uguale proveniente da un altro file", () => {
    const source = "- [ ] scelto";
    expect(reconcileTaskSelection([task(1, source)], [task(2, source, "altra.md")])).toEqual([]);
  });
});
