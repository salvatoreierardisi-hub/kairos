import { App, Notice, TFile, TFolder, normalizePath } from "obsidian";
import { Task, NewTaskInput, Settings, TaskStatus, Priority } from "../types";
import { formatTaskLine } from "../core/format";
import { createInboxContent, insertTaskAtTop } from "../core/dailyInsert";
import { isAutomaticTaskPath, resolveAutomaticTarget } from "../core/placement";
import { locateTaskLine, locateTaskLines } from "../core/taskLine";
import { setStatusLine, toggleLine } from "../core/toggleLine";
import { addTagLine, setDueLine, setPriorityLine } from "../core/updateLine";
import { DailyNotesConfigService } from "./DailyNotesConfig";

function markdownPath(path: string): string {
  const normalized = normalizePath(path);
  return normalized.toLowerCase().endsWith(".md") ? normalized : `${normalized}.md`;
}

export class TaskWriter {
  constructor(
    private app: App,
    private getSettings: () => Settings,
    private dailyNotes: DailyNotesConfigService,
  ) {}

  async addTask(input: NewTaskInput): Promise<void> {
    const line = formatTaskLine(input);
    if (input.targetPath) {
      await this.insertInNote(markdownPath(input.targetPath), line);
      return;
    }

    if (input.due) {
      await this.insertInDaily(input.due, line);
      return;
    }
    await this.insertInInbox(line);
  }

  async toggleTask(task: Task): Promise<void> {
    await this.updateTaskLine(task, (line) => toggleLine(line, task.status, this.todayString()));
  }

  async setStatus(task: Task, status: TaskStatus): Promise<void> {
    await this.updateTaskLine(task, (line) => setStatusLine(line, status, this.todayString()));
  }

  async setDue(task: Task, due: string | null): Promise<void> {
    const settings = this.getSettings();
    const daily = await this.dailyNotes.resolve();
    if (!isAutomaticTaskPath(task.file, settings.inboxPath, daily.folder)) {
      await this.updateTaskLine(task, (line) => setDueLine(line, due));
      return;
    }

    const prepared = due ? await this.dailyNotes.prepare(due) : null;
    const target = resolveAutomaticTarget(due, settings.inboxPath, prepared?.path ?? null);
    const sourcePath = normalizePath(task.file);
    const file = this.app.vault.getAbstractFileByPath(sourcePath);
    if (!(file instanceof TFile)) throw new Error(`Nota sorgente non trovata: ${sourcePath}`);
    const sourceLines = (await this.app.vault.read(file)).split("\n");
    const sourceIndex = locateTaskLine(sourceLines, task.line, task.source);
    const updatedLine = setDueLine(sourceLines[sourceIndex], due);

    if (normalizePath(target) === sourcePath) {
      sourceLines[sourceIndex] = updatedLine;
      await this.app.vault.modify(file, sourceLines.join("\n"));
      return;
    }

    if (due) await this.insertPreparedDaily(prepared!, updatedLine);
    else await this.insertInInbox(updatedLine);

    const latestLines = (await this.app.vault.read(file)).split("\n");
    const latestIndex = locateTaskLine(latestLines, sourceIndex, task.source);
    latestLines.splice(latestIndex, 1);
    try {
      await this.app.vault.modify(file, latestLines.join("\n"));
    } catch (error) {
      throw new Error(`task copiato nella destinazione ma non rimosso dalla sorgente: ${String(error)}`);
    }
  }

  async addTag(task: Task, tag: string): Promise<void> {
    await this.updateTaskLine(task, (line) => addTagLine(line, tag));
  }

  async setPriority(task: Task, priority: Priority | null): Promise<void> {
    await this.updateTaskLine(task, (line) => setPriorityLine(line, priority));
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

  private async insertInInbox(line: string): Promise<void> {
    const path = markdownPath(this.getSettings().inboxPath);
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) {
      const content = await this.app.vault.read(existing);
      await this.app.vault.modify(existing, insertTaskAtTop(content, line));
      return;
    }
    await this.createFile(path, createInboxContent(line));
  }

  private async insertInDaily(date: string, line: string): Promise<void> {
    await this.insertPreparedDaily(await this.dailyNotes.prepare(date), line);
  }

  private async insertPreparedDaily(
    prepared: Awaited<ReturnType<DailyNotesConfigService["prepare"]>>,
    line: string,
  ): Promise<void> {
    const existing = this.app.vault.getAbstractFileByPath(prepared.path);
    if (existing instanceof TFile) {
      const content = await this.app.vault.read(existing);
      await this.app.vault.modify(existing, insertTaskAtTop(content, line));
    } else {
      await this.createFile(prepared.path, insertTaskAtTop(prepared.initialContent, line));
    }
    if (prepared.warning) new Notice(`Kairos: ${prepared.warning}`);
  }

  private async insertInNote(path: string, line: string): Promise<void> {
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) {
      const content = await this.app.vault.read(existing);
      await this.app.vault.modify(existing, insertTaskAtTop(content, line));
      return;
    }
    await this.createFile(path, insertTaskAtTop("", line));
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

  private todayString(): string {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
}
