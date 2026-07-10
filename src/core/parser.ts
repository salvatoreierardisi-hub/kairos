import { Task, TaskStatus, Priority } from "../types";

const TASK_RE = /^\s*[-*]\s+\[( |x|X|\/|-)\]\s+(.*)$/;
const DUE_RE = /📅\s*(\d{4}-\d{2}-\d{2})/;
const DONE_RE = /✅\s*(\d{4}-\d{2}-\d{2})/;
const PRIORITY_EMOJI: [string, Priority][] = [
  ["🔺", "highest"],
  ["⏫", "high"],
  ["🔼", "medium"],
  ["🔽", "low"],
  ["⏬", "lowest"],
];
const PRIORITY_RE = /🔺|⏫|🔼|🔽|⏬/g;
const TAG_RE = /#([A-Za-z0-9_/\-]+)/g;

export function parseLine(raw: string, file: string, line: number): Task | null {
  const m = raw.match(TASK_RE);
  if (!m) return null;

  const mark = m[1];
  const status: TaskStatus =
    mark === "x" || mark === "X"
      ? "done"
      : mark === "/"
        ? "inProgress"
        : mark === "-"
          ? "cancelled"
          : "open";
  const body = m[2];

  const dueMatch = body.match(DUE_RE);
  const due = dueMatch ? dueMatch[1] : null;
  const doneMatch = body.match(DONE_RE);
  const completed = doneMatch ? doneMatch[1] : null;
  const priorityMatch = body.match(PRIORITY_RE);
  const priority = priorityMatch
    ? (PRIORITY_EMOJI.find(([emoji]) => emoji === priorityMatch[0])?.[1] ?? null)
    : null;
  const tags = [...body.matchAll(TAG_RE)].map((t) => t[1]);

  const text = body
    .replace(DUE_RE, "")
    .replace(DONE_RE, "")
    .replace(PRIORITY_RE, "")
    .replace(TAG_RE, "")
    .replace(/\s+/g, " ")
    .trim();

  return { text, status, due, completed, priority, tags, file, line, source: raw };
}

export function parseFileContent(content: string, file: string): Task[] {
  const out: Task[] = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const task = parseLine(lines[i], file, i);
    if (task) out.push(task);
  }
  return out;
}

export { PRIORITY_EMOJI };
