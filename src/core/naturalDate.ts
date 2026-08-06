import { addDays, isValidDay } from "./dates";

export interface NaturalDateResult { date: string | null; cleaned: string; }

function isoWeekday(key: string): number {
  const [year, month, day] = key.split("-").map(Number);
  const jsDay = new Date(year, month - 1, day).getDay();
  return jsDay === 0 ? 7 : jsDay;
}

function nextWeekday(today: string, target: number): string {
  return addDays(today, (target - isoWeekday(today) + 7) % 7);
}

const WEEKDAYS: [RegExp, number][] = [
  [/luned[iì]|monday|\blun\b|\bmon\b/, 1], [/marted[iì]|tuesday|\bmar\b|\btue\b/, 2],
  [/mercoled[iì]|wednesday|\bmer\b|\bwed\b/, 3], [/gioved[iì]|thursday|\bgio\b|\bthu\b/, 4],
  [/venerd[iì]|friday|\bven\b|\bfri\b/, 5], [/sabato|saturday|\bsab\b|\bsat\b/, 6],
  [/domenica|sunday|\bdom\b|\bsun\b/, 7],
];

const PATTERNS: [RegExp, (today: string, match: RegExpExecArray) => string | null][] = [
  [/(\d{4}-\d{2}-\d{2})$/, (_today, match) => isValidDay(match[1] ?? "") ? match[1] : null],
  [/(?:^|\s)(\d{1,2})\/(\d{1,2})$/, (today, match) => {
    const year = Number(today.slice(0, 4));
    const suffix = `${String(Number(match[2])).padStart(2, "0")}-${String(Number(match[1])).padStart(2, "0")}`;
    const candidate = `${year}-${suffix}`;
    if (!isValidDay(candidate)) return null;
    const result = candidate < today ? `${year + 1}-${suffix}` : candidate;
    return isValidDay(result) ? result : null;
  }],
  [/\b(?:oggi|today)$/, (today) => today],
  [/\b(?:dopodomani|day after tomorrow)$/, (today) => addDays(today, 2)],
  [/\b(?:domani|tomorrow)$/, (today) => addDays(today, 1)],
  [/\b(?:tra|fra|in)\s+(\d+)\s+(giorn[oi]|days?|settiman[ae]|weeks?)$/, (today, match) =>
    addDays(today, Number(match[1]) * (/sett|week/.test(match[2] ?? "") ? 7 : 1))],
  [/\b(?:prossima settimana|settimana prossima|next week)$/, (today) => addDays(today, 7)],
  [/\b(?:questo\s+)?(?:weekend|fine settimana)$/, (today) => nextWeekday(today, 6)],
];

export function parseNaturalDate(text: string, today: string): NaturalDateResult {
  const trimmed = text.replace(/\s+$/, "");
  const lower = trimmed.toLowerCase();
  for (const [pattern, resolve] of PATTERNS) {
    const match = pattern.exec(lower);
    if (!match) continue;
    const date = resolve(today, match);
    if (date) return { date, cleaned: trimmed.slice(0, match.index).trimEnd() };
  }
  for (const [pattern, target] of WEEKDAYS) {
    const match = new RegExp(`(?:^|\\s)(${pattern.source})$`, "u").exec(lower);
    if (match) return { date: nextWeekday(today, target), cleaned: trimmed.slice(0, match.index).trimEnd() };
  }
  return { date: null, cleaned: trimmed };
}
