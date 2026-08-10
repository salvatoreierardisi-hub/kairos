import { App, EventRef, setIcon, TFolder } from "obsidian";
import {
  buildReferenceCandidates,
  ReferenceCandidate,
  ReferenceCandidateCache,
  searchReferenceCandidates,
} from "../core/referenceCandidates";

export type { ReferenceCandidate } from "../core/referenceCandidates";

function hidden(path: string): boolean {
  return path.split("/").some((part) => part.startsWith("."));
}

export function referenceCandidates(app: App): ReferenceCandidate[] {
  const files = app.vault.getMarkdownFiles().filter((file) => !hidden(file.path));
  const folders = app.vault.getAllLoadedFiles().filter((entry): entry is TFolder => entry instanceof TFolder && entry.path !== "/" && !hidden(entry.path));
  return buildReferenceCandidates(
    files.map((file) => ({
      path: file.path,
      basename: file.basename,
      parentPath: file.parent?.path ?? null,
    })),
    folders.map((folder) => ({ path: folder.path, name: folder.name })),
  );
}

export class ReferenceSuggest {
  private root: HTMLElement;
  private candidates: ReferenceCandidate[] = [];
  private catalog = new ReferenceCandidateCache();
  private vaultEventRefs: EventRef[];
  private selected = 0;
  private open = false;
  private pointerInteracting = false;

  constructor(
    parent: HTMLElement,
    private app: App,
    private onChoose: (candidate: ReferenceCandidate) => void,
  ) {
    this.root = parent.createDiv({ cls: "kairos-reference-suggest" });
    this.root.setAttribute("role", "listbox");
    this.root.setAttribute("aria-label", "File e cartelle collegabili");
    this.root.addEventListener("pointerdown", () => {
      this.pointerInteracting = true;
    });
    const endPointerInteraction = () => {
      window.setTimeout(() => { this.pointerInteracting = false; }, 0);
    };
    this.root.addEventListener("pointerup", endPointerInteraction);
    this.root.addEventListener("pointercancel", endPointerInteraction);
    const invalidate = () => this.catalog.invalidate();
    this.vaultEventRefs = [
      this.app.vault.on("create", invalidate),
      this.app.vault.on("delete", invalidate),
      this.app.vault.on("rename", invalidate),
    ];
  }

  isInteracting(): boolean {
    return this.pointerInteracting;
  }

  update(query: string): void {
    const catalog = this.catalog.get(() => referenceCandidates(this.app));
    this.candidates = searchReferenceCandidates(catalog, query);
    this.selected = 0;
    this.open = true;
    this.render();
  }

  close(): void {
    this.open = false;
    this.root.empty();
    this.root.removeClass("is-open");
  }

  destroy(): void {
    this.close();
    for (const ref of this.vaultEventRefs) this.app.vault.offref(ref);
    this.vaultEventRefs = [];
    this.catalog.invalidate();
  }

  handleKeydown(event: KeyboardEvent): boolean {
    if (!this.open) return false;
    if (event.key === "Escape") {
      event.preventDefault();
      this.close();
      return true;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      this.selected = (this.selected + delta + Math.max(1, this.candidates.length)) % Math.max(1, this.candidates.length);
      this.render();
      return true;
    }
    if (event.key === "Enter" && this.candidates[this.selected]) {
      event.preventDefault();
      this.choose(this.candidates[this.selected]!);
      return true;
    }
    return false;
  }

  private render(): void {
    this.root.empty();
    this.root.addClass("is-open");
    if (this.candidates.length === 0) {
      this.root.createDiv({ cls: "kairos-reference-suggest__empty", text: "Nessun file o cartella" });
      return;
    }
    this.candidates.forEach((candidate, index) => {
      const item = this.root.createDiv({
        cls: `kairos-reference-suggest__item${index === this.selected ? " is-selected" : ""}`,
        attr: { role: "option", "aria-selected": String(index === this.selected) },
      });
      setIcon(item.createSpan({ cls: "kairos-reference-suggest__icon" }), candidate.kind === "folder" ? "folder" : "file-text");
      const labels = item.createDiv({ cls: "kairos-reference-suggest__labels" });
      labels.createDiv({ cls: "kairos-reference-suggest__label", text: candidate.label });
      labels.createDiv({ cls: "kairos-reference-suggest__path", text: candidate.indexed ? `${candidate.path} · Indice` : candidate.path });
      let chosen = false;
      const chooseOnce = () => {
        if (chosen) return;
        chosen = true;
        this.choose(candidate);
      };
      item.addEventListener("click", chooseOnce);
    });
    this.root.querySelector<HTMLElement>(".kairos-reference-suggest__item.is-selected")
      ?.scrollIntoView({ block: "nearest" });
  }

  private choose(candidate: ReferenceCandidate): void {
    this.close();
    this.onChoose(candidate);
  }
}
