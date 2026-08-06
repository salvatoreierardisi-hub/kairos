# Rifinitura del pannello task desktop e mobile

Data: 2026-08-06
Stato: approvato

## Obiettivo

Rendere il pannello task più ordinato, leggibile e affidabile al tocco, conservando il
drawer destro attuale su mobile e la stessa superficie `TaskPanel` condivisa con la
vista desktop. La riga deve distinguere chiaramente testo, scadenza leggibile,
scadenza esatta e nota sorgente, senza cambiare il modello dati o la collocazione
fisica dei task.

## Vincoli

- Il task continua a vivere in una sola riga Markdown e nella sua casa stabile.
- Assegnare o cambiare una data non sposta la riga sorgente.
- La pill relativa accanto al titolo (`Oggi`, `Domani`, giorno breve o data breve)
  rimane visibile.
- Il pannello mobile continua ad aprirsi nella sidebar destra di Obsidian.
- Sidebar e vista piena continuano a usare lo stesso componente e lo stesso stato.
- Nessuna azione essenziale dipende soltanto dall'hover.

## Struttura del pannello

Il DOM dell'intestazione mantiene gli stessi controlli, ma il layout responsive li
dispone in modo stabile:

1. ricerca flessibile, pulsante `+` e menu generale `…`;
2. segmenti `Inbox`, `Oggi`, `Prossimi`, `Tutti`, centrati e di uguale larghezza;
3. filtri a sinistra e ordinamento/raggruppamento a destra.

Su mobile ricerca e controlli interattivi hanno un'altezza minima di 44 px. Il `+` usa
il colore accentato ed è riconoscibile anche senza etichetta testuale. I controlli
forniscono un feedback breve alla pressione e non mantengono uno stato hover dopo il
tap.

## Struttura della riga task

Ogni riga usa tre colonne stabili:

- controllo di stato con area touch da almeno 44 × 44 px;
- contenuto flessibile, con testo e metadati;
- menu `…` con area touch da almeno 44 × 44 px.

Il menu della riga è sempre visibile su mobile e resta a comparsa su desktop. Il testo
può andare a capo senza spostare i controlli laterali. La checkbox è disegnata in CSS
all'interno del proprio target touch, così mantiene forma e contrasto uniformi nei
quattro stati:

- aperto: quadrato vuoto;
- in corso: quadrato con indicatore accentato;
- completato: quadrato pieno con spunta;
- annullato: quadrato barrato.

Il tap sulla checkbox cambia stato, il tap sul testo apre l'editor e il tap su `…` apre
il menu azioni. Questi eventi non devono propagarsi alla riga.

## Date e posizione

La riga conserva due rappresentazioni complementari della stessa scadenza:

- accanto al titolo, la pill relativa già esistente (`Oggi`, `Domani`, ecc.);
- nei metadati, la data ISO esatta seguita dalla nota sorgente, per esempio
  `• 2026-08-06  Inbox`.

La data esatta rappresenta il giorno della proiezione daily. La nota sorgente continua
a rappresentare la posizione fisica della riga e resta un controllo separato che apre
il file alla riga del task. Il punto usa il colore semantico della scadenza; una data
arretrata usa il colore di errore.

Se il task non ha data, il controllo della data esatta non viene mostrato e la nota
sorgente mantiene il proprio comportamento. La data viene mostrata nei metadati anche
quando la vista corrente nasconde la nota perché il raggruppamento la rende già
evidente.

## Rischedulazione

Il controllo della data esatta apre un solo menu condiviso con queste alternative:

- Oggi;
- Domani;
- Prossima settimana;
- Scegli data…;
- Rimuovi data.

Su desktop il controllo mostra, dopo una breve attesa, il suggerimento
`Due click per rischedulare`; il doppio click apre il menu. Il singolo click non cambia
la data e non apre l'editor della riga. Su mobile un singolo tap apre direttamente il
menu, poiché hover e doppio click non sono interazioni affidabili.

`Scegli data…` usa il selettore di data già compatibile con Obsidian. Tutte le scelte
passano da `TaskWriter.setDue`, quindi mantengono la validazione della riga sorgente e
il normale aggiornamento dell'indice. Un errore produce una `Notice` e lascia visibile
lo stato precedente fino al successivo aggiornamento valido.

## Accessibilità e comportamento responsive

- Data, checkbox, `+`, menu e controlli filtro hanno etichette accessibili.
- Il controllo data è raggiungibile da tastiera; `Enter` e `Spazio` aprono il menu.
- Le regole hover sono racchiuse in `@media (hover: hover)` per i controlli disponibili
  anche su telefono.
- Il feedback alla pressione rispetta `prefers-reduced-motion`.
- Il drawer non introduce una toolbar flottante né una seconda implementazione mobile.

## Modifiche previste

- `src/view/TaskPanel.ts`: checkbox CSS, controllo data esatta, menu di
  rischedulazione condiviso e gestione distinta di mouse, touch e tastiera.
- `styles.css`: layout responsive dell'intestazione e delle righe, target touch,
  checkbox, metadati e stati interattivi.
- Test mirati per eventuali helper puri estratti durante l'implementazione; nessun test
  deve dipendere dal DOM interno di Obsidian.

## Verifica

La modifica è completata quando:

1. `npm test`, `npx tsc --noEmit` e `npm run build` sono puliti;
2. la pill relativa non scompare quando compare la data ISO nei metadati;
3. data e nota sorgente eseguono azioni distinte;
4. su desktop il menu data si apre con doppio click e da tastiera;
5. su mobile data, checkbox, `+` e `…` hanno target da almeno 44 px e il menu `…` è
   sempre visibile;
6. testo su più righe e metadati non disallineano i controlli laterali;
7. la prova manuale conferma la resa nel drawer destro su desktop e iPhone.

La prova reale su iPhone resta un controllo manuale successivo al deploy locale; non è
sostituita dalla sola verifica automatica.
