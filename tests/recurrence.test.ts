import { describe, expect, it } from "vitest";
import { completeRecurring, parseRecurrence } from "../src/core/recurrence";

describe("recurrence", () => {
  it("riconosce il sottoinsieme supportato", () => {
    expect(parseRecurrence("Task 🔁 every 2 weeks when done")).toEqual({ unit: "week", interval: 2, whenDone: true });
    expect(parseRecurrence("Task 🔁 every weekday")).toBeNull();
    expect(parseRecurrence("Task 🔁 every week on Monday 📅 2026-08-10")).toBeNull();
  });

  it("completa e genera sopra la prossima occorrenza senza identità duplicata", () => {
    expect(completeRecurring(
      "- [ ] Task 🔁 every month ⏳ 2026-01-29 📅 2026-01-31 [[Dettagli/Task|Dettagli]] ^kairos-a",
      "2026-01-20",
    )).toEqual({
      nextLine: "- [ ] Task 🔁 every month ⏳ 2026-02-28 📅 2026-02-28",
      completedLine: "- [x] Task 🔁 every month ⏳ 2026-01-29 📅 2026-01-31 [[Dettagli/Task|Dettagli]] ✅ 2026-01-20 ^kairos-a",
    });
  });

  it("when done mantiene la distanza scheduled/due", () => {
    const result = completeRecurring("- [ ] Task 🔁 every week when done ⏳ 2026-08-08 📅 2026-08-10", "2026-08-20");
    expect(result?.nextLine).toBe("- [ ] Task 🔁 every week when done ⏳ 2026-08-25 📅 2026-08-27");
  });

  it("rifiuta una regola senza data", () => {
    expect(completeRecurring("- [ ] Task 🔁 every week", "2026-08-20")).toBeNull();
  });
});
