function cleanPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}

function markdownPath(path: string): string {
  const cleaned = cleanPath(path);
  if (cleaned === "" || cleaned.toLowerCase().endsWith(".md")) return cleaned;
  return `${cleaned}.md`;
}

/** La cattura globale ha sempre una casa stabile: la data non sposta il task. */
export function resolveInboxTarget(inboxPath: string): string {
  return markdownPath(inboxPath);
}
