# Daily stabile, compatta e riferimenti contestuali — design

Data: 2026-08-10
Stato: approvato per la specifica, da revisionare prima dell'implementazione

## Obiettivo

Rendere la proiezione Kairos nelle daily stabile durante la scrittura, piu compatta e
coerente con il drawer. Aggiungere inoltre riferimenti contestuali `@` a file, indici di
progetto e cartelle senza cambiare la collocazione fisica del task.

Il risultato atteso e:

```text
○ Chiamare Barbara @Selezione DM219  Inbox  Dettagli
```

Il task continua a vivere nell'Inbox o nella nota scelta. La menzione serve soltanto a
ricordare e aprire il contesto; non e un tag, un filtro o una destinazione.

## Ambito

Il lavoro contiene due sottosistemi coordinati ma separati:

1. stabilita e densita della proiezione Daily;
2. inserimento, persistenza e apertura dei riferimenti `@`.

Condividono soltanto il rendering del titolo e dei riferimenti. La Daily non riusa
l'intero `TaskPanel`, per non importare filtri, menu, selezione multipla e stato del
drawer in un componente con responsabilita diverse.

## Alternative considerate

### Ritocco CSS della Daily esistente

Riduce rapidamente gli ingombri, ma lascia irrisolti il ridisegno completo a ogni
notifica, l'assenza di Dettagli e la duplicazione del rendering tra Daily e drawer.

### Riutilizzo completo della riga `TaskPanel`

Massimizza il riuso, ma accoppia la Daily a comportamenti che non le appartengono e rende
piu fragile il rendering dentro Live Preview e modalita lettura.

### Primitive condivise e riga Daily dedicata — scelta

Testo con riferimenti, pill e risoluzione delle destinazioni diventano primitive
condivise. La Daily mantiene una propria struttura DOM, piu semplice e adatta al blocco
Markdown. Questo elimina la duplicazione utile senza fondere due componenti diversi.

## Stabilita dell'indice

Oggi `TaskIndex` notifica tutte le viste dopo ogni modifica di un file Markdown, anche
quando l'insieme dei task del file e identico. Scrivere prosa nella daily provoca quindi
il ridisegno della proiezione; `DailyTasksBlock.render()` svuota il contenitore e lo
ricostruisce, modificando l'ancoraggio dello scroll mentre l'utente scrive.

La correzione opera a due livelli.

### Notifiche soltanto per cambiamenti reali

`TaskIndexCore.replace(path, tasks)` confronta il bucket precedente con quello nuovo. Due
bucket sono equivalenti quando hanno la stessa lunghezza e, nello stesso ordine, ogni
task ha gli stessi `file`, `line` e `source`. Gli altri campi sono derivati dalla sorgente.

`replace` e `delete` ritornano se lo snapshot e cambiato. `TaskIndex` pianifica una
notifica soltanto quando almeno un bucket e realmente cambiato. Creare, rinominare o
eliminare un file continua a notificare quando cambia un task indicizzato.

### Firma della proiezione Daily

`DailyTasksBlock` conserva una firma dei soli task mostrati nella data corrente. Una
notifica globale dovuta a task estranei non ricostruisce il blocco quando firma, ordine e
stati visibili sono invariati.

La firma comprende `file`, `line`, `source` e la presenza effettiva della nota Dettagli.
Lo stato collassato resta locale e non viene perso.

La conservazione manuale dello `scrollTop` resta limitata al gesto di collasso/espansione;
non viene usata per mascherare ridisegni prodotti durante la scrittura.

## Riga Daily compatta

La riga usa questa gerarchia:

```text
row
├── checkbox
└── main
    ├── titolo con riferimenti inline e priorita
    └── metadati inline: sorgente · Dettagli
```

Comportamenti:

- checkbox: completa o riapre, con la protezione ricorrenze esistente;
- corpo libero della riga: apre l'editor task;
- sorgente: apre la nota alla riga del task;
- Dettagli: compare solo quando il file collegato esiste e lo apre direttamente;
- riferimento `@`: apre il file, l'indice o l'elenco della cartella;
- ogni controllo interno ferma la propagazione e non apre l'editor per errore.

Il grande pulsante sorgente sulla destra viene rimosso. Sorgente e Dettagli diventano
pill leggere accanto al contenuto. La riga mantiene target touch di almeno 44 px tramite
aree interattive trasparenti, ma riduce altezza visiva, padding, bordo e distanza tra
elementi. Testo lungo, URL e riferimenti continuano ad andare a capo.

I completati restano dopo aperti e in corso, con testo barrato. Gli annullati restano
esclusi dalla Daily secondo il comportamento esistente.

## Modello dei riferimenti

Un riferimento ha forma logica:

```ts
type TaskReference = {
  kind: "file" | "folder";
  label: string;
  target: string;
};
```

Soltanto una scelta esplicita dal suggeritore crea un riferimento. Un testo digitato a
mano che contiene `@qualcosa` resta testo normale.

### File e indici

File e indici usano un wikilink Markdown standard con alias che inizia per `@`:

```markdown
[[Projects/School/Selezione DM219/_indice-candidatura|@Selezione DM219]]
```

Il target non include `.md`. Per una nota normale la label e il basename. Quando si
seleziona una cartella con un unico file `_indice-*.md` direttamente al suo interno, il
target e quel file e la label e il nome della cartella.

### Cartelle senza indice

Una cartella senza indice, o con piu indici diretti, usa un link Markdown con azione
Kairos e percorso codificato:

```markdown
[@Materiali](obsidian://kairos-folder?path=Projects%2FMateriali)
```

Kairos registra l'azione `kairos-folder`. Il click apre un fuzzy picker limitato ai file
Markdown della cartella e delle sottocartelle. Gli eventuali `_indice-*` vengono mostrati
prima, poi gli altri file ordinati per percorso relativo.

## Editor pulito

`QuickAddModal` usa due rappresentazioni:

- `sourceText`: sintassi Markdown persistente;
- `displayText`: testo mostrato nella textarea, con soli `@Label` leggibili.

All'apertura, un parser puro estrae soltanto i wikilink con alias `@...` e i link
`obsidian://kairos-folder`. Gli altri wikilink e link Markdown restano contenuto ordinario
e conservano il comportamento corrente.

Il parser produce testo visibile, riferimenti e intervalli. Durante l'editing gli
intervalli vengono aggiornati rispetto alla modifica della textarea. Se l'utente cancella
interamente una menzione, il riferimento viene eliminato; cambiare testo altrove non lo
tocca. Se modifica anche un solo carattere dentro `@Label`, Kairos trasforma quella
menzione in testo normale e rimuove soltanto il collegamento associato. Non sono ammesse
due menzioni con la stessa label visibile nello stesso task: il
suggeritore aggiunge il percorso relativo alla label finche diventa univoca.

Al salvataggio, il serializer sostituisce gli intervalli ancora validi con la sintassi
persistente. Parsing e serializzazione devono essere lossless per testo, date, tag,
Dettagli, block ID, Unicode e link non gestiti.

## Suggeritore `@`

La textarea intercetta la parola `@query` che termina alla posizione del cursore. Si
apre un popover sotto il campo con file Markdown e cartelle del vault.

Ogni risultato mostra:

- icona file o cartella;
- nome leggibile;
- percorso relativo attenuato;
- indicazione `Indice` quando una cartella risolve un unico `_indice-*`.

Il filtro cerca senza distinzione di maiuscole e accenti su nome e percorso. Mostra un
numero limitato di risultati e supporta frecce, Invio, Escape, click e touch. La selezione
sostituisce soltanto `@query`, mantiene il cursore dopo la menzione e non cambia
`targetPath`, data, priorita o stato del task.

Il popover si chiude quando il cursore lascia la query, la modal viene chiusa o parte un
altro controllo. Non deve coprire i comandi principali del composer mobile.

## Rendering condiviso

Un helper puro separa testo e riferimenti; un helper di vista renderizza segmenti testuali
e riferimenti accessibili. `TaskPanel` e `DailyTasksBlock` lo usano entrambi.

Un riferimento file viene risolto con il metadata cache e poi col percorso esatto. Un
riferimento cartella usa il percorso esatto. Se la cartella non esiste piu, Kairos cerca
una cartella con lo stesso basename:

- una sola corrispondenza: usa quella cartella per la sessione;
- zero o piu corrispondenze: lascia la menzione attenuata e mostra un avviso.

Kairos non riscrive automaticamente tutte le righe del vault dopo un rename. I wikilink
file possono continuare a beneficiare dell'aggiornamento link di Obsidian; il fallback
cartella evita scritture massive o ambigue.

## Errori e sicurezza

- Un riferimento morto non crea automaticamente file, cartelle o indici.
- L'azione URI accetta soltanto percorsi relativi che risolvono una `TFolder` nel vault;
  rifiuta path assoluti, traversal e cartelle tecniche nascoste.
- Un click fallito mostra una `Notice` breve e non apre l'editor task.
- La serializzazione non salva se un intervallo riferimento e incoerente; mantiene il
  testo visibile e segnala l'errore invece di produrre Markdown corrotto.
- Il popover non intercetta `Cmd/Ctrl+Invio`, usato per salvare.
- I link Dettagli mantengono la precedenza del parser dedicato e non diventano menzioni.
- Cartelle escluse dall'indice task restano selezionabili come contesto, eccetto
  `.obsidian` e cartelle nascoste tecniche.

## Test

### Indice e stabilita

- bucket identico: nessuna notifica;
- modifica di sola prosa: nessuna notifica;
- aggiunta, modifica, spostamento di riga o eliminazione task: una notifica;
- firma Daily invariata: nessun ridisegno;
- cambiamento di stato, ordine o disponibilita Dettagli: ridisegno.

### Parsing e serializzazione

- file, indice e cartella;
- Unicode, spazi e percorsi codificati;
- testo pulito all'apertura e sintassi ripristinata al salvataggio;
- eliminazione della menzione;
- testo `@` non selezionato lasciato intatto;
- label duplicate disambiguate;
- link normali e Dettagli conservati lossless;
- trasformazioni di data, priorita e stato preservano i riferimenti.

### Interazione

- filtro del suggeritore per nome e percorso;
- tastiera, touch, Escape e cursore;
- file e indice aprono la nota corretta;
- cartella mostra soltanto i Markdown discendenti;
- cartella spostata univoca viene recuperata;
- riferimento morto mostra avviso senza creare contenuto;
- sorgente, Dettagli e menzioni non propagano il click alla riga.

### Prova manuale

- scrittura lunga nella daily con sezione Task aperta, desktop e iPhone;
- task numerosi da note diverse senza salto dello scroll;
- densita, wrapping e target touch della nuova riga;
- inserimento e modifica di riferimenti dal composer mobile;
- passaggio ripetuto Live Preview/lettura;
- apertura file, indice, cartella e Dettagli.

## Fuori scope

- usare i riferimenti come filtri, tag o criteri di raggruppamento;
- spostare il task nel file o nella cartella menzionata;
- creare automaticamente indici;
- riscrivere in massa riferimenti cartella dopo rename;
- riferimenti a file non Markdown;
- suggerimenti `@` nell'editor Markdown generale di Obsidian.
