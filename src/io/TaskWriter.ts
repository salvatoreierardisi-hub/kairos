import { App, TFile, TFolder, normalizePath } from "obsidian";
import { Task, NewTaskInput, Settings, TaskStatus, Priority } from "../types";
import { formatTaskLine } from "../core/format";
import { createInboxContent, insertTaskAtTop } from "../core/dailyInsert";
import { locateTaskLine, locateTaskLines } from "../core/taskLine";
import { setStatusLine, toggleLine } from "../core/toggleLine";
import { addTagLine, setDueLine, setPriorityLine, setScheduledLine, setTaskTextLine } from "../core/updateLine";
import { detailFolder, detailNoteContent, detailTitle } from "../core/taskDetail";
import { completeRecurring } from "../core/recurrence";
import { isValidDay } from "../core/dates";

function markdownPath(path: string): string {
  const normalized = normalizePath(path);
  return normalized.toLowerCase().endsWith(".md") ? normalized : `${normalized}.md`;
}

export interface CreatedTask {
  file: TFile;
  line: number;
  detailFile?: TFile;
}

export class TaskWriter {
  constructor(
    private app: App,
    private getSettings: () => Settings,
  ) {}

  async addTask(input: NewTaskInput): Promise<CreatedTask> {
    if (input.text.trim() === "") throw new Error("Il testo del task è vuoto");
    this.assertDate(input.due);
    this.assertDate(input.scheduled ?? null);
    const line = formatTaskLine(input);
    if (input.targetPath) {
      return await this.insertInNote(markdownPath(input.targetPath), line);
    }
    return await this.insertInInbox(line);
  }

  async addTaskWithDetail(input: NewTaskInput): Promise<CreatedTask> {
    if (input.targetPath) return await this.addTask(input);

    const title = detailTitle(input.text);
    const detailPath = await this.availableDetailPath(title);
    const blockId = this.newBlockId();
    const sourcePath = markdownPath(this.getSettings().inboxPath);
    const detailFile = await this.createFile(
      detailPath,
      detailNoteContent(title, sourcePath, blockId),
    );
    try {
      const created = await this.addTask({
        ...input,
        detailPath,
        blockId,
      });
      return { ...created, detailFile };
    } catch (error) {
      await this.app.fileManager.trashFile(detailFile).catch(() => undefined);
      throw error;
    }
  }

  async toggleTask(task: Task): Promise<void> {
    if (task.status !== "done" && task.source.includes("🔁")) {
      await this.completeRecurringTask(task);
      return;
    }
    await this.updateTaskLine(task, (line) => toggleLine(line, task.status, this.todayString()));
  }

  async setStatus(task: Task, status: TaskStatus): Promise<void> {
    if (status === "done" && task.status !== "done" && task.source.includes("🔁")) {
      await this.completeRecurringTask(task);
      return;
    }
    await this.updateTaskLine(task, (line) => setStatusLine(line, status, this.todayString()));
  }

  async setDue(task: Task, due: string | null): Promise<void> {
    this.assertDate(due);
    await this.updateTaskLine(task, (line) => setDueLine(line, due));
  }

  async setDueWithUndo(task: Task, due: string | null): Promise<() => Promise<void>> {
    this.assertDate(due);
    const file = this.app.vault.getAbstractFileByPath(task.file);
    if (!(file instanceof TFile)) throw new Error(`Nota sorgente non trovata: ${task.file}`);
    const lines = (await this.app.vault.read(file)).split("\n");
    const index = locateTaskLine(lines, task.line, task.source);
    const nextSource = setDueLine(lines[index], due);
    lines[index] = nextSource;
    await this.app.vault.modify(file, lines.join("\n"));
    const nextRef: Task = { ...task, line: index, source: nextSource, due };
    return async () => this.setDue(nextRef, task.due);
  }

  async setScheduled(task: Task, scheduled: string | null): Promise<void> {
    this.assertDate(scheduled);
    await this.updateTaskLine(task, (line) => setScheduledLine(line, scheduled));
  }

  async addTag(task: Task, tag: string): Promise<void> {
    await this.updateTaskLine(task, (line) => addTagLine(line, tag));
  }

  async setPriority(task: Task, priority: Priority | null): Promise<void> {
    await this.updateTaskLine(task, (line) => setPriorityLine(line, priority));
  }

  async updateTask(
    task: Task,
    update: { text: string; due: string | null; scheduled?: string | null; priority: Priority | null; status: TaskStatus },
  ): Promise<void> {
    if (update.text.trim() === "") throw new Error("Il testo del task è vuoto");
    this.assertDate(update.due);
    this.assertDate(update.scheduled ?? null);
    if (update.status === "done" && task.status !== "done" && task.source.includes("🔁")) {
      await this.completeRecurringTask(task, (line) => this.applyTaskEdits(line, task, update, task.status));
      return;
    }
    await this.updateTaskLine(task, (line) => {
      return this.applyTaskEdits(line, task, update, update.status);
    });
  }

  async deleteTask(task: Task): Promise<void> {
    await this.deleteTasks([task]);
  }

  async deleteTasks(tasks: readonly Task[]): Promise<void> {
    const byFile = new Map<string, Task[]>();
    for (const task of tasks) {
      const group = byFile.get(task.file) ?? [];
      group.push(task);
      byFile.set(task.file, group);
    }

    for (const [path, fileTasks] of byFile) {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (!(file instanceof TFile)) throw new Error(`Nota sorgente non trovata: ${path}`);
      const contentLines = (await this.app.vault.read(file)).split("\n");
      const lines = locateTaskLines(contentLines, fileTasks).sort((a, b) => b - a);
      for (const line of lines) contentLines.splice(line, 1);
      await this.app.vault.modify(file, contentLines.join("\n"));
    }
  }

  /** Spostamento append-first: un errore può duplicare, mai perdere, il task. */
  async moveToNote(task: Task, destPath: string): Promise<void> {
    const src = this.app.vault.getAbstractFileByPath(task.file);
    if (!(src instanceof TFile)) throw new Error(`Nota sorgente non trovata: ${task.file}`);
    const normalizedDest = markdownPath(destPath);
    if (normalizedDest === src.path) return;
    const srcLines = (await this.app.vault.read(src)).split("\n");
    const sourceIndex = locateTaskLine(srcLines, task.line, task.source);
    const lineText = srcLines[sourceIndex];
    await this.insertInNote(normalizedDest, lineText);

    const latestLines = (await this.app.vault.read(src)).split("\n");
    const latestIndex = locateTaskLine(latestLines, sourceIndex, task.source);
    latestLines.splice(latestIndex, 1);
    await this.app.vault.modify(src, latestLines.join("\n"));
  }

  private async updateTaskLine(task: Task, update: (line: string) => string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(task.file);
    if (!(file instanceof TFile)) throw new Error(`Nota sorgente non trovata: ${task.file}`);
    const lines = (await this.app.vault.read(file)).split("\n");
    const index = locateTaskLine(lines, task.line, task.source);
    lines[index] = update(lines[index]);
    await this.app.vault.modify(file, lines.join("\n"));
  }

  private applyTaskEdits(
    line: string,
    task: Task,
    update: { text: string; due: string | null; scheduled?: string | null; priority: Priority | null },
    status: TaskStatus,
  ): string {
    let next = setTaskTextLine(line, update.text);
    next = setDueLine(next, update.due);
    next = setScheduledLine(next, update.scheduled === undefined ? task.scheduled : update.scheduled);
    next = setPriorityLine(next, update.priority);
    return setStatusLine(next, status, this.todayString());
  }

  private async completeRecurringTask(task: Task, edit: (line: string) => string = (line) => line): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(task.file);
    if (!(file instanceof TFile)) throw new Error(`Nota sorgente non trovata: ${task.file}`);
    const lines = (await this.app.vault.read(file)).split("\n");
    const index = locateTaskLine(lines, task.line, task.source);
    const result = completeRecurring(edit(lines[index]), this.todayString());
    if (!result) {
      await this.app.workspace.getLeaf("tab").openFile(file, { eState: { line: index } });
      throw new Error("Ricorrenza non supportata o priva di data: nessuna modifica effettuata");
    }
    lines.splice(index, 1, result.nextLine, result.completedLine);
    await this.app.vault.modify(file, lines.join("\n"));
  }

  private async insertInInbox(line: string): Promise<CreatedTask> {
    const path = markdownPath(this.getSettings().inboxPath);
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) {
      const content = await this.app.vault.read(existing);
      const updated = insertTaskAtTop(content, line);
      await this.app.vault.modify(existing, updated);
      return { file: existing, line: this.findInsertedLine(updated, line) };
    }
    const content = createInboxContent(line);
    const file = await this.createFile(path, content);
    return { file, line: this.findInsertedLine(content, line) };
  }

  private async insertInNote(path: string, line: string): Promise<CreatedTask> {
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) {
      const content = await this.app.vault.read(existing);
      const updated = insertTaskAtTop(content, line);
      await this.app.vault.modify(existing, updated);
      return { file: existing, line: this.findInsertedLine(updated, line) };
    }
    const content = insertTaskAtTop("", line);
    const file = await this.createFile(path, content);
    return { file, line: this.findInsertedLine(content, line) };
  }

  private async createFile(path: string, content: string): Promise<TFile> {
    await this.ensureFolders(path);
    return await this.app.vault.create(path, content);
  }

  private async ensureFolders(path: string): Promise<void> {
    const parts = normalizePath(path).split("/").slice(0, -1);
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      const existing = this.app.vault.getAbstractFileByPath(current);
      if (existing instanceof TFolder) continue;
      if (existing) throw new Error(`Impossibile creare la cartella: ${current}`);
      await this.app.vault.createFolder(current);
    }
  }

  private async availableDetailPath(title: string): Promise<string> {
    const folder = detailFolder(this.getSettings().inboxPath);
    for (let suffix = 1; suffix < 10_000; suffix++) {
      const name = suffix === 1 ? title : `${title} ${suffix}`;
      const path = markdownPath(`${folder}/${name}`);
      if (!this.app.vault.getAbstractFileByPath(path)) return path;
    }
    throw new Error("Impossibile trovare un nome libero per la nota Dettagli");
  }

  private newBlockId(): string {
    const time = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 8);
    return `kairos-${time}-${random}`;
  }

  private findInsertedLine(content: string, line: string): number {
    const index = content.split(/\r?\n/).findIndex((candidate) => candidate === line);
    if (index === -1) throw new Error("Task creato ma posizione non trovata");
    return index;
  }

  private todayString(): string {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  private assertDate(date: string | null): void {
    if (date !== null && !isValidDay(date)) throw new Error(`Data non valida: ${date}`);
  }
}
