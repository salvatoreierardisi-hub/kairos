import { App, Menu, Modal, setIcon } from "obsidian";
import { Priority, Task, TaskStatus } from "../types";
import { PRIORITY_LABELS } from "../core/query";
import { pickNote } from "./NotePicker";
import { parseNaturalDate } from "../core/naturalDate";

const PRIORITY_ICON: Record<Priority, string> = {
  highest: "🔺",
  high: "⏫",
  medium: "🔼",
  low: "🔽",
  lowest: "⏬",
};

const PRIORITY_OPTIONS: [Priority | null, string][] = [
  [null, "Nessuna priorità"],
  ["highest", `${PRIORITY_ICON.highest} ${PRIORITY_LABELS.highest}`],
  ["high", `${PRIORITY_ICON.high} ${PRIORITY_LABELS.high}`],
  ["medium", `${PRIORITY_ICON.medium} ${PRIORITY_LABELS.medium}`],
  ["low", `${PRIORITY_ICON.low} ${PRIORITY_LABELS.low}`],
  ["lowest", `${PRIORITY_ICON.lowest} ${PRIORITY_LABELS.lowest}`],
];

const STATUS_OPTIONS: [TaskStatus, string, string][] = [
  ["open", "Da fare", "circle"],
  ["inProgress", "In corso", "circle-dot"],
  ["done", "Fatto", "check-circle"],
  ["cancelled", "Annullato", "x-circle"],
];

export interface TaskEditorResult {
  text: string;
  due: string | null;
  scheduled: string | null;
  priority: Priority | null;
  status: TaskStatus;
  targetPath?: string;
  createMode: "create" | "createAndOpen";
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

function noteTitle(path: string): string {
  return path.substring(path.lastIndexOf("/") + 1).replace(/\.md$/i, "");
}

function dateLabel(due: string | null): string {
  if (due === null) return "Programma";
  const today = todayString();
  if (due === today) return "Oggi";
  if (due === addDays(today, 1)) return "Domani";
  return due;
}

function dateControlLabel(due: string | null, scheduled: string | null): string {
  if (due) return dateLabel(due);
  return scheduled ? `Pianificato ${dateLabel(scheduled)}` : "Programma";
}

function priorityLabel(priority: Priority | null): string {
  if (priority === null) return "Priorità";
  return `${PRIORITY_ICON[priority]} ${PRIORITY_LABELS[priority]}`;
}

export class QuickAddModal extends Modal {
  private static active: QuickAddModal | null = null;
  private text = "";
  private due: string | null = null;
  private scheduled: string | null = null;
  private priority: Priority | null = null;
  private status: TaskStatus = "open";
  private dateInput: HTMLInputElement | null = null;
  private dateField: "due" | "scheduled" = "due";
  private naturalPreview: HTMLElement | null = null;
  private dateButton: HTMLButtonElement | null = null;
  private destinationButton: HTMLButtonElement | null = null;
  private priorityButton: HTMLButtonElement | null = null;
  private statusButton: HTMLButtonElement | null = null;
  private createButton: HTMLButtonElement | null = null;
  private createMenuButton: HTMLButtonElement | null = null;
  private submitting = false;

  constructor(
    app: App,
    private onSubmit: (input: TaskEditorResult) => Promise<void>,
    private targetPath?: string,
    private task?: Task,
    private onOpenSource?: (task: Task) => void,
    initialDue?: string,
  ) {
    super(app);
    if (task) {
      this.text = task.text;
      this.due = task.due;
      this.scheduled = task.scheduled;
      this.priority = task.priority;
      this.status = task.status;
      this.targetPath = task.file;
    } else if (initialDue) {
      this.due = initialDue;
    }
  }

  onOpen(): void {
    if (QuickAddModal.active && QuickAddModal.active !== this) {
      QuickAddModal.active.close();
    }
    QuickAddModal.active = this;
    this.modalEl.addClass("kairos-quickadd-modal");
    const { contentEl } = this;
    contentEl.empty();

    const card = contentEl.createDiv({ cls: "kairos-quickadd-card" });
    this.renderTop(card);
    this.renderInput(card);
    this.renderFooter(card);
  }

  private renderTop(parent: HTMLElement): void {
    const top = parent.createDiv({ cls: "kairos-quickadd-top" });
    this.destinationButton = top.createEl("button", { cls: "kairos-quickadd-dest" });
    this.destinationButton.setAttribute("aria-label", this.task ? "Apri nota sorgente" : "Scegli destinazione");
    this.destinationButton.addEventListener("click", (event) => {
      if (this.task) {
        event.preventDefault();
        const task = this.task;
        this.close();
        this.onOpenSource?.(task);
        return;
      }
      this.openDestinationMenu(event);
    });
    this.renderDestinationButton();
  }

  private renderInput(parent: HTMLElement): void {
    const inputWrap = parent.createDiv({ cls: "kairos-quickadd-inputwrap" });
    const input = inputWrap.createEl("textarea", {
      cls: "kairos-quickadd-input",
      attr: {
        placeholder: "Scrivi un task...",
        rows: "2",
      },
    });
    input.value = this.text;
    input.addEventListener("input", () => {
      this.text = input.value;
      this.resizeInput(input);
      this.refreshNaturalPreview();
      this.refreshCreateButton();
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        void this.submit("create");
      }
    });
    window.setTimeout(() => {
      this.resizeInput(input);
      input.focus();
    }, 0);
    this.naturalPreview = inputWrap.createDiv({ cls: "kairos-natural-date-preview" });
    this.refreshNaturalPreview();
  }

  private renderFooter(parent: HTMLElement): void {
    const footer = parent.createDiv({
      cls: this.task ? "kairos-quickadd-footer is-editing" : "kairos-quickadd-footer",
    });
    const tools = footer.createDiv({ cls: "kairos-quickadd-tools" });

    if (this.task) {
      this.statusButton = tools.createEl("button", {
        cls: "kairos-quickadd-tool kairos-quickadd-tool--status",
        attr: { type: "button" },
      });
      setIcon(this.statusButton.createSpan({ cls: "kairos-quickadd-tool__icon" }), "circle");
      this.statusButton.createSpan({ cls: "kairos-quickadd-tool__label" });
      this.statusButton.addEventListener("click", (event) => this.openStatusMenu(event));
      this.refreshStatusButton();
    }

    this.dateButton = tools.createEl("button", {
      cls: "kairos-quickadd-tool kairos-quickadd-tool--date",
      attr: { type: "button" },
    });
    setIcon(this.dateButton.createSpan({ cls: "kairos-quickadd-tool__icon" }), "calendar-days");
    this.dateButton.createSpan({ cls: "kairos-quickadd-tool__label", text: dateControlLabel(this.due, this.scheduled) });
    this.dateButton.addEventListener("click", (event) => this.openDateMenu(event));

    this.dateInput = tools.createEl("input", {
      cls: "kairos-quickadd-date-input",
      attr: { type: "date", "aria-label": "Scegli data" },
    });
    this.dateInput.addEventListener("change", () => {
      const value = this.dateInput?.value || null;
      if (this.dateField === "scheduled") this.setScheduled(value);
      else this.setDue(value);
    });

    this.priorityButton = tools.createEl("button", {
      cls: "kairos-quickadd-tool kairos-quickadd-tool--priority",
      attr: { type: "button" },
    });
    setIcon(this.priorityButton.createSpan({ cls: "kairos-quickadd-tool__icon" }), "flag");
    this.priorityButton.createSpan({ cls: "kairos-quickadd-tool__label", text: priorityLabel(this.priority) });
    this.priorityButton.addEventListener("click", (event) => this.openPriorityMenu(event));

    const spacer = footer.createDiv({ cls: "kairos-quickadd-spacer" });
    spacer.setAttribute("aria-hidden", "true");

    const createGroup = footer.createDiv({ cls: "kairos-quickadd-create-group" });
    this.createButton = createGroup.createEl("button", {
      cls: "kairos-quickadd-create",
      text: this.task ? "Salva" : "Crea",
      attr: { type: "button" },
    });
    this.createButton.addEventListener("click", () => void this.submit("create"));
    if (!this.task) {
      this.createMenuButton = createGroup.createEl("button", {
        cls: "kairos-quickadd-create-menu",
        attr: { type: "button", "aria-label": "Altre modalità di creazione" },
      });
      this.createMenuButton.createSpan({ cls: "kairos-quickadd-create-chevron" });
      this.createMenuButton.addEventListener("click", (event) => this.openCreateMenu(event));
    }
    this.refreshCreateButton();
  }

  private openCreateMenu(event: MouseEvent): void {
    event.preventDefault();
    const menu = new Menu();
    menu.addItem((item) =>
      item.setTitle("Crea").setIcon("plus").onClick(() => void this.submit("create")),
    );
    menu.addItem((item) =>
      item
        .setTitle("Crea e apri")
        .setIcon("external-link")
        .onClick(() => void this.submit("createAndOpen")),
    );
    menu.showAtMouseEvent(event);
  }

  private renderDestinationButton(): void {
    if (!this.destinationButton) return;
    this.destinationButton.empty();
    setIcon(
      this.destinationButton.createSpan({ cls: "kairos-quickadd-dest__icon" }),
      this.task ? "file-symlink" : this.targetPath ? "file-text" : "inbox",
    );
    this.destinationButton.createSpan({
      cls: "kairos-quickadd-dest__label",
      text: this.task
        ? `Apri sorgente — ${noteTitle(this.task.file)}`
        : this.targetPath
          ? `Nota progetto — ${noteTitle(this.targetPath)}`
          : "Inbox",
    });
    setIcon(
      this.destinationButton.createSpan({ cls: "kairos-quickadd-dest__chevron" }),
      this.task ? "external-link" : "chevron-down",
    );
  }

  private openDestinationMenu(event: MouseEvent): void {
    event.preventDefault();
    const menu = new Menu();
    menu.addItem((item) =>
      item
        .setTitle("Inbox")
        .setIcon("inbox")
        .setChecked(this.targetPath === undefined)
        .onClick(() => {
          this.targetPath = undefined;
          this.renderDestinationButton();
        }),
    );
    const currentFile = this.app.workspace.getActiveFile();
    if (currentFile) {
      menu.addItem((item) =>
        item
          .setTitle(`Nota corrente — ${currentFile.basename}`)
          .setIcon("file-text")
          .setChecked(this.targetPath === currentFile.path)
          .onClick(() => {
            this.targetPath = currentFile.path;
            this.renderDestinationButton();
          }),
      );
    }
    menu.addSeparator();
    menu.addItem((item) =>
      item
        .setTitle("Scegli nota...")
        .setIcon("search")
        .onClick(() =>
          pickNote(this.app, "Scegli nota per il task", (file) => {
            this.targetPath = file.path;
            this.renderDestinationButton();
          }),
        ),
    );
    menu.showAtMouseEvent(event);
  }

  private openDateMenu(event: MouseEvent): void {
    event.preventDefault();
    const menu = new Menu();
    const today = todayString();

    menu.addItem((item) =>
      item.setTitle("Oggi").setIcon("calendar").setChecked(this.due === today).onClick(() => this.setDue(today)),
    );
    menu.addItem((item) => {
      const tomorrow = addDays(today, 1);
      item.setTitle("Domani").setIcon("calendar").setChecked(this.due === tomorrow).onClick(() => this.setDue(tomorrow));
    });
    menu.addItem((item) => {
      const nextWeek = addDays(today, 7);
      item
        .setTitle("Prossima settimana")
        .setIcon("calendar")
        .setChecked(this.due === nextWeek)
        .onClick(() => this.setDue(nextWeek));
    });
    menu.addSeparator();
    menu.addItem((item) =>
      item.setTitle("Scegli scadenza...").setIcon("calendar-plus").onClick(() => this.openDatePicker("due")),
    );
    if (this.due !== null) {
      menu.addItem((item) => item.setTitle("Rimuovi data").setIcon("calendar-x").onClick(() => this.setDue(null)));
    }
    menu.addSeparator();
    menu.addItem((item) =>
      item.setTitle(this.scheduled ? `Pianificata: ${this.scheduled}` : "Aggiungi data pianificata...")
        .setIcon("clock-3").onClick(() => this.openDatePicker("scheduled")),
    );
    if (this.scheduled) {
      menu.addItem((item) => item.setTitle("Rimuovi data pianificata").setIcon("clock-9").onClick(() => this.setScheduled(null)));
    }
    menu.showAtMouseEvent(event);
  }

  private openDatePicker(field: "due" | "scheduled"): void {
    if (!this.dateInput) return;
    this.dateField = field;
    this.dateInput.value = (field === "due" ? this.due : this.scheduled) ?? "";
    this.dateInput.focus();
    const picker = this.dateInput as HTMLInputElement & { showPicker?: () => void };
    if (picker.showPicker) {
      picker.showPicker();
    } else {
      picker.click();
    }
  }

  private openPriorityMenu(event: MouseEvent): void {
    event.preventDefault();
    const menu = new Menu();
    for (const [value, label] of PRIORITY_OPTIONS) {
      menu.addItem((item) =>
        item
          .setTitle(label)
          .setIcon(value === null ? "circle" : "flag")
          .setChecked(this.priority === value)
          .onClick(() => this.setPriority(value)),
      );
    }
    menu.showAtMouseEvent(event);
  }

  private openStatusMenu(event: MouseEvent): void {
    event.preventDefault();
    const menu = new Menu();
    for (const [value, label, icon] of STATUS_OPTIONS) {
      menu.addItem((item) =>
        item
          .setTitle(label)
          .setIcon(icon)
          .setChecked(this.status === value)
          .onClick(() => {
            this.status = value;
            this.refreshStatusButton();
          }),
      );
    }
    menu.showAtMouseEvent(event);
  }

  private setDue(due: string | null): void {
    this.due = due;
    this.refreshDateButton();
    this.refreshNaturalPreview();
  }

  private setScheduled(scheduled: string | null): void {
    this.scheduled = scheduled;
    this.refreshDateButton();
  }

  private setPriority(priority: Priority | null): void {
    this.priority = priority;
    this.refreshPriorityButton();
  }

  private refreshDateButton(): void {
    if (!this.dateButton) return;
    this.dateButton.toggleClass("is-active", this.due !== null || this.scheduled !== null);
    const label = this.dateButton.querySelector(".kairos-quickadd-tool__label");
    if (label) label.textContent = dateControlLabel(this.due, this.scheduled);
    if (this.dateInput) this.dateInput.value = this.due ?? "";
  }

  private refreshNaturalPreview(): void {
    if (!this.naturalPreview) return;
    const result = !this.task && this.due === null ? parseNaturalDate(this.text, todayString()) : null;
    const recognized = result !== null && result.date !== null && result.cleaned !== "";
    this.naturalPreview.textContent = recognized && result
      ? `Riconosciuto: ${result.date} · “${result.cleaned}”`
      : "";
    this.naturalPreview.toggleClass("is-visible", recognized);
  }

  private refreshPriorityButton(): void {
    if (!this.priorityButton) return;
    this.priorityButton.toggleClass("is-active", this.priority !== null);
    const label = this.priorityButton.querySelector(".kairos-quickadd-tool__label");
    if (label) label.textContent = priorityLabel(this.priority);
  }

  private refreshStatusButton(): void {
    if (!this.statusButton) return;
    const current = STATUS_OPTIONS.find(([value]) => value === this.status) ?? STATUS_OPTIONS[0];
    this.statusButton.toggleClass("is-active", this.status !== "open");
    const icon = this.statusButton.querySelector(".kairos-quickadd-tool__icon");
    if (icon instanceof HTMLElement) {
      icon.empty();
      setIcon(icon, current[2]);
    }
    const label = this.statusButton.querySelector(".kairos-quickadd-tool__label");
    if (label) label.textContent = current[1];
  }

  private refreshCreateButton(): void {
    if (!this.createButton) return;
    const disabled = this.submitting || this.text.trim().length === 0;
    this.createButton.disabled = disabled;
    if (this.createMenuButton) this.createMenuButton.disabled = disabled;
  }

  private resizeInput(input: HTMLTextAreaElement): void {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
  }

  private async submit(createMode: "create" | "createAndOpen"): Promise<void> {
    if (this.submitting || this.text.trim().length === 0) return;
    this.submitting = true;
    this.refreshCreateButton();
    try {
      const parsedNatural = !this.task && this.due === null ? parseNaturalDate(this.text, todayString()) : null;
      const natural = parsedNatural?.date && parsedNatural.cleaned ? parsedNatural : null;
      await this.onSubmit({
        text: natural?.date ? natural.cleaned : this.text.trim(),
        due: natural?.date ?? this.due,
        scheduled: this.scheduled,
        priority: this.priority,
        status: this.status,
        targetPath: this.targetPath,
        createMode: this.task ? "create" : createMode,
      });
      this.close();
    } catch {
      this.submitting = false;
      this.refreshCreateButton();
    }
  }

  onClose(): void {
    if (QuickAddModal.active === this) QuickAddModal.active = null;
    this.contentEl.empty();
    this.modalEl.removeClass("kairos-quickadd-modal");
  }
}
