import { describe, expect, it, vi } from "vitest";

vi.mock("obsidian", () => {
  class TFile { constructor(public path: string) {} }
  class TFolder { constructor(public path: string) {} }
  return {
    TFile,
    TFolder,
    normalizePath: (path: string) => path.replace(/\\/g, "/").replace(/^\/+|\/+$/g, ""),
  };
});

import { TFile, TFolder } from "obsidian";
import { InboxArchive } from "../src/io/InboxArchive";
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

function archivedTask(filePath = "_Tasks/Inbox.md"): Task {
  const source = "- [x] Fatto [[_Tasks/Dettagli/Fatto|Dettagli]] ✅ 2026-08-03 ^kairos-old";
  return {
    text: "Fatto", status: "done", due: null, scheduled: null,
    completed: "2026-08-03", cancelled: null, priority: null, tags: [],
    file: filePath, line: filePath.includes("Archivio") ? 4 : 3, source,
    detailPath: "_Tasks/Dettagli/Fatto.md", blockId: "kairos-old",
  };
}

function fixture() {
  const entries = new Map<string, MockFile | MockFolder>([
    ["_Tasks", folder("_Tasks")],
    ["_Tasks/Dettagli", folder("_Tasks/Dettagli")],
  ]);
  const contents = new Map<string, string>();
  const inbox = file("_Tasks/Inbox.md");
  const detail = file("_Tasks/Dettagli/Fatto.md");
  entries.set(inbox.path, inbox);
  entries.set(detail.path, detail);
  contents.set(inbox.path, `# Inbox\n\n## Task\n${archivedTask().source}`);
  contents.set(detail.path, "# Dettaglio\n");

  const vault = {
    getAbstractFileByPath: vi.fn((path: string) => entries.get(path) ?? null),
    read: vi.fn(async (target: MockFile) => contents.get(target.path) ?? ""),
    modify: vi.fn(async (target: MockFile, content: string) => { contents.set(target.path, content); }),
    createFolder: vi.fn(async (path: string) => { entries.set(path, folder(path)); }),
    create: vi.fn(async (path: string, content: string) => {
      const created = file(path);
      entries.set(path, created);
      contents.set(path, content);
      return created;
    }),
  };
  const service = new InboxArchive(
    { vault } as never,
    () => ({ ...DEFAULT_SETTINGS, inboxPath: "_Tasks/Inbox.md", completedRetentionDays: 7 }),
  );
  return { service, vault, contents, entries };
}

describe("InboxArchive", () => {
  it("sposta copia-prima e conserva la nota Dettagli", async () => {
    const { service, contents, entries } = fixture();
    const result = await service.run([archivedTask()], "2026-08-10");

    expect(result).toEqual({ archived: 1, errors: [] });
    expect(contents.get("_Tasks/Inbox.md")).not.toContain("Fatto");
    expect(contents.get("_Tasks/Archivio/2026.md")).toContain(archivedTask().source);
    expect(contents.get("_Tasks/Dettagli/Fatto.md")).toBe("# Dettaglio\n");
    expect(entries.has("_Tasks/Dettagli/Fatto.md")).toBe(true);
  });

  it("riconosce anche un'impostazione Inbox senza estensione", () => {
    const { vault } = fixture();
    const service = new InboxArchive(
      { vault } as never,
      () => ({ ...DEFAULT_SETTINGS, inboxPath: "_Tasks/Inbox", completedRetentionDays: 7 }),
    );
    expect(service.analyze([archivedTask()], "2026-08-10").eligible).toHaveLength(1);
  });

  it("lascia la sorgente se la copia in archivio fallisce", async () => {
    const { service, vault, contents } = fixture();
    vault.create.mockRejectedValueOnce(new Error("disco non disponibile"));

    const result = await service.run([archivedTask()], "2026-08-10");

    expect(result.archived).toBe(0);
    expect(result.errors[0]).toContain("disco non disponibile");
    expect(contents.get("_Tasks/Inbox.md")).toContain("^kairos-old");
  });

  it("completa al retry una rimozione fallita senza duplicare", async () => {
    const { service, vault, contents } = fixture();
    let failed = false;
    vault.modify.mockImplementation(async (target: MockFile, content: string) => {
      if (target.path === "_Tasks/Inbox.md" && !content.includes("^kairos-old") && !failed) {
        failed = true;
        throw new Error("rimozione fallita");
      }
      contents.set(target.path, content);
    });

    const first = await service.run([archivedTask()], "2026-08-10");
    expect(first.archived).toBe(0);
    expect(contents.get("_Tasks/Inbox.md")).toContain("^kairos-old");
    const second = await service.run([archivedTask()], "2026-08-10");
    expect(second.archived).toBe(1);
    expect((contents.get("_Tasks/Archivio/2026.md")?.match(/\^kairos-old/g) ?? [])).toHaveLength(1);
  });

  it("riporta nell'Inbox un task riaperto prima di rimuoverlo dall'archivio", async () => {
    const { service, contents, entries } = fixture();
    await service.run([archivedTask()], "2026-08-10");
    const archiveTask = archivedTask("_Tasks/Archivio/2026.md");

    await service.reopen(archiveTask, archiveTask.source.replace("[x]", "[ ]").replace(" ✅ 2026-08-03", ""));

    expect(contents.get("_Tasks/Inbox.md")).toContain("- [ ] Fatto");
    expect(contents.get("_Tasks/Archivio/2026.md")).not.toContain("^kairos-old");
    expect(entries.has("_Tasks/Dettagli/Fatto.md")).toBe(true);
  });
});
