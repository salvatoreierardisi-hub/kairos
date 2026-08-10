export type TaskReferenceKind = "file" | "folder";

export interface TaskReference {
  kind: TaskReferenceKind;
  label: string;
  target: string;
  start: number;
  end: number;
}

export interface ParsedTaskReferences {
  text: string;
  references: TaskReference[];
}

const REFERENCE_RE = /\[\[([^\]|]+)\|(@[^\]]+)\]\]|\[(@[^\]]+)\]\(obsidian:\/\/kairos-folder\?path=([^)]+)\)/g;

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function parseTaskReferences(source: string): ParsedTaskReferences {
  let text = "";
  let cursor = 0;
  const references: TaskReference[] = [];
  for (const match of source.matchAll(REFERENCE_RE)) {
    const index = match.index;
    text += source.slice(cursor, index);
    const fileTarget = match[1];
    const fileLabel = match[2];
    const folderLabel = match[3];
    const folderTarget = match[4];
    const labelText = fileLabel ?? folderLabel ?? "";
    const start = text.length;
    text += labelText;
    references.push({
      kind: fileTarget ? "file" : "folder",
      label: labelText.slice(1),
      target: fileTarget ?? safeDecode(folderTarget ?? ""),
      start,
      end: text.length,
    });
    cursor = index + match[0].length;
  }
  text += source.slice(cursor);
  return { text, references };
}

function encodeReference(reference: TaskReference): string {
  const label = `@${reference.label}`;
  if (reference.kind === "file") return `[[${reference.target.replace(/\.md$/i, "")}|${label}]]`;
  return `[${label}](obsidian://kairos-folder?path=${encodeURIComponent(reference.target)})`;
}

export function serializeTaskReferences(text: string, references: readonly TaskReference[]): string {
  const sorted = [...references].sort((a, b) => a.start - b.start);
  let cursor = 0;
  let source = "";
  for (const reference of sorted) {
    if (reference.start < cursor || reference.end > text.length) throw new Error("Intervallo riferimento non valido");
    if (text.slice(reference.start, reference.end) !== `@${reference.label}`) {
      throw new Error(`Riferimento modificato: @${reference.label}`);
    }
    source += text.slice(cursor, reference.start) + encodeReference(reference);
    cursor = reference.end;
  }
  return source + text.slice(cursor);
}

export function updateTaskReferences(
  previous: string,
  next: string,
  references: readonly TaskReference[],
): TaskReference[] {
  let prefix = 0;
  while (prefix < previous.length && prefix < next.length && previous[prefix] === next[prefix]) prefix += 1;
  let suffix = 0;
  while (
    suffix < previous.length - prefix &&
    suffix < next.length - prefix &&
    previous[previous.length - 1 - suffix] === next[next.length - 1 - suffix]
  ) suffix += 1;
  const oldEnd = previous.length - suffix;
  const delta = next.length - previous.length;
  return references.flatMap((reference) => {
    if (oldEnd <= reference.start) return [{ ...reference, start: reference.start + delta, end: reference.end + delta }];
    if (prefix >= reference.end) return [reference];
    return [];
  });
}

export function addTaskReference(
  text: string,
  references: readonly TaskReference[],
  replaceStart: number,
  replaceEnd: number,
  input: Omit<TaskReference, "start" | "end">,
): ParsedTaskReferences {
  const mention = `@${input.label}`;
  const next = text.slice(0, replaceStart) + mention + text.slice(replaceEnd);
  const shifted = updateTaskReferences(text, next, references);
  return {
    text: next,
    references: [...shifted, { ...input, start: replaceStart, end: replaceStart + mention.length }]
      .sort((a, b) => a.start - b.start),
  };
}

export function referenceQuery(text: string, cursor: number): { start: number; end: number; query: string } | null {
  const before = text.slice(0, cursor);
  const match = /(?:^|\s)@([^\s@]*)$/.exec(before);
  if (!match) return null;
  const start = cursor - (match[1]?.length ?? 0) - 1;
  return { start, end: cursor, query: match[1] ?? "" };
}
