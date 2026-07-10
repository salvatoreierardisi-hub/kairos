import { App, Menu, Modal, setIcon } from "obsidian";
import { NewTaskInput, Priority } from "../types";
import { PRIORITY_LABELS } from "../core/query";
import { pickNote } from "./NotePicker";

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

function priorityLabel(priority: Priority | null): string {
  if (priority === null) return "Priorità";
  return `${PRIORITY_ICON[priority]} ${PRIORITY_LABELS[priority]}`;
}

export class QuickAddModal extends Modal {
  private text = "";
  private due: string | null = null;
  private priority: Priority | null = null;
  private dateInput: HTMLInputElement | null = null;
  private dateButton: HTMLButtonElement | null = null;
  private destinationButton: HTMLButtonElement | null = null;
  private priorityButton: HTMLButtonElement | null = null;
  private createButton: HTMLButtonElement | null = null;

  constructor(
    app: App,
    private onSubmit: (input: NewTaskInput) => void,
    private targetPath?: string,
  ) {
    super(app);
  }

  onOpen(): void {
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
    this.destinationButton.setAttribute("aria-label", "Scegli destinazione");
    this.destinationButton.addEventListener("click", (event) => this.openDestinationMenu(event));
    this.renderDestinationButton();

    const close = top.createEl("button", { cls: "kairos-quickadd-close", attr: { type: "button" } });
    setIcon(close, "x");
    close.createSpan({ cls: "kairos-quickadd-close__fallback", text: "×" });
    close.setAttribute("aria-label", "Chiudi");
    close.addEventListener("click", () => this.close());
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
    input.addEventListener("input", () => {
      this.text = input.value;
      this.resizeInput(input);
      this.refreshCreateButton();
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        this.submit();
      }
    });
    window.setTimeout(() => {
      this.resizeInput(input);
      input.focus();
    }, 0);
  }

  private renderFooter(parent: HTMLElement): void {
    const footer = parent.createDiv({ cls: "kairos-quickadd-footer" });
    const tools = footer.createDiv({ cls: "kairos-quickadd-tools" });

    this.dateButton = tools.createEl("button", { cls: "kairos-quickadd-tool", attr: { type: "button" } });
    setIcon(this.dateButton.createSpan({ cls: "kairos-quickadd-tool__icon" }), "calendar-days");
    this.dateButton.createSpan({ cls: "kairos-quickadd-tool__label", text: dateLabel(this.due) });
    this.dateButton.addEventListener("click", (event) => this.openDateMenu(event));

    this.dateInput = tools.createEl("input", {
      cls: "kairos-quickadd-date-input",
      attr: { type: "date", "aria-label": "Scegli data" },
    });
    this.dateInput.addEventListener("change", () => this.setDue(this.dateInput?.value || null));

    this.priorityButton = tools.createEl("button", { cls: "kairos-quickadd-tool", attr: { type: "button" } });
    setIcon(this.priorityButton.createSpan({ cls: "kairos-quickadd-tool__icon" }), "flag");
    this.priorityButton.createSpan({ cls: "kairos-quickadd-tool__label", text: priorityLabel(this.priority) });
    this.priorityButton.addEventListener("click", (event) => this.openPriorityMenu(event));

    const spacer = footer.createDiv({ cls: "kairos-quickadd-spacer" });
    spacer.setAttribute("aria-hidden", "true");

    this.createButton = footer.createEl("button", { cls: "kairos-quickadd-create", text: "Crea", attr: { type: "button" } });
    this.createButton.addEventListener("click", () => this.submit());
    this.refreshCreateButton();
  }

  private renderDestinationButton(): void {
    if (!this.destinationButton) return;
    this.destinationButton.empty();
    setIcon(
      this.destinationButton.createSpan({ cls: "kairos-quickadd-dest__icon" }),
      this.targetPath ? "file-text" : "wand-sparkles",
    );
    this.destinationButton.createSpan({
      cls: "kairos-quickadd-dest__label",
      text: this.targetPath ? noteTitle(this.targetPath) : "Automatico — Inbox o daily",
    });
    setIcon(this.destinationButton.createSpan({ cls: "kairos-quickadd-dest__chevron" }), "chevron-down");
  }

  private openDestinationMenu(event: MouseEvent): void {
    event.preventDefault();
    const menu = new Menu();
    menu.addItem((item) =>
      item
        .setTitle("Automatico — Inbox o daily")
        .setIcon("wand-sparkles")
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
      item.setTitle("Scegli data...").setIcon("calendar-plus").onClick(() => this.openDatePicker()),
    );
    if (this.due !== null) {
      menu.addItem((item) => item.setTitle("Rimuovi data").setIcon("calendar-x").onClick(() => this.setDue(null)));
    }
    menu.showAtMouseEvent(event);
  }

  private openDatePicker(): void {
    if (!this.dateInput) return;
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

  private setDue(due: string | null): void {
    this.due = due;
    this.refreshDateButton();
  }

  private setPriority(priority: Priority | null): void {
    this.priority = priority;
    this.refreshPriorityButton();
  }

  private refreshDateButton(): void {
    if (!this.dateButton) return;
    this.dateButton.toggleClass("is-active", this.due !== null);
    const label = this.dateButton.querySelector(".kairos-quickadd-tool__label");
    if (label) label.textContent = dateLabel(this.due);
    if (this.dateInput) this.dateInput.value = this.due ?? "";
  }

  private refreshPriorityButton(): void {
    if (!this.priorityButton) return;
    this.priorityButton.toggleClass("is-active", this.priority !== null);
    const label = this.priorityButton.querySelector(".kairos-quickadd-tool__label");
    if (label) label.textContent = priorityLabel(this.priority);
  }

  private refreshCreateButton(): void {
    if (!this.createButton) return;
    this.createButton.disabled = this.text.trim().length === 0;
  }

  private resizeInput(input: HTMLTextAreaElement): void {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
  }

  private submit(): void {
    if (this.text.trim().length === 0) return;
    this.onSubmit({
      text: this.text.trim(),
      due: this.due,
      priority: this.priority,
      important: false,
      targetPath: this.targetPath,
    });
    this.close();
  }

  onClose(): void {
    this.contentEl.empty();
    this.modalEl.removeClass("kairos-quickadd-modal");
  }
}
