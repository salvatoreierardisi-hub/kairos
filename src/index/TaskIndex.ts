import { App, Plugin, TFile } from "obsidian";
import { Task } from "../types";
import { parseFileContent } from "../core/parser";

export class TaskIndex {
  private byFile = new Map<string, Task[]>();
  private listeners: Array<() => void> = [];

  constructor(private app: App) {}

  async build(): Promise<void> {
    this.byFile.clear();
    const files = this.app.vault.getMarkdownFiles();
    for (const file of files) {
      await this.indexFile(file);
    }
    this.notify();
  }

  private async indexFile(file: TFile): Promise<void> {
    const content = await this.app.vault.cachedRead(file);
    const tasks = parseFileContent(content, file.path);
    if (tasks.length > 0) this.byFile.set(file.path, tasks);
    else this.byFile.delete(file.path);
  }

  getAll(): Task[] {
    return Array.from(this.byFile.values()).flat();
  }

  /** Ritorna un disposer: chiamalo per rimuovere il listener (evita leak su riapertura view). */
  onChange(cb: () => void): () => void {
    this.listeners.push(cb);
    return () => {
      const i = this.listeners.indexOf(cb);
      if (i !== -1) this.listeners.splice(i, 1);
    };
  }

  /** Trigger listeners on demand, e.g. when settings change without any vault file event. */
  refresh(): void {
    this.notify();
  }

  private notify(): void {
    for (const cb of this.listeners) cb();
  }

  registerVaultEvents(plugin: Plugin): void {
    const refresh = async (file: unknown) => {
      if (file instanceof TFile && file.extension === "md") {
        await this.indexFile(file);
        this.notify();
      }
    };
    plugin.registerEvent(this.app.vault.on("modify", refresh));
    plugin.registerEvent(this.app.vault.on("create", refresh));
    plugin.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (file instanceof TFile) {
          this.byFile.delete(file.path);
          this.notify();
        }
      }),
    );
    plugin.registerEvent(
      this.app.vault.on("rename", async (file, oldPath) => {
        this.byFile.delete(oldPath);
        await refresh(file);
      }),
    );
  }
}
