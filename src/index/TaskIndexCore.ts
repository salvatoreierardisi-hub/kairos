import { Task } from "../types";

/** Stato puro e snapshot dell'indice; il servizio Obsidian gestisce solo I/O ed eventi. */
export class TaskIndexCore {
  private byFile = new Map<string, Task[]>();
  private snapshot: Task[] = [];
  private listeners = new Set<() => void>();

  replace(path: string, tasks: readonly Task[]): void {
    if (tasks.length) this.byFile.set(path, [...tasks]);
    else this.byFile.delete(path);
    this.rebuild();
  }

  delete(path: string): void { this.byFile.delete(path); this.rebuild(); }

  clear(): void { this.byFile.clear(); this.rebuild(); }

  getAll(): Task[] { return this.snapshot; }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(): void { for (const listener of this.listeners) listener(); }

  private rebuild(): void { this.snapshot = Array.from(this.byFile.values()).flat(); }
}
