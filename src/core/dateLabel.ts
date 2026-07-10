function parseDate(value: string): Date | null {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function diffDays(from: Date, to: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((to.getTime() - from.getTime()) / msPerDay);
}

function sameYear(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear();
}

export function formatDueBadgeLabel(due: string, today: string): string {
  const dueDate = parseDate(due);
  const todayDate = parseDate(today);
  if (dueDate === null || todayDate === null) return due;

  const distance = diffDays(todayDate, dueDate);
  if (distance === 0) return "Oggi";
  if (distance === 1) return "Domani";
  if (distance > 1 && distance < 7) {
    return new Intl.DateTimeFormat("it-IT", { weekday: "long" }).format(dueDate);
  }

  const format: Intl.DateTimeFormatOptions = sameYear(dueDate, todayDate)
    ? { day: "numeric", month: "short" }
    : { day: "numeric", month: "short", year: "numeric" };
  return new Intl.DateTimeFormat("it-IT", format).format(dueDate);
}
