import { Priority } from "../types";

const CHECKBOX_RE = /^(\s*[-*]\s+\[(?: |x|X|\/|-)\]\s+)(.*)$/;
const DUE_RE = /\s*📅\s*\d{4}-\d{2}-\d{2}/g;
const DONE_MARK_RE = /\s*✅\s*\d{4}-\d{2}-\d{2}\s*$/;
const TAG_RE = /#([A-Za-z0-9_/\-]+)/g;
const PRIORITY_RE = /\s*(?:🔺|⏫|🔼|🔽|⏬)/g;
const PRIORITY_OF: Record<Priority, string> = {
  highest: "🔺", high: "⏫", medium: "🔼", low: "🔽", lowest: "⏬",
};

function splitDoneMarker(body: string): { body: string; done: string } {
  const match = body.match(DONE_MARK_RE);
  if (!match) return { body, done: "" };
  return {
    body: body.slice(0, match.index).replace(/\s+$/, ""),
    done: match[0].trimStart(),
  };
}

function normalizeBody(body: string): string {
  return body.replace(/\s+/g, " ").trim();
}

export function setDueLine(line: string, due: string | null): string {
  const match = line.match(CHECKBOX_RE);
  if (!match) return line;

  const { body, done } = splitDoneMarker(match[2]);
  const cleanBody = normalizeBody(body.replace(DUE_RE, ""));
  const dueText = due ? ` 📅 ${due}` : "";
  const doneText = done ? ` ${done}` : "";
  return `${match[1]}${cleanBody}${dueText}${doneText}`;
}

export function addTagLine(line: string, tag: string): string {
  const match = line.match(CHECKBOX_RE);
  if (!match) return line;

  const normalizedTag = tag.trim().replace(/^#/, "");
  if (normalizedTag.length === 0) return line;

  const { body, done } = splitDoneMarker(match[2]);
  const tags = [...body.matchAll(TAG_RE)].map((t) => t[1]);
  if (tags.includes(normalizedTag)) return line;

  const cleanBody = normalizeBody(body);
  const doneText = done ? ` ${done}` : "";
  return `${match[1]}${cleanBody} #${normalizedTag}${doneText}`;
}

export function setPriorityLine(line: string, priority: Priority | null): string {
  const match = line.match(CHECKBOX_RE);
  if (!match) return line;
  const { body, done } = splitDoneMarker(match[2]);
  const cleanBody = normalizeBody(body.replace(PRIORITY_RE, ""));
  // priorità prima della 📅 (convenzione Tasks: priorità → date)
  const dueMatch = cleanBody.match(/\s*📅\s*\d{4}-\d{2}-\d{2}/);
  const emoji = priority ? ` ${PRIORITY_OF[priority]}` : "";
  const doneText = done ? ` ${done}` : "";
  if (priority && dueMatch) {
    const idx = cleanBody.indexOf(dueMatch[0]);
    const head = cleanBody.slice(0, idx).replace(/\s+$/, "");
    const tail = cleanBody.slice(idx).replace(/^\s+/, "");
    return `${match[1]}${head}${emoji} ${tail}${doneText}`;
  }
  return `${match[1]}${cleanBody}${emoji}${doneText}`;
}
