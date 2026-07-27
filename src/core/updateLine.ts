import { Priority } from "../types";

const CHECKBOX_RE = /^(\s*[-*]\s+\[(?: |x|X|\/|-)\]\s+)(.*)$/;
const DUE_RE = /\s*📅\s*\d{4}-\d{2}-\d{2}/g;
const DONE_MARK_RE = /\s*✅\s*\d{4}-\d{2}-\d{2}\s*$/;
const BLOCK_MARK_RE = /\s+(\^kairos-[A-Za-z0-9-]+)\s*$/;
const TAG_RE = /#([A-Za-z0-9_/\-]+)/g;
const PRIORITY_RE = /\s*(?:🔺|⏫|🔼|🔽|⏬)/g;
const DETAIL_LINK_RE = /\s*\[\[[^\]]+\|Dettagli\]\]/;
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

function splitBlockMarker(body: string): { body: string; block: string } {
  const match = body.match(BLOCK_MARK_RE);
  if (!match) return { body, block: "" };
  return {
    body: body.slice(0, match.index).replace(/\s+$/, ""),
    block: match[1],
  };
}

function normalizeBody(body: string): string {
  return body.replace(/\s+/g, " ").trim();
}

const METADATA_TOKEN =
  "(?:🔺|⏫|🔼|🔽|⏬|📅\\s*\\d{4}-\\d{2}-\\d{2}|✅\\s*\\d{4}-\\d{2}-\\d{2}|#[A-Za-z0-9_/\\-]+|\\[\\[[^\\]]+\\|Dettagli\\]\\]|\\^kairos-[A-Za-z0-9-]+)";
const TRAILING_METADATA_RE = new RegExp(`(\\s+${METADATA_TOKEN}(?:\\s+${METADATA_TOKEN})*)\\s*$`);

/** Sostituisce solo il testo leggibile e conserva stato, priorità, date e tag. */
export function setTaskTextLine(line: string, text: string): string {
  const match = line.match(CHECKBOX_RE);
  const normalizedText = normalizeBody(text);
  if (!match || normalizedText.length === 0) return line;
  const metadata = match[2].match(TRAILING_METADATA_RE)?.[1] ?? "";
  return `${match[1]}${normalizedText}${metadata}`;
}

export function setDueLine(line: string, due: string | null): string {
  const match = line.match(CHECKBOX_RE);
  if (!match) return line;

  const { body: withoutBlock, block } = splitBlockMarker(match[2]);
  const { body, done } = splitDoneMarker(withoutBlock);
  const cleanBody = normalizeBody(body.replace(DUE_RE, ""));
  const dueText = due ? ` 📅 ${due}` : "";
  const doneText = done ? ` ${done}` : "";
  const blockText = block ? ` ${block}` : "";
  const detailMatch = cleanBody.match(DETAIL_LINK_RE);
  if (due && detailMatch?.index !== undefined) {
    const head = cleanBody.slice(0, detailMatch.index).replace(/\s+$/, "");
    const detail = cleanBody.slice(detailMatch.index).replace(/^\s+/, "");
    return `${match[1]}${head}${dueText} ${detail}${doneText}${blockText}`;
  }
  return `${match[1]}${cleanBody}${dueText}${doneText}${blockText}`;
}

export function addTagLine(line: string, tag: string): string {
  const match = line.match(CHECKBOX_RE);
  if (!match) return line;

  const normalizedTag = tag.trim().replace(/^#/, "");
  if (normalizedTag.length === 0) return line;

  const { body: withoutBlock, block } = splitBlockMarker(match[2]);
  const { body, done } = splitDoneMarker(withoutBlock);
  const tags = [...body.matchAll(TAG_RE)].map((t) => t[1]);
  if (tags.includes(normalizedTag)) return line;

  const cleanBody = normalizeBody(body);
  const doneText = done ? ` ${done}` : "";
  const blockText = block ? ` ${block}` : "";
  return `${match[1]}${cleanBody} #${normalizedTag}${doneText}${blockText}`;
}

export function setPriorityLine(line: string, priority: Priority | null): string {
  const match = line.match(CHECKBOX_RE);
  if (!match) return line;
  const { body: withoutBlock, block } = splitBlockMarker(match[2]);
  const { body, done } = splitDoneMarker(withoutBlock);
  const cleanBody = normalizeBody(body.replace(PRIORITY_RE, ""));
  // priorità prima della 📅 (convenzione Tasks: priorità → date)
  const dueMatch = cleanBody.match(/\s*📅\s*\d{4}-\d{2}-\d{2}/);
  const emoji = priority ? ` ${PRIORITY_OF[priority]}` : "";
  const doneText = done ? ` ${done}` : "";
  const blockText = block ? ` ${block}` : "";
  if (priority && dueMatch) {
    const idx = cleanBody.indexOf(dueMatch[0]);
    const head = cleanBody.slice(0, idx).replace(/\s+$/, "");
    const tail = cleanBody.slice(idx).replace(/^\s+/, "");
    return `${match[1]}${head}${emoji} ${tail}${doneText}${blockText}`;
  }
  return `${match[1]}${cleanBody}${emoji}${doneText}${blockText}`;
}
