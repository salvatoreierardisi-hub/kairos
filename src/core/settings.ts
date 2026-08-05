export function normalizeExcludedFolders(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const normalized = value.flatMap((candidate) => {
    if (typeof candidate !== "string") return [];
    const path = candidate.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
    if (!path || path === ".obsidian" || path.split("/").some((part) => part === "." || part === "..")) return [];
    return [path];
  });
  return [...new Set(normalized)];
}
