import { Task, TaskStatus, Priority } from "../types";
import { SortKey, sortTasks, priorityRank } from "./sorting";
import { addDays, effectiveDate } from "./dates";

export type DueSegment = "today" | "upcoming" | "none" | "all";
export type GroupKey = "note" | "date" | "agenda" | "priority" | "tag" | "folder" | "none";

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
  agendaHorizonDays?: number;
}

function searchable(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function matchesDue(task: Task, due: DueSegment, today: string): boolean {
  const date = effectiveDate(task);
  switch (due) {
    case "all": return true;
    case "none": return date === null;
    case "today": return date !== null && date <= today;
    case "upcoming": return date !== null && date > today;
  }
}

function matchesTag(taskTags: string[], wanted: string): boolean {
  return taskTags.some((tag) => tag === wanted || tag.startsWith(`${wanted}/`));
}

export function matchesTask(task: Task, filter: TaskFilter, today: string): boolean {
  if (filter.statuses.length > 0 && !filter.statuses.includes(task.status)) return false;
  if (filter.exactDay !== null) {
    if (effectiveDate(task) !== filter.exactDay) return false;
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
  const q = searchable(filter.text.trim());
  if (q === "") return true;
  const haystack = searchable(`${task.text} ${task.detailPath ?? ""} ${task.file} ${task.tags.join(" ")}`);
  return q.split(/\s+/).filter(Boolean).every((term) => haystack.includes(term));
}

export function tasksForDay(tasks: readonly Task[], day: string): Task[] {
  return tasks.filter((task) =>
    effectiveDate(task) === day && (task.status === "open" || task.status === "inProgress"),
  );
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
  const clean = (value: string) => value.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  const configured = clean(inboxPath);
  const normalizedInbox = configured === "" || configured.toLowerCase().endsWith(".md")
    ? configured
    : `${configured}.md`;
  return normalizedInbox !== "" && clean(path) === normalizedInbox;
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
      const date = effectiveDate(task);
      if (date === null) return { key: "zz-none", label: "Senza data" };
      if (date < today) return { key: "a-overdue", label: "In ritardo" };
      if (date === today) return { key: "b-today", label: "Oggi" };
      if (date <= addDays(today, 7)) return { key: "c-week", label: "Prossimi 7 giorni" };
      return { key: "d-later", label: "Dopo" };
    }
    case "agenda": {
      const date = effectiveDate(task);
      if (date === null) return { key: "zz-none", label: "Senza data" };
      if (date < today) return { key: "00-overdue", label: "In ritardo" };
      const horizon = Math.max(1, Math.min(365, opts.agendaHorizonDays ?? 14));
      if (date > addDays(today, horizon)) return { key: "zy-later", label: "Dopo" };
      const [year, month, day] = date.split("-").map(Number);
      const weekday = new Intl.DateTimeFormat("it-IT", { weekday: "long" })
        .format(new Date(year, month - 1, day));
      const label = date === today ? "Oggi" : weekday.charAt(0).toUpperCase() + weekday.slice(1);
      return { key: `10-${date}`, label, sublabel: date };
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
