# Salva e apri per i task esistenti

## Obiettivo

Consentire di trasformare un task esistente in un task con nota di approfondimento
senza duplicarlo. Nell'editor di modifica, lo split button `Salva` offre anche l'azione
`Salva e apri`, coerente con `Crea e apri` disponibile durante la creazione.

## Esperienza utente

- Il pulsante principale `Salva` conserva il comportamento attuale.
- La freccia laterale apre un menu con `Salva` e `Salva e apri`.
- `Salva e apri` salva testo, stato, scadenza, data pianificata e priorità.
- Se il task possiede già un collegamento `Dettagli`, Kairos apre la nota collegata.
- Se il collegamento non esiste, Kairos crea una nota nella cartella `Dettagli`,
  aggiunge link e block ID alla stessa riga Markdown e apre la nuova nota.
- Il task resta nella nota sorgente e nella stessa posizione; non viene creato un
  secondo task.
- La scorciatoia `Cmd/Ctrl+Invio` continua a eseguire il salvataggio semplice.

## Scrittura e consistenza

`QuickAddModal` restituisce la modalità scelta anche durante la modifica. Il plugin
instrada il salvataggio semplice verso `TaskWriter.updateTask` e quello con apertura
verso una nuova operazione di `TaskWriter` dedicata al collegamento dei Dettagli.

Per un task privo di Dettagli, il writer:

1. valida e prepara la riga aggiornata;
2. sceglie un percorso libero e un block ID, riusando quello esistente se presente;
3. crea la nota Dettagli con il backlink alla riga sorgente;
4. aggiorna in posto la riga del task aggiungendo link e block ID;
5. restituisce la nota da aprire.

Se l'aggiornamento della riga fallisce dopo la creazione della nota, la nuova nota viene
spostata nel cestino per evitare un file orfano e l'errore viene propagato. Se il task è
già collegato, il writer aggiorna soltanto la riga e restituisce la nota esistente; un
collegamento che punta a un file mancante produce un errore esplicito e non crea una
seconda nota con un'identità diversa.

## Componenti

- `QuickAddModal`: mostra lo split button anche in modifica e usa etichette coerenti
  con il contesto (`Salva`, `Salva e apri`).
- `taskSyntax` / `updateLine`: aggiunge link Dettagli e block ID preservando sintassi,
  marcatori e token non gestiti già presenti sulla riga.
- `TaskWriter`: coordina aggiornamento, creazione della nota e compensazione in caso di
  errore.
- `main`: dopo il salvataggio apre la nota Dettagli restituita dal writer.

## Errori e concorrenza

La localizzazione della riga continua a usare sorgente e posizione attese, con il
fallback univoco già adottato da Kairos. Un conflitto, un file mancante o un errore di
scrittura lascia il task originale recuperabile. L'editor resta aperto quando
l'operazione fallisce e mostra la notifica esistente.

## Verifica

- Test puro per l'aggiunta conservativa di link Dettagli e block ID.
- Test del writer per task senza Dettagli, task già collegato e rollback quando
  l'aggiornamento della riga fallisce.
- Verifica manuale dello split button su desktop e mobile.
- Suite Vitest, type-check e build completi.
