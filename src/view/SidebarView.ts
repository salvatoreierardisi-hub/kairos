import { ItemView, WorkspaceLeaf } from "obsidian";
import { TaskIndex } from "../index/TaskIndex";
import { TaskWriter } from "../io/TaskWriter";
import { TaskPanel, PanelContext } from "./TaskPanel";
import { Settings, Task } from "../types";

export const VIEW_TYPE_KAIROS_SIDEBAR = "kairos-sidebar-view";

/**
 * Guscio compatto per la leaf laterale: stesso TaskPanel di AttivitaView ma in
 * densità `compact` e senza Inspector. Il click su una riga è gestito dal panel
 * e apre direttamente la nota alla riga del task.
 */
export class SidebarView extends ItemView {
  private panel: TaskPanel | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private index: TaskIndex,
    private writer: TaskWriter,
    private getSettings: () => Settings,
    private saveSettings: () => Promise<void>,
    private onQuickAdd: (targetPath?: string) => void,
    private onEditTask: (task: Task) => void,
    private onExpand: () => void,
  ) {
    super(leaf);
  }

  getViewType(): string { return VIEW_TYPE_KAIROS_SIDEBAR; }
  getDisplayText(): string { return "Kairos"; }
  getIcon(): string { return "circle-check"; }

  async onOpen(): Promise<void> {
    this.containerEl.addClass("kairos-sidebar-surface");
    const root = this.contentEl;
    root.empty();
    root.addClass("kairos-root");
    const panelContainer = root.createDiv({ cls: "kairos-panel-host" });

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
        compact: true,
        onStateChange: () => this.persistState(),
        onExpand: () => this.onExpand(),
      },
    );
    this.panel.mount();
  }

  async onClose(): Promise<void> {
    this.panel?.unmount();
    this.panel = null;
    this.containerEl.removeClass("kairos-sidebar-surface");
  }

  private persistState(): void {
    if (!this.panel) return;
    this.getSettings().panelState = this.panel.getState();
    void this.saveSettings();
  }
}
