import { Task } from "../types";
import {
  firstDate,
  parseTaskSyntax,
  PRIORITY_OF_EMOJI,
} from "./taskSyntax";
import { Priority } from "../types";

const PRIORITY_EMOJI: [string, Priority][] = [
  ["🔺", "highest"],
  ["⏫", "high"],
  ["🔼", "medium"],
  ["🔽", "low"],
  ["⏬", "lowest"],
];

export function parseLine(raw: string, file: string, line: number): Task | null {
  const syntax = parseTaskSyntax(raw);
  if (!syntax || syntax.status === "unknown") return null;

  const priorityToken = syntax.tokens.find((token) => token.kind === "priority");
  const priority = priorityToken?.kind === "priority"
    ? PRIORITY_OF_EMOJI[priorityToken.emoji] ?? null
    : null;
  const tags = syntax.tokens.flatMap((token) => token.kind === "tag" ? [token.value] : []);
  const rawDetailPath = syntax.tokens.find((token) => token.kind === "detail")?.target;
  const detailPath = rawDetailPath
    ? rawDetailPath.toLowerCase().endsWith(".md") ? rawDetailPath : `${rawDetailPath}.md`
    : undefined;
  const blockId = syntax.tokens.find((token) => token.kind === "blockid")?.value;
  const text = syntax.tokens
    .filter((token) => token.kind === "text")
    .map((token) => token.raw)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    text,
    status: syntax.status,
    due: firstDate(syntax.tokens, "📅"),
    scheduled: firstDate(syntax.tokens, "⏳"),
    completed: firstDate(syntax.tokens, "✅"),
    cancelled: firstDate(syntax.tokens, "❌"),
    priority,
    tags,
    file,
    line,
    source: raw,
    ...(detailPath ? { detailPath } : {}),
    ...(blockId ? { blockId } : {}),
  };
}

export function parseFileContent(content: string, file: string): Task[] {
  const out: Task[] = [];
  const lines = content.split("\n");
  let fence: "`" | "~" | null = null;
  for (let i = 0; i < lines.length; i++) {
    const marker = /^\s*(`{3,}|~{3,})/.exec(lines[i])?.[1]?.[0] as "`" | "~" | undefined;
    if (marker) {
      if (fence === marker) fence = null;
      else if (fence === null) fence = marker;
      continue;
    }
    if (fence !== null) continue;
    const task = parseLine(lines[i], file, i);
    if (task) out.push(task);
  }
  return out;
}

export { PRIORITY_EMOJI };
