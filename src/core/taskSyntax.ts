import { Priority, TaskStatus } from "../types";

export type DateEmoji = "📅" | "⏳" | "✅" | "❌";

export type BodyToken =
  | { kind: "text"; raw: string }
  | { kind: "date"; raw: string; emoji: DateEmoji; date: string }
  | { kind: "priority"; raw: string; emoji: string }
  | { kind: "tag"; raw: string; value: string }
  | { kind: "detail"; raw: string; target: string }
  | { kind: "blockid"; raw: string; value: string }
  | { kind: "unknown"; raw: string };

export interface ParsedTaskSyntax {
  indent: string;
  listMarker: string;
  gap: string;
  statusChar: string;
  status: TaskStatus | "unknown";
  separator: string;
  tokens: BodyToken[];
}

const TASK_RE = /^(\s*)([-*+]|\d+[.)])(\s+)\[(.)\](\s)(.*)$/;
const BLOCK_ID_RE = /(\s\^[A-Za-z0-9-]+)$/;
const TOKEN_RE =
  /(\s*)(?:([📅⏳✅❌🛫➕])[ \t]*(\d{4}-\d{2}-\d{2})|(🔁[^📅⏳✅❌➕🛫🔺⏫🔼🔽⏬]*)|([🔺⏫🔼🔽⏬])|(\[\[([^\]|]+)\|Dettagli\]\])|(#[\p{L}\p{N}_/-]+))/gu;

const MANAGED_DATES = new Set<string>(["📅", "⏳", "✅", "❌"]);

export const PRIORITY_MARK: Record<Priority, string> = {
  highest: "🔺",
  high: "⏫",
  medium: "🔼",
  low: "🔽",
  lowest: "⏬",
};

export const PRIORITY_OF_EMOJI: Record<string, Priority> = {
  "🔺": "highest",
  "⏫": "high",
  "🔼": "medium",
  "🔽": "low",
  "⏬": "lowest",
};

const STATUS_OF_CHAR: Record<string, TaskStatus> = {
  " ": "open",
  x: "done",
  X: "done",
  "/": "inProgress",
  "-": "cancelled",
};

const CHAR_OF_STATUS: Record<TaskStatus, string> = {
  open: " ",
  inProgress: "/",
  done: "x",
  cancelled: "-",
};

function isValidDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function tokenizeBody(source: string): BodyToken[] {
  const tokens: BodyToken[] = [];
  let body = source;
  let blockToken: BodyToken | null = null;
  const block = BLOCK_ID_RE.exec(body);
  if (block?.[1]) {
    blockToken = { kind: "blockid", raw: block[1], value: block[1].trim().slice(1) };
    body = body.slice(0, block.index);
  }

  let cursor = 0;
  TOKEN_RE.lastIndex = 0;
  for (const match of body.matchAll(TOKEN_RE)) {
    const index = match.index;
    if (index > cursor) tokens.push({ kind: "text", raw: body.slice(cursor, index) });
    const whole = match[0];
    const leading = match[1] ?? "";
    const emoji = match[2];
    const date = match[3];
    const recurrence = match[4];
    const priority = match[5];
    const detail = match[6];
    const detailTarget = match[7];
    const tag = match[8];

    if (emoji && date) {
      if (MANAGED_DATES.has(emoji) && isValidDate(date)) {
        tokens.push({ kind: "date", raw: whole, emoji: emoji as DateEmoji, date });
      } else if (!MANAGED_DATES.has(emoji)) {
        tokens.push({ kind: "unknown", raw: whole });
      } else {
        tokens.push({ kind: "text", raw: whole });
      }
    } else if (recurrence) {
      tokens.push({ kind: "unknown", raw: `${leading}${recurrence}` });
    } else if (priority) {
      tokens.push({ kind: "priority", raw: `${leading}${priority}`, emoji: priority });
    } else if (detail && detailTarget) {
      tokens.push({ kind: "detail", raw: whole, target: detailTarget.trim() });
    } else if (tag) {
      tokens.push({ kind: "tag", raw: whole, value: tag.slice(1) });
    }
    cursor = index + whole.length;
  }
  if (cursor < body.length) tokens.push({ kind: "text", raw: body.slice(cursor) });
  if (blockToken) tokens.push(blockToken);
  return tokens;
}

export function parseTaskSyntax(raw: string): ParsedTaskSyntax | null {
  const match = TASK_RE.exec(raw);
  if (!match) return null;
  const statusChar = match[4] ?? " ";
  return {
    indent: match[1] ?? "",
    listMarker: match[2] ?? "-",
    gap: match[3] ?? " ",
    statusChar,
    status: STATUS_OF_CHAR[statusChar] ?? "unknown",
    separator: match[5] ?? " ",
    tokens: tokenizeBody(match[6] ?? ""),
  };
}

export function serializeTaskSyntax(task: ParsedTaskSyntax): string {
  const body = task.tokens.map((token) => token.raw).join("");
  return `${task.indent}${task.listMarker}${task.gap}[${task.statusChar}]${task.separator}${body}`;
}

export function firstDate(tokens: readonly BodyToken[], emoji: DateEmoji): string | null {
  for (const token of tokens) {
    if (token.kind === "date" && token.emoji === emoji) return token.date;
  }
  return null;
}

function padded(raw: string): string {
  return /^\s/.test(raw) ? raw : ` ${raw}`;
}

function insertBeforeTrailing(tokens: BodyToken[], token: BodyToken, kinds: BodyToken["kind"][]): BodyToken[] {
  const index = tokens.findIndex((candidate) => kinds.includes(candidate.kind));
  return index === -1
    ? [...tokens, token]
    : [...tokens.slice(0, index), token, ...tokens.slice(index)];
}

function replaceDate(tokens: BodyToken[], emoji: DateEmoji, date: string): BodyToken[] {
  let replaced = false;
  const next = tokens.map((token) => {
    if (token.kind !== "date" || token.emoji !== emoji || replaced) return token;
    replaced = true;
    return { ...token, date, raw: token.raw.replace(/\d{4}-\d{2}-\d{2}/, date) };
  });
  if (replaced) return next;
  const token: BodyToken = { kind: "date", raw: ` ${emoji} ${date}`, emoji, date };
  const index = next.findIndex((candidate) =>
    candidate.kind === "blockid" ||
    (emoji === "⏳" && candidate.kind === "date" && candidate.emoji === "📅") ||
    (emoji !== "✅" && emoji !== "❌" && (
      candidate.kind === "detail" ||
      (candidate.kind === "date" && (candidate.emoji === "✅" || candidate.emoji === "❌"))
    )),
  );
  return index === -1
    ? [...next, token]
    : [...next.slice(0, index), token, ...next.slice(index)];
}

export function rewriteDateField(line: string, emoji: DateEmoji, date: string | null): string {
  const task = parseTaskSyntax(line);
  if (!task || (date !== null && !isValidDate(date))) return line;
  const tokens = date === null
    ? task.tokens.filter((token) => !(token.kind === "date" && token.emoji === emoji))
    : replaceDate(task.tokens, emoji, date);
  return serializeTaskSyntax({ ...task, tokens });
}

export function rewritePriorityField(line: string, priority: Priority | null): string {
  const task = parseTaskSyntax(line);
  if (!task) return line;
  const kept = task.tokens.filter((token) => token.kind !== "priority");
  if (priority === null) return serializeTaskSyntax({ ...task, tokens: kept });
  const emoji = PRIORITY_MARK[priority];
  const token: BodyToken = { kind: "priority", raw: ` ${emoji}`, emoji };
  const tokens = insertBeforeTrailing(kept, token, ["date", "tag", "detail", "blockid"]);
  return serializeTaskSyntax({ ...task, tokens });
}

export function rewriteDescriptionField(line: string, text: string): string {
  const task = parseTaskSyntax(line);
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!task || normalized === "") return line;
  const fields = task.tokens
    .filter((token) => token.kind !== "text")
    .map((token, index, all) => {
      let raw = padded(token.raw);
      if (index > 0 && /\s$/.test(all[index - 1]?.raw ?? "")) raw = raw.replace(/^\s+/, "");
      return { ...token, raw };
    });
  return serializeTaskSyntax({ ...task, tokens: [{ kind: "text", raw: normalized }, ...fields] });
}

export function addTagField(line: string, tag: string): string {
  const task = parseTaskSyntax(line);
  const value = tag.trim().replace(/^#/, "");
  if (!task || value === "" || task.tokens.some((token) => token.kind === "tag" && token.value === value)) {
    return line;
  }
  const token: BodyToken = { kind: "tag", raw: ` #${value}`, value };
  const tokens = insertBeforeTrailing(task.tokens, token, ["date", "detail", "blockid"]);
  return serializeTaskSyntax({ ...task, tokens });
}

/** Aggiunge l'identità Dettagli senza sostituire collegamenti o block ID esistenti. */
export function addDetailIdentityField(line: string, target: string, blockId: string): string {
  const task = parseTaskSyntax(line);
  const normalizedTarget = target.trim().replace(/\.md$/i, "");
  const normalizedBlockId = blockId.trim().replace(/^\^/, "");
  if (!task || normalizedTarget === "" || !/^[A-Za-z0-9-]+$/.test(normalizedBlockId)) return line;

  let tokens = task.tokens;
  if (!tokens.some((token) => token.kind === "detail")) {
    const detail: BodyToken = {
      kind: "detail",
      raw: ` [[${normalizedTarget}|Dettagli]]`,
      target: normalizedTarget,
    };
    tokens = insertBeforeTrailing(tokens, detail, ["blockid"]);
  }
  if (!tokens.some((token) => token.kind === "blockid")) {
    tokens = [...tokens, { kind: "blockid", raw: ` ^${normalizedBlockId}`, value: normalizedBlockId }];
  }
  return serializeTaskSyntax({ ...task, tokens });
}

export function transitionStatusField(line: string, status: TaskStatus, today: string): string {
  const task = parseTaskSyntax(line);
  if (!task || task.status === "unknown") return line;
  let tokens = task.tokens.filter(
    (token) => !(token.kind === "date" && (token.emoji === "✅" || token.emoji === "❌")),
  );
  if (status === "done") tokens = replaceDate(tokens, "✅", today);
  if (status === "cancelled") tokens = replaceDate(tokens, "❌", today);
  return serializeTaskSyntax({ ...task, statusChar: CHAR_OF_STATUS[status], status, tokens });
}

/** Rimuove soltanto l'identità dell'occorrenza, preservando ogni altro token. */
export function stripOccurrenceIdentity(line: string): string {
  const task = parseTaskSyntax(line);
  if (!task) return line;
  return serializeTaskSyntax({
    ...task,
    tokens: task.tokens.filter((token) => token.kind !== "detail" && token.kind !== "blockid"),
  }).trimEnd();
}
