const FRONTMATTER_RE = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;

export function insertTaskAtTop(content: string, line: string, heading = "## Task"): string {
  const eol = content.includes("\r\n") ? "\r\n" : "\n";
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const existingHeading = content.match(new RegExp(`^${escapedHeading}[ \\t]*(?:\\r?\\n|$)`, "m"));
  if (existingHeading?.index !== undefined) {
    const insertAt = existingHeading.index + existingHeading[0].length;
    const separator = existingHeading[0].endsWith("\n") ? "" : eol;
    return `${content.slice(0, insertAt)}${separator}${line}${eol}${content.slice(insertAt)}`;
  }

  const fmMatch = content.match(FRONTMATTER_RE);
  const bodyStart = fmMatch?.[0].length ?? 0;
  const body = content.slice(bodyStart);
  const h1 = body.match(/^#(?!#)[ \t]+.*(?:\r?\n|$)/m);
  const insertAt = h1?.index !== undefined ? bodyStart + h1.index + h1[0].length : bodyStart;
  const before = content.slice(0, insertAt);
  const after = content.slice(insertAt).replace(/^(?:\r?\n)+/, "");

  let beforeSep = "";
  if (h1) {
    beforeSep = before.endsWith(`${eol}${eol}`) ? "" : eol;
  } else if (bodyStart === 0 && before.length > 0) {
    beforeSep = before.endsWith(eol) ? "" : eol;
  }

  const afterSep = after.length > 0 ? eol : "";
  return `${before}${beforeSep}${heading}${eol}${line}${eol}${afterSep}${after}`;
}

export function createInboxContent(line: string): string {
  return `# Inbox\n\n## Task\n${line}\n`;
}

export const DAILY_TASKS_BLOCK = "```kairos-tasks\n```";

function insertStandaloneDailyBlock(content: string): string {
  const eol = content.includes("\r\n") ? "\r\n" : "\n";
  const block = DAILY_TASKS_BLOCK.split("\n").join(eol);
  const fmMatch = content.match(FRONTMATTER_RE);
  const bodyStart = fmMatch?.[0].length ?? 0;
  const body = content.slice(bodyStart);
  const h1 = body.match(/^#(?!#)[ \t]+.*(?:\r?\n|$)/m);
  const insertAt = h1?.index !== undefined ? bodyStart + h1.index + h1[0].length : bodyStart;
  const before = content.slice(0, insertAt);
  const after = content.slice(insertAt).replace(/^(?:\r?\n)+/, "");
  const beforeSep = before.length > 0 && !before.endsWith(`${eol}${eol}`) ? eol : "";
  const afterSep = after.length > 0 ? `${eol}${eol}` : eol;
  return `${before}${beforeSep}${block}${afterSep}${after}`;
}

/** Inserisce una sola proiezione Kairos autonoma e migra il vecchio titolo adiacente. */
export function ensureDailyTasksBlock(content: string): string {
  const block = content.match(/^```kairos-tasks[ \t]*(?:\r?\n|$)/m);
  if (block?.index === undefined) {
    const heading = content.match(/^## Task[ \t]*(?:\r?\n|$)/m);
    if (heading?.index === undefined) return insertStandaloneDailyBlock(content);

    const eol = content.includes("\r\n") ? "\r\n" : "\n";
    const standaloneBlock = DAILY_TASKS_BLOCK.split("\n").join(eol);
    const after = content.slice(heading.index + heading[0].length).replace(/^(?:\r?\n)+/, "");
    const afterSep = after.length > 0 ? `${eol}${eol}` : eol;
    return `${content.slice(0, heading.index)}${standaloneBlock}${afterSep}${after}`;
  }

  const before = content.slice(0, block.index);
  const migrated = before.replace(/(^|\r?\n)## Task[ \t]*\r?\n$/, "$1");
  return migrated === before ? content : `${migrated}${content.slice(block.index)}`;
}
