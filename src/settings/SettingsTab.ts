import { App, PluginSettingTab, Setting, Plugin } from "obsidian";
import { Settings } from "../types";
import { EffectiveDailyConfig } from "../io/DailyNotesConfig";
import { promptText } from "../view/PromptModal";

export interface SettingsHost extends Plugin {
  settings: Settings;
  saveSettings(): Promise<void>;
  getEffectiveDailySettings(): Promise<EffectiveDailyConfig>;
}

export class KairosSettingTab extends PluginSettingTab {
  constructor(app: App, private host: SettingsHost) {
    super(app, host);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    type StringSettingKey =
      | "inboxPath"
      | "dailyFolder"
      | "dailyFormat"
      | "dailyTemplate"
      | "projectPrefix"
      | "areaPrefix";
    const field = (name: string, desc: string, key: StringSettingKey, placeholder: string) => {
      new Setting(containerEl)
        .setName(name)
        .setDesc(desc)
        .addText((t) =>
          t
            .setPlaceholder(placeholder)
            .setValue(this.host.settings[key])
            .onChange(async (v) => {
              this.host.settings[key] = v.trim();
              await this.host.saveSettings();
            }),
        );
    };

    field("File Inbox", "Dove finiscono i task automatici senza data.", "inboxPath", "_inbox/Inbox.md");

    new Setting(containerEl)
      .setName("Configurazione daily")
      .setDesc("Eredita cartella, formato e template da Daily Notes oppure usa i valori Kairos.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("obsidian", "Eredita da Obsidian")
          .addOption("custom", "Personalizzata")
          .setValue(this.host.settings.dailyConfigMode)
          .onChange(async (value) => {
            this.host.settings.dailyConfigMode = value === "custom" ? "custom" : "obsidian";
            await this.host.saveSettings();
            this.display();
          }),
      );

    const effective = new Setting(containerEl)
      .setName("Configurazione effettiva")
      .setDesc("Rilevamento in corso…");
    void this.host.getEffectiveDailySettings().then((config) => {
      effective.setDesc(
        `${config.folder || "Radice vault"} · ${config.format} · ${config.templatePath || "nessun template"}`,
      );
    });

    field(
      "Cartella daily Kairos",
      "Usata in modalità personalizzata o come fallback se Daily Notes non è configurato.",
      "dailyFolder",
      "02 Daily",
    );
    field("Formato daily Kairos", "Formato Moment del nome file.", "dailyFormat", "YYYY-MM-DD");
    field(
      "Template daily Kairos",
      "Percorso opzionale, usato in modalità personalizzata o come fallback.",
      "dailyTemplate",
      "06 System/Templates/template-daily",
    );
    field("Prefisso tag progetto", "Es. progetto/", "projectPrefix", "progetto/");
    field("Prefisso tag area", "Es. area/", "areaPrefix", "area/");

    if (this.host.settings.savedViews.length > 0) {
      new Setting(containerEl).setName("Viste salvate").setHeading();
      for (const view of this.host.settings.savedViews) {
        new Setting(containerEl)
          .setName(view.name)
          .addExtraButton((button) =>
            button
              .setIcon("pencil")
              .setTooltip("Rinomina vista")
              .onClick(() => {
                promptText(this.app, "Rinomina vista", view.name, async (name) => {
                  if (name === view.name) return;
                  view.name = name;
                  await this.host.saveSettings();
                  this.display();
                });
              }),
          )
          .addExtraButton((button) =>
            button
              .setIcon("trash")
              .setTooltip("Elimina vista")
              .onClick(async () => {
                this.host.settings.savedViews = this.host.settings.savedViews.filter(
                  (candidate) => candidate !== view,
                );
                await this.host.saveSettings();
                this.display();
              }),
          );
      }
    }
  }
}
