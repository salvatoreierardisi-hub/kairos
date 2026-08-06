import { App, Plugin, TFile } from "obsidian";
import { Settings, Task } from "../types";
import { parseFileContent } from "../core/parser";
import { TaskIndexCore } from "./TaskIndexCore";

export class TaskIndex {
  private core = new TaskIndexCore();

  private generation = 0;
  private notifyTimer: number | null = null;

  constructor(private app: App, private getSettings: () => Settings) {}

  async build(): Promise<void> {
    const generation = ++this.generation;
    this.core.clear();
    const files = this.app.vault.getMarkdownFiles().filter((file) => !this.isExcluded(file.path));
    for (let index = 0; index < files.length; index++) {
      if (generation !== this.generation) return;
      const file = files[index];
      try {
        await this.indexFile(file);
      } catch (error) {
        console.warn(`Kairos: impossibile indicizzare ${file.path}`, error);
      }
      if (index > 0 && index % 50 === 0) await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    }
    this.notify();
  }

  private async indexFile(file: TFile): Promise<void> {
    if (this.isExcluded(file.path)) {
      this.core.delete(file.path);
      return;
    }
    const content = await this.app.vault.cachedRead(file);
    const tasks = parseFileContent(content, file.path);
    this.core.replace(file.path, tasks);
  }

  getAll(): Task[] {
    return this.core.getAll();
  }

  /** Ritorna un disposer: chiamalo per rimuovere il listener (evita leak su riapertura view). */
  onChange(cb: () => void): () => void {
    return this.core.onChange(cb);
  }

  /** Trigger listeners on demand, e.g. when settings change without any vault file event. */
  refresh(): void {
    this.notify();
  }

  private notify(): void {
    this.core.notify();
  }

  private scheduleNotify(): void {
    if (this.notifyTimer !== null) window.clearTimeout(this.notifyTimer);
    this.notifyTimer = window.setTimeout(() => {
      this.notifyTimer = null;
      this.notify();
    }, 50);
  }

  private isExcluded(path: string): boolean {
    const clean = path.replace(/\\/g, "/").replace(/^\/+/, "");
    const excluded = [".obsidian", ...this.getSettings().excludeFolders]
      .map((folder) => folder.replace(/\\/g, "/").replace(/^\/+|\/+$/g, ""))
      .filter(Boolean);
    return excluded.some((folder) => clean === folder || clean.startsWith(`${folder}/`));
  }

  registerVaultEvents(plugin: Plugin): void {
    const refresh = async (file: unknown) => {
      if (file instanceof TFile && file.extension === "md") {
        try {
          await this.indexFile(file);
          this.scheduleNotify();
        } catch (error) {
          console.warn(`Kairos: impossibile aggiornare l'indice per ${file.path}`, error);
        }
      }
    };
    plugin.registerEvent(this.app.vault.on("modify", refresh));
    plugin.registerEvent(this.app.vault.on("create", refresh));
    plugin.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (file instanceof TFile) {
          this.core.delete(file.path);
          this.scheduleNotify();
        }
      }),
    );
    plugin.registerEvent(
      this.app.vault.on("rename", async (file, oldPath) => {
        this.core.delete(oldPath);
        await refresh(file);
      }),
    );
    plugin.register(() => {
      if (this.notifyTimer !== null) window.clearTimeout(this.notifyTimer);
      this.notifyTimer = null;
      this.generation += 1;
    });
  }
}
