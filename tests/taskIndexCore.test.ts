import { describe, expect, it, vi } from "vitest";
import { TaskIndexCore } from "../src/index/TaskIndexCore";
import { Task } from "../src/types";

const task = (file: string, line: number): Task => ({
  text: "Task", status: "open", due: null, scheduled: null, completed: null, cancelled: null,
  priority: null, tags: [], file, line, source: "- [ ] Task",
});

describe("TaskIndexCore", () => {
  it("mantiene uno snapshot aggiornato per bucket", () => {
    const index = new TaskIndexCore();
    index.replace("a.md", [task("a.md", 1)]);
    index.replace("b.md", [task("b.md", 2)]);
    index.replace("a.md", []);
    expect(index.getAll().map((item) => item.file)).toEqual(["b.md"]);
  });

  it("mantiene lo snapshot stabile finché un bucket non cambia", () => {
    const index = new TaskIndexCore();
    index.replace("a.md", [task("a.md", 1)]);
    const first = index.getAll();
    expect(index.getAll()).toBe(first);

    index.replace("b.md", [task("b.md", 2)]);
    const second = index.getAll();
    expect(second).not.toBe(first);
    expect(second.map((item) => item.file)).toEqual(["a.md", "b.md"]);
    expect(index.getAll()).toBe(second);
  });

  it("riconosce bucket invariati e cambiamenti reali", () => {
    const index = new TaskIndexCore();
    expect(index.replace("a.md", [task("a.md", 1)])).toBe(true);
    expect(index.replace("a.md", [task("a.md", 1)])).toBe(false);
    expect(index.replace("a.md", [task("a.md", 2)])).toBe(true);
    expect(index.delete("missing.md")).toBe(false);
    expect(index.delete("a.md")).toBe(true);
  });

  it("notifica solo quando richiesto e rimuove il listener", () => {
    const index = new TaskIndexCore();
    const listener = vi.fn();
    const dispose = index.onChange(listener);
    index.replace("a.md", [task("a.md", 1)]);
    expect(listener).not.toHaveBeenCalled();
    index.notify();
    dispose();
    index.notify();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
