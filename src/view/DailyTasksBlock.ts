import { App, MarkdownRenderChild, Notice, setIcon, TFile } from "obsidian";
import { TaskIndex } from "../index/TaskIndex";
import { TaskWriter } from "../io/TaskWriter";
import { Priority, Task } from "../types";
import { sortTasks } from "../core/sorting";
import { orderDailyTasks, tasksForDay } from "../core/query";
import { openTaskReference, renderTaskTextWithReferences } from "./TaskReferenceView";

const PRIORITY_ICON: Record<Priority, string> = {
  highest: "🔺",
  high: "⏫",
  medium: "🔼",
  low: "🔽",
  lowest: "⏬",
};

function nearestScrollContainer(element: HTMLElement): HTMLElement | null {
  let current = element.parentElement;
  while (current) {
    const overflowY = window.getComputedStyle(current).overflowY;
    if (/auto|scroll|overlay/.test(overflowY) && current.scrollHeight > current.clientHeight) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

export class DailyTasksBlock extends MarkdownRenderChild {
  private unsubscribe: (() => void) | null = null;
  private collapsed = false;
  private signature: string | null = null;

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
    this.unsubscribe = this.index.onChange(() => this.renderIfChanged());
    this.renderIfChanged(true);
  }

  onunload(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.releaseProjection();
  }

  private tasks(): Task[] {
    return orderDailyTasks(sortTasks(
      tasksForDay(this.index.getAll(), this.date),
      "priority",
    ));
  }

  private renderIfChanged(force = false): void {
    const tasks = this.tasks();
    const signature = JSON.stringify(tasks.map((task) => [
      task.file,
      task.line,
      task.source,
      task.detailPath
        ? this.app.vault.getAbstractFileByPath(task.detailPath) instanceof TFile
        : false,
    ]));
    if (!force && signature === this.signature) return;
    this.signature = signature;
    this.render(tasks);
  }

  private render(tasks: Task[]): void {
    this.containerEl.empty();
    const header = this.containerEl.createDiv({ cls: "kairos-daily-header" });
    const toggle = header.createEl("button", {
      cls: "kairos-daily-header__toggle",
      attr: { type: "button", "aria-expanded": String(!this.collapsed) },
    });
    setIcon(toggle.createSpan({ cls: "kairos-daily-header__chevron" }), this.collapsed ? "chevron-right" : "chevron-down");
    toggle.createSpan({ cls: "kairos-daily-header__title", text: "Task" });
    toggle.setAttribute("aria-label", this.collapsed ? "Espandi task" : "Comprimi task");

    const add = header.createEl("button", {
      cls: "kairos-daily-header__add",
      attr: { type: "button", "aria-label": "Aggiungi task per questa data" },
    });
    add.createSpan({ cls: "kairos-daily-header__add-symbol", text: "+" });
    add.addEventListener("click", () => this.onAddTask(this.date));

    const list = this.containerEl.createDiv({ cls: "kairos-daily-list" });
    list.toggleClass("is-collapsed", this.collapsed);
    toggle.addEventListener("click", () => {
      const scrollContainer = nearestScrollContainer(toggle);
      const scrollTop = scrollContainer?.scrollTop ?? window.scrollY;
      this.collapsed = !this.collapsed;
      toggle.setAttribute("aria-expanded", String(!this.collapsed));
      toggle.setAttribute("aria-label", this.collapsed ? "Espandi task" : "Comprimi task");
      setIcon(
        toggle.querySelector<HTMLElement>(".kairos-daily-header__chevron")!,
        this.collapsed ? "chevron-right" : "chevron-down",
      );
      list.toggleClass("is-collapsed", this.collapsed);
      const restoreScroll = () => {
        if (scrollContainer) scrollContainer.scrollTop = scrollTop;
        else window.scrollTo({ top: scrollTop });
      };
      restoreScroll();
      window.requestAnimationFrame(restoreScroll);
    });

    if (tasks.length === 0) {
      list.createDiv({ cls: "kairos-daily-empty", text: "Nessun task per questa data." });
      return;
    }

    for (const task of tasks) {
      const isDone = task.status === "done";
      const isProtectedRecurrence = isDone && task.source.includes("🔁");
      const row = list.createDiv({
        cls: `kairos-daily-task kairos-status-${task.status}${isProtectedRecurrence ? " is-protected-recurrence" : ""}`,
      });
      const check = row.createEl("button", {
        cls: "kairos-daily-check",
        attr: {
          "aria-label": isProtectedRecurrence
            ? "Task ricorrente completato; la prossima occorrenza è già stata creata"
            : isDone ? "Riapri task" : "Completa task",
          "aria-disabled": String(isProtectedRecurrence),
          "aria-pressed": String(isDone),
          type: "button",
          ...(isProtectedRecurrence
            ? { title: "Ricorrenza completata: la prossima occorrenza è già stata creata" }
            : {}),
        },
      });
      check.createSpan({
        cls: `kairos-checkmark kairos-checkmark--${task.status}`,
      });
      check.addEventListener("click", (event) => {
        event.stopPropagation();
        if (isProtectedRecurrence) return;
        void this.writer.toggleTask(task).catch((error) =>
          new Notice(`Kairos: impossibile aggiornare il task — ${error instanceof Error ? error.message : String(error)}`),
        );
      });

      const body = row.createDiv({
        cls: "kairos-daily-task__body",
        attr: { role: "button", tabindex: "0", "aria-label": "Modifica task" },
      });
      const title = body.createDiv({ cls: "kairos-daily-task__text" });
      if (task.text.trim()) {
        renderTaskTextWithReferences(title, task.text, (reference) => {
          void openTaskReference(this.app, task.file, reference);
        });
      } else {
        title.setText("(senza testo)");
      }
      if (task.priority !== null) {
        title.createSpan({ cls: "kairos-badge", text: PRIORITY_ICON[task.priority] });
      }

      const meta = body.createDiv({ cls: "kairos-daily-task__meta" });
      const source = meta.createSpan({
        cls: "kairos-pill kairos-daily-task__source",
        text: task.file.substring(task.file.lastIndexOf("/") + 1).replace(/\.md$/i, ""),
        attr: { role: "link", tabindex: "0", "aria-label": "Apri nota sorgente" },
      });
      const openSource = (event: Event) => {
        event.stopPropagation();
        void this.openSource(task);
      };
      source.addEventListener("click", openSource);
      source.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        openSource(event);
      });

      const detailFile = task.detailPath
        ? this.app.vault.getAbstractFileByPath(task.detailPath)
        : null;
      if (task.detailPath && detailFile instanceof TFile) {
        const detail = meta.createSpan({
          cls: "kairos-pill kairos-detail-link",
          text: "Dettagli",
          attr: { role: "link", tabindex: "0" },
        });
        const openDetail = (event: Event) => {
          event.stopPropagation();
          void this.app.workspace.getLeaf("tab").openFile(detailFile);
        };
        detail.addEventListener("click", openDetail);
        detail.addEventListener("keydown", (event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          openDetail(event);
        });
      }
      body.addEventListener("click", () => this.onEditTask(task));
      body.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        this.onEditTask(task);
      });
    }
  }

  private async openSource(task: Task): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(task.file);
    if (!(file instanceof TFile)) return;
    await this.app.workspace.getLeaf("tab").openFile(file, { eState: { line: task.line } });
  }
}
