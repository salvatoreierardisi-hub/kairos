# Kairos

Kairos è un plugin per Obsidian che raccoglie i task Markdown del vault in un pannello
unico. I task restano nelle tue note: Kairos li indicizza e li modifica direttamente,
senza database separati o duplicazioni.

## Funzionalità

- Pannello completo e sidebar compatta.
- Viste Oggi, Prossimi, Senza data e Tutti, con ricerca, filtri, ordinamento e
  raggruppamento.
- Cattura rapida: task automatici nell'Inbox o nella daily; task ancorati alla nota
  corrente o a una nota scelta dall'utente.
- Stato, priorità, scadenza, tag, spostamento e rimozione dei task direttamente dalla
  vista.
- Sintassi compatibile con il formato emoji del plugin community Tasks, senza dipendere
  da quel plugin.
- Configurazione dell'Inbox, delle daily e dei prefissi tag dalle impostazioni.
- Funziona su desktop e mobile.

## Sintassi dei task

Kairos legge e scrive normali checkbox Markdown:

```markdown
- [ ] Rinnovare l'assicurazione auto ⏫ 📅 2026-07-20 #progetto/casa
```

| Marcatore | Significato |
| --- | --- |
| `- [ ]` / `- [/]` / `- [x]` / `- [-]` | aperto / in corso / completato / annullato |
| `📅 YYYY-MM-DD` | scadenza |
| `✅ YYYY-MM-DD` | data di completamento |
| `🔺` / `⏫` / `🔼` / `🔽` / `⏬` | priorità dal massimo al minimo |
| `#tag` | tag Markdown |

## Installazione manuale

1. Apri l'ultima [Release](../../releases) di Kairos su GitHub.
2. Scarica `main.js`, `manifest.json` e `styles.css`.
3. Crea la cartella `<vault>/.obsidian/plugins/kairos/` e copia lì i tre file.
4. In Obsidian vai in **Impostazioni → Plugin della community**, abilita Kairos e
   ricarica il plugin quando installi un aggiornamento.

## Uso rapido

- Clicca l'icona con la spunta nel ribbon o usa il comando **Apri Kairos**.
- Usa **Nuovo task (Kairos)** per creare un task da qualsiasi nota.
- Clicca un task per aprire la nota sorgente alla riga giusta.
- Clicca la sua icona di stato per completarlo o riaprirlo; il menu `…` offre le altre
  azioni.

Le impostazioni permettono di scegliere l'Inbox, usare la configurazione del plugin
Daily Notes di Obsidian o definire una configurazione personalizzata.

## Sviluppo

```bash
npm install
npm test
npm run build
```

Vedi [l'architettura](docs/architecture.md) e [come contribuire](CONTRIBUTING.md).

## Licenza

[MIT](LICENSE) © 2026 Salvo

