import { App, FuzzySuggestModal, TFile } from "obsidian";

class NotePickerModal extends FuzzySuggestModal<TFile> {
  constructor(app: App, placeholder: string, private onPick: (file: TFile) => void) {
    super(app);
    this.setPlaceholder(placeholder);
  }

  getItems(): TFile[] {
    return this.app.vault.getMarkdownFiles();
  }

  getItemText(file: TFile): string {
    return file.path;
  }

  onChooseItem(file: TFile): void {
    this.onPick(file);
  }
}

/** Note picker fuzzy su tutti i file markdown del vault. */
export function pickNote(app: App, placeholder: string, onPick: (file: TFile) => void): void {
  new NotePickerModal(app, placeholder, onPick).open();
}
