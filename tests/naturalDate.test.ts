import { describe, expect, it } from "vitest";
import { parseNaturalDate } from "../src/core/naturalDate";

describe("parseNaturalDate", () => {
  const today = "2026-08-05";
  it.each([
    ["Scrivi domani", "2026-08-06", "Scrivi"],
    ["Scrivi tra 2 settimane", "2026-08-19", "Scrivi"],
    ["Scrivi monday", "2026-08-10", "Scrivi"],
    ["Scrivi 15/08", "2026-08-15", "Scrivi"],
  ])("riconosce %s", (text, date, cleaned) => {
    expect(parseNaturalDate(text, today)).toEqual({ date, cleaned });
  });
  it("non interpreta date nel mezzo", () => {
    expect(parseNaturalDate("Domani decidiamo il task", today)).toEqual({ date: null, cleaned: "Domani decidiamo il task" });
  });
});
