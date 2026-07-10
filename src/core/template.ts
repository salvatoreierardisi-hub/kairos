export interface TemplateFormatters {
  title: string;
  date: (format: string) => string;
  time: (format: string) => string;
}

const TEMPLATE_VARIABLE_RE = /\{\{(title|date|time)(?::([^}]+))?\}\}/g;

export function renderDailyTemplate(template: string, formatters: TemplateFormatters): string {
  return template.replace(TEMPLATE_VARIABLE_RE, (_match, key: string, rawFormat?: string) => {
    if (key === "title") return formatters.title;
    if (key === "date") return formatters.date(rawFormat ?? "YYYY-MM-DD");
    return formatters.time(rawFormat ?? "HH:mm");
  });
}
