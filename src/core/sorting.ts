import { Task, Priority } from "../types";
import { effectiveDate } from "./dates";

export type SortKey = "due" | "priority" | "note";

const PRIORITY_RANK: Record<Priority, number> = {
  highest: 0, high: 1, medium: 2, low: 3, lowest: 4,
};

export function priorityRank(priority: Priority | null): number {
  return priority === null ? 5 : PRIORITY_RANK[priority];
}

function cmpDue(a: Task, b: Task): number {
  const dateA = effectiveDate(a);
  const dateB = effectiveDate(b);
  if (dateA === dateB) return 0;
  if (dateA === null) return 1;
  if (dateB === null) return -1;
  return dateA.localeCompare(dateB);
}

function cmpNote(a: Task, b: Task): number {
  return a.file.localeCompare(b.file) || a.line - b.line;
}

function cmpPriority(a: Task, b: Task): number {
  return priorityRank(a.priority) - priorityRank(b.priority);
}

export function sortTasks(tasks: Task[], key: SortKey): Task[] {
  const copy = [...tasks];
  switch (key) {
    case "due":
      copy.sort((a, b) => cmpDue(a, b) || cmpPriority(a, b) || cmpNote(a, b));
      break;
    case "priority":
      copy.sort((a, b) => cmpPriority(a, b) || cmpDue(a, b) || cmpNote(a, b));
      break;
    case "note":
      copy.sort(cmpNote);
      break;
  }
  return copy;
}
