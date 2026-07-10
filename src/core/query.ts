import { Task, TaskStatus, Priority } from "../types";
import { SortKey, sortTasks, priorityRank } from "./sorting";

export type DueSegment = "today" | "upcoming" | "none" | "all";
export type GroupKey = "note" | "date" | "priority" | "tag" | "folder" | "none";

export interface TaskFilter {
  text: string;
  statuses: TaskStatus[];
  tags: string[];
  folder: string | null;
  due: DueSegment;
  exactDay: string | null;
  priorities: Priority[] | null;
}

export const DEFAULT_FILTER: TaskFilter = {
  text: "",
  statuses: ["open", "inProgress"],
  tags: [],
  folder: null,
  due: "all",
  exactDay: null,
  priorities: null,
};

export interface TaskGroup {
  key: string;
  label: string;
  sublabel?: string;
  tasks: Task[];
}

export interface QueryOptions {
  inboxPath?: string;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function matchesDue(task: Task, due: DueSegment, today: string): boolean {
  switch (due) {
    case "all": return true;
    case "none": return task.due === null;
    case "today": return task.due !== null && task.due <= today;
    case "upcoming": return task.due !== null && task.due > today;
  }
}

function matchesTag(taskTags: string[], wanted: string): boolean {
  return taskTags.some((tag) => tag === wanted || tag.startsWith(`${wanted}/`));
}

export function matchesTask(task: Task, filter: TaskFilter, today: string): boolean {
  if (filter.statuses.length > 0 && !filter.statuses.includes(task.status)) return false;
  if (filter.exactDay !== null) {
    if (task.due !== filter.exactDay) return false;
  } else if (!matchesDue(task, filter.due, today)) {
    return false;
  }
  if (filter.tags.length > 0 && !filter.tags.some((t) => matchesTag(task.tags, t))) return false;
  if (filter.folder !== null && filter.folder !== "") {
    const prefix = filter.folder.endsWith("/") ? filter.folder : `${filter.folder}/`;
    if (task.file !== filter.folder && !task.file.startsWith(prefix)) return false;
  }
  if (filter.priorities !== null && (task.priority === null || !filter.priorities.includes(task.priority))) {
    return false;
  }
  const q = filter.text.trim().toLowerCase();
  if (q === "") return true;
  const haystack = `${task.text} ${task.file} ${task.tags.join(" ")}`.toLowerCase();
  return q.split(/\s+/).filter(Boolean).every((term) => haystack.includes(term));
}

/** Etichette italiane per la priorità, riusate anche in view/AttivitaView.ts. */
export const PRIORITY_LABELS: Record<Priority, string> = {
  highest: "Massima",
  high: "Alta",
  medium: "Media",
  low: "Bassa",
  lowest: "Minima",
};

interface GroupSpec { key: string; label: string; sublabel?: string; }

function noteName(path: string): string {
  const slash = path.lastIndexOf("/");
  return path.slice(slash + 1).replace(/\.md$/i, "");
}

function parentFolder(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash === -1 ? "" : path.slice(0, slash);
}

function isInboxPath(path: string, inboxPath: string): boolean {
  const prefix = inboxPath.replace(/\/+$/, "");
  return prefix !== "" && (path === prefix || path.startsWith(`${prefix}/`));
}

function groupSpec(task: Task, group: GroupKey, today: string, opts: QueryOptions): GroupSpec {
  switch (group) {
    case "none":
      return { key: "all", label: "" };
    case "note":
      return isInboxPath(task.file, opts.inboxPath ?? "")
        ? { key: "0-inbox", label: "Inbox" }
        : { key: `1-${task.file}`, label: noteName(task.file) };
    case "date": {
      if (task.due === null) return { key: "zz-none", label: "Senza data" };
      if (task.due < today) return { key: "a-overdue", label: "In ritardo" };
      if (task.due === today) return { key: "b-today", label: "Oggi" };
      if (task.due <= addDays(today, 7)) return { key: "c-week", label: "Prossimi 7 giorni" };
      return { key: "d-later", label: "Dopo" };
    }
    case "priority":
      return task.priority === null
        ? { key: "5-none", label: "Senza priorità" }
        : { key: `${priorityRank(task.priority)}-${task.priority}`, label: PRIORITY_LABELS[task.priority] };
    case "tag": {
      const tag = task.tags[0];
      return tag === undefined ? { key: "zz-none", label: "Senza tag" } : { key: `t-${tag}`, label: `#${tag}` };
    }
    case "folder": {
      const dir = parentFolder(task.file);
      return dir === "" ? { key: "", label: "Radice vault" } : { key: dir, label: dir };
    }
  }
}

export function groupTasks(
  tasks: Task[],
  filter: TaskFilter,
  sort: SortKey,
  group: GroupKey,
  today: string,
  opts: QueryOptions = {},
): TaskGroup[] {
  const matched = sortTasks(tasks.filter((t) => matchesTask(t, filter, today)), sort);
  const groups = new Map<string, TaskGroup>();
  for (const task of matched) {
    const spec = groupSpec(task, group, today, opts);
    let bucket = groups.get(spec.key);
    if (!bucket) {
      bucket = { key: spec.key, label: spec.label, sublabel: spec.sublabel, tasks: [] };
      groups.set(spec.key, bucket);
    }
    bucket.tasks.push(task);
  }
  return [...groups.values()].sort((a, b) => a.key.localeCompare(b.key));
}
