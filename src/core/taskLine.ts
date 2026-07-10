export class TaskLineConflictError extends Error {
  constructor() {
    super("Il task è stato modificato o non è identificabile con certezza. Aggiorna Kairos e riprova.");
    this.name = "TaskLineConflictError";
  }
}

export function locateTaskLine(lines: readonly string[], expectedLine: number, source: string): number {
  if (expectedLine >= 0 && expectedLine < lines.length && lines[expectedLine] === source) {
    return expectedLine;
  }

  const matches: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === source) matches.push(i);
  }
  if (matches.length === 1) return matches[0];
  throw new TaskLineConflictError();
}

export function locateTaskLines(
  lines: readonly string[],
  tasks: readonly { line: number; source: string }[],
): number[] {
  const resolved = tasks.map((task) => locateTaskLine(lines, task.line, task.source));
  if (new Set(resolved).size !== resolved.length) throw new TaskLineConflictError();
  return resolved;
}
