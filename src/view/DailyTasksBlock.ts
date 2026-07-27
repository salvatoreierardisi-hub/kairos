import { App, MarkdownRenderChild, Notice, setIcon, TFile } from "obsidian";
import { TaskIndex } from "../index/TaskIndex";
import { TaskWriter } from "../io/TaskWriter";
import { Task } from "../types";
import { sortTasks } from "../core/sorting";

export class DailyTasksBlock extends MarkdownRenderChild {
  private unsubscribe: (() => void) | null = null;

  constructor(
    containerEl: HTMLElement,
    private app: App,
    private date: string,
    private index: TaskIndex,
    private writer: TaskWriter,
    private onEditTask: (task: Task) => void,
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
  }

  private tasks(): Task[] {
    return sortTasks(
      this.index.getAll().filter(
        (task) =>
          task.due === this.date &&
          (task.status === "open" || task.status === "inProgress"),
      ),
      "priority",
    );
  }

  private render(): void {
    this.containerEl.empty();
    const tasks = this.tasks();
    if (tasks.length === 0) {
      this.containerEl.createDiv({ cls: "kairos-daily-empty", text: "Nessun task per questa data." });
      return;
    }

    for (const task of tasks) {
      const row = this.containerEl.createDiv({ cls: "kairos-daily-task" });
      const check = row.createEl("button", {
        cls: "kairos-daily-check",
        attr: { "aria-label": "Completa task", type: "button" },
      });
      setIcon(check, task.status === "inProgress" ? "circle-dot" : "circle");
      check.addEventListener("click", (event) => {
        event.stopPropagation();
        void this.writer.toggleTask(task).catch((error) =>
          new Notice(`Kairos: impossibile aggiornare il task — ${error instanceof Error ? error.message : String(error)}`),
        );
      });

      const body = row.createEl("button", { cls: "kairos-daily-task__body", attr: { type: "button" } });
      body.createSpan({ cls: "kairos-daily-task__text", text: task.text || "(senza testo)" });
      body.createSpan({
        cls: "kairos-daily-task__source",
        text: task.file.substring(task.file.lastIndexOf("/") + 1).replace(/\.md$/i, ""),
      });
      body.addEventListener("click", () => this.onEditTask(task));

      const open = row.createEl("button", {
        cls: "kairos-daily-open",
        attr: { "aria-label": "Apri nota sorgente", type: "button" },
      });
      setIcon(open, "file-symlink");
      open.addEventListener("click", () => void this.openSource(task));
    }
  }

  private async openSource(task: Task): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(task.file);
    if (!(file instanceof TFile)) return;
    await this.app.workspace.getLeaf("tab").openFile(file, { eState: { line: task.line } });
  }
}
