import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("obsidian", () => {
  class TFile {
    constructor(public path: string) {}
  }
  class TFolder {
    constructor(public path: string) {}
  }
  return {
    TFile,
    TFolder,
    normalizePath: (path: string) => path.replace(/\\/g, "/").replace(/^\/+|\/+$/g, ""),
  };
});

import { TFile, TFolder } from "obsidian";
import { TaskWriter } from "../src/io/TaskWriter";
import { DEFAULT_SETTINGS, Task } from "../src/types";

type MockFile = TFile & { path: string };
type MockFolder = TFolder & { path: string };

function file(path: string): MockFile {
  const File = TFile as unknown as new (path: string) => MockFile;
  return new File(path);
}

function folder(path: string): MockFolder {
  const Folder = TFolder as unknown as new (path: string) => MockFolder;
  return new Folder(path);
}

function task(source: string, extra: Partial<Task> = {}): Task {
  return {
    text: "Vecchio",
    status: "open",
    due: null,
    scheduled: null,
    completed: null,
    cancelled: null,
    priority: null,
    tags: [],
    file: "_inbox/Inbox.md",
    line: 3,
    source,
    ...extra,
  };
}

function fixture(source: string, detailPath?: string) {
  const entries = new Map<string, MockFile | MockFolder>([
    ["_inbox", folder("_inbox")],
    ["_inbox/Dettagli", folder("_inbox/Dettagli")],
  ]);
  const contents = new Map<string, string>();
  const sourceFile = file("_inbox/Inbox.md");
  entries.set(sourceFile.path, sourceFile);
  contents.set(sourceFile.path, `# Inbox\n\n## Task\n${source}`);
  if (detailPath) {
    const detail = file(detailPath);
    entries.set(detail.path, detail);
    contents.set(detail.path, "# Dettaglio esistente\n");
  }

  const vault = {
    getAbstractFileByPath: vi.fn((path: string) => entries.get(path) ?? null),
    read: vi.fn(async (target: MockFile) => contents.get(target.path) ?? ""),
    modify: vi.fn(async (target: MockFile, content: string) => {
      contents.set(target.path, content);
    }),
    create: vi.fn(async (path: string, content: string) => {
      const created = file(path);
      entries.set(path, created);
      contents.set(path, content);
      return created;
    }),
    createFolder: vi.fn(async (path: string) => {
      entries.set(path, folder(path));
    }),
  };
  const trashFile = vi.fn(async (target: MockFile) => {
    entries.delete(target.path);
    contents.delete(target.path);
  });
  const app = { vault, fileManager: { trashFile } };
  const writer = new TaskWriter(app as never, () => ({ ...DEFAULT_SETTINGS }));
  const update = {
    text: "Nuovo testo",
    due: "2026-08-10",
    scheduled: null,
    priority: "high" as const,
    status: "open" as const,
  };
  return { writer, update, vault, contents, trashFile };
}

describe("TaskWriter.updateTaskWithDetail", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("aggiorna lo stesso task, crea Dettagli e restituisce la nota", async () => {
    const source = "- [ ] Vecchio #progetto/kairos";
    const { writer, update, contents } = fixture(source);

    const detail = await writer.updateTaskWithDetail(task(source), update);

    expect(detail.path).toBe("_inbox/Dettagli/Nuovo testo.md");
    const inbox = contents.get("_inbox/Inbox.md") ?? "";
    expect(inbox).toContain(
      "- [ ] Nuovo testo ⏫ #progetto/kairos 📅 2026-08-10 [[_inbox/Dettagli/Nuovo testo|Dettagli]] ^kairos-",
    );
    expect(contents.get(detail.path)).toContain(
      "Task sorgente: [[_inbox/Inbox#^kairos-",
    );
  });

  it("salva e restituisce la nota Dettagli già collegata senza crearne un'altra", async () => {
    const detailPath = "_inbox/Dettagli/Esistente.md";
    const source = "- [ ] Vecchio [[_inbox/Dettagli/Esistente|Dettagli]] ^kairos-esistente";
    const { writer, update, vault, contents } = fixture(source, detailPath);

    const detail = await writer.updateTaskWithDetail(task(source, { detailPath, blockId: "kairos-esistente" }), update);

    expect(detail.path).toBe(detailPath);
    expect(vault.create).not.toHaveBeenCalled();
    expect(contents.get("_inbox/Inbox.md")).toContain(
      "- [ ] Nuovo testo ⏫ 📅 2026-08-10 [[_inbox/Dettagli/Esistente|Dettagli]] ^kairos-esistente",
    );
  });

  it("ricrea nello stesso percorso una nota Dettagli eliminata", async () => {
    const detailPath = "_inbox/Dettagli/Eliminata.md";
    const source = "- [ ] Vecchio [[_inbox/Dettagli/Eliminata|Dettagli]] ^kairos-esistente";
    const { writer, update, vault, contents } = fixture(source);

    const detail = await writer.updateTaskWithDetail(task(source, { detailPath, blockId: "kairos-esistente" }), update);

    expect(detail.path).toBe(detailPath);
    expect(vault.create).toHaveBeenCalledWith(
      detailPath,
      expect.stringContaining("Task sorgente: [[_inbox/Inbox#^kairos-esistente|Apri il task]]"),
    );
    expect(contents.get("_inbox/Inbox.md")).toContain(
      "[[_inbox/Dettagli/Eliminata|Dettagli]] ^kairos-esistente",
    );
  });

  it("sposta nel cestino la nuova nota se il collegamento del task fallisce", async () => {
    const source = "- [ ] Vecchio";
    const { writer, update, vault, trashFile } = fixture(source);
    vault.modify.mockRejectedValueOnce(new Error("scrittura fallita"));

    await expect(writer.updateTaskWithDetail(task(source), update)).rejects.toThrow("scrittura fallita");

    expect(trashFile).toHaveBeenCalledOnce();
    expect(trashFile.mock.calls[0]?.[0].path).toBe("_inbox/Dettagli/Nuovo testo.md");
  });
});
