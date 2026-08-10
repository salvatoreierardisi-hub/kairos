# Piano di implementazione — Prestazioni di Kairos

Spec: `docs/superpowers/specs/2026-08-10-performance-optimization-design.md`

## 1. Infrastruttura benchmark

- Aggiungere generatori deterministici per note, task, file e cartelle sintetici.
- Configurare Vitest Benchmark con un comando `npm run benchmark` e output JSON.
- Coprire parser, costruzione iniziale dell'indice, replace invariato e modificato,
  query strutturate/testuali e costruzione dei riferimenti.
- Salvare la baseline prima di cambiare gli algoritmi e annotare runtime e dataset.

## 2. Profiling e selezione

- Eseguire più passate della baseline nelle stesse condizioni.
- Confrontare mediana, p99 e throughput; distinguere rumore da costi dominanti.
- Ordinare gli interventi in base al costo misurato e alla frequenza nel flusso reale.

## 3. Indice

- Evitare la ricostruzione dello snapshot per ogni file durante il caricamento.
- Conservare replace invariato, ordine dello snapshot e notifiche esistenti.
- Aggiungere test per snapshot lazy/batch, invalidazione e isolamento dai consumer.
- Rimisurare indicizzazione e modifica singola prima di mantenere l'intervento.

## 4. Riferimenti contestuali

- Estrarre la costruzione algoritmica dei candidati in una funzione pura testabile.
- Indicizzare gli `_indice-*` diretti per cartella in un solo passaggio.
- Riutilizzare il catalogo durante la digitazione e invalidarlo sugli eventi strutturali.
- Preservare disambiguazione, ordinamento, limite e comportamento file/cartella.
- Rimisurare catalogo e ricerca prima di mantenere l'intervento.

## 5. Query e rendering

- Profilare filtro, normalizzazione, ordinamento e raggruppamento su 10.000 task.
- Introdurre caching soltanto se il costo e dominante e l'invalidazione resta chiara.
- Verificare in Obsidian se il pannello ricostruisce DOM inutilmente dopo gli interventi.
- Aggiungere una firma visibile solo se la prova reale o un test mirato ne dimostra il
  beneficio; evitare una riconciliazione DOM complessa senza evidenza.

## 6. Rapporto e chiusura

- Rieseguire gli stessi benchmark e produrre confronto prima-dopo per scenario.
- Rimuovere modifiche che non raggiungono i criteri della specifica.
- Eseguire `npm test`, `npx tsc --noEmit`, `npm run build` e `git diff --check`.
- Non distribuire nel vault, committare o pubblicare l'implementazione senza un controllo
  esplicito finale dello scope.
