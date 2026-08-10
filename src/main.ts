import {
  MarkdownPostProcessorContext,
  normalizePath,
  Notice,
  Platform,
  Plugin,
  TFile,
  TFolder,
  WorkspaceLeaf,
} from "obsidian";
import { Settings, DEFAULT_SETTINGS, Task, TaskPanelState } from "./types";
import { TaskIndex } from "./index/TaskIndex";
import { TaskWriter } from "./io/TaskWriter";
import { DailyNotesConfigService, EffectiveDailyConfig } from "./io/DailyNotesConfig";
import { AttivitaView, VIEW_TYPE_KAIROS } from "./view/AttivitaView";
import { SidebarView, VIEW_TYPE_KAIROS_SIDEBAR } from "./view/SidebarView";
import { QuickAddModal } from "./view/QuickAddModal";
import { KairosSettingTab } from "./settings/SettingsTab";
import { DailyTasksBlock } from "./view/DailyTasksBlock";
import { ensureDailyTasksBlock } from "./core/dailyInsert";
import { KairosApi } from "./api";
import { DEFAULT_FILTER } from "./core/query";
import { dayKey, effectiveDate } from "./core/dates";
import { normalizeExcludedFolders } from "./core/settings";
import { archiveFolderPath } from "./core/archive";
import { InboxArchive } from "./io/InboxArchive";
import { openFolderReference } from "./view/TaskReferenceView";

export default class KairosPlugin extends Plugin {
  api!: KairosApi;
  settings: Settings = DEFAULT_SETTINGS;
  private index!: TaskIndex;
  private writer!: TaskWriter;
  private archive!: InboxArchive;
  private dailyNotes!: DailyNotesConfigService;
  private uiSaveTimer: number | null = null;
  private archiveLastRunDay: string | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();
    try {
      await this.migrateLegacyInbox();
    } catch (error) {
      new Notice(`Kairos: migrazione Inbox non riuscita — ${error instanceof Error ? error.message : String(error)}`);
    }

    this.index = new TaskIndex(this.app, () => this.settings);
    this.dailyNotes = new DailyNotesConfigService(this.app, () => this.settings);
    this.archive = new InboxArchive(this.app, () => this.settings);
    this.writer = new TaskWriter(this.app, () => this.settings, this.archive);
    this.api = new KairosApi(
      this.index,
      this.writer,
      (day) => this.openForDay(day),
      (task) => this.openTaskSource(task),
    );
    this.index.registerVaultEvents(this);
    this.registerObsidianProtocolHandler("kairos-folder", (params) => {
      if (typeof params.path === "string") openFolderReference(this.app, params.path);
    });

    this.registerMarkdownCodeBlockProcessor("kairos-tasks", async (_source, el, ctx) => {
      const wasConnected = el.isConnected;
      const date = await this.dailyNotes.dateForPath(ctx.sourcePath);
      if (wasConnected && !el.isConnected) return;
      if (!date) {
        el.createDiv({ cls: "kairos-daily-empty", text: "Questa vista Kairos funziona dentro una daily configurata." });
        return;
      }
      const releaseProjection = this.claimDailyProjection(el, ctx);
      ctx.addChild(
        new DailyTasksBlock(
          el,
          this.app,
          date,
          this.index,
          this.writer,
          (task) => this.openTaskEditor(task),
          (taskDate) => this.openQuickAdd(undefined, taskDate),
          releaseProjection,
        ),
      );
    });

    this.registerView(
      VIEW_TYPE_KAIROS,
      (leaf: WorkspaceLeaf) =>
        new AttivitaView(
          leaf,
          this.index,
          this.writer,
          () => this.settings,
          () => this.saveUiState(),
          (targetPath?: string) => this.openQuickAdd(targetPath),
          (task: Task) => this.openTaskEditor(task),
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
          () => this.saveUiState(),
          (targetPath?: string) => this.openQuickAdd(targetPath),
          (task: Task) => this.openTaskEditor(task),
          () => this.activateView(),
        ),
    );

    this.addRibbonIcon("circle-check", "Kairos", () =>
      Platform.isMobile ? this.activateView() : this.activateSidebar(),
    );
    this.addCommand({
      id: "open-kairos",
      name: "Apri Kairos come pagina",
      callback: () => this.activateView(),
    });
    this.addCommand({
      id: "open-today",
      name: "Apri i task di oggi (Kairos)",
      callback: () => this.openForDay(dayKey()),
    });
    this.addCommand({
      id: "open-upcoming",
      name: "Apri i prossimi task (Kairos)",
      callback: () => this.openUpcoming(),
    });
    this.addCommand({
      id: "quick-add-task",
      name: "Nuovo task in Inbox (Kairos)",
      callback: () => this.openQuickAdd(),
    });
    this.addCommand({
      id: "quick-add-task-in-current-note",
      name: "Nuovo task nella nota corrente (Kairos)",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file) return false;
        if (!checking) this.openQuickAdd(file.path);
        return true;
      },
    });
    this.addCommand({
      id: "open-kairos-sidebar",
      name: "Apri Kairos nella sidebar",
      callback: () => this.activateSidebar(),
    });
    this.addCommand({
      id: "open-task-list",
      name: "Apri lista task (alias integrazioni Kairos)",
      callback: () => this.activateView(),
    });
    this.addCommand({
      id: "open-task-sidebar",
      name: "Apri sidebar task (alias integrazioni Kairos)",
      callback: () => this.activateSidebar(),
    });
    this.addCommand({
      id: "check-inbox-archive",
      name: "Controlla archivio Inbox (Kairos)",
      callback: () => void this.previewInboxArchive(),
    });

    this.addSettingTab(new KairosSettingTab(this.app, this));

    const status = this.addStatusBarItem();
    const refreshStatus = () => {
      const today = dayKey();
      const overdue = this.index.getAll().filter((task) =>
        task.status !== "done" && task.status !== "cancelled" && effectiveDate(task) !== null && effectiveDate(task)! < today,
      ).length;
      status.setText(overdue > 0 ? `Kairos · ${overdue} in ritardo` : "Kairos · in ordine");
      status.setAttribute("aria-label", "Apri i task di oggi in Kairos");
    };
    status.addEventListener("click", () => void this.openForDay(dayKey()));
    this.register(this.index.onChange(refreshStatus));
    this.register(this.index.onChange(() => {
      if (this.settings.autoArchiveCompleted && this.archiveLastRunDay !== dayKey()) {
        void this.runAutomaticArchive();
      }
    }));
    refreshStatus();

    this.registerEvent(
      this.app.workspace.on("file-open", (file) => {
        if (file) void this.ensureDailyProjection(file);
      }),
    );

    this.app.workspace.onLayoutReady(() => {
      void (async () => {
        try {
          await this.writer.organizeInbox();
        } catch (error) {
          new Notice(`Kairos: riordino Inbox non riuscito — ${error instanceof Error ? error.message : String(error)}`);
        }
        await this.index.build();
        await this.runAutomaticArchive();
      })();
      const active = this.app.workspace.getActiveFile();
      if (active) void this.ensureDailyProjection(active);
      if (Platform.isMobile) void this.prepareMobileSidebar();
    });
  }

  private openQuickAdd(targetPath?: string, initialDue?: string): void {
    new QuickAddModal(
      this.app,
      async (input) => {
        try {
          const taskInput = {
            text: input.text,
            due: input.due,
            scheduled: input.scheduled,
            priority: input.priority,
            important: false,
            targetPath: input.targetPath,
          };
          if (input.createMode === "create") {
            await this.writer.addTask(taskInput);
            return;
          }

          if (input.targetPath) {
            const created = await this.writer.addTask(taskInput);
            await this.app.workspace.getLeaf("tab").openFile(created.file, {
              eState: { line: created.line },
            });
            return;
          }

          const created = await this.writer.addTaskWithDetail(taskInput);
          if (created.detailFile) {
            await this.app.workspace.getLeaf("tab").openFile(created.detailFile);
          }
        } catch (err) {
          new Notice("Kairos: impossibile salvare il task — " + (err instanceof Error ? err.message : String(err)));
          throw err;
        }
      },
      targetPath,
      undefined,
      undefined,
      initialDue,
    ).open();
  }

  private claimDailyProjection(el: HTMLElement, ctx: MarkdownPostProcessorContext): () => void {
    const line = ctx.getSectionInfo(el)?.lineStart ?? "daily";
    const key = `${ctx.sourcePath}:${line}`;
    const host = el.closest<HTMLElement>(".cm-embed-block");

    // Reading view has a single renderer and must never be hidden by Live Preview
    // deduplication during an asynchronous mode transition.
    if (!host) {
      delete el.dataset.kairosDailyProjection;
      el.removeClass("kairos-daily-projection--duplicate");
      return () => {};
    }

    const viewRoot = el.closest<HTMLElement>(".workspace-leaf-content") ?? el.ownerDocument.body;
    const previousHosts = new Set<HTMLElement>();

    for (const candidate of Array.from(
      viewRoot.querySelectorAll<HTMLElement>("[data-kairos-daily-projection]"),
    )) {
      if (
        candidate.matches(".cm-embed-block") &&
        candidate.dataset.kairosDailyProjection === key &&
        candidate !== host
      ) {
        previousHosts.add(candidate);
      }
    }

    for (const previous of previousHosts) {
      previous.dataset.kairosDailyProjection = key;
      previous.addClass("kairos-daily-projection--duplicate");
    }
    host.dataset.kairosDailyProjection = key;
    host.removeClass("kairos-daily-projection--duplicate");

    return () => {
      delete host.dataset.kairosDailyProjection;
      host.removeClass("kairos-daily-projection--duplicate");
      const remaining = Array.from(
        viewRoot.querySelectorAll<HTMLElement>("[data-kairos-daily-projection]"),
      ).filter(
        (candidate) =>
          candidate.matches(".cm-embed-block") &&
          candidate.dataset.kairosDailyProjection === key &&
          candidate.isConnected,
      );
      remaining[remaining.length - 1]?.removeClass("kairos-daily-projection--duplicate");
    };
  }

  private openTaskEditor(task: Task): void {
    new QuickAddModal(
      this.app,
      async (input) => {
        try {
          const update = {
            text: input.text,
            due: input.due,
            scheduled: input.scheduled,
            priority: input.priority,
            status: input.status,
          };
          if (input.createMode === "create") {
            await this.writer.updateTask(task, update);
            return;
          }
          const detailFile = await this.writer.updateTaskWithDetail(task, update);
          await this.app.workspace.getLeaf("tab").openFile(detailFile);
        } catch (err) {
          new Notice("Kairos: impossibile aggiornare il task — " + (err instanceof Error ? err.message : String(err)));
          throw err;
        }
      },
      task.file,
      task,
      (source) => void this.openTaskSource(source),
    ).open();
  }

  private async openTaskSource(task: Task): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(task.file);
    if (!(file instanceof TFile)) return;
    await this.app.workspace.getLeaf("tab").openFile(file, { eState: { line: task.line } });
  }

  private async openForDay(day: string): Promise<void> {
    const state: TaskPanelState = {
      view: "all",
      filter: { ...DEFAULT_FILTER, exactDay: day },
      sort: "due",
      group: "none",
      collapsed: [],
    };
    this.settings.panelState = state;
    await this.saveData(this.settings);
    await this.activateView();
    const view = this.app.workspace.getLeavesOfType(VIEW_TYPE_KAIROS)[0]?.view;
    if (view instanceof AttivitaView) view.applyPanelState(state);
  }

  private async openUpcoming(): Promise<void> {
    const state: TaskPanelState = {
      view: "upcoming",
      filter: { ...DEFAULT_FILTER, due: "upcoming", exactDay: null },
      sort: "due",
      group: "agenda",
      collapsed: ["zy-later", "zz-none"],
    };
    this.settings.panelState = state;
    await this.saveData(this.settings);
    await this.activateView();
    const view = this.app.workspace.getLeavesOfType(VIEW_TYPE_KAIROS)[0]?.view;
    if (view instanceof AttivitaView) view.applyPanelState(state);
  }

  private async saveUiState(): Promise<void> {
    if (this.uiSaveTimer !== null) window.clearTimeout(this.uiSaveTimer);
    this.uiSaveTimer = window.setTimeout(() => {
      this.uiSaveTimer = null;
      void this.saveData(this.settings);
    }, 500);
  }

  onunload(): void {
    if (this.uiSaveTimer === null) return;
    window.clearTimeout(this.uiSaveTimer);
    this.uiSaveTimer = null;
    void this.saveData(this.settings);
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
      const rightLeaf = workspace.getRightLeaf(true);
      if (!rightLeaf) return;
      leaf = rightLeaf;
      await leaf.setViewState({ type: VIEW_TYPE_KAIROS_SIDEBAR, active: true });
    }
    workspace.revealLeaf(leaf);
  }

  private async prepareMobileSidebar(): Promise<void> {
    if (this.app.workspace.getLeavesOfType(VIEW_TYPE_KAIROS_SIDEBAR).length > 0) return;
    const leaf = this.app.workspace.getRightLeaf(true);
    if (!leaf) return;
    await leaf.setViewState({ type: VIEW_TYPE_KAIROS_SIDEBAR, active: false });
  }

  private async ensureDailyProjection(file: TFile): Promise<void> {
    try {
      if (!(await this.dailyNotes.dateForPath(file.path))) return;
      const content = await this.app.vault.read(file);
      const updated = ensureDailyTasksBlock(content);
      if (updated !== content) await this.app.vault.modify(file, updated);
    } catch (error) {
      new Notice(`Kairos: impossibile preparare la vista nella daily — ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** Migra soltanto il vecchio default storico; non tocca percorsi personalizzati. */
  private async migrateLegacyInbox(): Promise<void> {
    if (normalizePath(this.settings.inboxPath) !== "Inbox.md") return;

    const targetPath = "_inbox/Inbox.md";
    const legacy = this.app.vault.getAbstractFileByPath("Inbox.md");
    const target = this.app.vault.getAbstractFileByPath(targetPath);

    if (target instanceof TFile) {
      this.settings.inboxPath = targetPath;
      await this.saveData(this.settings);
      return;
    }
    if (target) throw new Error(`Impossibile migrare l'Inbox: ${targetPath} esiste ma non è un file`);

    if (legacy instanceof TFile) {
      const folder = this.app.vault.getAbstractFileByPath("_inbox");
      if (!folder) await this.app.vault.createFolder("_inbox");
      else if (!(folder instanceof TFolder)) {
        throw new Error("Impossibile migrare l'Inbox: _inbox esiste ma non è una cartella");
      }
      await this.app.fileManager.renameFile(legacy, targetPath);
    }

    this.settings.inboxPath = targetPath;
    await this.saveData(this.settings);
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.settings.excludeFolders = normalizeExcludedFolders(this.settings.excludeFolders);
    this.settings.agendaHorizonDays = Number.isInteger(this.settings.agendaHorizonDays)
      ? Math.max(1, Math.min(365, this.settings.agendaHorizonDays))
      : DEFAULT_SETTINGS.agendaHorizonDays;
    this.settings.autoArchiveCompleted = this.settings.autoArchiveCompleted === true;
    this.settings.completedRetentionDays = Number.isInteger(this.settings.completedRetentionDays)
      ? Math.max(1, Math.min(365, this.settings.completedRetentionDays))
      : DEFAULT_SETTINGS.completedRetentionDays;
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    await this.index.build();
  }

  async getEffectiveDailySettings(): Promise<EffectiveDailyConfig> {
    return await this.dailyNotes.resolve();
  }

  async setAutoArchiveEnabled(enabled: boolean): Promise<boolean> {
    if (!enabled) {
      this.settings.autoArchiveCompleted = false;
      await this.saveData(this.settings);
      return false;
    }
    if (!(await this.confirmInboxArchive("Attivare l'archiviazione automatica?"))) return false;
    this.settings.autoArchiveCompleted = true;
    await this.saveData(this.settings);
    await this.runArchiveNow();
    return true;
  }

  async previewInboxArchive(): Promise<void> {
    if (!(await this.confirmInboxArchive("Eseguire ora la manutenzione dell'Inbox?"))) return;
    await this.runArchiveNow();
  }

  private async confirmInboxArchive(title: string): Promise<boolean> {
    const analysis = this.archive.analyze(this.index.getAll(), dayKey());
    const destination = archiveFolderPath(this.settings.inboxPath);
    const missing = analysis.missingDate > 0
      ? `\n${analysis.missingDate} task conclusi senza data resteranno nell'Inbox.`
      : "";
    return window.confirm(
      `${title}\n\n${analysis.eligible.length} task verranno archiviati in ${destination}.${missing}\n\nNessuna nota Dettagli verrà eliminata.`,
    );
  }

  private async runAutomaticArchive(): Promise<void> {
    if (!this.settings.autoArchiveCompleted) return;
    const today = dayKey();
    if (this.archiveLastRunDay === today) return;
    this.archiveLastRunDay = today;
    const analysis = this.archive.analyze(this.index.getAll(), today);
    if (analysis.eligible.length === 0) return;
    await this.runArchiveNow(today);
  }

  private async runArchiveNow(today = dayKey()): Promise<void> {
    const result = await this.archive.run(this.index.getAll(), today);
    this.archiveLastRunDay = today;
    if (result.archived > 0) {
      new Notice(`Kairos: archiviati ${result.archived} task conclusi.`);
    } else if (result.errors.length === 0) {
      new Notice("Kairos: nessun task da archiviare.");
    }
    if (result.errors.length > 0) {
      new Notice(`Kairos: ${result.errors.length} task non archiviati — ${result.errors[0]}`);
    }
  }
}
