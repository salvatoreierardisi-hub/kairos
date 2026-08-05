/** Testo leggibile per le view, senza modificare la sorgente Markdown. */
export function displayTaskText(text: string): string {
  return text
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, (_match, target: string) => target.split("/").pop() ?? target)
    .replace(/\[([^\]]+)\]\([^\s)]+(?:\s+"[^"]*")?\)/g, "$1");
}
