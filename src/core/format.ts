import { NewTaskInput, Priority } from "../types";

const PRIORITY_MARK: Record<Priority, string> = {
  highest: "🔺",
  high: "⏫",
  medium: "🔼",
  low: "🔽",
  lowest: "⏬",
};

export function formatTaskLine(input: NewTaskInput): string {
  let line = `- [ ] ${input.text.trim()}`;
  const priority = input.priority ?? (input.important ? "high" : null);
  if (priority) line += ` ${PRIORITY_MARK[priority]}`;
  if (input.due) line += ` 📅 ${input.due}`;
  return line;
}
