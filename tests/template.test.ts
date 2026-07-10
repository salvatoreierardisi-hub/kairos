import { describe, expect, it } from "vitest";
import { renderDailyTemplate } from "../src/core/template";

describe("renderDailyTemplate", () => {
  it("renderizza titolo, data e ora con formato", () => {
    const output = renderDailyTemplate(
      "# {{title}}\n{{date}} · {{date:dddd D MMMM YYYY}} · {{time}} · {{time:HH.mm}}",
      {
        title: "2026-07-10",
        date: (format) => `DATE(${format})`,
        time: (format) => `TIME(${format})`,
      },
    );
    expect(output).toBe(
      "# 2026-07-10\nDATE(YYYY-MM-DD) · DATE(dddd D MMMM YYYY) · TIME(HH:mm) · TIME(HH.mm)",
    );
  });

  it("preserva variabili sconosciute e sintassi Templater", () => {
    const input = "{{unknown}} <% tp.date.now() %>";
    expect(renderDailyTemplate(input, { title: "x", date: () => "d", time: () => "t" })).toBe(input);
  });
});
