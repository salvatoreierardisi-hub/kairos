# Suggeritore riferimenti: espansione verso il basso e touch mobile

Data: 2026-08-10
Stato: revisione mobile approvata verbalmente, in attesa di revisione della specifica

## Problema

Inizialmente il suggeritore aperto digitando `@` era posizionato in assoluto sotto la
textarea e il composer lo ritagliava. Il passaggio al flusso verticale ha risolto il
desktop. La prima prova mobile ha pero mostrato due problemi collegati: il footer sticky
si sovrappone ai risultati e la scelta su `pointerdown` impedisce al gesto verticale di
diventare uno scorrimento.

## Comportamento scelto

Il suggeritore entra nel normale flusso verticale del composer, subito sotto la
textarea e prima del footer. Quando compare, la finestra cresce verso il basso; il
footer viene spinto dopo l'elenco e resta utilizzabile. Il menu mostra fino a circa
cinque o sei risultati, poi scorre al proprio interno. L'altezza massima resta vincolata
allo spazio disponibile nello schermo.

La finestra conserva l'altezza compatta quando il suggeritore e chiuso. Su mobile,
mentre il menu e aperto, il footer con Programma, Priorita e Crea viene nascosto
temporaneamente. L'elenco usa cosi lo spazio disponibile sopra la tastiera e scorre al
proprio interno; appena una scelta chiude il menu, il footer ricompare senza perdere lo
stato dei controlli.

## Interazione mobile

- l'evento `input` dopo la digitazione di `@` continua ad aprire il suggeritore;
- `pointerdown` segnala soltanto che il dito sta interagendo con l'elenco e non usa
  `preventDefault`, lasciando intatto lo scorrimento nativo;
- il blur della textarea non chiude il menu finche il puntatore resta nell'elenco;
- un tap genera la scelta al normale `click`; un trascinamento verticale scorre e non
  seleziona accidentalmente un risultato;
- la scelta resta idempotente anche se il WebView genera eventi duplicati;
- tastiera, frecce, Invio ed Escape mantengono il comportamento esistente;
- toccare un altro controllo chiude il menu normalmente.

## Modifiche circoscritte

- `styles.css`: il suggeritore mantiene il flusso verticale; su mobile il footer viene
  nascosto soltanto mentre il menu e aperto, che riceve lo spazio liberato e conserva
  overflow interno.
- `ReferenceSuggest.ts`: stato dell'interazione pointer esposto alla modal, selezione
  touch idempotente e semantica accessibile.
- `QuickAddModal.ts`: nessun cambiamento al formato Markdown o alla destinazione task;
  il blur rispetta un'interazione in corso nell'elenco.

Non cambiano parser, serializzazione, indice, collocazione Inbox o apertura dei
riferimenti.

## Verifica

- test automatici, type-check e build completi;
- controllo che `@` apra il menu e che frecce/Invio continuino a scegliere;
- prova desktop: almeno cinque risultati visibili e menu scorrevole;
- prova mobile: digitazione `@`, scorrimento dell'elenco senza selezioni accidentali,
  tocco su un risultato e menzione inserita una sola volta;
- controllo che il footer scompaia durante la ricerca e ricompaia dopo scelta o chiusura.
