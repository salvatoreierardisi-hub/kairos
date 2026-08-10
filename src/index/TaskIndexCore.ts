import { Task } from "../types";

/** Stato puro e snapshot dell'indice; il servizio Obsidian gestisce solo I/O ed eventi. */
export class TaskIndexCore {
  private byFile = new Map<string, Task[]>();
  private snapshot: Task[] = [];
  private snapshotDirty = false;
  private listeners = new Set<() => void>();

  replace(path: string, tasks: readonly Task[]): boolean {
    const previous = this.byFile.get(path) ?? [];
    const unchanged = previous.length === tasks.length && previous.every((task, index) => {
      const next = tasks[index];
      return next !== undefined && task.file === next.file && task.line === next.line && task.source === next.source;
    });
    if (unchanged) return false;
    if (tasks.length) this.byFile.set(path, [...tasks]);
    else this.byFile.delete(path);
    this.snapshotDirty = true;
    return true;
  }

  delete(path: string): boolean {
    if (!this.byFile.delete(path)) return false;
    this.snapshotDirty = true;
    return true;
  }

  clear(): void {
    this.byFile.clear();
    this.snapshot = [];
    this.snapshotDirty = false;
  }

  getAll(): Task[] {
    if (this.snapshotDirty) this.rebuild();
    return this.snapshot;
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(): void { for (const listener of this.listeners) listener(); }

  private rebuild(): void {
    this.snapshot = Array.from(this.byFile.values()).flat();
    this.snapshotDirty = false;
  }
}
