import { Notice, Plugin, WorkspaceLeaf } from "obsidian";
import { Settings, DEFAULT_SETTINGS, NewTaskInput } from "./types";
import { TaskIndex } from "./index/TaskIndex";
import { TaskWriter } from "./io/TaskWriter";
import { DailyNotesConfigService, EffectiveDailyConfig } from "./io/DailyNotesConfig";
import { AttivitaView, VIEW_TYPE_KAIROS } from "./view/AttivitaView";
import { SidebarView, VIEW_TYPE_KAIROS_SIDEBAR } from "./view/SidebarView";
import { QuickAddModal } from "./view/QuickAddModal";
import { KairosSettingTab } from "./settings/SettingsTab";

export default class KairosPlugin extends Plugin {
  settings: Settings = DEFAULT_SETTINGS;
  private index!: TaskIndex;
  private writer!: TaskWriter;
  private dailyNotes!: DailyNotesConfigService;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.index = new TaskIndex(this.app);
    this.dailyNotes = new DailyNotesConfigService(this.app, () => this.settings);
    this.writer = new TaskWriter(this.app, () => this.settings, this.dailyNotes);
    this.index.registerVaultEvents(this);

    this.registerView(
      VIEW_TYPE_KAIROS,
      (leaf: WorkspaceLeaf) =>
        new AttivitaView(
          leaf,
          this.index,
          this.writer,
          () => this.settings,
          () => this.saveSettings(),
          (targetPath?: string) => this.openQuickAdd(targetPath),
        ),
    );

    this.registerView(
      VIEW_TYPE_KAIROS_SIDEBAR,
      (leaf: WorkspaceLeaf) =>
        new SidebarView(
          leaf,
          this.index,
          this.writer,
          () => this.settings,
          () => this.saveSettings(),
          (targetPath?: string) => this.openQuickAdd(targetPath),
          () => this.activateView(),
        ),
    );

    this.addRibbonIcon("circle-check", "Kairos", () => this.activateView());
    this.addCommand({ id: "open-kairos", name: "Apri Kairos", callback: () => this.activateView() });
    this.addCommand({
      id: "quick-add-task",
      name: "Nuovo task (Kairos)",
      callback: () => this.openQuickAdd(this.app.workspace.getActiveFile()?.path),
    });
    this.addCommand({
      id: "open-kairos-sidebar",
      name: "Apri Kairos nella sidebar",
      callback: () => this.activateSidebar(),
    });

    this.addSettingTab(new KairosSettingTab(this.app, this));

    this.app.workspace.onLayoutReady(() => this.index.build());
  }

  private openQuickAdd(targetPath?: string): void {
    new QuickAddModal(
      this.app,
      async (input: NewTaskInput) => {
        try {
          await this.writer.addTask(input);
        } catch (err) {
          new Notice("Kairos: impossibile salvare il task — " + (err instanceof Error ? err.message : String(err)));
          throw err;
        }
      },
      targetPath,
    ).open();
  }

  private async activateView(): Promise<void> {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_KAIROS)[0];
    if (!leaf) {
      leaf = workspace.getLeaf(true);
      await leaf.setViewState({ type: VIEW_TYPE_KAIROS, active: true });
    }
    workspace.revealLeaf(leaf);
  }

  private async activateSidebar(): Promise<void> {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_KAIROS_SIDEBAR)[0];
    if (!leaf) {
      const rightLeaf = workspace.getRightLeaf(false);
      if (!rightLeaf) return;
      leaf = rightLeaf;
      await leaf.setViewState({ type: VIEW_TYPE_KAIROS_SIDEBAR, active: true });
    }
    workspace.revealLeaf(leaf);
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.index.refresh();
  }

  async getEffectiveDailySettings(): Promise<EffectiveDailyConfig> {
    return await this.dailyNotes.resolve();
  }
}
