# Contribuire a Kairos

Grazie per l'interesse. Prima di aprire una pull request, descrivi il problema o la
proposta in una issue.

## Ambiente locale

```bash
npm install
npm test
npm run build
```

La logica di dominio vive in `src/core/` e deve restare pura e coperta da test. Il codice
che integra Obsidian vive in `src/io/`, `src/view/`, `src/settings/` e `src/main.ts`.

## Pull request

- Mantieni le modifiche mirate e spiega il comportamento utente che cambia.
- Aggiungi o aggiorna i test quando tocchi `src/core/`.
- Verifica `npm test` e `npm run build` prima di aprire la pull request.
- Non introdurre dipendenze runtime oltre a `obsidian`.

