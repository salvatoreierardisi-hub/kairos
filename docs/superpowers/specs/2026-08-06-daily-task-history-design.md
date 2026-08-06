# Storico dei task nella nota giornaliera

Data: 2026-08-06
Stato: approvato

## Obiettivo

La proiezione Kairos dentro una nota giornaliera deve mostrare sia il lavoro ancora da
fare sia quello completato durante quella giornata. Completare un task non deve quindi
far sparire la riga: a fine giornata la sezione `Task` deve offrire un riepilogo leggibile
di ciò che è rimasto aperto e di ciò che è stato svolto.

La proiezione mantiene un'identità propria dentro la nota, ma adotta gli stessi controlli
e lo stesso linguaggio visivo del drawer destro di Kairos.

## Selezione e ordinamento

La proiezione di una daily include i task la cui data effettiva coincide con la data
della nota e il cui stato è:

- aperto;
- in corso;
- completato.

I task annullati restano esclusi. I task aperti e in corso sono mostrati per primi; i
completati formano la parte finale della stessa lista. All'interno dei due insiemi resta
valido l'ordinamento esistente per priorità, data e posizione sorgente.

Il task continua a vivere soltanto nella propria riga Markdown. Il completamento aggiorna
quella riga e l'indice; la daily è una proiezione e non salva copie. Nel caso di un task
ricorrente, l'occorrenza completata resta nella daily originale, mentre la nuova occorrenza
compare soltanto nella propria data.

## Interazioni di stato

Il controllo circolare attuale viene sostituito dallo stesso quadratino arrotondato usato
nel drawer:

- vuoto per un task aperto;
- indicatore accentato per un task in corso;
- pieno con spunta per un task completato.

Un tap o click sul quadratino completa un task aperto e riapre un task completato non
ricorrente. La riga completata resta visibile, con testo attenuato e barrato; sorgente e
azione di apertura restano utilizzabili. Etichetta accessibile e stato visivo devono
descrivere correttamente sia `Completa task` sia `Riapri task`.

Un'occorrenza ricorrente completata è invece di sola lettura nella daily: il quadratino
mostra la spunta ma non la riapre, perché al completamento Kairos ha già generato
l'occorrenza successiva. Il controllo espone un'etichetta accessibile che chiarisce la
protezione e non produce scritture. Questa regola evita due occorrenze aperte della stessa
serie senza introdurre qui una procedura distruttiva di rollback della ricorrenza.

## Intestazione

Freccia e titolo `Task` restano raggruppati a sinistra. Il pulsante `+` viene separato dal
titolo e allineato all'estremità destra dell'intestazione. Mantiene un target minimo di
44 x 44 px su mobile, un simbolo ben centrato e un feedback alla pressione coerente con
il drawer.

La freccia continua a comprimere o espandere l'intera proiezione; il `+` apre la creazione
con la data della daily e non attiva il collasso.

## Superfici e allineamento

Le righe conservano una superficie rettangolare perché sono incorporate nel testo della
nota, ma diventano più leggere:

- sfondo semitrasparente derivato dai colori nativi di Obsidian;
- bordo sottile e poco contrastato;
- raggio coerente con il drawer;
- niente riquadri opachi separati attorno a checkbox, contenuto e azione sorgente;
- spaziatura, dimensione del testo e allineamento verticale vicini alle righe del drawer.

Il nome della nota sorgente resta sotto al titolo. L'azione per aprire la sorgente rimane
a destra, discreta ma con target touch adeguato. Hover e pressione modificano solo il
contrasto della superficie interessata e non introducono colori permanenti.

## Componenti interessati

- `src/core/query.ts`: selezione pura dei task della giornata comprensiva dei completati.
- `src/view/DailyTasksBlock.ts`: separazione attivi/completati, stato accessibile del
  controllo, riapertura e struttura dell'intestazione.
- `styles.css`: checkbox condivisa o visivamente equivalente, righe trasparenti, stato
  completato, allineamento del `+` e target touch.
- `tests/query.test.ts`: casi per task aperti, in corso, completati, annullati e date non
  corrispondenti.

Non cambiano il parser, il formato Markdown, la collocazione fisica dei task o il drawer.

## Errori e aggiornamenti

Le azioni continuano a passare da `TaskWriter`. Se una scrittura fallisce, Kairos mostra
la `Notice` già prevista e la riga non assume localmente uno stato non confermato. Dopo
una scrittura valida, l'aggiornamento dell'indice ridisegna la proiezione senza far
scomparire il task completato.

## Verifica

La modifica è completata quando:

1. un task aperto della daily diventa completato e resta visibile in fondo alla lista;
2. un secondo tap riapre un task non ricorrente e lo riporta tra gli attivi;
3. i task annullati e quelli di altre date non compaiono;
4. un task ricorrente completato resta visibile ma protetto dalla riapertura, mentre la
   nuova occorrenza compare soltanto nella propria data;
5. il `+` è allineato a destra e non attiva il collasso;
6. checkbox, card semitrasparenti e stati risultano coerenti con il drawer su desktop e
   mobile;
7. `npm test`, `npx tsc --noEmit`, `npm run build` e `git diff --check` sono puliti;
8. una prova reale nel vault conferma la resa in Live Preview e in modalità lettura.
