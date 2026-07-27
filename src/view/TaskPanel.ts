import { App, Menu, Notice, setIcon, TFile } from "obsidian";
import type { MenuItem } from "obsidian";
import { TaskIndex } from "../index/TaskIndex";
import { TaskWriter } from "../io/TaskWriter";
import {
  groupTasks,
  matchesTask,
  DEFAULT_FILTER,
  DueSegment,
  GroupKey,
  TaskFilter,
} from "../core/query";
import { formatDueBadgeLabel } from "../core/dateLabel";
import { sortTasks, SortKey } from "../core/sorting";
import { reconcileTaskSelection } from "../core/selection";
import { PRIORITY_EMOJI } from "../core/parser";
import { Task, Settings, TaskStatus, Priority, TaskPanelState, SavedView } from "../types";
import { pickNote } from "./NotePicker";
import { promptText } from "./PromptModal";

/** `MenuItem.setSubmenu()` esiste a runtime (Obsidian ≥1.4) ma non è tipizzato. */
function submenuOf(item: MenuItem): Menu {
  return (item as MenuItem & { setSubmenu(): Menu }).setSubmenu();
}

const PAGE_SIZE = 20;

const DUE_SEGMENTS: [DueSegment, string][] = [
  ["today", "Oggi"],
  ["upcoming", "Prossimi"],
  ["none", "Senza data"],
  ["all", "Tutti"],
];

const STATUS_OPTIONS: [TaskStatus, string][] = [
  ["open", "Da fare"],
  ["inProgress", "In corso"],
  ["done", "Fatti"],
  ["cancelled", "Annullati"],
];

const OPEN_STATUSES: TaskStatus[] = ["open", "inProgress"];

const SORT_OPTIONS: [SortKey, string][] = [
  ["due", "Scadenza"],
  ["priority", "Priorità"],
  ["note", "Nota"],
];

const GROUP_OPTIONS: [GroupKey, string][] = [
  ["note", "Nota"],
  ["date", "Data"],
  ["priority", "Priorità"],
  ["tag", "Tag"],
  ["folder", "Cartella"],
  ["none", "Niente"],
];

const STATUS_ICON: Record<TaskStatus, string> = {
  open: "circle",
  inProgress: "circle-dot",
  done: "check-circle",
  cancelled: "x-circle",
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  open: "Da fare",
  inProgress: "In corso",
  done: "Fatto",
  cancelled: "Annullato",
};

const PRIORITY_EMOJI_BY: Record<Priority, string> = Object.fromEntries(
  PRIORITY_EMOJI.map(([emoji, priority]) => [priority, emoji]),
) as Record<Priority, string>;

const PRIORITY_OPTIONS: [string, string][] = [
  ["", "Nessuna"],
  ["highest", `${PRIORITY_EMOJI_BY.highest} Massima`],
  ["high", `${PRIORITY_EMOJI_BY.high} Alta`],
  ["medium", `${PRIORITY_EMOJI_BY.medium} Media`],
  ["low", `${PRIORITY_EMOJI_BY.low} Bassa`],
  ["lowest", `${PRIORITY_EMOJI_BY.lowest} Minima`],
];

function shortLabel(options: readonly [string, string][], value: string): string {
  return options.find(([candidate]) => candidate === value)?.[1] ?? value;
}

function isDefaultStatuses(statuses: TaskStatus[]): boolean {
  return statuses.length === 2 && OPEN_STATUSES.every((status) => statuses.includes(status));
}

function statusSummary(statuses: TaskStatus[]): string {
  if (statuses.length === 0) return "Ogni stato";
  if (isDefaultStatuses(statuses)) return "Aperti";
  return statuses.map((status) => STATUS_LABEL[status] ?? status).join(", ");
}

function taskKey(task: Task): string {
  return `${task.file}:${task.line}`;
}

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

export interface PanelContext {
  app: App;
  index: TaskIndex;
  writer: TaskWriter;
  getSettings: () => Settings;
  saveSettings: () => Promise<void>;
  onQuickAdd: (targetPath?: string) => void;
}

export interface TaskPanelOptions {
  compact: boolean;
  onStateChange: () => void;
  /** Solo sidebar: apre la lista a pagina piena. */
  onExpand?: () => void;
  /** Azione esplicita "Dettagli": l'Inspector vive nel guscio, non nel panel. */
  onOpenInspector?: (task: Task) => void;
}

/**
 * Superficie task condivisa: filter-bar compatta + gruppi accordion, guidata da
 * un unico oggetto di stato { filter, sort, group, collapsed[] }. La sidebar e
 * la scheda piena sono lo stesso componente a due densità (flag `compact`).
 * Il segmento "Oggi" rende il Focus (In ritardo / Oggi / Attenzione).
 */
export class TaskPanel {
  private readonly container: HTMLElement;
  private readonly ctx: PanelContext;
  private readonly options: TaskPanelOptions;
  private readonly state: TaskPanelState;
  private readonly collapsed: Set<string>;
  /** Gruppi che l'utente ha espanso oltre PAGE_SIZE; azzerato al cambio query. */
  private readonly expanded = new Set<string>();

  private filtersEl: HTMLElement | null = null;
  private bulkBarEl: HTMLElement | null = null;
  private resultsEl: HTMLElement | null = null;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private lastGroupKeys: string[] = [];

  // Cursore tastiera + selezione multipla sulle righe attualmente visibili.
  private cursor = -1;
  private readonly selection = new Map<string, Task>();
  private visibleTasks: Task[] = [];
  private rowEls: HTMLElement[] = [];
  private taskByKey = new Map<string, Task>();
  private keyHandler: ((event: KeyboardEvent) => void) | null = null;
  private unsubscribeIndex: (() => void) | null = null;
  private searchInputEl: HTMLInputElement | null = null;

  constructor(
    container: HTMLElement,
    ctx: PanelContext,
    initial: Partial<TaskPanelState>,
    options: TaskPanelOptions,
  ) {
    this.container = container;
    this.ctx = ctx;
    this.options = options;
    this.state = {
      filter: { ...structuredClone(DEFAULT_FILTER), ...(initial.filter ?? {}) },
      sort: initial.sort ?? "due",
      group: initial.group ?? "note",
      collapsed: initial.collapsed ?? [],
    };
    this.collapsed = new Set(this.state.collapsed);
  }

  mount(): void {
    this.container.addClass("kairos-panel");
    this.container.toggleClass("kairos-panel--compact", this.options.compact);
    this.container.tabIndex = 0;
    this.keyHandler = (event) => this.onKeyDown(event);
    this.container.addEventListener("keydown", this.keyHandler);
    this.unsubscribeIndex = this.ctx.index.onChange(() => this.renderResults());
    this.renderChrome();
  }

  unmount(): void {
    if (this.searchTimer !== null) clearTimeout(this.searchTimer);
    this.searchTimer = null;
    if (this.keyHandler) this.container.removeEventListener("keydown", this.keyHandler);
    this.keyHandler = null;
    if (this.unsubscribeIndex) this.unsubscribeIndex();
    this.unsubscribeIndex = null;
  }

  getState(): TaskPanelState {
    return {
      filter: { ...this.state.filter },
      sort: this.state.sort,
      group: this.state.group,
      collapsed: [...this.collapsed],
    };
  }

  // ── Chrome (costruita una volta; l'input di ricerca non viene ricreato) ──

  private renderChrome(): void {
    const root = this.container;
    root.empty();

    const header = root.createDiv({ cls: "kairos-panel__header" });
    const actions = header.createDiv({ cls: "kairos-panel__actions" });

    const searchWrap = actions.createDiv({ cls: "kairos-search" });
    setIcon(searchWrap.createSpan({ cls: "kairos-search__icon" }), "search");
    const search = searchWrap.createEl("input", {
      cls: "kairos-search__input",
      attr: { type: "search", placeholder: "Cerca…" },
    });
    search.value = this.state.filter.text;
    this.searchInputEl = search;
    search.addEventListener("input", () => {
      if (this.searchTimer !== null) clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => {
        this.state.filter.text = search.value;
        this.expanded.clear();
        this.renderResults();
        this.options.onStateChange();
      }, 150);
    });

    const add = actions.createEl("button", { cls: "kairos-add-btn" });
    setIcon(add, "plus");
    if (!this.options.compact) add.createSpan({ text: "Task" });
    add.setAttribute("aria-label", "Nuovo task");
    add.addEventListener("click", () => this.ctx.onQuickAdd());

    const overflow = actions.createEl("button", { cls: "kairos-iconbtn" });
    setIcon(overflow, "more-horizontal");
    overflow.setAttribute("aria-label", "Altro");
    overflow.addEventListener("click", (event) => this.openOverflowMenu(event));

    this.filtersEl = root.createDiv({ cls: "kairos-panel__filters" });
    this.bulkBarEl = root.createDiv({ cls: "kairos-bulkbar is-hidden" });
    this.resultsEl = root.createDiv({ cls: "kairos-panel__results" });

    this.renderFilters();
    this.renderResults();
  }

  // ── Filter bar ──────────────────────────────────────────────────────

  private renderFilters(): void {
    const bar = this.filtersEl;
    if (!bar) return;
    bar.empty();

    // Riga segmenti temporali (slicer primario).
    const segRow = bar.createDiv({ cls: "kairos-filterbar__row" });
    const segments = segRow.createDiv({ cls: "kairos-segments" });
    for (const [value, label] of DUE_SEGMENTS) {
      const active = this.state.filter.due === value;
      const segment = segments.createEl("button", {
        cls: `kairos-segment${active ? " is-active" : ""}`,
        text: label,
      });
      segment.addEventListener("click", () =>
        this.update(() => {
          this.state.filter.due = value;
          this.state.filter.exactDay = null;
        }),
      );
    }

    // Riga controlli: chip "Filtri" (contatore) + Ordina/Raggruppa.
    const controlRow = bar.createDiv({ cls: "kairos-filterbar__row" });

    const activeFilters = this.activeFilterCount();
    const filterChip = controlRow.createEl("button", {
      cls: `kairos-fchip${activeFilters > 0 ? " is-active" : ""}`,
    });
    setIcon(filterChip.createSpan({ cls: "kairos-fchip__icon" }), "filter");
    filterChip.createSpan({
      cls: "kairos-fchip__label",
      text: activeFilters > 0 ? `Filtri (${activeFilters})` : "Filtri",
    });
    setIcon(filterChip.createSpan({ cls: "kairos-fchip__caret" }), "chevron-down");
    filterChip.addEventListener("click", (event) => this.openFiltersMenu(event));

    const controlEnd = controlRow.createDiv({ cls: "kairos-filterbar__end" });
    this.iconMenu(controlEnd, "arrow-up-down", "Ordina", SORT_OPTIONS, this.state.sort, (value) =>
      this.update(() => {
        this.state.sort = value;
      }),
    );

    // Su "Oggi" il Focus ha una struttura fissa: Raggruppa è inerte.
    if (this.state.filter.due === "today") {
      const groupBtn = controlEnd.createEl("button", { cls: "kairos-iconbtn is-disabled" });
      setIcon(groupBtn, "layout-list");
      groupBtn.setAttribute("aria-label", "Raggruppa non disponibile su Oggi");
      groupBtn.disabled = true;
    } else {
      this.iconMenu(controlEnd, "layout-list", "Raggruppa", GROUP_OPTIONS, this.state.group, (value) =>
        this.update(() => {
          this.state.group = value;
        }),
      );
    }
  }

  /** Bottone icona che apre un menù a selezione singola (Ordina / Raggruppa). */
  private iconMenu<T extends string>(
    parent: HTMLElement,
    icon: string,
    label: string,
    options: readonly [T, string][],
    current: T,
    onPick: (value: T) => void,
  ): void {
    const button = parent.createEl("button", { cls: "kairos-iconbtn" });
    setIcon(button, icon);
    button.setAttribute("aria-label", `${label}: ${shortLabel(options, current)}`);
    button.addEventListener("click", (event) => {
      const menu = new Menu();
      for (const [value, optionLabel] of options) {
        menu.addItem((item) =>
          item
            .setTitle(optionLabel)
            .setChecked(value === current)
            .onClick(() => onPick(value)),
        );
      }
      menu.showAtMouseEvent(event);
    });
  }

  private activeFilterCount(): number {
    let count = 0;
    if (!isDefaultStatuses(this.state.filter.statuses)) count += 1;
    if (this.state.filter.tags.length > 0) count += 1;
    if (this.state.filter.folder !== null) count += 1;
    if (this.state.filter.priorities !== null) count += 1;
    return count;
  }

  /** Un solo popover con ogni dimensione di filtro secondaria come sottomenù. */
  private openFiltersMenu(event: MouseEvent): void {
    const menu = new Menu();
    const facets = this.facets();

    menu.addItem((item) => {
      item.setTitle(`Stato · ${statusSummary(this.state.filter.statuses)}`).setIcon("circle-dot");
      const sub = submenuOf(item);
      for (const [status, label] of STATUS_OPTIONS) {
        sub.addItem((sitem: MenuItem) =>
          sitem
            .setTitle(label)
            .setChecked(this.state.filter.statuses.includes(status))
            .onClick(() =>
              this.update(() => {
                this.state.filter.statuses = this.state.filter.statuses.includes(status)
                  ? this.state.filter.statuses.filter((candidate) => candidate !== status)
                  : [...this.state.filter.statuses, status];
              }),
            ),
        );
      }
    });

    menu.addItem((item) => {
      const current = this.state.filter.priorities?.[0] ?? "";
      item.setTitle("Priorità").setIcon("flag");
      const sub = submenuOf(item);
      for (const [value, label] of PRIORITY_OPTIONS) {
        sub.addItem((sitem: MenuItem) =>
          sitem
            .setTitle(label)
            .setChecked(value === current)
            .onClick(() =>
              this.update(() => {
                this.state.filter.priorities = value === "" ? null : [value as Priority];
              }),
            ),
        );
      }
    });

    menu.addItem((item) => {
      item.setTitle("Tag").setIcon("hash");
      const sub = submenuOf(item);
      sub.addItem((sitem: MenuItem) =>
        sitem
          .setTitle("Tutti i tag")
          .setChecked(this.state.filter.tags.length === 0)
          .onClick(() => this.update(() => (this.state.filter.tags = []))),
      );
      for (const tag of facets.tags) {
        sub.addItem((sitem: MenuItem) =>
          sitem
            .setTitle(`#${tag}`)
            .setChecked(this.state.filter.tags[0] === tag)
            .onClick(() => this.update(() => (this.state.filter.tags = [tag]))),
        );
      }
    });

    menu.addItem((item) => {
      item.setTitle("Cartella").setIcon("folder");
      const sub = submenuOf(item);
      sub.addItem((sitem: MenuItem) =>
        sitem
          .setTitle("Tutte le cartelle")
          .setChecked(this.state.filter.folder === null)
          .onClick(() => this.update(() => (this.state.filter.folder = null))),
      );
      for (const folder of facets.folders) {
        sub.addItem((sitem: MenuItem) =>
          sitem
            .setTitle(folder)
            .setChecked(this.state.filter.folder === folder)
            .onClick(() => this.update(() => (this.state.filter.folder = folder))),
        );
      }
    });

    if (this.activeFilterCount() > 0) {
      menu.addSeparator();
      menu.addItem((item) =>
        item
          .setTitle("Azzera filtri")
          .setIcon("filter-x")
          .onClick(() =>
            this.update(() => {
              this.state.filter.statuses = [...OPEN_STATUSES];
              this.state.filter.tags = [];
              this.state.filter.folder = null;
              this.state.filter.priorities = null;
            }),
          ),
      );
    }

    menu.showAtMouseEvent(event);
  }

  /** Overflow header: viste salvate, comprimi/espandi, apri lista. */
  private openOverflowMenu(event: MouseEvent): void {
    const menu = new Menu();

    menu.addItem((item) => {
      item.setTitle("Viste salvate").setIcon("bookmark");
      const sub = submenuOf(item);
      const savedViews = this.ctx.getSettings().savedViews;
      if (savedViews.length === 0) {
        sub.addItem((sitem: MenuItem) => sitem.setTitle("Nessuna vista").setDisabled(true));
      }
      for (const view of savedViews) {
        sub.addItem((sitem: MenuItem) => sitem.setTitle(view.name).onClick(() => this.applyView(view)));
      }
      sub.addSeparator();
      sub.addItem((sitem: MenuItem) =>
        sitem
          .setTitle("Salva vista corrente…")
          .setIcon("save")
          .onClick(() => this.saveCurrentView()),
      );
    });

    if (this.lastGroupKeys.length > 0) {
      const anyOpen = this.lastGroupKeys.some((key) => !this.collapsed.has(key));
      menu.addItem((item) =>
        item
          .setTitle(anyOpen ? "Comprimi tutto" : "Espandi tutto")
          .setIcon(anyOpen ? "chevrons-down-up" : "chevrons-up-down")
          .onClick(() => this.toggleAll()),
      );
    }

    if (this.options.onExpand) {
      menu.addItem((item) =>
        item
          .setTitle("Apri lista completa")
          .setIcon("maximize-2")
          .onClick(() => this.options.onExpand?.()),
      );
    }

    menu.showAtMouseEvent(event);
  }

  private facets(): { tags: string[]; folders: string[] } {
    const tags = new Set<string>();
    const folders = new Set<string>();
    for (const task of this.ctx.index.getAll()) {
      for (const tag of task.tags) tags.add(tag);
      const slash = task.file.lastIndexOf("/");
      if (slash !== -1) folders.add(task.file.slice(0, slash));
    }
    return { tags: [...tags].sort(), folders: [...folders].sort() };
  }

  // ── Risultati ───────────────────────────────────────────────────────

  private renderResults(): void {
    const results = this.resultsEl;
    if (!results) return;
    results.empty();
    this.visibleTasks = [];
    this.rowEls = [];
    const today = todayString();

    // Segmento "Oggi" → Focus (In ritardo / Oggi / Attenzione).
    if (this.state.filter.due === "today") {
      this.renderTodayFocus(results, today);
      this.finalizeSelectionAndCursor();
      return;
    }

    const groups = groupTasks(
      this.ctx.index.getAll(),
      this.state.filter,
      this.state.sort,
      this.state.group,
      today,
      { inboxPath: this.ctx.getSettings().inboxPath },
    );
    this.lastGroupKeys = groups.filter((group) => group.label !== "").map((group) => group.key);
    this.taskByKey = new Map();
    for (const group of groups) for (const task of group.tasks) this.taskByKey.set(taskKey(task), task);
    this.reconcileSelection();

    const total = groups.reduce((sum, group) => sum + group.tasks.length, 0);
    if (total === 0) {
      this.pruneSelection();
      this.cursor = -1;
      this.renderBulkBar();
      results.createDiv({ cls: "kairos-empty", text: "Nessun task corrisponde ai filtri." });
      return;
    }

    for (const group of groups) {
      const isInbox = this.state.group === "note" && group.key === "0-inbox";
      const showNote = this.state.group !== "note" || isInbox;

      // Il bucket unico senza etichetta (group = none) non è un accordion.
      if (group.label === "") {
        const body = results.createDiv({ cls: "kairos-group__body" });
        this.renderRows(body, group.key, group.tasks, today, showNote);
        continue;
      }

      const collapsed = this.collapsed.has(group.key);
      const section = results.createDiv({
        cls: `kairos-group${isInbox ? " kairos-group--inbox" : ""}${collapsed ? " is-collapsed" : ""}`,
      });

      const head = section.createDiv({
        cls: "kairos-group__head",
        attr: { role: "button", "aria-expanded": String(!collapsed), tabindex: "0" },
      });
      setIcon(head.createSpan({ cls: "kairos-group__chevron" }), "chevron-right");
      head.createSpan({ cls: "kairos-group__title", text: group.label });
      if (group.sublabel) head.createSpan({ cls: "kairos-group__sub", text: group.sublabel });
      head.createSpan({ cls: "kairos-group__count", text: String(group.tasks.length) });

      const notePath = group.tasks[0]?.file;
      if (this.state.group === "note" && !isInbox && notePath !== undefined) {
        const spacer = head.createDiv({ cls: "kairos-group__actions" });
        const addHere = spacer.createSpan({ cls: "kairos-group__act" });
        setIcon(addHere, "plus");
        addHere.setAttribute("aria-label", "Nuovo task in questa nota");
        addHere.addEventListener("click", (event) => {
          event.stopPropagation();
          this.ctx.onQuickAdd(notePath);
        });
        const open = spacer.createSpan({ cls: "kairos-group__act" });
        setIcon(open, "file-symlink");
        open.setAttribute("aria-label", "Apri nota");
        open.addEventListener("click", (event) => {
          event.stopPropagation();
          void this.openFile(notePath);
        });
      }

      head.addEventListener("click", () => this.toggleCollapse(group.key));
      head.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          this.toggleCollapse(group.key);
        }
      });

      if (!collapsed) {
        const body = section.createDiv({ cls: "kairos-group__body" });
        this.renderRows(body, group.key, group.tasks, today, showNote);
      }
    }

    this.finalizeSelectionAndCursor();
  }

  /** Elimina dalla selezione le chiavi di task non più presenti, poi ridisegna la barra e vincola il cursore. */
  private finalizeSelectionAndCursor(): void {
    this.pruneSelection();
    if (this.cursor >= this.visibleTasks.length) this.cursor = this.visibleTasks.length - 1;
    this.renderBulkBar();
  }

  private pruneSelection(): void {
    this.reconcileSelection();
  }

  private reconcileSelection(): void {
    const selected = reconcileTaskSelection(
      [...this.selection.values()],
      [...this.taskByKey.values()],
    );
    this.selection.clear();
    for (const task of selected) this.selection.set(taskKey(task), task);
  }

  private renderRows(
    body: HTMLElement,
    key: string,
    tasks: readonly Task[],
    today: string,
    showNote: boolean,
  ): void {
    const visible = this.expanded.has(key) ? tasks : tasks.slice(0, PAGE_SIZE);
    for (const task of visible) {
      const index = this.visibleTasks.length;
      const rowEl = this.renderTask(
        body,
        task,
        today,
        showNote,
        index,
        index === this.cursor,
        this.selection.has(taskKey(task)),
      );
      this.visibleTasks.push(task);
      this.rowEls.push(rowEl);
    }
    if (tasks.length > visible.length) {
      const more = body.createEl("button", {
        cls: "kairos-group__more",
        text: `Mostra altri ${tasks.length - visible.length}`,
      });
      more.addEventListener("click", () => {
        this.expanded.add(key);
        this.renderResults();
      });
    }
  }

  // ── Focus di Oggi (In ritardo / Oggi / Attenzione) ──────────────────

  private renderTodayFocus(results: HTMLElement, today: string): void {
    // Il Focus ignora il filtro di stato/data e calcola i propri attivi, ma
    // rispetta ricerca/tag/cartella/priorità impostati.
    const focusFilter: TaskFilter = {
      ...this.state.filter,
      due: "all",
      exactDay: null,
      statuses: OPEN_STATUSES,
    };
    const active = sortTasks(
      this.ctx.index.getAll().filter((task) => matchesTask(task, focusFilter, today)),
      this.state.sort,
    );

    const used = new Set<string>();
    const overdue = active.filter((task) => task.due !== null && task.due < today);
    overdue.forEach((task) => used.add(taskKey(task)));
    const dueToday = active.filter((task) => task.due === today && !used.has(taskKey(task)));
    dueToday.forEach((task) => used.add(taskKey(task)));
    const attention = active.filter(
      (task) =>
        !used.has(taskKey(task)) &&
        (task.status === "inProgress" || task.priority === "highest" || task.priority === "high"),
    );

    this.lastGroupKeys = ["focus-overdue", "focus-today", "focus-attention"];
    this.taskByKey = new Map();
    for (const task of [...overdue, ...dueToday, ...attention]) this.taskByKey.set(taskKey(task), task);
    this.reconcileSelection();

    this.renderFocusSection(results, "focus-overdue", "In ritardo", overdue, today);
    this.renderFocusSection(results, "focus-today", "Oggi", dueToday, today);
    this.renderFocusSection(results, "focus-attention", "Attenzione", attention, today);
  }

  private renderFocusSection(
    results: HTMLElement,
    key: string,
    label: string,
    tasks: Task[],
    today: string,
  ): void {
    const collapsed = this.collapsed.has(key);
    const section = results.createDiv({
      cls: `kairos-group${collapsed ? " is-collapsed" : ""}`,
    });
    const head = section.createDiv({
      cls: "kairos-group__head",
      attr: { role: "button", "aria-expanded": String(!collapsed), tabindex: "0" },
    });
    setIcon(head.createSpan({ cls: "kairos-group__chevron" }), "chevron-right");
    head.createSpan({ cls: "kairos-group__title", text: label });
    head.createSpan({ cls: "kairos-group__count", text: String(tasks.length) });
    head.addEventListener("click", () => this.toggleCollapse(key));
    head.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        this.toggleCollapse(key);
      }
    });

    if (collapsed) return;
    const body = section.createDiv({ cls: "kairos-group__body" });
    if (tasks.length === 0) {
      body.createDiv({ cls: "kairos-empty", text: "—" });
      return;
    }
    this.renderRows(body, key, tasks, today, true);
  }

  // ── Riga ────────────────────────────────────────────────────────────

  private renderTask(
    body: HTMLElement,
    task: Task,
    today: string,
    showNote: boolean,
    index: number,
    cursor: boolean,
    selected: boolean,
  ): HTMLElement {
    const row = body.createDiv({ cls: `kairos-task kairos-status-${task.status}` });
    row.toggleClass("is-cursor", cursor);
    row.toggleClass("is-selected", selected);

    const check = row.createSpan({ cls: "kairos-check" });
    check.setAttribute("aria-label", "Cambia stato");
    setIcon(check, STATUS_ICON[task.status]);
    check.addEventListener("click", (event) => {
      event.stopPropagation();
      this.runTaskAction(() => this.ctx.writer.toggleTask(task));
    });
    check.addEventListener("contextmenu", (event) => this.showRowMenu(event, task, today));

    const main = row.createDiv({ cls: "kairos-task-main" });
    const line = main.createDiv({ cls: "kairos-task-line" });
    line.createSpan({ cls: "kairos-task-text", text: task.text || "(senza testo)" });
    if (task.due) {
      const overdue = task.due < today && (task.status === "open" || task.status === "inProgress");
      line.createSpan({
        cls: `kairos-pill kairos-due kairos-due-inline${overdue ? " kairos-due-overdue" : ""}`,
        text: formatDueBadgeLabel(task.due, today),
      });
    }
    if (task.priority !== null) {
      line.createSpan({ cls: "kairos-badge", text: PRIORITY_EMOJI_BY[task.priority] });
    }

    const metaRow = main.createDiv({ cls: "kairos-task-meta" });
    const project = task.tags.find((tag) => tag.startsWith(this.ctx.getSettings().projectPrefix));
    if (project) {
      metaRow.createSpan({ cls: "kairos-pill kairos-tag", text: project.split("/").pop() ?? project });
    }
    if (showNote) {
      const source = metaRow.createSpan({ cls: "kairos-source", text: noteTitle(task.file) });
      source.addEventListener("click", (event) => {
        event.stopPropagation();
        void this.openFile(task.file, task.line);
      });
    }

    const more = row.createEl("button", { cls: "kairos-row-more" });
    setIcon(more, "more-horizontal");
    more.setAttribute("aria-label", "Azioni");
    more.addEventListener("click", (event) => {
      event.stopPropagation();
      this.showRowMenu(event, task, today);
    });

    row.addEventListener("contextmenu", (event) => this.showRowMenu(event, task, today));
    row.addEventListener("click", (event) => {
      if (event.metaKey || event.ctrlKey) {
        event.preventDefault();
        event.stopPropagation();
        this.toggleSelect(task);
        return;
      }
      if (event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        this.selectRange(index);
        return;
      }
      void this.openFile(task.file, task.line);
    });
    return row;
  }

  /** Menù contestuale riga: Stato · Priorità · Tag · date rapide. */
  private showRowMenu(event: MouseEvent, task: Task, today: string): void {
    event.preventDefault();
    event.stopPropagation();
    const menu = new Menu();

    menu.addItem((item) =>
      item.setTitle("Apri nota").setIcon("file-symlink").onClick(() => void this.openFile(task.file, task.line)),
    );
    if (this.canOpenInspector()) {
      menu.addItem((item) =>
        item.setTitle("Dettagli").setIcon("panel-right").onClick(() => this.options.onOpenInspector?.(task)),
      );
    }
    menu.addSeparator();

    menu.addItem((item) => {
      item.setTitle("Stato").setIcon("circle-dot");
      const sub = submenuOf(item);
      for (const [status, label] of STATUS_OPTIONS) {
        sub.addItem((sitem: MenuItem) =>
          sitem
            .setTitle(label)
            .setChecked(task.status === status)
            .onClick(() => this.runTaskAction(() => this.ctx.writer.setStatus(task, status))),
        );
      }
    });

    menu.addItem((item) => {
      item.setTitle("Priorità").setIcon("flag");
      const sub = submenuOf(item);
      for (const [value, label] of PRIORITY_OPTIONS) {
        sub.addItem((sitem: MenuItem) =>
          sitem
            .setTitle(label)
            .setChecked((task.priority ?? "") === value)
            .onClick(() =>
              this.runTaskAction(() => this.ctx.writer.setPriority(task, value === "" ? null : (value as Priority))),
            ),
        );
      }
    });

    const tags = this.projectAreaTags();
    menu.addItem((item) => {
      item.setTitle("Aggiungi tag").setIcon("hash");
      const sub = submenuOf(item);
      if (tags.length === 0) {
        sub.addItem((sitem: MenuItem) => sitem.setTitle("Nessun tag progetto/area").setDisabled(true));
      }
      for (const tag of tags) {
        sub.addItem((sitem: MenuItem) =>
          sitem
            .setTitle(`#${tag}`)
            .setChecked(task.tags.includes(tag))
            .onClick(() => this.runTaskAction(() => this.ctx.writer.addTag(task, tag))),
        );
      }
    });

    menu.addSeparator();
    menu.addItem((item) =>
      item.setTitle("Oggi").setIcon("calendar").onClick(() => this.runTaskAction(() => this.ctx.writer.setDue(task, today))),
    );
    menu.addItem((item) =>
      item.setTitle("Domani").setIcon("calendar").onClick(() =>
        this.runTaskAction(() => this.ctx.writer.setDue(task, addDays(today, 1))),
      ),
    );
    menu.addItem((item) =>
      item
        .setTitle("Prossima settimana")
        .setIcon("calendar")
        .onClick(() => this.runTaskAction(() => this.ctx.writer.setDue(task, addDays(today, 7)))),
    );
    if (task.due !== null) {
      menu.addItem((item) =>
        item.setTitle("Rimuovi data").setIcon("calendar-x").onClick(() =>
          this.runTaskAction(() => this.ctx.writer.setDue(task, null)),
        ),
      );
    }

    menu.addSeparator();
    menu.addItem((item) =>
      item.setTitle("Elimina task").setIcon("trash-2").onClick(() =>
        this.runTaskAction(() => this.deleteTargets([task])),
      ),
    );

    menu.showAtMouseEvent(event);
  }

  private projectAreaTags(): string[] {
    const settings = this.ctx.getSettings();
    return [
      ...new Set(
        this.ctx.index
          .getAll()
          .flatMap((task) => task.tags)
          .filter((tag) => tag.startsWith(settings.projectPrefix) || tag.startsWith(settings.areaPrefix)),
      ),
    ].sort();
  }

  private async openFile(path: string, line?: number): Promise<void> {
    const file = this.ctx.app.vault.getAbstractFileByPath(path);
    if (file instanceof TFile) {
      const leaf = this.ctx.app.workspace.getLeaf('tab');
      await leaf.openFile(file, line !== undefined ? { eState: { line } } : undefined);
    }
  }

  private canOpenInspector(): boolean {
    return (
      this.options.onOpenInspector !== undefined &&
      !document.body.classList.contains("is-mobile") &&
      !window.matchMedia("(max-width: 900px)").matches
    );
  }

  // ── Tastiera + selezione multipla ───────────────────────────────────

  private onKeyDown(event: KeyboardEvent): void {
    const target = event.target;
    // Lascia che i controlli interattivi (input, bottoni, header di gruppo)
    // gestiscano i propri tasti — altrimenti Invio/Spazio scatterebbero due volte
    // (es. un header di gruppo aprirebbe anche l'Inspector del cursore).
    if (
      target instanceof HTMLElement &&
      (target.isContentEditable || target.closest('input, textarea, select, a, button, [role="button"]'))
    ) {
      return;
    }
    switch (event.key) {
      case "j":
      case "ArrowDown":
        this.moveCursor(1);
        break;
      case "k":
      case "ArrowUp":
        this.moveCursor(-1);
        break;
      case "x":
        this.runTaskAction(() => this.completeTargets());
        break;
      case "e": {
        const task = this.cursorTask();
        if (task && this.canOpenInspector()) this.options.onOpenInspector?.(task);
        break;
      }
      case "Enter":
      case "o":
        this.openCursor();
        break;
      case " ":
        this.toggleCursorSelection();
        break;
      case "Escape":
        if (this.selection.size === 0) return;
        this.clearSelection();
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  private moveCursor(delta: number): void {
    if (this.visibleTasks.length === 0) return;
    const prev = this.cursor;
    this.cursor =
      prev < 0
        ? delta > 0
          ? 0
          : this.visibleTasks.length - 1
        : Math.max(0, Math.min(this.visibleTasks.length - 1, prev + delta));
    if (prev >= 0) this.rowEls[prev]?.removeClass("is-cursor");
    const el = this.rowEls[this.cursor];
    el?.addClass("is-cursor");
    el?.scrollIntoView({ block: "nearest" });
  }

  private cursorTask(): Task | null {
    return this.cursor >= 0 ? this.visibleTasks[this.cursor] ?? null : null;
  }

  private toggleSelect(task: Task): void {
    const key = taskKey(task);
    if (this.selection.has(key)) this.selection.delete(key);
    else this.selection.set(key, task);
    const index = this.visibleTasks.findIndex((candidate) => taskKey(candidate) === key);
    if (index >= 0) this.rowEls[index]?.toggleClass("is-selected", this.selection.has(key));
    this.renderBulkBar();
  }

  private toggleCursorSelection(): void {
    const task = this.cursorTask();
    if (task) this.toggleSelect(task);
  }

  private selectRange(toIndex: number): void {
    const from = this.cursor < 0 ? toIndex : this.cursor;
    const [lo, hi] = from <= toIndex ? [from, toIndex] : [toIndex, from];
    for (let i = lo; i <= hi; i++) {
      const task = this.visibleTasks[i];
      if (!task) continue;
      this.selection.set(taskKey(task), task);
      this.rowEls[i]?.addClass("is-selected");
    }
    this.cursor = toIndex;
    this.renderBulkBar();
  }

  private clearSelection(): void {
    this.selection.clear();
    for (const el of this.rowEls) el.removeClass("is-selected");
    this.renderBulkBar();
  }

  /** Bersagli dell'azione in blocco: la selezione, altrimenti la riga sotto il cursore. */
  private targets(): Task[] {
    if (this.selection.size > 0) {
      return [...this.selection.values()];
    }
    const task = this.cursorTask();
    return task ? [task] : [];
  }

  private async completeTargets(): Promise<void> {
    const targets = this.targets();
    for (const task of targets) await this.ctx.writer.setStatus(task, "done");
    this.clearSelection();
  }

  private openCursor(): void {
    const task = this.cursorTask();
    if (task) void this.openFile(task.file, task.line);
  }

  // ── Barra azioni in blocco ───────────────────────────────────────────

  private renderBulkBar(): void {
    const bar = this.bulkBarEl;
    if (!bar) return;
    bar.empty();
    bar.toggleClass("is-hidden", this.selection.size === 0);
    if (this.selection.size === 0) return;

    bar.createSpan({ cls: "kairos-bulkbar__count", text: `${this.selection.size} selezionati` });
    const actions = bar.createDiv({ cls: "kairos-bulkbar__actions" });

    const complete = actions.createEl("button", { cls: "kairos-bulkbar__pill", text: "Completa" });
    complete.addEventListener("click", () => this.runTaskAction(() => this.completeTargets()));

    const reschedule = actions.createEl("button", { cls: "kairos-bulkbar__pill", text: "Rischedula" });
    reschedule.addEventListener("click", (event) => this.openRescheduleMenu(event));

    const move = actions.createEl("button", { cls: "kairos-bulkbar__pill", text: "Sposta" });
    move.addEventListener("click", () => this.openMoveMenu());

    const remove = actions.createEl("button", { cls: "kairos-bulkbar__pill kairos-bulkbar__pill--danger", text: "Elimina" });
    remove.addEventListener("click", () => this.runTaskAction(() => this.deleteTargets()));

    const clear = actions.createEl("button", { cls: "kairos-iconbtn" });
    setIcon(clear, "x");
    clear.setAttribute("aria-label", "Deseleziona");
    clear.addEventListener("click", () => this.clearSelection());
  }

  /**
   * Rischedula in blocco con poche scelte relative, coerenti con le date rapide del
   * menù riga.
   */
  private openRescheduleMenu(event: MouseEvent): void {
    const targets = this.targets();
    const today = todayString();
    const menu = new Menu();
    menu.addItem((item) =>
      item.setTitle("Oggi").setIcon("calendar").onClick(() =>
        this.runTaskAction(() => this.applyDue(targets, today)),
      ),
    );
    menu.addItem((item) =>
      item
        .setTitle("Domani")
        .setIcon("calendar")
        .onClick(() => this.runTaskAction(() => this.applyDue(targets, addDays(today, 1)))),
    );
    menu.addItem((item) =>
      item
        .setTitle("Tra 7 giorni")
        .setIcon("calendar")
        .onClick(() => this.runTaskAction(() => this.applyDue(targets, addDays(today, 7)))),
    );
    menu.addSeparator();
    menu.addItem((item) =>
      item.setTitle("Rimuovi data").setIcon("calendar-x").onClick(() =>
        this.runTaskAction(() => this.applyDue(targets, null)),
      ),
    );
    menu.showAtMouseEvent(event);
  }

  private async applyDue(targets: Task[], due: string | null): Promise<void> {
    for (const task of targets) await this.ctx.writer.setDue(task, due);
    this.clearSelection();
  }

  private openMoveMenu(): void {
    // Ordina per file e poi per riga decrescente: rimuovendo prima le righe più
    // basse nello stesso file, gli indici `line` dei task ancora da processare
    // in quel file restano validi (moveToNote fa uno splice sull'origine).
    const targets = [...this.targets()].sort((a, b) =>
      a.file === b.file ? b.line - a.line : a.file.localeCompare(b.file),
    );
    pickNote(this.ctx.app, "Sposta i task in…", (file) => {
      this.runTaskAction(async () => {
        for (const task of targets) await this.ctx.writer.moveToNote(task, file.path);
        this.clearSelection();
      });
    });
  }

  private async deleteTargets(explicitTargets?: Task[]): Promise<void> {
    const targets = explicitTargets ?? this.targets();
    if (targets.length === 0) return;
    const message =
      targets.length === 1
        ? "Eliminare questo task? La riga verrà rimossa dalla nota."
        : `Eliminare ${targets.length} task? Le righe verranno rimosse dalle note.`;
    if (!window.confirm(message)) return;
    await this.ctx.writer.deleteTasks(targets);
    this.clearSelection();
    new Notice(targets.length === 1 ? "Kairos: task eliminato." : `Kairos: ${targets.length} task eliminati.`);
  }

  private runTaskAction(action: () => Promise<void>): void {
    void action().catch((error) => {
      new Notice(`Kairos: impossibile aggiornare il task — ${error instanceof Error ? error.message : String(error)}`);
    });
  }

  // ── Transizioni di stato ────────────────────────────────────────────

  private update(mutate: () => void): void {
    mutate();
    this.expanded.clear();
    this.selection.clear();
    this.cursor = -1;
    this.options.onStateChange();
    this.renderFilters();
    this.renderResults();
  }

  private toggleCollapse(key: string): void {
    if (this.collapsed.has(key)) this.collapsed.delete(key);
    else this.collapsed.add(key);
    this.options.onStateChange();
    this.renderResults();
  }

  // ── Viste salvate ────────────────────────────────────────────────────

  private applyView(view: SavedView): void {
    this.state.filter = { ...structuredClone(DEFAULT_FILTER), ...view.filter };
    this.state.sort = view.sort;
    this.state.group = view.group;
    if (this.searchInputEl) this.searchInputEl.value = this.state.filter.text;
    this.expanded.clear();
    this.collapsed.clear();
    this.selection.clear();
    this.cursor = -1;
    this.options.onStateChange();
    this.renderFilters();
    this.renderResults();
  }

  private saveCurrentView(): void {
    promptText(this.ctx.app, "Nome della vista", "", (name) => {
      const view: SavedView = {
        name,
        filter: { ...this.state.filter },
        sort: this.state.sort,
        group: this.state.group,
      };
      const settings = this.ctx.getSettings();
      const existing = settings.savedViews.findIndex((candidate) => candidate.name === name);
      if (existing >= 0) settings.savedViews = settings.savedViews.map((v, i) => i === existing ? view : v);
      else settings.savedViews = [...settings.savedViews, view];
      void this.ctx.saveSettings();
      new Notice(`Kairos: vista "${name}" salvata.`);
    });
  }

  private toggleAll(): void {
    const anyOpen = this.lastGroupKeys.some((key) => !this.collapsed.has(key));
    if (anyOpen) for (const key of this.lastGroupKeys) this.collapsed.add(key);
    else this.collapsed.clear();
    this.options.onStateChange();
    this.renderResults();
  }
}
