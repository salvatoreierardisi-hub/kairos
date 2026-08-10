# Ottimizzazione delle prestazioni di Kairos

Data: 2026-08-10

## Obiettivo

Ridurre il lavoro eseguito da Kairos durante l'indicizzazione e nelle interazioni più
frequenti, mantenendo invariati comportamento, modello dati e compatibilità con
Obsidian. Ogni modifica deve essere giustificata da benchmark ripetibili e accompagnata
da un confronto prima-dopo.

Il lavoro copre tre percorsi percepibili dall'utente:

1. costruzione iniziale dell'indice su un vault grande;
2. aggiornamento incrementale dopo la modifica di una singola nota;
3. filtro, raggruppamento e ricerca dei task e dei riferimenti `@`.

Il rendering DOM viene valutato nella prova reale in Obsidian e ottimizzato soltanto se
le misure indicano che resta un collo di bottiglia dopo gli interventi sulla logica.

## Strategia di misura

Si adotta un approccio ibrido:

- benchmark sintetici deterministici misurano la logica TypeScript senza dipendere dal
  contenuto privato del vault;
- una prova manuale in Obsidian verifica che i miglioramenti misurati corrispondano a
  una maggiore reattività nel flusso reale.

La suite viene eseguita con un comando dedicato e non fa parte di `npm test`. Usa dati
generati con schema e seme fissi, un warm-up prima della raccolta e più campioni per
scenario. Il rapporto presenta almeno mediana, p99 e numero di operazioni al secondo,
oltre alle caratteristiche del runtime usato. I risultati grezzi prima e dopo vengono
salvati in artefatti confrontabili, mentre nel repository resta un rapporto leggibile.

### Dataset

I dati sintetici rappresentano note normali, task con date, priorità e tag, code fence e
testo non-task. Gli scenari principali sono:

- parser: note sufficienti a contenere complessivamente circa 10.000 task;
- indice incrementale: 2.000 file con 5 task ciascuno, poi sostituzione invariata e
  modifica di un singolo bucket;
- query: 10.000 task sottoposti a filtro testuale, filtro strutturato, ordinamento e
  raggruppamento;
- riferimenti: 5.000 note e 1.000 cartelle, incluse cartelle con un unico file
  `_indice-*`, poi ricerche successive come durante la digitazione.

La dimensione potrà essere ridotta soltanto se una singola esecuzione rende la suite
impraticabile; in quel caso il rapporto deve dichiarare la dimensione effettiva.

### Criteri di accettazione

Un intervento viene mantenuto quando:

- migliora di almeno il 20% il percorso critico che intende correggere;
- non peggiora di oltre il 10% gli altri scenari comparabili;
- non cambia l'output funzionale;
- lascia puliti `npm test`, `npx tsc --noEmit` e `npm run build`.

Variazioni inferiori alla normale dispersione dei campioni non vengono presentate come
miglioramenti. Se un'ottimizzazione non supera i criteri, viene rimossa.

## Architettura della suite

La generazione dei dati e l'esecuzione delle misure restano separate dalla logica del
plugin:

- un generatore puro crea note, task e candidati di riferimento deterministici;
- un runner misura gli scenari in processi e condizioni coerenti;
- un comando produce un risultato strutturato utilizzabile per il confronto;
- un rapporto finale riassume ambiente, dataset, valori prima-dopo e variazioni.

Le funzioni di benchmark possono importare soltanto moduli puri. Se un percorso oggi è
accoppiato a classi di Obsidian, la parte algoritmica viene estratta dietro una piccola
funzione pura; l'adattatore UI continua a fornire gli stessi dati e a osservare lo
stesso contratto.

I benchmark non introducono dipendenze runtime nel plugin. Eventuali strumenti restano
dipendenze di sviluppo già disponibili nel progetto o piccoli script locali.

## Colli di bottiglia da verificare

L'ispezione del codice individua quattro ipotesi, che devono essere confermate dalla
baseline prima di modificare l'implementazione:

1. `TaskIndexCore.replace()` appiattisce tutti i bucket dopo ogni modifica, rendendo
   l'aggiornamento di un file proporzionale al numero totale di task.
2. La costruzione dei riferimenti `@` cerca gli indici diretti scansionando tutti i file
   per ciascuna cartella e viene ripetuta a ogni aggiornamento del suggeritore.
3. La query normalizza ripetutamente testo, percorso e tag per ogni filtro testuale.
4. Le notifiche dell'indice possono ricostruire l'intero pannello, anche quando cambia
   un solo task o quando la porzione visibile è limitata.

La priorità degli interventi segue il tempo misurato e la frequenza nel flusso reale,
non l'ordine di questa lista.

## Direzione degli interventi

### Indice

L'indice deve conservare la semantica di snapshot ordinato per file, ma evitare lavoro
globale nei casi invariati. Le alternative ammesse includono snapshot lazy, cache con
invalidazione o aggiornamento incrementale delle porzioni interessate. `getAll()` deve
continuare a restituire uno snapshot stabile che i consumer non possano alterare per
errore.

La costruzione iniziale non deve ricostruire lo snapshot dopo ogni file: il caricamento
può accumulare i bucket e pubblicare una sola vista coerente alla fine, conservando la
cancellazione tramite `generation` e la notifica unica esistenti.

### Riferimenti

La costruzione dei candidati deve essere lineare nel numero di file e cartelle. Gli
indici diretti vengono raccolti in una mappa per cartella in un solo passaggio. La lista
completa viene preparata una volta per istanza del composer e riutilizzata durante la
digitazione; va invalidata quando il vault cambia struttura o quando il composer viene
riaperto.

La ricerca conserva ordinamento, disambiguazione, limite di otto risultati e trattamento
delle cartelle con indice univoco.

### Query

Il filtro strutturato resta puro. Per la ricerca testuale si può precalcolare una chiave
normalizzata per snapshot o per ciclo di rendering, senza aggiungere dati persistenti ai
task e senza rendere incoerenti le modifiche incrementali. La cache deve avere una
politica di invalidazione evidente e testabile.

### Rendering

Prima di introdurre aggiornamenti DOM incrementali, si misura separatamente la logica
che precede il rendering e si verifica il pannello reale. Se il DOM resta dominante, il
primo intervento ammesso è evitare render identici tramite una firma visibile, seguendo
il modello già usato dalla proiezione Daily. Una riconciliazione riga per riga è fuori
scope salvo evidenza che la firma non sia sufficiente.

## Flusso dei dati

All'avvio, Obsidian fornisce l'elenco dei file Markdown. Kairos legge e analizza ogni
file, aggiorna i bucket dell'indice e pubblica uno snapshot completo una sola volta. Una
modifica successiva ricalcola soltanto il bucket del file coinvolto; se il contenuto task
non cambia, non invalida snapshot o viste.

Il pannello prende lo snapshot, applica query e raggruppamento, quindi renderizza al
massimo la pagina visibile di ogni gruppo. Il suggeritore costruisce il catalogo dal
vault quando necessario e, durante la digitazione, applica soltanto ricerca, ordinamento
e limite al catalogo già pronto.

## Gestione degli errori e correttezza

I benchmark falliscono con un messaggio esplicito se il dataset non viene generato, uno
scenario non restituisce l'output atteso o il risultato strutturato non può essere
scritto. Le misure non nascondono eccezioni della logica testata.

Le ottimizzazioni devono preservare:

- ordine e identità dei task nello snapshot;
- riconoscimento delle modifiche reali rispetto a quelle irrilevanti;
- cancellazione e rename dei file;
- esclusioni configurate e cancellazione di build concorrenti;
- risultati, ordinamento e disambiguazione del suggeritore;
- selezione, filtri e stato visibile del pannello.

## Verifica

I test unitari coprono ogni nuova unità pura e i contratti precedenti. In particolare
devono dimostrare equivalenza degli output su dataset rappresentativi, invalidazione
delle cache, snapshot stabile, caricamento batch e aggiornamenti incrementali.

La sequenza finale è:

1. esecuzione e salvataggio della baseline sul commit precedente agli interventi;
2. profiling dei singoli scenari e scelta dei colli di bottiglia reali;
3. interventi uno alla volta, con benchmark dopo ciascuno;
4. suite funzionale completa, type-check e build;
5. nuova esecuzione nelle stesse condizioni;
6. rapporto prima-dopo con mediana, p99, variazione percentuale e interpretazione;
7. prova manuale in Obsidian di avvio, modifica nota, filtro e suggeritore `@`.

La prova manuale non sostituisce i benchmark e il rapporto distingue chiaramente ciò
che è misurato automaticamente da ciò che resta da confermare nel vault reale.
