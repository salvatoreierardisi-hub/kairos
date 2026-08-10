import { App, PluginSettingTab, Setting, Plugin } from "obsidian";
import { Settings } from "../types";
import { EffectiveDailyConfig } from "../io/DailyNotesConfig";
import { promptText } from "../view/PromptModal";
import { normalizeExcludedFolders } from "../core/settings";
import { archiveFolderPath } from "../core/archive";

export interface SettingsHost extends Plugin {
  settings: Settings;
  saveSettings(): Promise<void>;
  getEffectiveDailySettings(): Promise<EffectiveDailyConfig>;
  setAutoArchiveEnabled(enabled: boolean): Promise<boolean>;
  previewInboxArchive(): Promise<void>;
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

    field("File Inbox", "Casa stabile dei task creati con la cattura globale, anche quando hanno una data.", "inboxPath", "_inbox/Inbox.md");

    new Setting(containerEl)
      .setName("Configurazione daily")
      .setDesc("Serve a riconoscere le daily e mostrarvi la proiezione interattiva dei task.")
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

    new Setting(containerEl).setName("Archivio Inbox").setHeading();
    new Setting(containerEl)
      .setName("Archivia automaticamente i task conclusi")
      .setDesc(
        `Dopo il periodo di controllo, sposta completati e annullati in ${archiveFolderPath(this.host.settings.inboxPath)}. Le note Dettagli non vengono toccate.`,
      )
      .addToggle((toggle) => toggle
        .setValue(this.host.settings.autoArchiveCompleted)
        .onChange(async (enabled) => {
          await this.host.setAutoArchiveEnabled(enabled);
          this.display();
        }));

    new Setting(containerEl)
      .setName("Giorni di permanenza")
      .setDesc("Giorni durante i quali un task concluso resta ancora nell'Inbox (1–365).")
      .addText((text) => text
        .setDisabled(!this.host.settings.autoArchiveCompleted)
        .setValue(String(this.host.settings.completedRetentionDays))
        .onChange(async (value) => {
          const parsed = Number(value);
          if (!Number.isInteger(parsed) || parsed < 1 || parsed > 365) return;
          this.host.settings.completedRetentionDays = parsed;
          await this.host.saveSettings();
        }));

    new Setting(containerEl)
      .setName("Controlla archivio ora")
      .setDesc("Mostra l'anteprima e avvia la manutenzione soltanto dopo conferma.")
      .addButton((button) => button
        .setButtonText("Analizza")
        .onClick(() => void this.host.previewInboxArchive()));

    new Setting(containerEl)
      .setName("Orizzonte Agenda")
      .setDesc("Numero di giorni mostrati singolarmente prima del gruppo Dopo (1–365).")
      .addText((text) => text
        .setValue(String(this.host.settings.agendaHorizonDays))
        .onChange(async (value) => {
          const parsed = Number(value);
          if (!Number.isInteger(parsed) || parsed < 1 || parsed > 365) return;
          this.host.settings.agendaHorizonDays = parsed;
          await this.host.saveSettings();
        }));

    new Setting(containerEl)
      .setName("Cartelle escluse")
      .setDesc("Percorsi relativi al vault separati da virgola. .obsidian è sempre esclusa.")
      .addTextArea((area) => area
        .setPlaceholder("Archivio, Allegati")
        .setValue(this.host.settings.excludeFolders.join(", "))
        .onChange(async (value) => {
          this.host.settings.excludeFolders = normalizeExcludedFolders(value.split(","));
          await this.host.saveSettings();
        }));

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
