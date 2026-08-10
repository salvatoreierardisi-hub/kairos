# Archivio automatico dell'Inbox — design

Data: 2026-08-10
Stato: approvato per la specifica, da revisionare prima dell'implementazione

## Obiettivo

Mantenere il file Inbox leggibile anche con un uso intenso di Kairos, senza perdere la
cronologia e senza cancellare automaticamente le note Dettagli. I task completati o
annullati restano nell'Inbox per un breve periodo di controllo; trascorso il periodo di
conservazione vengono spostati in un archivio annuale.

L'archiviazione deve rispettare i vincoli esistenti:

- una riga Markdown resta la fonte di verita del task;
- ogni spostamento copia prima e rimuove dopo;
- un errore puo lasciare un duplicato, ma non deve perdere un task;
- percorsi personalizzati dell'Inbox non vengono aggirati;
- le note Dettagli non vengono eliminate automaticamente.

## Alternative considerate

### Archiviazione immediata

Mantiene l'Inbox minimale, ma rende piu difficile controllare o riaprire un task appena
completato per errore.

### Pulizia soltanto manuale

Evita qualsiasi automatismo, ma lascia crescere il file proprio negli usi piu intensi e
trasforma la manutenzione in un'attivita ricorrente dell'utente.

### Conservazione breve e archivio opportunistico — scelta

I task restano sette giorni nell'Inbox e vengono poi archiviati quando Kairos e attivo.
Questa soluzione conserva una cronologia recente senza richiedere un processo in
background e senza far crescere indefinitamente il file operativo.

## Configurazione

La funzione e disattivata per impostazione predefinita, perche un aggiornamento del
plugin non deve spostare righe senza una scelta esplicita dell'utente.

Le impostazioni aggiunte sono:

- `autoArchiveCompleted`: abilita l'archiviazione opportunistica;
- `completedRetentionDays`: giorni di permanenza nell'Inbox, valore iniziale 7.

La cartella di archivio deriva dalla cartella dell'Inbox configurata. Per esempio, con
`_Tasks/Inbox.md` Kairos usa `_Tasks/Archivio/`. Non viene introdotto un secondo percorso
indipendente che possa divergere dall'Inbox.

L'attivazione mostra un'anteprima con numero di task idonei e destinazione. Soltanto la
conferma abilita l'automatismo ed esegue la prima archiviazione. Un comando separato
`Kairos: controlla archivio Inbox` permette di mostrare la stessa anteprima ed eseguire
la manutenzione su richiesta.

## Regole di idoneita

Un task viene archiviato solo quando tutte le condizioni seguenti sono vere:

1. vive esattamente nel file Inbox configurato;
2. ha stato `done` oppure `cancelled`;
3. contiene il marcatore coerente `✅ YYYY-MM-DD` oppure `❌ YYYY-MM-DD`;
4. la data del marcatore e precedente o uguale a `oggi - retentionDays`;
5. la data e valida.

Un task completato o annullato senza data resta nell'Inbox e viene segnalato
nell'anteprima come non archiviabile. Kairos non deduce la data dalla modifica del file.
I task aperti e in corso non sono mai idonei.

Le occorrenze ricorrenti completate seguono le stesse regole. La nuova occorrenza aperta
resta nell'Inbox; l'occorrenza storica puo essere archiviata dopo il periodo previsto.

## Formato dell'archivio

Ogni anno usa un file separato:

```text
<cartella Inbox>/Archivio/2026.md
```

Il file contiene un titolo e sezioni mensili italiane:

```markdown
# Archivio task 2026

## Agosto

- [x] Esempio ✅ 2026-08-03 ^kairos-id
```

Le righe sono raggruppate usando la data di completamento o annullamento e ordinate con
le piu recenti in alto nella rispettiva sezione. La riga conserva testo, date, priorita,
tag, ricorrenza e collegamenti.

Prima dello spostamento Kairos assicura che la riga abbia un block ID stabile. Se manca,
ne aggiunge uno usando lo stesso formato gia impiegato dalle note Dettagli. Questo rende
lo spostamento idempotente e permette di distinguere task con testo identico.

## Spostamento sicuro

Per ogni task idoneo Kairos esegue in sequenza:

1. localizza nuovamente la riga tramite sorgente e posizione attesa;
2. aggiunge un block ID se manca e salva l'Inbox;
3. inserisce la riga identificata nel file annuale corretto;
4. rilegge l'archivio e verifica la presenza esatta del block ID;
5. rilegge l'Inbox e rimuove la riga identificata;
6. lascia che gli eventi del vault aggiornino l'indice e le viste.

Una sola manutenzione puo essere in corso. Le notifiche prodotte dalle scritture non
avviano un secondo ciclo. Se il block ID e gia presente nell'archivio, Kairos non crea
una seconda copia e prova soltanto a completare la rimozione dall'Inbox. Se una verifica
fallisce, la sorgente non viene rimossa e l'errore viene mostrato all'utente.

Un batch continua con gli altri task quando un elemento fallisce e presenta alla fine
il totale archiviato e il numero di errori. Nessun errore viene ignorato in silenzio.

## Quando viene eseguita la manutenzione

Kairos non usa un demone, notifiche di sistema o lavoro con Obsidian chiuso.

Quando l'opzione e attiva, il controllo viene richiesto:

- dopo la costruzione iniziale dell'indice;
- al primo aggiornamento dell'indice in un nuovo giorno di calendario;
- quando l'utente esegue il comando manuale.

Il controllo automatico viene eseguito al massimo una volta per giorno e soltanto quando
Obsidian e Kairos sono attivi. Dopo un lungo periodo con Obsidian chiuso, il lavoro
arretrato viene recuperato al successivo avvio.

## Riapertura di un task archiviato

I file di archivio restano indicizzati, quindi la vista Completati conserva l'intera
cronologia. Se un task archiviato passa da `done` o `cancelled` a `open` o `inProgress`,
Kairos non lo lascia nell'archivio:

1. costruisce la nuova riga con lo stato richiesto e rimuove il marcatore storico;
2. la inserisce prima nell'Inbox configurata;
3. verifica il block ID nell'Inbox;
4. rimuove poi la vecchia riga dall'archivio.

La regola si applica sia alla checkbox sia all'editor. Un errore conserva la copia
archiviata e segnala il problema; non elimina mai l'unica riga esistente.

## Note Dettagli

L'archiviazione sposta soltanto la riga task. Il wikilink `Dettagli` continua a puntare
allo stesso file e la nota rimane nella cartella Dettagli corrente.

Kairos non elimina e non sposta automaticamente una nota Dettagli perche:

- puo contenere conoscenza o appunti utili oltre il ciclo del task;
- piu task possono collegarsi alla stessa nota;
- un collegamento puo essere stato scritto o modificato manualmente.

Un futuro comando `Kairos: verifica note Dettagli` potra classificare note collegate,
condivise e orfane. Anche in quel flusso l'eliminazione dovra richiedere una selezione e
usare il cestino di Obsidian. Questo audit non fa parte dell'implementazione corrente.

## Componenti

### Core puro

Un nuovo modulo puro gestisce:

- calcolo della soglia temporale;
- selezione dei task idonei;
- percorso annuale derivato dall'Inbox;
- inserimento idempotente nelle sezioni mensili;
- riconoscimento dei file di archivio;
- aggiunta o riuso del block ID.

### Servizio Obsidian

Un servizio di archiviazione orchestra letture, scritture, verifiche e lock del batch.
`TaskWriter` continua a essere l'unica porta per mutare righe e riusa il servizio quando
un task archiviato viene riaperto.

### Impostazioni e comandi

La scheda impostazioni contiene toggle, giorni di conservazione, destinazione calcolata
e azione di anteprima. Il comando manuale usa la stessa analisi e lo stesso servizio,
senza un secondo percorso logico.

## Test

### Test puri

- soglia di sette giorni, inclusione del giorno limite e cambio anno;
- esclusione di aperti, in corso, date mancanti e date non valide;
- distinzione tra completati e annullati;
- derivazione dell'archivio da Inbox in radice o sottocartella;
- creazione del file annuale e delle sezioni mensili;
- inserimento ordinato e idempotente tramite block ID;
- conservazione lossless della sintassi non gestita e dei link Dettagli.

### Test del writer e del servizio

- copia verificata prima della rimozione;
- errore di scrittura nell'archivio lascia intatta l'Inbox;
- errore di rimozione lascia una copia recuperabile senza duplicarla al giro successivo;
- batch parzialmente fallito continua e riporta i conteggi;
- lock contro esecuzioni sovrapposte;
- riapertura da archivio reinserisce prima nell'Inbox;
- task con Dettagli conserva il collegamento senza toccare il file collegato.

### Verifica manuale

- anteprima della prima attivazione su desktop;
- archiviazione e vista Completati su desktop e mobile;
- riapertura di un task archiviato;
- riavvio di Obsidian senza nuove copie;
- conferma che nessuna nota Dettagli venga spostata o eliminata.

## Fuori scope

- cancellazione automatica di task o note Dettagli;
- compattazione o eliminazione dello storico annuale;
- processo in background con Obsidian chiuso;
- sincronizzazione cloud separata da quella del vault;
- archiviazione di task completati nelle note progetto o nelle daily;
- audit e pulizia interattiva delle note Dettagli.
