# Nodo Analisi Documenti 📄

## Che cos'è il Nodo Analisi Documenti?

Il Nodo Analisi Documenti è il vostro "ingresso" in Magic Flow per elaborare vari tipi di file e fonti dati, è come un lettore intelligente che può leggere e comprendere contenuti di documenti in diversi formati, convertendo file originali in dati di testo che i nodi successivi possono elaborare. Che si tratti di PDF, file WORD caricati localmente, o contenuti web online, il Nodo Analisi Documenti può aiutarvi a estrarre informazioni preziose.

**Spiegazione Immagine:**

L'interfaccia del Nodo Analisi Documenti è composta principalmente da aree di "Nome Visualizzato", "Aggiungi Parametro", "Valore Parametro" e impostazioni "Espressione". Gli utenti possono configurare qui parametri come fonte dati, tipo file e modalità di analisi.
![Nodo Analisi Documenti](https://cdn.letsmagic.cn/static/img/Document-parsing.png)

## Perché serve il Nodo Analisi Documenti?

Nella costruzione di applicazioni AI, spesso abbiamo bisogno di elaborare documenti e dati in vari formati. Il Nodo Analisi Documenti risolve i seguenti problemi:
1. **Conversione Formato**: Convertire documenti in vari formati (PDF, DOCX, pagine web, ecc.) in formato testo standard, facilitando l'elaborazione successiva
2. **Estrazione Contenuto**: Estrarre contenuti testuali preziosi da file complessi
3. **Ingresso Unificato**: Fornire un ingresso di elaborazione unificato per dati da diverse fonti (file locali, contenuti web, database, ecc.)
4. **Pre-elaborazione**: Effettuare pulizia e formattazione preliminare dei dati originali, migliorare la qualità dell'analisi successiva

Attraverso il Nodo Analisi Documenti, è possibile convertire facilmente dati da varie fonti in forma testuale comprensibile per i modelli grandi, è un componente essenziale per costruire applicazioni di question-answering basato su conoscenza, analisi documenti.

## Scenari di Applicazione

### Scenario 1: Sistema Question-Answering Basato su Conoscenza

Importare e analizzare documenti interni aziendali, manuali prodotto, materiali di formazione, ecc., combinandoli con nodi di modello grande per costruire sistemi di question-answering basati su conoscenza aziendale, aiutare i dipendenti a ottenere rapidamente le informazioni necessarie.

### Scenario 2: Analisi Contenuto Web

Analizzare il contenuto di pagine web specifiche, estrarre informazioni chiave, per analisi di mercato, monitoraggio concorrenti o riepilogo informazioni.

### Scenario 3: Elaborazione Intelligente Documenti

Analizzare in batch documenti presentati dai clienti (come CV, moduli di richiesta, ecc.), estrarre informazioni chiave ed effettuare elaborazione e classificazione automatizzate.

## Spiegazione Parametri del Nodo

### Parametri di Input

Il Nodo Analisi Documenti ha principalmente i seguenti parametri di input:
|Nome Parametro|Spiegazione|Obbligatorio|Valore Default|
|---|---|---|---|
|Lista File|Lista dei file da analizzare, può essere file caricati localmente, URL di rete o riferimento variabile|Sì|Nessuno|

### Variabili di Output

Il Nodo Analisi Documenti emetterà le seguenti variabili, utilizzabili nei nodi successivi:
|Nome Variabile|Spiegazione|Valore Esempio|
|---|---|---|
|Tutto il Contenuto (content)|Contenuto testuale analizzato|"Questo è un manuale prodotto, contiene le seguenti caratteristiche..."|
|File (file_info)|Informazioni base del file, inclusi nome file, indirizzo file, contenuto, tipo, ecc.|`{"name": "Manuale_prodotto.pdf", "size": 1024, "type": "application/pdf"}`|

## Istruzioni per l'Uso

### Passi di Configurazione Base

1. **Aggiungere Nodo Analisi Documenti**
2. **Configurare Fonte File**
    1. Selezionare "Caricamento File" per caricare file locali
    2. Selezionare "URL Rete" per inserire indirizzo web
    3. Selezionare "Variabile" per utilizzare dati file emessi da nodi precedenti
3. **Connettere Nodi Downstream**
Connettere l'output del nodo analisi documenti a nodi di elaborazione successivi, come nodo segmentazione testo, nodo chiamata modello grande, ecc.

### Tecniche Avanzate

1. **Elaborazione File in Batch**
2. **Analisi URL Dinamica**
3. **Combinazione con Nodo Ciclo**
4. **Analisi Condizionale**

## Note Importanti

### Limitazione Dimensione File

La piattaforma Magic Flow ha limitazioni di dimensione per i file caricati, solitamente non superiori a 50MB. Per file più grandi, si consiglia di dividerli prima del caricamento o utilizzare il metodo URL per l'introduzione.

### Supporto Formati File

Sebbene il Nodo Analisi Documenti supporti molteplici formati, l'effetto di analisi può differire per formati diversi:
- Documenti PDF: Supporta estrazione testo e riconoscimento tabelle
- Documenti Word: Supporta estrazione testo completo e formati
- Contenuti Web: Supporta analisi HTML, ma contenuti con rendering JavaScript complesso potrebbero non essere completamente acquisibili
- File Immagine: Necessitano estrazione testo tramite OCR, l'accuratezza è influenzata dalla qualità dell'immagine

### Accesso Risorse di Rete

Quando si analizza contenuto web tramite URL, assicurarsi che:
- L'URL sia accessibile pubblicamente
- Il contenuto non richieda autenticazione di login
- La risorsa non violi copyright e leggi

### Considerazioni Prestazionali

L'analisi di documenti di grandi dimensioni o formati complessi potrebbe richiedere tempo relativamente lungo, si consiglia:
- Impostare appropriatamente il tempo di timeout
- Pre-elaborare o dividere documenti di grandi dimensioni
- Evitare di analizzare troppi file in un singolo flusso

## Domande Frequenti

### Problema 1: Analisi documento fallita o contenuto mancante

**Possibili Cause**: Formato file incompatibile, file danneggiato o criptato, fallimento riconoscimento OCR
**Soluzioni**:
- Verificare se il file può essere aperto normalmente
- Provare a convertire il file in formato più universale (come PDF a TXT)
- Per documenti criptati, rimuovere prima la crittografia poi ricaricare
- Migliorare la qualità dell'immagine o regolare parametri OCR

### Problema 2: Tempo di analisi troppo lungo

**Possibili Cause**: File troppo grande, formato complesso, caricamento risorse di rete lento
**Soluzioni**:
- Dividere documenti di grandi dimensioni in molteplici file più piccoli
- Aumentare l'impostazione del tempo di timeout
- Per risorse di rete, è possibile scaricarle prima localmente poi caricarle per l'analisi
- Semplificare il flusso di elaborazione, estrarre solo contenuti necessari

### Problema 3: Formati speciali non analizzabili

**Possibili Cause**: Formati non standard, formati di nuova versione, formati software professionale
**Soluzioni**:
- Convertire il file in formato standard prima del caricamento
- Utilizzare software professionale per esportare in formato compatibile
- Combinare con nodo codice per logica di analisi personalizzata
- Contattare il team di supporto della piattaforma per assistenza tecnica

## Nodi di Combinazione Comuni

Il Nodo Analisi Documenti solitamente si combina con i seguenti nodi:
1. **Nodo Segmentazione Testo**: Tagliare il testo lungo analizzato in frammenti adatti all'elaborazione del modello grande
2. **Nodo Memorizzazione Vettori**: Convertire il contenuto del documento analizzato in vettori e memorizzarli, per ricerche di similarità successive
3. **Nodo Chiamata Modello Grande**: Utilizzare il modello grande per analizzare, riassumere o rispondere al contenuto analizzato
4. **Nodo Codice**: Effettuare elaborazione e conversione personalizzate sui risultati di analisi
5. **Nodo Condizionale**: Secondo diverse caratteristiche dei risultati di analisi, scegliere percorsi di elaborazione diversi