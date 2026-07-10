import { TaskStatus } from "../types";

const CHECKBOX_RE = /^(\s*[-*]\s+)\[( |x|X|\/|-)\](.*)$/;
const DONE_MARK_RE = /\s*✅\s*\d{4}-\d{2}-\d{2}\s*$/;

const STATUS_MARK: Record<TaskStatus, string> = {
  open: " ",
  inProgress: "/",
  done: "x",
  cancelled: "-",
};

export function toggleLine(line: string, currentStatus: TaskStatus, today: string): string {
  const m = line.match(CHECKBOX_RE);
  if (!m) return line;

  const prefix = m[1];
  const rest = m[3];
  const cleanRest = rest.replace(DONE_MARK_RE, "").replace(/\s+$/, "");

  if (currentStatus === "open") {
    return `${prefix}[x]${cleanRest} ✅ ${today}`;
  }
  return `${prefix}[ ]${cleanRest}`;
}

export function setStatusLine(line: string, status: TaskStatus, today: string): string {
  const m = line.match(CHECKBOX_RE);
  if (!m) return line;

  const prefix = m[1];
  const rest = m[3];
  const cleanRest = rest.replace(DONE_MARK_RE, "").replace(/\s+$/, "");

  if (status === "done") {
    return `${prefix}[x]${cleanRest} ✅ ${today}`;
  }
  return `${prefix}[${STATUS_MARK[status]}]${cleanRest}`;
}
