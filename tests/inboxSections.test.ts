import { describe, expect, it } from "vitest";
import { organizeInboxContent } from "../src/core/inboxSections";

describe("organizeInboxContent", () => {
  it("ordina i task esistenti nelle quattro sezioni conservando le righe", () => {
    const input = [
      "# Inbox",
      "",
      "## Task",
      "- [x] Fatto ✅ 2026-08-01 ^kairos-done",
      "- [ ] Aperto #tag",
      "- [-] Annullato ❌ 2026-08-02",
      "- [/] Avviato 📅 2026-08-10",
      "",
    ].join("\n");

    expect(organizeInboxContent(input)).toBe([
      "# Inbox",
      "",
      "## Task aperti",
      "- [ ] Aperto #tag",
      "",
      "## Task in corso",
      "- [/] Avviato 📅 2026-08-10",
      "",
      "## Task completati",
      "- [x] Fatto ✅ 2026-08-01 ^kairos-done",
      "",
      "## Task annullati",
      "- [-] Annullato ❌ 2026-08-02",
      "",
    ].join("\n"));
  });

  it("inserisce un nuovo task aperto in cima e non duplica le sezioni", () => {
    const input = "# Inbox\n\n## Task aperti\n- [ ] Vecchio\n\n## Task completati\n- [x] Fatto ✅ 2026-08-01\n";
    const result = organizeInboxContent(input, "- [ ] Nuovo");

    expect(result).toContain("## Task aperti\n- [ ] Nuovo\n- [ ] Vecchio");
    expect(result.match(/## Task aperti/g)).toHaveLength(1);
    expect(result.match(/## Task completati/g)).toHaveLength(1);
  });

  it("conserva contenuto libero, frontmatter, task nei fence e CRLF", () => {
    const input = "---\r\ntitle: Inbox\r\n---\r\n# Inbox\r\n\r\nAppunto libero\r\n\r\n```md\r\n- [x] Esempio\r\n```\r\n\r\n- [ ] Reale\r\n";
    const result = organizeInboxContent(input);

    expect(result).toContain("---\r\ntitle: Inbox\r\n---\r\n# Inbox\r\n\r\n## Task aperti\r\n- [ ] Reale");
    expect(result).toContain("Appunto libero\r\n\r\n```md\r\n- [x] Esempio\r\n```");
    expect(result).not.toMatch(/(^|[^\r])\n/);
  });

  it("mantiene l'ordine relativo dentro ogni stato", () => {
    const input = "# Inbox\n- [x] Primo ✅ 2026-08-01\n- [ ] A\n- [x] Secondo ✅ 2026-08-02\n- [ ] B\n";
    const result = organizeInboxContent(input);

    expect(result.indexOf("- [ ] A")).toBeLessThan(result.indexOf("- [ ] B"));
    expect(result.indexOf("- [x] Primo")).toBeLessThan(result.indexOf("- [x] Secondo"));
  });

  it("è idempotente dopo il primo riordino", () => {
    const once = organizeInboxContent("# Inbox\n\n## Task\n- [ ] A\n- [x] B ✅ 2026-08-01\n");
    expect(organizeInboxContent(once)).toBe(once);
  });
});
