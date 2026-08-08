# Riparazione delle note Dettagli mancanti

## Problema

Quando una nota Dettagli viene eliminata fuori da Kairos, la riga del task conserva il
wikilink e il block ID. Il pannello mostra quindi un collegamento che non può essere
aperto e `Salva e apri` interrompe l'operazione con un errore.

## Comportamento

- Un collegamento valido continua a essere mostrato come `Dettagli` e apre la nota.
- Se il percorso collegato non contiene più un file Markdown, la pill non viene
  mostrata: il pannello non espone collegamenti morti.
- `Salva e apri` applica la stessa riparazione mentre salva le modifiche dell'editor.
- La riga del task non viene duplicata e il collegamento Markdown esistente resta
  invariato.
- Errori di creazione o apertura producono una notifica e non eliminano il task.

## Scrittura

`TaskWriter.updateTaskWithDetail` distingue tre casi:

1. nota esistente: aggiorna il task e restituisce il file;
2. link esistente ma file mancante: ricrea esattamente il percorso collegato, aggiorna
   il task e restituisce il nuovo file;
3. task mai collegato: sceglie un percorso libero, crea identità e nota come nel flusso
   già implementato.

Il riferimento resta nella riga Markdown: se la nota viene ripristinata dal cestino, il
collegamento torna disponibile; se viene usato `Salva e apri`, il percorso può essere
ricreato senza produrre una seconda identità. Una scrittura fallita viene compensata
spostando nel cestino la nota appena creata.

## Interfaccia e aggiornamento

`TaskPanel` verifica il percorso tramite il vault e costruisce la pill soltanto quando
il file esiste. Gli eventi del vault aggiornano già l'indice e provocano il rendering
del pannello, quindi la pill sparisce dopo l'eliminazione e torna automaticamente a
`Dettagli` dopo un ripristino o una ricreazione.

## Verifica

- Test del writer per la riparazione tramite `Salva e apri`.
- Test del writer per il riuso del percorso e del block ID.
- Test di rollback quando l'aggiornamento della riga fallisce.
- Suite Vitest, type-check, build e distribuzione verificata nel vault locale.
