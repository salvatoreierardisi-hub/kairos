import { TaskStatus } from "../types";
import { transitionStatusField } from "./taskSyntax";

export function toggleLine(line: string, currentStatus: TaskStatus, today: string): string {
  return transitionStatusField(line, currentStatus === "open" ? "done" : "open", today);
}

export function setStatusLine(line: string, status: TaskStatus, today: string): string {
  return transitionStatusField(line, status, today);
}
