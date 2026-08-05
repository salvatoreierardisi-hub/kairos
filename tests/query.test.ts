import { describe, it, expect } from "vitest";
import { matchesTask, groupTasks, DEFAULT_FILTER, TaskFilter, tasksForDay } from "../src/core/query";
import { Task, Priority } from "../src/types";

function mk(p: Partial<Task>): Task {
  return {
    text: "t", status: "open", due: null, scheduled: null, completed: null, cancelled: null, priority: null,
    tags: [], file: "n.md", line: 0, source: "- [ ] t", ...p,
  };
}
const filter = (p: Partial<TaskFilter>): TaskFilter => ({ ...DEFAULT_FILTER, ...p });
const TODAY = "2026-07-06";

describe("matchesTask", () => {
  it("stato: default mostra open e inProgress, non done", () => {
    expect(matchesTask(mk({ status: "open" }), DEFAULT_FILTER, TODAY)).toBe(true);
    expect(matchesTask(mk({ status: "inProgress" }), DEFAULT_FILTER, TODAY)).toBe(true);
    expect(matchesTask(mk({ status: "done" }), DEFAULT_FILTER, TODAY)).toBe(false);
  });

  it("statuses [] = ogni stato", () => {
    expect(matchesTask(mk({ status: "done" }), filter({ statuses: [] }), TODAY)).toBe(true);
  });

  it("due 'today' include scaduti e oggi, esclude futuri", () => {
    const f = filter({ due: "today" });
    expect(matchesTask(mk({ due: "2026-07-01" }), f, TODAY)).toBe(true);
    expect(matchesTask(mk({ due: TODAY }), f, TODAY)).toBe(true);
    expect(matchesTask(mk({ due: "2026-07-10" }), f, TODAY)).toBe(false);
    expect(matchesTask(mk({ due: null }), f, TODAY)).toBe(false);
  });

  it("due 'upcoming' solo futuri", () => {
    const f = filter({ due: "upcoming" });
    expect(matchesTask(mk({ due: "2026-07-10" }), f, TODAY)).toBe(true);
    expect(matchesTask(mk({ due: TODAY }), f, TODAY)).toBe(false);
  });

  it("due 'none' solo senza data", () => {
    const f = filter({ due: "none" });
    expect(matchesTask(mk({ due: null }), f, TODAY)).toBe(true);
    expect(matchesTask(mk({ due: TODAY }), f, TODAY)).toBe(false);
  });

  it("exactDay: matcha solo il task con quella data esatta", () => {
    const f = filter({ exactDay: "2026-07-09" });
    expect(matchesTask(mk({ due: "2026-07-09" }), f, TODAY)).toBe(true);
    expect(matchesTask(mk({ due: "2026-07-10" }), f, TODAY)).toBe(false);
    expect(matchesTask(mk({ due: null }), f, TODAY)).toBe(false);
  });

  it("ricerca senza distinzione di accenti e include il titolo Dettagli", () => {
    expect(matchesTask(mk({ text: "Qualità città" }), filter({ text: "qualita citta" }), TODAY)).toBe(true);
    expect(matchesTask(mk({ detailPath: "Dettagli/Revisione qualità.md" }), filter({ text: "revisione qualita" }), TODAY)).toBe(true);
  });

  it("usa due prima di scheduled come data effettiva", () => {
    expect(matchesTask(mk({ due: null, scheduled: TODAY }), filter({ exactDay: TODAY }), TODAY)).toBe(true);
    expect(matchesTask(mk({ due: "2026-07-10", scheduled: TODAY }), filter({ exactDay: TODAY }), TODAY)).toBe(false);
  });

  it("tag gerarchico: 'progetto' matcha 'progetto/casa'", () => {
    const f = filter({ tags: ["progetto"] });
    expect(matchesTask(mk({ tags: ["progetto/casa"] }), f, TODAY)).toBe(true);
    expect(matchesTask(mk({ tags: ["area/x"] }), f, TODAY)).toBe(false);
  });

  it("cartella: prefisso del path", () => {
    const f = filter({ folder: "01 Progetti" });
    expect(matchesTask(mk({ file: "01 Progetti/a.md" }), f, TODAY)).toBe(true);
    expect(matchesTask(mk({ file: "02 Daily/a.md" }), f, TODAY)).toBe(false);
  });

  it("priorità", () => {
    const f = filter({ priorities: ["high"] as Priority[] });
    expect(matchesTask(mk({ priority: "high" }), f, TODAY)).toBe(true);
    expect(matchesTask(mk({ priority: "low" }), f, TODAY)).toBe(false);
    expect(matchesTask(mk({ priority: null }), f, TODAY)).toBe(false);
  });

  it("testo: tutti i termini presenti (case-insensitive)", () => {
    const f = filter({ text: "latte spesa" });
    expect(matchesTask(mk({ text: "Comprare latte per la spesa" }), f, TODAY)).toBe(true);
    expect(matchesTask(mk({ text: "Comprare latte" }), f, TODAY)).toBe(false);
  });
});

describe("groupTasks", () => {
  const tasks = [
    mk({ file: "Inbox.md", text: "in inbox" }),
    mk({ file: "01 Progetti/docly.md", text: "docly", tags: ["progetto/docly"], priority: "high" }),
    mk({ file: "01 Progetti/kairos.md", text: "kairos", due: "2026-07-10" }),
  ];

  it("gruppo 'note' appunta Inbox in cima, poi le note per path", () => {
    const g = groupTasks(tasks, filter({ due: "all" }), "note", "note", TODAY, { inboxPath: "Inbox.md" });
    expect(g.map((x) => x.label)).toEqual(["Inbox", "docly", "kairos"]);
  });

  it("riconosce Inbox senza estensione nel raggruppamento per nota", () => {
    const g = groupTasks(
      [mk({ file: "_inbox/Inbox.md" })],
      filter({ due: "all" }),
      "note",
      "note",
      TODAY,
      { inboxPath: "_inbox/Inbox" },
    );
    expect(g[0]?.key).toBe("0-inbox");
    expect(g[0]?.label).toBe("Inbox");
  });

  it("gruppo 'date' produce i bucket ordinati", () => {
    const g = groupTasks(
      [mk({ due: "2026-07-01" }), mk({ due: TODAY }), mk({ due: "2026-07-20" }), mk({ due: null })],
      filter({ due: "all" }), "due", "date", TODAY,
    );
    expect(g.map((x) => x.label)).toEqual(["In ritardo", "Oggi", "Dopo", "Senza data"]);
  });

  it("gruppo 'date' mette una scadenza entro 7 giorni nel bucket 'Prossimi 7 giorni'", () => {
    const g = groupTasks(
      [mk({ due: "2026-07-09" })],
      filter({ due: "all" }), "due", "date", TODAY,
    );
    expect(g.map((x) => x.label)).toEqual(["Prossimi 7 giorni"]);
  });

  it("gruppo 'none' = un bucket unico senza label", () => {
    const g = groupTasks(tasks, filter({ due: "all" }), "note", "none", TODAY);
    expect(g).toHaveLength(1);
    expect(g[0].label).toBe("");
  });

  it("Agenda crea giorni singoli e gruppi semantici", () => {
    const g = groupTasks([
      mk({ due: "2026-07-01" }), mk({ scheduled: TODAY }), mk({ due: "2026-07-08" }),
      mk({ due: "2026-07-20" }), mk({ due: null }),
    ], filter({ due: "all" }), "due", "agenda", TODAY, { agendaHorizonDays: 7 });
    expect(g.map((group) => group.label)).toEqual(["In ritardo", "Oggi", "Mercoledì", "Dopo", "Senza data"]);
  });
});

describe("tasksForDay", () => {
  it("proietta una sola volta dalla casa stabile usando due prima di scheduled", () => {
    const task = mk({ file: "_inbox/Inbox.md", due: TODAY, scheduled: TODAY });
    expect(tasksForDay([task], TODAY)).toEqual([task]);
    expect(tasksForDay([mk({ due: "2026-07-10", scheduled: TODAY })], TODAY)).toEqual([]);
    expect(tasksForDay([mk({ due: null, scheduled: TODAY })], TODAY)).toHaveLength(1);
  });
});
