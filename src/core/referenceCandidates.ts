import { TaskReferenceKind } from "./taskReferences";

export interface ReferenceCandidate {
  kind: TaskReferenceKind;
  label: string;
  target: string;
  path: string;
  indexed: boolean;
}

export interface ReferenceSourceFile {
  path: string;
  basename: string;
  parentPath: string | null;
}

export interface ReferenceSourceFolder {
  path: string;
  name: string;
}

export class ReferenceCandidateCache {
  private value: ReferenceCandidate[] | null = null;

  get(build: () => ReferenceCandidate[]): readonly ReferenceCandidate[] {
    this.value ??= build();
    return this.value;
  }

  invalidate(): void {
    this.value = null;
  }
}

function parentName(path: string): string {
  const parts = path.split("/");
  return parts.length > 1 ? parts[parts.length - 2] ?? "" : "Radice";
}

/** Costruisce il catalogo in un passaggio su file e cartelle. */
export function buildReferenceCandidates(
  files: readonly ReferenceSourceFile[],
  folders: readonly ReferenceSourceFolder[],
): ReferenceCandidate[] {
  const directIndices = new Map<string, ReferenceSourceFile[]>();
  const out: ReferenceCandidate[] = [];

  for (const file of files) {
    if (file.basename.startsWith("_indice-")) {
      if (file.parentPath !== null) {
        const siblings = directIndices.get(file.parentPath);
        if (siblings) siblings.push(file);
        else directIndices.set(file.parentPath, [file]);
      }
      continue;
    }
    out.push({
      kind: "file",
      label: file.basename,
      target: file.path,
      path: file.path,
      indexed: false,
    });
  }

  for (const folder of folders) {
    const indices = directIndices.get(folder.path) ?? [];
    out.push(indices.length === 1
      ? {
          kind: "file",
          label: folder.name,
          target: indices[0]!.path,
          path: folder.path,
          indexed: true,
        }
      : {
          kind: "folder",
          label: folder.name,
          target: folder.path,
          path: folder.path,
          indexed: false,
        });
  }

  const counts = new Map<string, number>();
  for (const item of out) counts.set(item.label, (counts.get(item.label) ?? 0) + 1);
  return out.map((item) => counts.get(item.label)! > 1
    ? { ...item, label: `${item.label} · ${parentName(item.path)}` }
    : item);
}

function normalized(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function searchReferenceCandidates(
  candidates: readonly ReferenceCandidate[],
  query: string,
  limit = 8,
): ReferenceCandidate[] {
  const needle = normalized(query);
  return candidates
    .filter((item) => normalized(`${item.label} ${item.path}`).includes(needle))
    .sort((a, b) => Number(b.indexed) - Number(a.indexed) || a.label.localeCompare(b.label))
    .slice(0, limit);
}
