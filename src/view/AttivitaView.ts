import { ItemView, WorkspaceLeaf, TFile, setIcon, Notice } from "obsidian";
import { displayTaskText } from "../core/taskText";
import { TaskIndex } from "../index/TaskIndex";
import { TaskWriter } from "../io/TaskWriter";
import { TaskPanel, PanelContext } from "./TaskPanel";
import { PRIORITY_LABELS } from "../core/query";
import { Task, Settings, TaskStatus, TaskPanelState } from "../types";

export const VIEW_TYPE_KAIROS = "kairos-view";

const STATUS_LABEL: Record<TaskStatus, string> = {
  open: "Da fare",
  inProgress: "In corso",
  done: "Fatto",
  cancelled: "Annullato",
};

function noteTitle(path: string): string {
  return path.substring(path.lastIndexOf("/") + 1).replace(/\.md$/i, "");
}

function todayString(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Guscio a pagina piena: istanzia il TaskPanel in densità normale e conserva
 * l'Inspector, aperto solo da azione esplicita (menu riga o scorciatoia `e`).
 */
export class AttivitaView extends ItemView {
  private panel: TaskPanel | null = null;
  private shellEl!: HTMLElement;
  private selectedTask: Task | null = null;
  private unsubscribeIndex: (() => void) | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private index: TaskIndex,
    private writer: TaskWriter,
    private getSettings: () => Settings,
    private saveSettings: () => Promise<void>,
    private onQuickAdd: (targetPath?: string) => void,
    private onEditTask: (task: Task) => void,
  ) {
    super(leaf);
  }

  getViewType(): string { return VIEW_TYPE_KAIROS; }
  getDisplayText(): string { return "Attività"; }
  getIcon(): string { return "circle-check"; }

  async onOpen(): Promise<void> {
    const root = this.contentEl;
    root.empty();
    root.addClass("kairos-root");
    this.shellEl = root.createDiv({ cls: "kairos-shell" });
    const panelContainer = this.shellEl.createDiv({ cls: "kairos-panel-host" });

    const ctx: PanelContext = {
      app: this.app,
      index: this.index,
      writer: this.writer,
      getSettings: this.getSettings,
      saveSettings: this.saveSettings,
      onQuickAdd: this.onQuickAdd,
      onEditTask: this.onEditTask,
    };

    this.panel = new TaskPanel(
      panelContainer,
      ctx,
      this.getSettings().panelState ?? {},
      {
        compact: false,
        onStateChange: () => this.persistState(),
        onOpenInspector: (task) => this.showInspector(task),
      },
    );
    this.panel.mount();

    // Ridisegna l'Inspector quando l'indice cambia (il task selezionato può sparire).
    this.unsubscribeIndex = this.index.onChange(() => this.renderInspector());
  }

  async onClose(): Promise<void> {
    this.panel?.unmount();
    this.panel = null;
    if (this.unsubscribeIndex) this.unsubscribeIndex();
    this.unsubscribeIndex = null;
  }

  applyPanelState(state: TaskPanelState): void {
    this.panel?.applyState(state);
  }

  private persistState(): void {
    if (!this.panel) return;
    this.getSettings().panelState = this.panel.getState();
    void this.saveSettings();
  }

  // ── Inspector ───────────────────────────────────────────────────────

  private showInspector(task: Task): void {
    this.selectedTask = task;
    this.renderInspector();
  }

  private currentTask(): Task | null {
    if (!this.selectedTask) return null;
    const sameFile = this.index.getAll().filter((task) => task.file === this.selectedTask?.file);
    const exact = sameFile.find(
      (task) => task.line === this.selectedTask?.line && task.source === this.selectedTask?.source,
    );
    if (exact) return exact;
    const sameSource = sameFile.filter((task) => task.source === this.selectedTask?.source);
    return sameSource.length === 1 ? sameSource[0] : null;
  }

  private renderInspector(): void {
    this.shellEl.querySelector(".kairos-inspector")?.remove();
    const task = this.currentTask();
    if (!task) return;

    const today = todayString();
    const inspector = this.shellEl.createDiv({ cls: "kairos-inspector" });

    const head = inspector.createDiv({ cls: "kairos-inspector-head" });
    head.createDiv({ cls: "kairos-inspector-title", text: "Dettagli" });
    const close = head.createEl("button", { cls: "kairos-icon-button" });
    setIcon(close, "x");
    close.onclick = () => {
      this.selectedTask = null;
      this.renderInspector();
    };

    inspector.createDiv({ cls: "kairos-inspector-task", text: displayTaskText(task.text) || "(senza testo)" });
    this.renderInspectorRow(inspector, "Stato", STATUS_LABEL[task.status]);
    this.renderInspectorRow(inspector, "Data", task.due ?? "Senza data");
    this.renderInspectorRow(inspector, "Priorità", task.priority === null ? "—" : PRIORITY_LABELS[task.priority]);
    this.renderInspectorRow(inspector, "Nota origine", noteTitle(task.file));
    this.renderInspectorRow(
      inspector,
      "Tag",
      task.tags.length > 0 ? task.tags.map((tag) => `#${tag}`).join(" ") : "—",
    );

    const actions = inspector.createDiv({ cls: "kairos-inspector-actions" });
    this.action(actions, "Oggi", () => this.writer.setDue(task, today));
    this.action(actions, "Domani", () => this.writer.setDue(task, addDays(today, 1)));
    this.action(actions, "Settimana", () => this.writer.setDue(task, addDays(today, 7)));
    this.action(actions, "In corso", () => this.writer.setStatus(task, "inProgress"));
    this.action(actions, "Completa", () => this.writer.setStatus(task, "done"));
    this.action(actions, "Annulla", () => this.writer.setStatus(task, "cancelled"));

    const open = inspector.createEl("button", { cls: "kairos-open-source", text: "Apri nota" });
    open.onclick = () => void this.openSource(task);
  }

  private renderInspectorRow(parent: HTMLElement, label: string, value: string): void {
    const row = parent.createDiv({ cls: "kairos-inspector-row" });
    row.createSpan({ cls: "kairos-inspector-label", text: label });
    row.createSpan({ cls: "kairos-inspector-value", text: value });
  }

  private action(parent: HTMLElement, label: string, run: () => Promise<void>): void {
    const button = parent.createEl("button", { cls: "kairos-mini-action", text: label });
    button.onclick = async (event) => {
      event.stopPropagation();
      try {
        await run();
      } catch (err) {
        new Notice(`Kairos: impossibile aggiornare il task — ${err instanceof Error ? err.message : String(err)}`);
      }
    };
  }

  private async openSource(task: Task): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(task.file);
    if (file instanceof TFile) {
      const leaf = this.app.workspace.getLeaf(false);
      await leaf.openFile(file, { eState: { line: task.line } });
    }
  }
}
