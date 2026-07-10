import { describe, expect, it } from "vitest";
import { formatDueBadgeLabel } from "../src/core/dateLabel";

describe("formatDueBadgeLabel", () => {
  const today = "2026-07-08";

  it("mostra oggi e domani come etichette relative", () => {
    expect(formatDueBadgeLabel("2026-07-08", today)).toBe("Oggi");
    expect(formatDueBadgeLabel("2026-07-09", today)).toBe("Domani");
  });

  it("mostra il giorno della settimana per i prossimi giorni vicini", () => {
    expect(formatDueBadgeLabel("2026-07-10", today)).toBe("venerdì");
  });

  it("mostra giorno e mese per date meno vicine nello stesso anno", () => {
    expect(formatDueBadgeLabel("2026-07-28", today)).toBe("28 lug");
  });

  it("include l'anno quando la scadenza cade in un anno diverso", () => {
    expect(formatDueBadgeLabel("2027-01-03", today)).toBe("3 gen 2027");
  });

  it("lascia invariata una data non interpretabile", () => {
    expect(formatDueBadgeLabel("data-strana", today)).toBe("data-strana");
  });
});
