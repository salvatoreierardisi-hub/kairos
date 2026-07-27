function withoutExtension(path: string): string {
  return path.replace(/\.md$/i, "");
}

export function detailTitle(text: string): string {
  const cleaned = text
    .replace(/\[\[[^\]]+\]\]/g, "")
    .replace(/#[A-Za-z0-9_/\-]+/g, "")
    .replace(/[\\/:*?"<>|#^]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)
    .trim();
  return cleaned || "Dettaglio task";
}

export function detailFolder(inboxPath: string): string {
  const normalized = inboxPath.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  const slash = normalized.lastIndexOf("/");
  const parent = slash === -1 ? "" : normalized.slice(0, slash);
  return parent ? `${parent}/Dettagli` : "Dettagli";
}

export function detailNoteContent(title: string, sourcePath: string, blockId: string): string {
  return [
    `# ${title}`,
    "",
    `Task sorgente: [[${withoutExtension(sourcePath)}#^${blockId}|Apri il task]]`,
    "",
    "## Note",
    "",
  ].join("\n");
}
