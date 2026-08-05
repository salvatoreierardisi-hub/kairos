import { Task } from "../types";

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidDay(value: string): boolean {
  const match = DAY_RE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function dayKey(date: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(value: string, days: number): string {
  if (!isValidDay(value)) return value;
  const [year, month, day] = value.split("-").map(Number);
  return dayKey(new Date(year, month - 1, day + days));
}

export function addMonths(value: string, months: number): string {
  if (!isValidDay(value)) return value;
  const [year, month, day] = value.split("-").map(Number);
  const monthIndex = month - 1 + months;
  const targetYear = year + Math.floor(monthIndex / 12);
  const targetMonth = ((monthIndex % 12) + 12) % 12;
  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
  return dayKey(new Date(targetYear, targetMonth, Math.min(day, lastDay)));
}

export function daysBetween(from: string, to: string): number {
  if (!isValidDay(from) || !isValidDay(to)) return 0;
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return Math.round(
    (new Date(ty, tm - 1, td).getTime() - new Date(fy, fm - 1, fd).getTime()) / 86_400_000,
  );
}

export function effectiveDate(task: Pick<Task, "due" | "scheduled">): string | null {
  return task.due ?? task.scheduled;
}
