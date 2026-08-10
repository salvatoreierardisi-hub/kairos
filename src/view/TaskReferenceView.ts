import { App, FuzzySuggestModal, Notice, TFile, TFolder } from "obsidian";
import { parseTaskReferences, TaskReference } from "../core/taskReferences";
import { displayTaskText } from "../core/taskText";

class FolderNotePicker extends FuzzySuggestModal<TFile> {
  constructor(app: App, private folder: TFolder) { super(app); }
  getItems(): TFile[] {
    const prefix = `${this.folder.path}/`;
    return this.app.vault.getMarkdownFiles()
      .filter((file) => file.path.startsWith(prefix))
      .sort((a, b) => Number(b.basename.startsWith("_indice-")) - Number(a.basename.startsWith("_indice-")) || a.path.localeCompare(b.path));
  }
  getItemText(file: TFile): string { return file.path.slice(this.folder.path.length + 1); }
  onChooseItem(file: TFile): void { void this.app.workspace.getLeaf("tab").openFile(file); }
}

export function resolveFolder(app: App, path: string): TFolder | null {
  const exact = app.vault.getAbstractFileByPath(path);
  if (exact instanceof TFolder) return exact;
  const name = path.split("/").pop();
  const matches = app.vault.getAllLoadedFiles().filter((entry): entry is TFolder => entry instanceof TFolder && entry.name === name);
  return matches.length === 1 ? matches[0]! : null;
}

export function openFolderReference(app: App, path: string): void {
  if (path.startsWith("/") || path.split("/").some((part) => part === ".." || part.startsWith("."))) {
    new Notice("Kairos: riferimento cartella non valido.");
    return;
  }
  const folder = resolveFolder(app, path);
  if (!folder) {
    new Notice("Kairos: cartella collegata non trovata.");
    return;
  }
  new FolderNotePicker(app, folder).open();
}

export async function openTaskReference(app: App, sourcePath: string, reference: TaskReference): Promise<void> {
  if (reference.kind === "folder") {
    openFolderReference(app, reference.target);
    return;
  }
  const file = app.metadataCache.getFirstLinkpathDest(reference.target, sourcePath) ??
    app.vault.getAbstractFileByPath(reference.target.replace(/\.md$/i, "") + ".md");
  if (!(file instanceof TFile)) {
    new Notice("Kairos: nota collegata non trovata.");
    return;
  }
  await app.workspace.getLeaf("tab").openFile(file);
}

export function renderTaskTextWithReferences(
  parent: HTMLElement,
  raw: string,
  onOpen: (reference: TaskReference) => void,
): void {
  const parsed = parseTaskReferences(raw);
  let cursor = 0;
  for (const reference of parsed.references) {
    if (reference.start > cursor) {
      parent.createSpan({ text: displayTaskText(parsed.text.slice(cursor, reference.start)) });
    }
    const link = parent.createSpan({ cls: "kairos-task-reference", text: `@${reference.label}` });
    link.setAttribute("role", "link");
    link.setAttribute("tabindex", "0");
    const open = (event: Event) => { event.stopPropagation(); onOpen(reference); };
    link.addEventListener("click", open);
    link.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      open(event);
    });
    cursor = reference.end;
  }
  if (cursor < parsed.text.length) parent.createSpan({ text: displayTaskText(parsed.text.slice(cursor)) });
}
