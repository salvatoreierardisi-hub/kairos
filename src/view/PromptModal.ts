import { App, Modal } from "obsidian";

/** Prompt testuale a una riga. Richiama `onSubmit` solo se il valore non è vuoto. */
export function promptText(
  app: App,
  title: string,
  initial: string,
  onSubmit: (value: string) => void,
): void {
  new PromptModal(app, title, initial, onSubmit).open();
}

class PromptModal extends Modal {
  constructor(
    app: App,
    private title: string,
    private initial: string,
    private onSubmit: (value: string) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText(this.title);
    const input = this.contentEl.createEl("input", {
      cls: "kairos-prompt-input",
      attr: { type: "text" },
      value: this.initial,
    });
    const buttons = this.contentEl.createDiv({ cls: "modal-button-container" });
    const save = buttons.createEl("button", { cls: "mod-cta", text: "Salva" });
    const submit = (): void => {
      const value = input.value.trim();
      this.close();
      if (value !== "") this.onSubmit(value);
    };
    save.addEventListener("click", submit);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") submit();
    });
    buttons.createEl("button", { text: "Annulla" }).addEventListener("click", () => this.close());
    input.focus();
    input.select();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
