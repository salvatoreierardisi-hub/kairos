# Rapporto prestazioni Kairos — 2026-08-10

## Risultato

I benchmark hanno individuato due colli di bottiglia dominanti e confermato il
miglioramento dopo gli interventi:

- la costruzione iniziale dell'indice passa da una mediana di **64,452 ms** a
  **0,114–0,115 ms** su 2.000 file e 10.000 task: riduzione del **99,82%**;
- la costruzione del catalogo dei riferimenti passa da **19,781 ms** a
  **0,604–0,609 ms** su 5.000 note e 1.000 cartelle: riduzione del
  **96,92–96,95%**.

Il replace di un singolo file, parser e query non mostrano regressioni oltre il 10%.
Un esperimento sulla query testuale ha prodotto un miglioramento del 15% ed è stato
rimosso perché inferiore alla soglia del 20% stabilita nella specifica.

## Ambiente e metodo

- piattaforma: macOS Darwin arm64;
- Node.js: 26.0.0;
- Vitest Benchmark: 4.1.10, basato su Tinybench 2.9.0;
- warm-up per scenario: 200 ms;
- raccolta per scenario: almeno 800 ms;
- dataset generati deterministicamente, senza leggere il vault personale;
- baseline: implementazione precedente agli interventi;
- finale: due esecuzioni consecutive nelle stesse condizioni.

Il comando ripetibile è:

```bash
npm run benchmark
```

I risultati JSON grezzi usati per il confronto sono conservati soltanto nel contesto
locale di sviluppo, escluso dalla repository pubblica. Il rapporto contiene i valori
necessari a ripetere e verificare il confronto.

## Confronto prima-dopo

I tempi sono in millisecondi. L'intervallo finale contiene le due esecuzioni finali.

| Scenario | Mediana prima | Mediana dopo | p99 prima | p99 dopo | Esito |
|---|---:|---:|---:|---:|---|
| Indice iniziale, 2.000 file / 10.000 task | 64,452 | 0,114–0,115 | 69,360 | 0,185 | −99,82% |
| Catalogo `@`, 5.000 note / 1.000 cartelle | 19,781 | 0,604–0,609 | 50,369 | 0,669–0,837 | −96,92–96,95% |
| Parser, 500 note / 10.000 task | 11,614 | 10,861–10,941 | 27,037 | 11,251–11,441 | stabile; nessun intervento |
| Query testuale e gruppi, 10.000 task | 9,300 | 9,125–9,436 | 11,336 | 9,529–10,090 | stabile; nessun intervento |
| Query strutturata e agenda, 10.000 task | 0,330 | 0,323–0,340 | 0,507 | 0,399–0,454 | stabile; nessun intervento |
| Replace modificato + snapshot, 10.000 task | 0,061 | 0,056–0,058 | 0,095 | 0,076–0,082 | stabile |
| Replace invariato | 0,000041 | 0,000041 | 0,000042 | 0,000042 | invariato |

Il throughput medio dell'indice iniziale cresce da circa 15 a 8.568 operazioni al
secondo nella prima esecuzione finale (**560×**). Il catalogo cresce da circa 45 a
1.642 operazioni al secondo (**36,8×**). Questi rapporti usano la media del runner;
la tabella usa la mediana, meno sensibile agli outlier.

## Colli di bottiglia e interventi

### Ricostruzione ripetuta dello snapshot

`TaskIndexCore.replace()` appiattiva tutti i bucket dopo ogni file. Durante una build da
2.000 file lo snapshot completo veniva quindi ricostruito 2.000 volte. Ora ogni replace
invalida lo snapshot e `getAll()` lo ricostruisce soltanto alla prima lettura. La build
continua a notificare le viste una sola volta alla fine, quindi esegue un solo flatten.

Lo snapshot conserva ordine, replace invariato, delete, clear e identità stabile tra due
letture senza modifiche. Il costo del replace incrementale non aumenta.

### Scansione file per ogni cartella

Il catalogo `@` cercava gli `_indice-*` diretti filtrando tutti i file per ciascuna
cartella. Il nuovo core puro costruisce una mappa degli indici diretti in un singolo
passaggio, portando la costruzione da andamento file × cartelle a andamento lineare.

Il composer conserva inoltre il catalogo durante la digitazione. Gli eventi strutturali
`create`, `delete` e `rename` lo invalidano; alla chiusura vengono rimossi i listener.
Ordinamento, disambiguazione, limite di otto elementi e risoluzione dell'indice univoco
restano invariati.

## Esperimento scartato

Il testo della query veniva normalizzato una volta per task. Precalcolare i termini una
sola volta per `groupTasks()` ha ridotto la mediana da 9,386 a 8,164 ms nel passaggio
sperimentale, pari a circa il 15%. Poiché non raggiungeva il 20% concordato, la modifica
è stata rimossa e non fa parte dell'implementazione finale.

## Verifica funzionale

- benchmark: completati con output equivalente sui dataset;
- test: 182 test verdi su 27 file;
- type-check: pulito;
- build di produzione: completata;
- `git diff --check`: pulito.

## Limiti

La suite misura la logica TypeScript e non il tempo di lettura fisica dei file, che è
gestito da Obsidian. Il rendering DOM non è risultato il primo collo di bottiglia dopo
il profiling della logica e non è stato reso più complesso senza evidenza.

La build è stata distribuita nel vault e i tre artefatti sono stati confrontati byte per
byte. Dopo il reload, Kairos e i task sono tornati visibili e il passaggio
Oggi → Tutti → Oggi ha aggiornato correttamente i risultati. La verifica manuale ha
confermato sia i suggerimenti dopo `@Pro` nel composer sia l'apertura dell'editor di un
task. La prova reale è quindi completata; non è stata usata per produrre i numeri sopra
e resta separata dal confronto automatico.
