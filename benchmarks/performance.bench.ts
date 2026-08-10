import { bench, describe, vi } from "vitest";

vi.mock("obsidian", () => {
  class TFolder {
    constructor(public path: string, public name: string) {}
  }
  return { TFolder, setIcon: () => undefined };
});

import { TFolder } from "obsidian";
import { parseFileContent } from "../src/core/parser";
import { DEFAULT_FILTER, groupTasks, TaskFilter } from "../src/core/query";
import { TaskIndexCore } from "../src/index/TaskIndexCore";
import { referenceCandidates } from "../src/view/ReferenceSuggest";
import { makeIndexBuckets, makeMarkdownNotes, makeTasks } from "./fixtures";

const BENCH_OPTIONS = { time: 800, warmupTime: 200 };

const markdownNotes = makeMarkdownNotes();
const indexBuckets = makeIndexBuckets();
const tasks = makeTasks();
const textFilter: TaskFilter = {
  ...DEFAULT_FILTER,
  text: "manutenzione impianto 3",
};
const structuredFilter: TaskFilter = {
  ...DEFAULT_FILTER,
  tags: ["progetto/progetto-7"],
  priorities: ["high", "medium"],
  due: "upcoming",
};

function populatedIndex(): TaskIndexCore {
  const index = new TaskIndexCore();
  for (const [path, bucket] of indexBuckets) index.replace(path, bucket);
  index.getAll();
  return index;
}

const unchangedIndex = populatedIndex();
const changedIndex = populatedIndex();
let changedVersion = false;

type FolderCtor = new (path: string, name: string) => TFolder;
const Folder = TFolder as unknown as FolderCtor;
const referenceFolders = Array.from({ length: 1_000 }, (_, index) =>
  new Folder(`Area-${index}`, `Area-${index}`),
);
const referenceFiles = Array.from({ length: 5_000 }, (_, index) => {
  const parent = referenceFolders[index % referenceFolders.length]!;
  const indexed = index < 500;
  const basename = indexed ? `_indice-${parent.name}` : `Nota-${index}`;
  return { path: `${parent.path}/${basename}.md`, basename, parent };
});
const referenceApp = {
  vault: {
    getMarkdownFiles: () => referenceFiles,
    getAllLoadedFiles: () => referenceFolders,
  },
} as never;

if (markdownNotes.length !== 500 || indexBuckets.length !== 2_000 || tasks.length !== 10_000) {
  throw new Error("Dataset benchmark non valido");
}

describe("parser — 500 note / 10.000 task", () => {
  bench("indicizzazione contenuto Markdown", () => {
    let parsed = 0;
    for (let index = 0; index < markdownNotes.length; index++) {
      parsed += parseFileContent(markdownNotes[index]!, `Nota-${index}.md`).length;
    }
    if (parsed !== 10_000) throw new Error(`Task analizzati inattesi: ${parsed}`);
  }, BENCH_OPTIONS);
});
describe("indice — 2.000 file / 10.000 task", () => {
  bench("costruzione iniziale e snapshot", () => {
    const index = populatedIndex();
    if (index.getAll().length !== 10_000) throw new Error("Snapshot indice incompleto");
  }, BENCH_OPTIONS);

  bench("replace invariato", () => {
    const [path, bucket] = indexBuckets[1_000]!;
    if (unchangedIndex.replace(path, bucket)) throw new Error("Bucket invariato segnalato come modificato");
    unchangedIndex.getAll();
  }, BENCH_OPTIONS);

  bench("replace modificato e snapshot", () => {
    const [path, bucket] = indexBuckets[1_000]!;
    changedVersion = !changedVersion;
    const changed = bucket.map((task, index) => index === 0
      ? { ...task, source: `${task.source} ${changedVersion ? "A" : "B"}` }
      : task);
    if (!changedIndex.replace(path, changed)) throw new Error("Modifica indice non rilevata");
    if (changedIndex.getAll().length !== 10_000) throw new Error("Snapshot indice incompleto");
  }, BENCH_OPTIONS);
});

describe("query — 10.000 task", () => {
  bench("ricerca testuale, ordinamento e gruppi", () => {
    groupTasks(tasks, textFilter, "due", "note", "2026-08-10", { inboxPath: "Inbox.md" });
  }, BENCH_OPTIONS);

  bench("filtri strutturati, ordinamento e agenda", () => {
    groupTasks(tasks, structuredFilter, "priority", "agenda", "2026-08-10", {
      inboxPath: "Inbox.md",
      agendaHorizonDays: 14,
    });
  }, BENCH_OPTIONS);
});

describe("riferimenti — 5.000 note / 1.000 cartelle", () => {
  bench("costruzione catalogo", () => {
    const candidates = referenceCandidates(referenceApp);
    if (candidates.length !== 5_500) {
      throw new Error(`Candidati inattesi: ${candidates.length}`);
    }
  }, BENCH_OPTIONS);
});
