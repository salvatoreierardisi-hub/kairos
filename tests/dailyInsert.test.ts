import { describe, it, expect } from "vitest";
import { createInboxContent, ensureDailyTasksBlock, insertTaskAtTop } from "../src/core/dailyInsert";

describe("insertTaskAtTop", () => {
  it("crea l'intestazione in un file vuoto", () => {
    expect(insertTaskAtTop("", "- [ ] Nuovo"))
      .toBe("## Task\n- [ ] Nuovo\n");
  });

  it("crea l'intestazione sopra un corpo esistente senza frontmatter", () => {
    const content = "Nota del giorno\n\nAltro testo";
    expect(insertTaskAtTop(content, "- [ ] Nuovo"))
      .toBe("## Task\n- [ ] Nuovo\n\nNota del giorno\n\nAltro testo");
  });

  it("crea l'intestazione dopo il frontmatter, se presente", () => {
    const content = "---\ntitle: x\n---\nNota\n";
    expect(insertTaskAtTop(content, "- [ ] Nuovo"))
      .toBe("---\ntitle: x\n---\n## Task\n- [ ] Nuovo\n\nNota\n");
  });

  it("inserisce sotto un'intestazione Task già esistente (dopo frontmatter), sopra i task precedenti", () => {
    const content = "---\ntitle: x\n---\n## Task\n- [ ] Vecchio\n";
    expect(insertTaskAtTop(content, "- [ ] Nuovo"))
      .toBe("---\ntitle: x\n---\n## Task\n- [ ] Nuovo\n- [ ] Vecchio\n");
  });

  it("inserisce sotto un'intestazione Task esistente senza frontmatter", () => {
    const content = "## Task\n- [ ] Vecchio\n";
    expect(insertTaskAtTop(content, "- [ ] Nuovo"))
      .toBe("## Task\n- [ ] Nuovo\n- [ ] Vecchio\n");
  });

  it("gestisce un'intestazione Task alla fine del file", () => {
    expect(insertTaskAtTop("## Task", "- [ ] Nuovo"))
      .toBe("## Task\n- [ ] Nuovo\n");
  });

  it("crea la sezione Task subito dopo il primo H1", () => {
    const content = "---\ndate: 2026-07-10\n---\n\n# Giorno\n\n## Pensieri\nTesto\n";
    expect(insertTaskAtTop(content, "- [ ] Nuovo"))
      .toBe("---\ndate: 2026-07-10\n---\n\n# Giorno\n\n## Task\n- [ ] Nuovo\n\n## Pensieri\nTesto\n");
  });

  it("preserva i terminatori CRLF", () => {
    expect(insertTaskAtTop("# Giorno\r\n\r\nTesto\r\n", "- [ ] Nuovo"))
      .toBe("# Giorno\r\n\r\n## Task\r\n- [ ] Nuovo\r\n\r\nTesto\r\n");
  });
});

describe("createInboxContent", () => {
  it("crea Inbox strutturata con il primo task", () => {
    expect(createInboxContent("- [ ] Primo")).toBe("# Inbox\n\n## Task\n- [ ] Primo\n");
  });
});

describe("ensureDailyTasksBlock", () => {
  it("aggiunge la proiezione dopo il titolo della daily", () => {
    expect(ensureDailyTasksBlock("# 27 luglio\n\nNote\n"))
      .toBe("# 27 luglio\n\n## Task\n```kairos-tasks\n```\n\nNote\n");
  });

  it("non duplica un blocco esistente", () => {
    const content = "# Giorno\n\n## Task\n```kairos-tasks\n```\n";
    expect(ensureDailyTasksBlock(content)).toBe(content);
  });
});
