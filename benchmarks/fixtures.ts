import { Task } from "../src/types";

const PRIORITIES: Task["priority"][] = ["highest", "high", "medium", "low", "lowest", null];

export function makeTasks(count = 10_000): Task[] {
  return Array.from({ length: count }, (_, index) => {
    const day = String((index % 28) + 1).padStart(2, "0");
    const folder = `Area-${index % 40}`;
    const file = `${folder}/Nota-${index % 2_000}.md`;
    const project = `progetto/progetto-${index % 100}`;
    return {
      text: `Attività numero ${index} manutenzione impianto ${index % 17}`,
      status: index % 9 === 0 ? "done" : index % 7 === 0 ? "inProgress" : "open",
      due: index % 4 === 0 ? `2026-08-${day}` : null,
      scheduled: index % 4 === 1 ? `2026-08-${day}` : null,
      completed: index % 9 === 0 ? `2026-08-${day}` : null,
      cancelled: null,
      priority: PRIORITIES[index % PRIORITIES.length] ?? null,
      tags: [project, `area/area-${index % 40}`],
      file,
      line: index % 200,
      source: `- [ ] Attività numero ${index} #${project}`,
      ...(index % 13 === 0 ? { detailPath: `Dettagli/Task-${index}.md` } : {}),
    };
  });
}
export function makeMarkdownNotes(noteCount = 500, tasksPerNote = 20): string[] {
  return Array.from({ length: noteCount }, (_, noteIndex) => {
    const lines = [`# Nota ${noteIndex}`, "", "Testo introduttivo senza task."];
    for (let taskIndex = 0; taskIndex < tasksPerNote; taskIndex++) {
      const index = noteIndex * tasksPerNote + taskIndex;
      const day = String((index % 28) + 1).padStart(2, "0");
      lines.push(
        `- [${index % 9 === 0 ? "x" : index % 7 === 0 ? "/" : " "}] Attività ${index} `
        + `⏫ 📅 2026-08-${day} #progetto/progetto-${index % 100}`,
      );
      lines.push(`Annotazione libera ${index}`);
    }
    lines.push("```md", "- [ ] Non indicizzare nel code fence", "```");
    return lines.join("\n");
  });
}

export function makeIndexBuckets(fileCount = 2_000, tasksPerFile = 5): Array<[string, Task[]]> {
  const tasks = makeTasks(fileCount * tasksPerFile);
  return Array.from({ length: fileCount }, (_, fileIndex) => {
    const path = `Vault/Nota-${fileIndex}.md`;
    const start = fileIndex * tasksPerFile;
    const bucket = tasks.slice(start, start + tasksPerFile).map((task, line) => ({
      ...task,
      file: path,
      line,
      source: `${task.source} ^bench-${fileIndex}-${line}`,
    }));
    return [path, bucket];
  });
}
