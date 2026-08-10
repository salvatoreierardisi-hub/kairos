import { daysBetween, isValidDay } from "./dates";
import { Task } from "../types";

const MONTHS = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
] as const;

function cleanPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}

export function archiveDate(task: Pick<Task, "status" | "completed" | "cancelled">): string | null {
  if (task.status === "done") return task.completed;
  if (task.status === "cancelled") return task.cancelled;
  return null;
}

export function isArchivableTask(
  task: Pick<Task, "file" | "status" | "completed" | "cancelled">,
  inboxPath: string,
  today: string,
  retentionDays: number,
): boolean {
  const date = archiveDate(task);
  return cleanPath(task.file) === cleanPath(inboxPath) &&
    date !== null &&
    isValidDay(date) &&
    isValidDay(today) &&
    Number.isInteger(retentionDays) &&
    retentionDays >= 1 &&
    daysBetween(date, today) >= retentionDays;
}

export function archiveFolderPath(inboxPath: string): string {
  const clean = cleanPath(inboxPath);
  const slash = clean.lastIndexOf("/");
  return slash === -1 ? "Archivio" : `${clean.slice(0, slash)}/Archivio`;
}

export function archiveFilePath(inboxPath: string, date: string): string {
  if (!isValidDay(date)) throw new Error(`Data archivio non valida: ${date}`);
  return `${archiveFolderPath(inboxPath)}/${date.slice(0, 4)}.md`;
}

export function isArchiveFile(path: string, inboxPath: string): boolean {
  const folder = archiveFolderPath(inboxPath);
  return new RegExp(`^${folder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/\\d{4}\\.md$`)
    .test(cleanPath(path));
}

export function ensureTaskBlockId(line: string, blockId: string): string {
  if (/\s\^[A-Za-z0-9-]+\s*$/.test(line)) return line;
  const normalized = blockId.trim().replace(/^\^/, "");
  if (!/^[A-Za-z0-9-]+$/.test(normalized)) throw new Error("Block ID non valido");
  return `${line.trimEnd()} ^${normalized}`;
}

export function containsBlockId(content: string, blockId: string): boolean {
  const normalized = blockId.trim().replace(/^\^/, "");
  if (!/^[A-Za-z0-9-]+$/.test(normalized)) return false;
  return content.split(/\r?\n/).some((line) => line.trimEnd().endsWith(`^${normalized}`));
}

function newlineOf(content: string): string {
  return content.includes("\r\n") ? "\r\n" : "\n";
}

export function insertArchivedTask(content: string, line: string, date: string): string {
  if (!isValidDay(date)) throw new Error(`Data archivio non valida: ${date}`);
  const id = /\^([A-Za-z0-9-]+)\s*$/.exec(line)?.[1];
  if (!id) throw new Error("Il task da archiviare non ha un block ID");

  const eol = newlineOf(content);
  if (containsBlockId(content, id)) {
    const lines = content.split(/\r?\n/);
    const index = lines.findIndex((candidate) => candidate.trimEnd().endsWith(`^${id}`));
    if (index === -1 || lines[index]?.trimEnd() === line.trimEnd()) return content;
    lines[index] = line;
    return lines.join(eol);
  }
  const year = date.slice(0, 4);
  const month = MONTHS[Number(date.slice(5, 7)) - 1];
  const title = `# Archivio task ${year}`;
  const heading = `## ${month}`;
  if (content.trim() === "") return `${title}${eol}${eol}${heading}${eol}${eol}${line}${eol}`;

  const lines = content.split(/\r?\n/);
  const headingIndex = lines.findIndex((candidate) => candidate.trimEnd() === heading);
  if (headingIndex !== -1) {
    let insertAt = headingIndex + 1;
    while (insertAt < lines.length && lines[insertAt]?.trim() === "") insertAt += 1;
    const nextHeading = lines.findIndex((candidate, index) => index > headingIndex && /^##\s/.test(candidate));
    const sectionEnd = nextHeading === -1 ? lines.length : nextHeading;
    for (let index = insertAt; index < sectionEnd; index++) {
      const candidate = lines[index] ?? "";
      if (candidate.trim() === "") {
        insertAt = index;
        break;
      }
      const existingDate = /(?:✅|❌)\s+(\d{4}-\d{2}-\d{2})/.exec(candidate)?.[1];
      if (existingDate && existingDate < date) {
        insertAt = index;
        break;
      }
      insertAt = index + 1;
    }
    lines.splice(insertAt, 0, line);
    return lines.join(eol);
  }

  const titleIndex = lines.findIndex((candidate) => candidate.trimEnd() === title);
  const insertAt = titleIndex === -1 ? 0 : titleIndex + 1;
  const section = titleIndex === -1
    ? [title, "", heading, "", line, ""]
    : ["", heading, "", line];
  lines.splice(insertAt, 0, ...section);
  return lines.join(eol);
}
