import { describe, expect, it, vi } from "vitest";
import { KairosApi } from "../src/api";
import { Task } from "../src/types";
import { TaskIndex } from "../src/index/TaskIndex";
import { TaskWriter } from "../src/io/TaskWriter";

const indexed: Task = {
  text: "Città", status: "open", due: "2099-08-05", scheduled: null, completed: null, cancelled: null,
  priority: null, tags: ["qualità"], file: "Inbox.md", line: 2, source: "- [ ] Città 📅 2099-08-05 #qualità",
};

function fixture() {
  const index = { getAll: () => [indexed] } as unknown as TaskIndex;
  const setStatus = vi.fn(async () => undefined);
  const writer = { setStatus } as unknown as TaskWriter;
  const api = new KairosApi(index, writer, vi.fn(async () => undefined), vi.fn(async () => undefined));
  return { api, setStatus };
}

describe("KairosApi", () => {
  it("espone DTO clonati e ricerca accent-insensitive", () => {
    const { api } = fixture();
    const result = api.query({ text: "citta qualita", statuses: [] });
    expect(result).toHaveLength(1);
    expect(result[0]).not.toBe(indexed);
    expect(api.descriptor.apiVersion).toBe(1);
  });

  it("fa passare le mutazioni dal writer e rifiuta riferimenti stantii", async () => {
    const { api, setStatus } = fixture();
    await api.completeTask({ file: indexed.file, line: indexed.line, source: indexed.source });
    expect(setStatus).toHaveBeenCalledWith(indexed, "done");
    await expect(api.completeTask({ file: indexed.file, line: indexed.line, source: "vecchia" })).rejects.toThrow("non più valido");
  });

  it("valida le date prima della navigazione", async () => {
    const { api } = fixture();
    await expect(api.openForDay("2026-02-30")).rejects.toThrow("Data non valida");
  });
});
