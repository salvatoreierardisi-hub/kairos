import { addDays, addMonths, daysBetween } from "./dates";
import { parseTaskSyntax, firstDate, rewriteDateField, stripOccurrenceIdentity, transitionStatusField } from "./taskSyntax";

export type RecurrenceUnit = "day" | "week" | "month" | "year";

export interface Recurrence {
  unit: RecurrenceUnit;
  interval: number;
  whenDone: boolean;
}

const RECURRENCE_TOKEN_RE = /🔁([^📅⏳✅❌➕🛫🔺⏫🔼🔽⏬#\[]*)/u;
const RULE_RE = /^\s*every\s+(?:(\d+)\s+)?(day|days|week|weeks|month|months|year|years)(\s+when\s+done)?\s*$/iu;

export function parseRecurrence(text: string): Recurrence | null {
  const token = RECURRENCE_TOKEN_RE.exec(text)?.[1];
  if (!token) return null;
  const match = RULE_RE.exec(token);
  if (!match) return null;
  const interval = match[1] ? Number(match[1]) : 1;
  if (!Number.isFinite(interval) || interval < 1) return null;
  const word = (match[2] ?? "").toLowerCase();
  const unit: RecurrenceUnit = word.startsWith("day")
    ? "day"
    : word.startsWith("week") ? "week" : word.startsWith("month") ? "month" : "year";
  return { unit, interval, whenDone: match[3] !== undefined };
}

function shift(date: string, recurrence: Recurrence): string {
  switch (recurrence.unit) {
    case "day": return addDays(date, recurrence.interval);
    case "week": return addDays(date, recurrence.interval * 7);
    case "month": return addMonths(date, recurrence.interval);
    case "year": return addMonths(date, recurrence.interval * 12);
  }
}

export interface RecurrenceResult {
  nextLine: string;
  completedLine: string;
}

export function completeRecurring(line: string, today: string): RecurrenceResult | null {
  const parsed = parseTaskSyntax(line);
  const recurrence = parseRecurrence(line);
  if (!parsed || !recurrence) return null;
  const due = firstDate(parsed.tokens, "📅");
  const scheduled = firstDate(parsed.tokens, "⏳");
  if (!due && !scheduled) return null;

  let nextDue: string | null = null;
  let nextScheduled: string | null = null;
  if (recurrence.whenDone) {
    if (due) {
      nextDue = shift(today, recurrence);
      if (scheduled) nextScheduled = addDays(nextDue, daysBetween(due, scheduled));
    } else if (scheduled) {
      nextScheduled = shift(today, recurrence);
    }
  } else {
    if (due) nextDue = shift(due, recurrence);
    if (scheduled) nextScheduled = shift(scheduled, recurrence);
  }

  let nextLine = transitionStatusField(line, "open", today);
  if (nextDue) nextLine = rewriteDateField(nextLine, "📅", nextDue);
  if (nextScheduled) nextLine = rewriteDateField(nextLine, "⏳", nextScheduled);
  nextLine = stripOccurrenceIdentity(nextLine);
  return { nextLine, completedLine: transitionStatusField(line, "done", today) };
}
