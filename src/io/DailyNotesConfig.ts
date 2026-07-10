import { App, TFile, moment, normalizePath } from "obsidian";
import { Settings } from "../types";
import { renderDailyTemplate } from "../core/template";

interface MomentValue {
  isValid(): boolean;
  format(value: string): string;
}

const makeMoment = moment as unknown as {
  (input?: string, format?: string, strict?: boolean): MomentValue;
};

interface ObsidianDailyNotesData {
  folder?: string;
  format?: string;
  template?: string;
}

export interface EffectiveDailyConfig {
  folder: string;
  format: string;
  templatePath: string;
  inherited: boolean;
}

export interface PreparedDaily {
  path: string;
  title: string;
  initialContent: string;
  warning?: string;
}

function markdownPath(path: string): string {
  const normalized = normalizePath(path.trim());
  return normalized.toLowerCase().endsWith(".md") ? normalized : `${normalized}.md`;
}

export class DailyNotesConfigService {
  constructor(private app: App, private getSettings: () => Settings) {}

  async resolve(): Promise<EffectiveDailyConfig> {
    const settings = this.getSettings();
    if (settings.dailyConfigMode === "custom") {
      return {
        folder: normalizePath(settings.dailyFolder),
        format: settings.dailyFormat || "YYYY-MM-DD",
        templatePath: settings.dailyTemplate ? markdownPath(settings.dailyTemplate) : "",
        inherited: false,
      };
    }

    const inherited = await this.readObsidianConfig();
    return {
      folder: normalizePath(inherited?.folder || settings.dailyFolder),
      format: inherited?.format || settings.dailyFormat || "YYYY-MM-DD",
      templatePath: inherited?.template
        ? markdownPath(inherited.template)
        : settings.dailyTemplate
          ? markdownPath(settings.dailyTemplate)
          : "",
      inherited: inherited !== null,
    };
  }

  async prepare(date: string): Promise<PreparedDaily> {
    const config = await this.resolve();
    const day = makeMoment(date, "YYYY-MM-DD", true);
    if (!day.isValid()) throw new Error(`Data non valida: ${date}`);

    const formattedName = day.format(config.format);
    const relative = formattedName.toLowerCase().endsWith(".md") ? formattedName : `${formattedName}.md`;
    const path = normalizePath(config.folder ? `${config.folder}/${relative}` : relative);
    const title = relative.substring(relative.lastIndexOf("/") + 1).replace(/\.md$/i, "");
    let initialContent = `# ${title}\n`;
    let warning: string | undefined;

    if (config.templatePath) {
      const template = this.app.vault.getAbstractFileByPath(config.templatePath);
      if (template instanceof TFile) {
        try {
          const raw = await this.app.vault.read(template);
          const now = makeMoment();
          initialContent = renderDailyTemplate(raw, {
            title,
            date: (format) => day.format(format),
            time: (format) => now.format(format),
          });
        } catch (error) {
          warning = `template daily non leggibile; creata una daily minimale (${String(error)})`;
        }
      } else {
        warning = `template daily non trovato: ${config.templatePath}; creata una daily minimale`;
      }
    }

    return { path, title, initialContent, warning };
  }

  private async readObsidianConfig(): Promise<ObsidianDailyNotesData | null> {
    const path = normalizePath(`${this.app.vault.configDir}/daily-notes.json`);
    try {
      if (!(await this.app.vault.adapter.exists(path))) return null;
      const parsed = JSON.parse(await this.app.vault.adapter.read(path)) as unknown;
      if (!parsed || typeof parsed !== "object") return null;
      const data = parsed as Record<string, unknown>;
      return {
        folder: typeof data.folder === "string" ? data.folder : undefined,
        format: typeof data.format === "string" ? data.format : undefined,
        template: typeof data.template === "string" ? data.template : undefined,
      };
    } catch {
      return null;
    }
  }
}
