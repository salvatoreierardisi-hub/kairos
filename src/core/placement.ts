function cleanPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}

export function isAutomaticTaskPath(file: string, inboxPath: string, dailyFolder: string): boolean {
  const normalizedFile = cleanPath(file);
  const normalizedInbox = cleanPath(inboxPath);
  if (normalizedFile === normalizedInbox) return true;

  const folder = cleanPath(dailyFolder);
  if (folder.length === 0) return !normalizedFile.includes("/");
  return normalizedFile.startsWith(`${folder}/`);
}

export function resolveAutomaticTarget(
  due: string | null,
  inboxPath: string,
  formattedDailyPath: string | null,
): string {
  if (due === null) return cleanPath(inboxPath);
  if (!formattedDailyPath) throw new Error("Percorso daily non disponibile");
  return cleanPath(formattedDailyPath);
}
