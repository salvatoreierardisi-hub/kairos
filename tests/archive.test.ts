import { describe, expect, it } from "vitest";
import {
  archiveDate,
  archiveFilePath,
  archiveFolderPath,
  containsBlockId,
  ensureTaskBlockId,
  insertArchivedTask,
  isArchivableTask,
  isArchiveFile,
} from "../src/core/archive";
import { Task } from "../src/types";

function task(extra: Partial<Task> = {}): Task {
  return {
    text: "Task", status: "done", due: null, scheduled: null,
    completed: "2026-08-03", cancelled: null, priority: null, tags: [],
    file: "_Tasks/Inbox.md", line: 3, source: "- [x] Task ✅ 2026-08-03",
    ...extra,
  };
}

describe("archivio Inbox", () => {
  it("usa il marcatore coerente con lo stato", () => {
    expect(archiveDate(task())).toBe("2026-08-03");
    expect(archiveDate(task({ status: "cancelled", completed: null, cancelled: "2026-08-02" })))
      .toBe("2026-08-02");
    expect(archiveDate(task({ status: "open" }))).toBeNull();
  });

  it("include il giorno limite ed esclude task non sicuri", () => {
    expect(isArchivableTask(task(), "_Tasks/Inbox.md", "2026-08-10", 7)).toBe(true);
    expect(isArchivableTask(task({ completed: "2026-08-04" }), "_Tasks/Inbox.md", "2026-08-10", 7)).toBe(false);
    expect(isArchivableTask(task({ completed: null }), "_Tasks/Inbox.md", "2026-08-10", 7)).toBe(false);
    expect(isArchivableTask(task({ file: "Progetti/X.md" }), "_Tasks/Inbox.md", "2026-08-10", 7)).toBe(false);
    expect(isArchivableTask(task({ status: "open" }), "_Tasks/Inbox.md", "2026-08-10", 7)).toBe(false);
  });

  it("deriva cartella e file annuale dall'Inbox", () => {
    expect(archiveFolderPath("_Tasks/Inbox.md")).toBe("_Tasks/Archivio");
    expect(archiveFolderPath("Inbox.md")).toBe("Archivio");
    expect(archiveFilePath("_Tasks/Inbox.md", "2025-12-31")).toBe("_Tasks/Archivio/2025.md");
    expect(isArchiveFile("_Tasks/Archivio/2026.md", "_Tasks/Inbox.md")).toBe(true);
    expect(isArchiveFile("_Tasks/Archivio/note.md", "_Tasks/Inbox.md")).toBe(false);
  });

  it("aggiunge o conserva un block ID stabile", () => {
    expect(ensureTaskBlockId("- [x] Task ✅ 2026-08-03", "kairos-abc"))
      .toBe("- [x] Task ✅ 2026-08-03 ^kairos-abc");
    expect(ensureTaskBlockId("- [x] Task ^kairos-old", "kairos-new"))
      .toBe("- [x] Task ^kairos-old");
    expect(containsBlockId("a\n- [x] Task ^kairos-abc\n", "kairos-abc")).toBe(true);
  });

  it("crea archivio e inserisce i task recenti in alto nella sezione", () => {
    const first = insertArchivedTask("", "- [x] Primo ✅ 2026-08-01 ^kairos-a", "2026-08-01");
    expect(first).toBe("# Archivio task 2026\n\n## Agosto\n\n- [x] Primo ✅ 2026-08-01 ^kairos-a\n");
    const second = insertArchivedTask(first, "- [x] Secondo ✅ 2026-08-03 ^kairos-b", "2026-08-03");
    expect(second.indexOf("Secondo")).toBeLessThan(second.indexOf("Primo"));
    const same = insertArchivedTask(second, "- [x] Secondo ✅ 2026-08-03 ^kairos-b", "2026-08-03");
    expect(same).toBe(second);
    const refreshed = insertArchivedTask(second, "- [x] Secondo aggiornato ✅ 2026-08-03 ^kairos-b", "2026-08-03");
    expect(refreshed).toContain("Secondo aggiornato");
    expect((refreshed.match(/\^kairos-b/g) ?? [])).toHaveLength(1);
    const older = insertArchivedTask(second, "- [x] Vecchio ✅ 2026-08-01 ^kairos-c", "2026-08-01");
    expect(older.indexOf("Vecchio")).toBeGreaterThan(older.indexOf("Primo"));
    expect(older).not.toContain("^kairos-a\n\n- [x] Vecchio");
  });

  it("inserisce il nuovo mese sopra quelli precedenti e conserva CRLF", () => {
    const august = "# Archivio task 2026\r\n\r\n## Agosto\r\n\r\n- [x] A ^kairos-a\r\n";
    const september = insertArchivedTask(august, "- [x] S ^kairos-s", "2026-09-01");
    expect(september).toContain("\r\n");
    expect(september.indexOf("## Settembre")).toBeLessThan(september.indexOf("## Agosto"));
  });
});
