import { TaskStatus } from "../types";

const CHECKBOX_RE = /^(\s*[-*]\s+)\[( |x|X|\/|-)\](.*)$/;
const DONE_MARK_RE = /\s*✅\s*\d{4}-\d{2}-\d{2}\s*$/;
const BLOCK_MARK_RE = /\s+(\^kairos-[A-Za-z0-9-]+)\s*$/;

const STATUS_MARK: Record<TaskStatus, string> = {
  open: " ",
  inProgress: "/",
  done: "x",
  cancelled: "-",
};

function restBlock(rest: string): { rest: string; id: string } {
  const match = rest.match(BLOCK_MARK_RE);
  if (!match) return { rest, id: "" };
  return {
    rest: rest.slice(0, match.index).replace(/\s+$/, ""),
    id: match[1],
  };
}

export function toggleLine(line: string, currentStatus: TaskStatus, today: string): string {
  const m = line.match(CHECKBOX_RE);
  if (!m) return line;

  const prefix = m[1];
  const block = restBlock(m[3]);
  const cleanRest = block.rest.replace(DONE_MARK_RE, "").replace(/\s+$/, "");
  const blockText = block.id ? ` ${block.id}` : "";

  if (currentStatus === "open") {
    return `${prefix}[x]${cleanRest} ✅ ${today}${blockText}`;
  }
  return `${prefix}[ ]${cleanRest}${blockText}`;
}

export function setStatusLine(line: string, status: TaskStatus, today: string): string {
  const m = line.match(CHECKBOX_RE);
  if (!m) return line;

  const prefix = m[1];
  const block = restBlock(m[3]);
  const cleanRest = block.rest.replace(DONE_MARK_RE, "").replace(/\s+$/, "");
  const blockText = block.id ? ` ${block.id}` : "";

  if (status === "done") {
    return `${prefix}[x]${cleanRest} ✅ ${today}${blockText}`;
  }
  return `${prefix}[${STATUS_MARK[status]}]${cleanRest}${blockText}`;
}
