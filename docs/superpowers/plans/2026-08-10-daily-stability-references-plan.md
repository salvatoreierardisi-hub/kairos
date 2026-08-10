# Piano di implementazione — Daily stabile e riferimenti contestuali

Spec: `docs/superpowers/specs/2026-08-10-daily-stability-references-design.md`

## 1. Core riferimenti

- Creare parser, serializer e aggiornamento intervalli per file e cartelle.
- Separare testo visibile e sintassi persistente senza alterare link ordinari.
- Coprire Unicode, cancellazione/modifica menzione, label duplicate e round-trip.

## 2. Editor e suggeritore

- Integrare lo stato riferimenti nella `QuickAddModal`.
- Aggiungere popover `@` accessibile da tastiera e touch su file e cartelle.
- Risolvere un indice diretto univoco; altrimenti conservare la cartella.

## 3. Apertura e rendering

- Condividere il rendering inline tra pannello e Daily.
- Aprire file/indici; per cartelle mostrare un picker dei Markdown discendenti.
- Registrare l'azione URI cartella e gestire riferimenti morti senza scritture.

## 4. Stabilita e Daily

- Rendere `TaskIndexCore` sensibile ai cambiamenti reali.
- Saltare il render Daily quando la firma visibile non cambia.
- Sostituire il pulsante sorgente con pill inline e aggiungere Dettagli.
- Ridurre densita visiva mantenendo target touch e wrapping.

## 5. Chiusura

- Eseguire test completi, type-check, build e `git diff --check`.
- Commit e deploy nel vault locale; prova visuale e dello scroll dopo reload.
