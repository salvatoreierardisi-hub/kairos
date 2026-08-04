# Testata Task autonoma nelle daily

Data: 2026-08-04

## Obiettivo

Rendere la proiezione Kairos nelle note giornaliere una sezione autonoma con:

- titolo visivo `Task`;
- controllo per aprire e chiudere soltanto l'elenco;
- pulsante `+` per creare un task già programmato per la data della daily;
- contenuto scritto dopo la proiezione indipendente dalla chiusura dell'elenco.

## Struttura della daily

`## Task` non viene più usato come titolo Markdown della proiezione. Il blocco
`kairos-tasks` renderizza direttamente una testata interattiva e l'elenco. In questo
modo il folding non può coinvolgere gli appunti successivi.

Quando Kairos apre una daily esistente, riconosce soltanto la sequenza esatta composta
dal titolo `## Task` immediatamente seguito dal blocco `kairos-tasks` e rimuove quel
titolo. Se il template contiene il solo titolo esatto `## Task`, Kairos lo sostituisce
con il blocco autonomo. Non modifica titoli diversi o il contenuto successivo. Nelle
nuove daily prive di entrambi il blocco viene inserito dopo il primo H1, o dopo il
frontmatter se non esiste un H1, senza creare un titolo Markdown aggiuntivo.

## Interazione

La testata contiene un pulsante di disclosure, titolo `Task` e pulsante `+`. Lo stato
aperto o chiuso appartiene all'istanza renderizzata e viene mantenuto durante gli
aggiornamenti dell'indice finché la nota resta aperta. La chiusura nasconde solo lista
o stato vuoto; testata e appunti Markdown restano visibili.

Il pulsante `+` apre l'editor Kairos con la data della daily precompilata e destinazione
globale Inbox. La data continua a pilotare la proiezione, senza spostare fisicamente il
task fuori dall'Inbox.

Desktop e mobile usano gli stessi valori espliciti per dimensioni, spaziatura, sfondo,
raggio e tipografia della testata e delle righe. Gli stili nativi dei pulsanti vengono
azzerati. Il segno `+`, la checkbox e l'apertura nota vivono in `span` dedicati con
colore, opacità, text fill e stroke espliciti: il WebView mobile non può più nascondere
il contenuto diretto del pulsante. La testata usa controlli da 34 px e titolo da 20 px;
le righe conservano controlli da 38 px, testo da 15 px e sorgente da 13 px.

Poiché una prova reale successiva ha confermato che i due SVG di riga restavano
invisibili su iOS, il cerchio di completamento viene disegnato con bordo e pseudo-elemento
CSS, mentre il documento con freccia usa una maschera CSS incorporata. Nessuno dei due
dipende più dal renderer di icone di Obsidian; click e label accessibili restano sui
pulsanti esistenti.

## Deduplicazione del renderer mobile

Il Markdown conserva una sola proiezione. Se Live Preview crea più renderer per lo
stesso blocco, Kairos li identifica tramite percorso, riga e foglia Obsidian. L'istanza
più recente resta attiva e gli host precedenti nella stessa foglia vengono nascosti;
all'unload viene riattivata l'ultima istanza ancora connessa. Due foglie che mostrano la
stessa nota restano indipendenti.

## Errori e accessibilità

I controlli sono pulsanti reali con etichette accessibili e `aria-expanded` aggiornato.
Gli errori di scrittura continuano a usare il flusso e le `Notice` dell'editor esistente.
Una daily non riconosciuta conserva il messaggio di errore attuale.

## Verifica

- test puri per inserimento del nuovo blocco e migrazione conservativa del vecchio
  `## Task`;
- nessuna duplicazione del blocco;
- test, type-check e build completi;
- prova reale desktop e mobile: apertura/chiusura limitata all'elenco, appunti sempre
  visibili, `+` con data corretta e nuovo task immediatamente proiettato.

## Fuori scope

Non cambiano formato dei task, parser, collocazione fisica in Inbox, impostazioni daily
o comportamento dell'editor al di fuori della data iniziale.
