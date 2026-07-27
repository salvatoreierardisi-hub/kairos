import { Task } from "../types";

function exactIdentity(a: Task, b: Task): boolean {
  return a.file === b.file && a.line === b.line && a.source === b.source;
}

/**
 * Riconcilia snapshot selezionati con l'indice corrente senza mai trasferire una
 * selezione a una riga diversa. Una sorgente duplicata dopo uno spostamento di riga
 * è ambigua e viene quindi scartata.
 */
export function reconcileTaskSelection(selected: readonly Task[], current: readonly Task[]): Task[] {
  const claimed = new Set<Task>();
  const reconciled: Task[] = [];

  for (const snapshot of selected) {
    const exact = current.find((task) => !claimed.has(task) && exactIdentity(task, snapshot));
    if (exact) {
      claimed.add(exact);
      reconciled.push(exact);
      continue;
    }

    const sameSource = current.filter(
      (task) => !claimed.has(task) && task.file === snapshot.file && task.source === snapshot.source,
    );
    if (sameSource.length === 1) {
      claimed.add(sameSource[0]);
      reconciled.push(sameSource[0]);
    }
  }

  return reconciled;
}
