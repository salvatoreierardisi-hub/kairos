import { TaskStatus } from "../types";
import { parseLine } from "./parser";

const SECTION_ORDER: readonly TaskStatus[] = ["open", "inProgress", "done", "cancelled"];

const SECTION_TITLE: Record<TaskStatus, string> = {
  open: "## Task aperti",
  inProgress: "## Task in corso",
  done: "## Task completati",
  cancelled: "## Task annullati",
};

const MANAGED_HEADING = /^##[ \t]+Task(?:[ \t]+(?:aperti|in corso|completati|annullati))?[ \t]*$/i;

/**
 * Ricostruisce soltanto il blocco task dell'Inbox, conservando integralmente le righe
 * Markdown dei task e il contenuto non-task nel suo ordine relativo.
 */
export function organizeInboxContent(content: string, newTask?: string): string {
  const eol = content.includes("\r\n") ? "\r\n" : "\n";
  const hadFinalEol = content.endsWith("\n");
  const lines = content === "" ? [] : content.split(/\r?\n/);
  if (hadFinalEol) lines.pop();

  const tasks: Record<TaskStatus, string[]> = {
    open: [],
    inProgress: [],
    done: [],
    cancelled: [],
  };
  const remaining: string[] = [];
  let fence: "`" | "~" | null = null;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? "";
    const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1]?.[0] as "`" | "~" | undefined;
    if (marker) {
      if (fence === marker) fence = null;
      else if (fence === null) fence = marker;
      remaining.push(line);
      continue;
    }

    const task = fence === null ? parseLine(line, "Inbox.md", index) : null;
    if (task) tasks[task.status].push(line);
    else if (!MANAGED_HEADING.test(line)) remaining.push(line);
  }

  if (newTask !== undefined) {
    const parsed = parseLine(newTask, "Inbox.md", -1);
    if (!parsed) throw new Error("La nuova riga non è un task Markdown valido");
    tasks[parsed.status].unshift(newTask);
  }

  const block = SECTION_ORDER.flatMap((status, index) => [
    ...(index === 0 ? [] : [""]),
    SECTION_TITLE[status],
    ...tasks[status],
  ]);

  const insertAt = inboxBlockInsertionIndex(remaining);
  const before = trimTrailingBlanks(remaining.slice(0, insertAt));
  const after = trimLeadingBlanks(remaining.slice(insertAt));
  const output = [
    ...before,
    ...(before.length > 0 ? [""] : []),
    ...block,
    ...(after.length > 0 ? ["", ...after] : []),
  ];
  return `${output.join(eol)}${eol}`;
}

function inboxBlockInsertionIndex(lines: readonly string[]): number {
  let bodyStart = 0;
  if (lines[0]?.trim() === "---") {
    const end = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
    if (end !== -1) bodyStart = end + 1;
  }
  for (let index = bodyStart; index < lines.length; index++) {
    if (/^#(?!#)[ \t]+/.test(lines[index] ?? "")) return index + 1;
  }
  return bodyStart;
}

function trimLeadingBlanks(lines: string[]): string[] {
  while (lines[0]?.trim() === "") lines.shift();
  return lines;
}

function trimTrailingBlanks(lines: string[]): string[] {
  while (lines[lines.length - 1]?.trim() === "") lines.pop();
  return lines;
}
