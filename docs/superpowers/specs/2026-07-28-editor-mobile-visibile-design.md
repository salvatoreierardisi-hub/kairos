# Editor mobile sempre visibile

## Contesto

Su iPhone, l’apertura dell’editor porta subito il focus nella textarea e mostra la
tastiera. Il WebView di Obsidian non riduce però il viewport CSS: il foglio resta
posizionato a `28dvh`, la sua parte centrale viene coperta e il testo digitato diventa
visibile soltanto dopo uno scorrimento manuale.

## Obiettivo

Quando si tocca `+`, destinazione, campo di testo, Programma, Priorità e azione Crea
devono essere visibili insieme sopra la tastiera. Il cursore deve restare subito attivo
nel campo, senza richiedere scorrimenti.

## Design approvato

Si mantiene l’editor esistente e si modifica soltanto il layout attivato dalla classe
affidabile `.is-mobile` di Obsidian:

- il foglio viene ancorato nella parte alta dello schermo, circa al `14dvh`, rispettando
  la safe area superiore;
- altezza massima, padding e campo di testo vengono compattati senza ridurre i controlli
  sotto una dimensione touch utilizzabile;
- Programma e Priorità restano affiancati e Crea conserva una riga dedicata;
- il contenuto interno resta scorrevole come fallback per schermi molto bassi o per
  l’editor di modifica, che include anche Stato;
- il testo, il placeholder e il cursore conservano gli override espliciti necessari al
  WebView iOS.

Non vengono modificati struttura dei dati, scrittura dei task, menu, focus automatico
o layout desktop.

## Alternative escluse

- Un foglio ampio fissato ancora più in alto offrirebbe più spazio per testi lunghi, ma
  coprirebbe una parte maggiore di Kairos.
- Una barra compatta sopra la tastiera sarebbe più rapida, ma cambierebbe sensibilmente
  l’aspetto e la gerarchia dell’editor.

## Verifica

- Confermare che gli override desktop e le media query non cambino comportamento.
- Eseguire `npm test`, `npx tsc --noEmit` e `npm run build`.
- Provare manualmente su iPhone dopo il reload del plugin: aprire `+`, verificare che
  l’intero editor sia visibile senza scorrere e digitare un testo abbastanza lungo da
  controllare crescita e scorrimento della textarea.

La prova reale della tastiera iOS resta manuale perché il WebView di Obsidian non è
riproducibile dai test automatici del repository.
