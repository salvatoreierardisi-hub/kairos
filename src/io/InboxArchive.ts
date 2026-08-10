import { App, TFile, TFolder, normalizePath } from "obsidian";
import { archiveDate, archiveFilePath, containsBlockId, ensureTaskBlockId, insertArchivedTask, isArchivableTask, isArchiveFile } from "../core/archive";
import { createInboxContent } from "../core/dailyInsert";
import { organizeInboxContent } from "../core/inboxSections";
import { locateTaskLine } from "../core/taskLine";
import { Settings, Task } from "../types";

export interface ArchiveAnalysis {
  eligible: Task[];
  missingDate: number;
}

export interface ArchiveRunResult {
  archived: number;
  errors: string[];
}

export class InboxArchive {
  private running = false;

  constructor(private app: App, private getSettings: () => Settings) {}

  analyze(tasks: readonly Task[], today: string): ArchiveAnalysis {
    const settings = this.getSettings();
    const inbox = this.inboxPath();
    const inboxTasks = tasks.filter((task) => normalizePath(task.file) === inbox);
    return {
      eligible: inboxTasks.filter((task) =>
        isArchivableTask(task, inbox, today, settings.completedRetentionDays),
      ),
      missingDate: inboxTasks.filter((task) =>
        (task.status === "done" && task.completed === null) ||
        (task.status === "cancelled" && task.cancelled === null),
      ).length,
    };
  }

  isArchivedTask(task: Pick<Task, "file">): boolean {
    return isArchiveFile(task.file, this.getSettings().inboxPath);
  }

  async run(tasks: readonly Task[], today: string): Promise<ArchiveRunResult> {
    if (this.running) return { archived: 0, errors: ["Archiviazione già in corso"] };
    this.running = true;
    try {
      const eligible = [...this.analyze(tasks, today).eligible].sort((a, b) => b.line - a.line);
      const result: ArchiveRunResult = { archived: 0, errors: [] };
      for (const task of eligible) {
        try {
          await this.archiveOne(task);
          result.archived += 1;
        } catch (error) {
          result.errors.push(error instanceof Error ? error.message : String(error));
        }
      }
      return result;
    } finally {
      this.running = false;
    }
  }

  async reopen(task: Task, openLine: string): Promise<void> {
    if (!this.isArchivedTask(task)) throw new Error("Il task non appartiene all'archivio Kairos");
    const archive = this.app.vault.getAbstractFileByPath(task.file);
    if (!(archive instanceof TFile)) throw new Error(`Archivio non trovato: ${task.file}`);
    const archiveContent = await this.app.vault.read(archive);
    const archiveEol = this.newlineOf(archiveContent);
    const archiveLines = archiveContent.split(/\r?\n/);
    const sourceIndex = locateTaskLine(archiveLines, task.line, task.source);
    const blockId = task.blockId ?? this.newBlockId();
    const sourceLine = ensureTaskBlockId(archiveLines[sourceIndex] ?? task.source, blockId);
    const targetLine = ensureTaskBlockId(openLine, blockId);
    if (sourceLine !== archiveLines[sourceIndex]) {
      archiveLines[sourceIndex] = sourceLine;
      await this.app.vault.modify(archive, archiveLines.join(archiveEol));
    }

    const inboxPath = this.inboxPath();
    const inbox = this.app.vault.getAbstractFileByPath(inboxPath);
    if (inbox && !(inbox instanceof TFile)) throw new Error(`Il percorso Inbox non è un file: ${inboxPath}`);
    const inboxContent = inbox instanceof TFile ? await this.app.vault.read(inbox) : "";
    const updatedInbox = containsBlockId(inboxContent, blockId)
      ? inboxContent
      : inbox instanceof TFile ? organizeInboxContent(inboxContent, targetLine) : createInboxContent(targetLine);
    const inboxFile = inbox instanceof TFile
      ? (updatedInbox === inboxContent ? inbox : await this.modifyAndReturn(inbox, updatedInbox))
      : await this.createFile(inboxPath, updatedInbox);
    if (!containsBlockId(await this.app.vault.read(inboxFile), blockId)) {
      throw new Error("Riapertura non verificata nell'Inbox");
    }

    const latestContent = await this.app.vault.read(archive);
    const latest = latestContent.split(/\r?\n/);
    const latestIndex = latest.findIndex((line) => line.trimEnd().endsWith(`^${blockId}`));
    if (latestIndex === -1) return;
    if (latest[latestIndex]?.trimEnd() !== sourceLine.trimEnd()) {
      throw new Error("Il task archiviato è cambiato durante la riapertura");
    }
    latest.splice(latestIndex, 1);
    await this.app.vault.modify(archive, latest.join(this.newlineOf(latestContent)));
  }

  private async archiveOne(task: Task): Promise<void> {
    const date = archiveDate(task);
    if (!date) throw new Error(`Task senza data storica: ${task.text}`);
    const inbox = this.app.vault.getAbstractFileByPath(this.inboxPath());
    if (!(inbox instanceof TFile)) throw new Error("File Inbox non trovato");
    const inboxContent = await this.app.vault.read(inbox);
    const inboxEol = this.newlineOf(inboxContent);
    const inboxLines = inboxContent.split(/\r?\n/);
    const sourceIndex = locateTaskLine(inboxLines, task.line, task.source);
    const blockId = task.blockId ?? this.newBlockId();
    const identifiedLine = ensureTaskBlockId(inboxLines[sourceIndex] ?? task.source, blockId);
    if (identifiedLine !== inboxLines[sourceIndex]) {
      inboxLines[sourceIndex] = identifiedLine;
      await this.app.vault.modify(inbox, inboxLines.join(inboxEol));
    }

    const destinationPath = archiveFilePath(this.getSettings().inboxPath, date);
    const existing = this.app.vault.getAbstractFileByPath(destinationPath);
    if (existing && !(existing instanceof TFile)) {
      throw new Error(`Il percorso archivio non è un file: ${destinationPath}`);
    }
    const oldArchive = existing instanceof TFile ? await this.app.vault.read(existing) : "";
    const newArchive = insertArchivedTask(oldArchive, identifiedLine, date);
    const archive = existing instanceof TFile
      ? (newArchive === oldArchive ? existing : await this.modifyAndReturn(existing, newArchive))
      : await this.createFile(destinationPath, newArchive);
    const verifiedArchive = await this.app.vault.read(archive);
    if (!verifiedArchive.split(/\r?\n/).some((line) => line.trimEnd() === identifiedLine.trimEnd())) {
      throw new Error(`Copia non verificata nell'archivio: ${task.text}`);
    }

    const latestInboxContent = await this.app.vault.read(inbox);
    const latestInbox = latestInboxContent.split(/\r?\n/);
    const latestIndex = latestInbox.findIndex((line) => line.trimEnd().endsWith(`^${blockId}`));
    if (latestIndex === -1) return;
    if (latestInbox[latestIndex]?.trimEnd() !== identifiedLine.trimEnd()) {
      throw new Error(`Task modificato durante l'archiviazione: ${task.text}`);
    }
    latestInbox.splice(latestIndex, 1);
    await this.app.vault.modify(inbox, latestInbox.join(this.newlineOf(latestInboxContent)));
  }

  private async modifyAndReturn(file: TFile, content: string): Promise<TFile> {
    await this.app.vault.modify(file, content);
    return file;
  }

  private async createFile(path: string, content: string): Promise<TFile> {
    const parts = normalizePath(path).split("/").slice(0, -1);
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      const existing = this.app.vault.getAbstractFileByPath(current);
      if (existing instanceof TFolder) continue;
      if (existing) throw new Error(`Impossibile creare la cartella: ${current}`);
      await this.app.vault.createFolder(current);
    }
    return await this.app.vault.create(path, content);
  }

  private newBlockId(): string {
    return `kairos-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private inboxPath(): string {
    const path = normalizePath(this.getSettings().inboxPath);
    return path.toLowerCase().endsWith(".md") ? path : `${path}.md`;
  }

  private newlineOf(content: string): string {
    return content.includes("\r\n") ? "\r\n" : "\n";
  }
}
