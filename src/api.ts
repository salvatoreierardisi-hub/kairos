import { DEFAULT_FILTER, matchesTask, TaskFilter } from "./core/query";
import { dayKey, effectiveDate, isValidDay } from "./core/dates";
import { TaskIndex } from "./index/TaskIndex";
import { TaskWriter } from "./io/TaskWriter";
import { NewTaskInput, Priority, Task, TaskStatus } from "./types";
import { formatTaskLine } from "./core/format";

export interface TaskRef { file: string; line: number; source: string; }
export interface CreateTaskOptions extends Partial<Omit<NewTaskInput, "text" | "important">> { important?: boolean; }

export interface KairosApiDescriptor {
  pluginId: "kairos";
  apiVersion: 1;
  taskRef: readonly ["file", "line", "source"];
  operations: readonly string[];
}

export class KairosApi {
  readonly apiVersion = 1 as const;
  readonly descriptor: KairosApiDescriptor = {
    pluginId: "kairos",
    apiVersion: 1,
    taskRef: ["file", "line", "source"],
    operations: ["allTasks", "query", "overdue", "today", "createTask", "completeTask", "setStatus", "reschedule", "setPriority", "moveToNote", "deleteTask", "openForDay", "openTask"],
  };

  constructor(
    private index: TaskIndex,
    private writer: TaskWriter,
    private openDay: (day: string) => Promise<void>,
    private openSource: (task: Task) => Promise<void>,
  ) {}

  allTasks(): Task[] { return this.index.getAll().map((task) => ({ ...task, tags: [...task.tags] })); }

  query(filter: Partial<TaskFilter>): Task[] {
    const complete: TaskFilter = { ...DEFAULT_FILTER, ...filter };
    return this.allTasks().filter((task) => matchesTask(task, complete, dayKey()));
  }

  overdue(): Task[] {
    const today = dayKey();
    return this.allTasks().filter((task) => task.status !== "done" && task.status !== "cancelled" && effectiveDate(task) !== null && effectiveDate(task)! < today);
  }

  today(): Task[] {
    const today = dayKey();
    return this.allTasks().filter((task) => task.status !== "done" && task.status !== "cancelled" && effectiveDate(task) === today);
  }

  async createTask(description: string, options: CreateTaskOptions = {}): Promise<TaskRef> {
    const input: NewTaskInput = {
      text: description,
      due: options.due ?? null,
      scheduled: options.scheduled ?? null,
      priority: options.priority ?? null,
      important: options.important ?? false,
      targetPath: options.targetPath,
      detailPath: options.detailPath,
      blockId: options.blockId,
    };
    const created = await this.writer.addTask(input);
    const task = this.index.getAll().find((candidate) => candidate.file === created.file.path && candidate.line === created.line);
    return task ? this.ref(task) : { file: created.file.path, line: created.line, source: formatTaskLine(input) };
  }

  async completeTask(ref: TaskRef): Promise<void> { await this.writer.setStatus(this.resolve(ref), "done"); }
  async setStatus(ref: TaskRef, status: TaskStatus): Promise<void> { await this.writer.setStatus(this.resolve(ref), status); }
  async reschedule(ref: TaskRef, date: string | null, field: "due" | "scheduled" = "due"): Promise<void> {
    const task = this.resolve(ref);
    await (field === "scheduled" ? this.writer.setScheduled(task, date) : this.writer.setDue(task, date));
  }
  async setPriority(ref: TaskRef, priority: Priority | null): Promise<void> { await this.writer.setPriority(this.resolve(ref), priority); }
  async moveToNote(ref: TaskRef, targetPath: string): Promise<void> { await this.writer.moveToNote(this.resolve(ref), targetPath); }
  async deleteTask(ref: TaskRef): Promise<void> { await this.writer.deleteTask(this.resolve(ref)); }
  async openForDay(day: string): Promise<void> {
    if (!isValidDay(day)) throw new Error(`Data non valida: ${day}`);
    await this.openDay(day);
  }
  async openTask(ref: TaskRef): Promise<void> { await this.openSource(this.resolve(ref)); }

  private resolve(ref: TaskRef): Task {
    const exact = this.index.getAll().find((task) => task.file === ref.file && task.line === ref.line && task.source === ref.source);
    if (exact) return exact;
    const moved = this.index.getAll().filter((task) => task.file === ref.file && task.source === ref.source);
    if (moved.length === 1) return moved[0];
    throw new Error("Riferimento task non più valido: aggiorna la query prima di modificare");
  }

  private ref(task: Task): TaskRef { return { file: task.file, line: task.line, source: task.source }; }
}
