import { App, MarkdownRenderChild, Notice, setIcon, TFile } from "obsidian";
import { TaskIndex } from "../index/TaskIndex";
import { TaskWriter } from "../io/TaskWriter";
import { Task } from "../types";
import { sortTasks } from "../core/sorting";
import { tasksForDay } from "../core/query";
import { displayTaskText } from "../core/taskText";

export class DailyTasksBlock extends MarkdownRenderChild {
  private unsubscribe: (() => void) | null = null;
  private collapsed = false;

  constructor(
    containerEl: HTMLElement,
    private app: App,
    private date: string,
    private index: TaskIndex,
    private writer: TaskWriter,
    private onEditTask: (task: Task) => void,
    private onAddTask: (date: string) => void,
    private releaseProjection: () => void,
  ) {
    super(containerEl);
  }

  onload(): void {
    this.containerEl.addClass("kairos-daily-block");
    this.unsubscribe = this.index.onChange(() => this.render());
    this.render();
  }

  onunload(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.releaseProjection();
  }

  private tasks(): Task[] {
    return sortTasks(
      tasksForDay(this.index.getAll(), this.date),
      "priority",
    );
  }

  private render(): void {
    this.containerEl.empty();
    const header = this.containerEl.createDiv({ cls: "kairos-daily-header" });
    const toggle = header.createEl("button", {
      cls: "kairos-daily-header__toggle",
      attr: { type: "button", "aria-expanded": String(!this.collapsed) },
    });
    setIcon(toggle.createSpan({ cls: "kairos-daily-header__chevron" }), this.collapsed ? "chevron-right" : "chevron-down");
    toggle.createSpan({ cls: "kairos-daily-header__title", text: "Task" });
    toggle.setAttribute("aria-label", this.collapsed ? "Espandi task" : "Comprimi task");
    toggle.addEventListener("click", () => {
      this.collapsed = !this.collapsed;
      this.render();
    });

    const add = header.createEl("button", {
      cls: "kairos-daily-header__add",
      attr: { type: "button", "aria-label": "Aggiungi task per questa data" },
    });
    add.createSpan({ cls: "kairos-daily-header__add-symbol", text: "+" });
    add.addEventListener("click", () => this.onAddTask(this.date));

    if (this.collapsed) return;

    const list = this.containerEl.createDiv({ cls: "kairos-daily-list" });
    const tasks = this.tasks();
    if (tasks.length === 0) {
      list.createDiv({ cls: "kairos-daily-empty", text: "Nessun task per questa data." });
      return;
    }

    for (const task of tasks) {
      const row = list.createDiv({ cls: "kairos-daily-task" });
      const check = row.createEl("button", {
        cls: "kairos-daily-check",
        attr: { "aria-label": "Completa task", type: "button" },
      });
      check.createSpan({
        cls: task.status === "inProgress"
          ? "kairos-daily-complete-icon is-in-progress"
          : "kairos-daily-complete-icon",
      });
      check.addEventListener("click", (event) => {
        event.stopPropagation();
        void this.writer.toggleTask(task).catch((error) =>
          new Notice(`Kairos: impossibile aggiornare il task — ${error instanceof Error ? error.message : String(error)}`),
        );
      });

      const body = row.createEl("button", { cls: "kairos-daily-task__body", attr: { type: "button" } });
      body.createSpan({ cls: "kairos-daily-task__text", text: displayTaskText(task.text) || "(senza testo)" });
      body.createSpan({
        cls: "kairos-daily-task__source",
        text: task.file.substring(task.file.lastIndexOf("/") + 1).replace(/\.md$/i, ""),
      });
      body.addEventListener("click", () => this.onEditTask(task));

      const open = row.createEl("button", {
        cls: "kairos-daily-open",
        attr: { "aria-label": "Apri nota sorgente", type: "button" },
      });
      open.createSpan({ cls: "kairos-daily-source-icon" });
      open.addEventListener("click", () => void this.openSource(task));
    }
  }

  private async openSource(task: Task): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(task.file);
    if (!(file instanceof TFile)) return;
    await this.app.workspace.getLeaf("tab").openFile(file, { eState: { line: task.line } });
  }
}
