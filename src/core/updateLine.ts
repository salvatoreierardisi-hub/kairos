import { Priority } from "../types";
import {
  addTagField,
  rewriteDateField,
  rewriteDescriptionField,
  rewritePriorityField,
} from "./taskSyntax";

/** Sostituisce solo il testo leggibile e conserva tutti i campi Markdown. */
export function setTaskTextLine(line: string, text: string): string {
  return rewriteDescriptionField(line, text);
}

export function setDueLine(line: string, due: string | null): string {
  return rewriteDateField(line, "📅", due);
}

export function setScheduledLine(line: string, scheduled: string | null): string {
  return rewriteDateField(line, "⏳", scheduled);
}

export function addTagLine(line: string, tag: string): string {
  return addTagField(line, tag);
}

export function setPriorityLine(line: string, priority: Priority | null): string {
  return rewritePriorityField(line, priority);
}
