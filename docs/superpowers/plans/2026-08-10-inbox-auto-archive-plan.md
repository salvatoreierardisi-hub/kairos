# Piano di implementazione — archivio automatico Inbox

Spec: `docs/superpowers/specs/2026-08-10-inbox-auto-archive-design.md`

## 1. Core puro

- Aggiungere a `Settings` l'abilitazione e i giorni di conservazione, disattivati per
  default e normalizzati al caricamento.
- Creare `src/core/archive.ts` per idoneita, percorso annuale derivato dall'Inbox,
  riconoscimento archivio, block ID e inserimento mensile idempotente.
- Coprire il modulo con test di soglia, cambio anno, percorsi, ordinamento, sintassi e
  duplicati.

## 2. Servizio di archiviazione

- Creare `src/io/InboxArchive.ts` con analisi read-only, lock del batch e spostamento
  copia-prima/rimuovi-dopo.
- Verificare ogni scrittura tramite block ID e continuare il batch dopo errori isolati.
- Integrare in `TaskWriter` la riapertura sicura di un task che vive nell'archivio.
- Aggiungere fixture I/O per successo, retry idempotente, errore di copia, errore di
  rimozione, Dettagli e riapertura.

## 3. Integrazione plugin

- Aggiungere comando manuale, anteprima/conferma e controlli nelle impostazioni.
- Avviare la manutenzione dopo la build iniziale e al primo cambio indice di un nuovo
  giorno, con guardia per una sola esecuzione giornaliera.
- Mostrare riepiloghi sintetici e non silenziare gli errori.

## 4. Chiusura

- Eseguire `npm test`, `npx tsc --noEmit`, `npm run build` e `git diff --check`.
- Non modificare il vault reale durante i test automatici; l'attivazione e la prima
  archiviazione restano una prova manuale successiva al deploy.
