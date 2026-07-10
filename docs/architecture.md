# Architettura

Kairos tratta le righe Markdown come unica fonte di verità. L'indice in memoria osserva
il vault e ricostruisce la vista; le azioni dell'utente modificano la riga sorgente.

```text
Note Markdown → TaskIndex → TaskPanel
       ↑                         │
       └────── TaskWriter ───────┘
```

## Moduli

- `src/core/`: parser, formattazione, filtro, ordinamento e regole di collocazione;
  funzioni pure coperte da Vitest.
- `src/index/TaskIndex.ts`: indicizza i task del vault e reagisce alle modifiche dei file.
- `src/io/TaskWriter.ts`: scrive, sposta e aggiorna le righe Markdown.
- `src/view/`: pannello, sidebar, cattura rapida e componenti di supporto.
- `src/settings/`: impostazioni esposte in Obsidian.

Il plugin non richiede dipendenze runtime oltre all'API di Obsidian.

