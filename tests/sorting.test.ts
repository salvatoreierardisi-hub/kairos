import { describe, it, expect } from "vitest";
import { sortTasks } from "../src/core/sorting";
import { Task, Priority } from "../src/types";

const task = (p: Partial<Task>): Task => ({
  text: "t",
  status: "open",
  due: null,
  scheduled: null,
  completed: null,
  cancelled: null,
  priority: null,
  tags: [],
  file: "a.md",
  line: 0,
  source: "- [ ] t",
  ...p,
});

describe("sortTasks", () => {
  it("per scadenza crescente, null in fondo", () => {
    const ts = [task({ due: null }), task({ due: "2026-07-10" }), task({ due: "2026-07-01" })];
    expect(sortTasks(ts, "due").map((t) => t.due)).toEqual(["2026-07-01", "2026-07-10", null]);
  });

  it("ordina per scheduled quando due manca", () => {
    const ts = [task({ scheduled: "2026-07-10" }), task({ due: "2026-07-05" }), task({ scheduled: "2026-07-01" })];
    expect(sortTasks(ts, "due").map((t) => t.due ?? t.scheduled)).toEqual(["2026-07-01", "2026-07-05", "2026-07-10"]);
  });

  it("per nota usa file poi line", () => {
    const ts = [
      task({ file: "b.md", line: 0 }),
      task({ file: "a.md", line: 5 }),
      task({ file: "a.md", line: 2 }),
    ];
    expect(sortTasks(ts, "note").map((t) => `${t.file}:${t.line}`)).toEqual(["a.md:2", "a.md:5", "b.md:0"]);
  });

  it("ordina per priorità: highest→lowest, poi senza priorità", () => {
    const mk = (priority: Priority | null, text: string): Task => ({
      text, status: "open", due: null, scheduled: null, completed: null, cancelled: null, priority, tags: [], file: "f.md", line: 0,
      source: `- [ ] ${text}`,
    });
    const input = [mk(null, "z"), mk("low", "l"), mk("highest", "h"), mk("medium", "m")];
    const out = sortTasks(input, "priority").map((t) => t.text);
    expect(out).toEqual(["h", "m", "l", "z"]);
  });

  it("non muta l'input", () => {
    const ts = [task({ due: "2026-07-10" }), task({ due: "2026-07-01" })];
    const copy = [...ts];
    sortTasks(ts, "due");
    expect(ts).toEqual(copy);
  });
});
