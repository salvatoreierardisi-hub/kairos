# Fix wrapping daily e chiusura editor

Data: 2026-08-04

## Obiettivo

Correggere due difetti visivi confermati nella build reale di Kairos:

1. nelle proiezioni delle daily su mobile, il testo lungo di un task non va a capo e
   deborda dalla riga;
2. nell'editor di creazione o modifica compaiono contemporaneamente il pulsante di
   chiusura nativo di Obsidian e quello personalizzato di Kairos.

## Wrapping dei task nelle daily

Il corpo cliccabile del task resta un `button`, così conserva comportamento da tastiera,
accessibilità e gestione del tap già esistenti. Il CSS imposta esplicitamente
`white-space: normal` sia sul corpo sia sullo span del testo, neutralizzando il
`nowrap` applicato dai controlli nativi o dal tema di Obsidian. Imposta inoltre
`height: auto` sul pulsante, perché il controllo nativo conserva altrimenti un'altezza
fissa anche quando il testo va a capo. Il layout flex ha `min-width: 0`, mantiene una
corretta altezza minima per i task brevi e cresce insieme a testo, sorgente e bordo;
`overflow-wrap: anywhere` continua a gestire URL e token senza spazi.

## Un solo controllo di chiusura

L'editor usa esclusivamente `.modal-close-button`, creato e gestito da Obsidian. Il
pulsante personalizzato `.kairos-quickadd-close` viene rimosso dal rendering, insieme
alla classe globale `body.kairos-quickadd-open` e alla regola che tentava di nascondere
il controllo nativo.

Il pulsante nativo viene stilizzato soltanto quando appartiene a
`.kairos-quickadd-modal`, mantenendo l'aspetto circolare e la posizione coerente con la
testata. La testata riserva lo spazio necessario per evitare sovrapposizioni. Se il CSS
non venisse applicato, rimarrebbe comunque una sola X funzionante.

La protezione contro più editor aperti resta, ma non rimuove direttamente contenitori
DOM di Obsidian: l'istanza attiva precedente viene chiusa tramite il normale lifecycle
della modal.

## Verifica

- test automatici esistenti;
- type-check TypeScript;
- build del plugin;
- controllo statico che il codice non crei più `.kairos-quickadd-close` e non usi lo
  stato globale `kairos-quickadd-open`;
- prova manuale finale su desktop e iPhone: una sola X, apertura ripetuta dell'editor,
  task daily su più righe e token lungo senza overflow.

## Fuori scope

Non cambiano parsing, persistenza, contenuto Markdown, comportamento dei task o layout
generale dell'editor.
