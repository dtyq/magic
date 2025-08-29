# Nodo Caricamento Dati 📊

## Che cos'è il Nodo Caricamento Dati?

Il Nodo Caricamento Dati è uno strumento utilizzato per leggere dati precedentemente memorizzati da un database persistente. È come un intelligente ricercatore che, secondo la "chiave dati" fornita dall'utente, può rapidamente trovare e estrarre le informazioni precedentemente salvate nel database persistente, per l'utilizzo da parte di altri nodi nel flusso di lavoro.

**Spiegazione Immagine:**

L'interfaccia del Nodo Caricamento Dati è composta principalmente dall'area delle condizioni di query, inclusi elementi chiave come la selezione dell'ambito, la casella di input della chiave dati, ecc. Gli utenti possono recuperare dati precedentemente memorizzati nel database persistente configurando questi parametri.
![Nodo Caricamento Dati](https://cdn.letsmagic.cn/static/img/Data-loading.png)

## Perché serve il Nodo Caricamento Dati?

**Nei flussi di lavoro intelligenti, spesso è necessario trasferire e utilizzare dati tra diversi momenti o diverse sessioni. Ad esempio:**
- Ricordare le preferenze dell'utente, utilizzarle direttamente nella prossima conversazione
- Memorizzare informazioni chiave dell'ultima interazione, per l'elaborazione successiva
- Salvare dati aziendali, permettendo il recupero in qualsiasi momento futuro

Il Nodo Caricamento Dati è progettato proprio per soddisfare questa esigenza, permette di recuperare convenientemente qualsiasi informazione precedentemente memorizzata, stabilendo la capacità di "memoria a lungo termine" del flusso di lavoro, facendo sì che l'assistente AI abbia capacità di accesso ai dati persistenti.

## Scenari di Applicazione

Il Nodo Caricamento Dati è applicabile nei seguenti scenari:
1. **Memoria Impostazioni Utente**: Leggere informazioni sulle preferenze dell'utente, abitudini d'uso, ecc., fornire servizi personalizzati
2. **Continuità Processo Aziendale**: Mantenere la continuità aziendale tra molteplici conversazioni, come leggere informazioni di ordini incompleti dalla volta precedente
3. **Ricerca Conoscenza**: Leggere conoscenze professionali o regole precedentemente salvate dal deposito persistente
4. **Identificazione Identità Utente**: Leggere informazioni di identità dell'utente, per il controllo dei permessi successivo e servizi personalizzati

## Spiegazione Parametri del Nodo

### Parametri di Input

|Nome Parametro|Descrizione Parametro|Obbligatorio|Valore Default|Spiegazione|
|---|---|---|---|---|
|Ambito|D'ambito di memorizzazione dei dati|Sì|Argomento Corrente|Determina da quale ambito cercare i dati, gli ambiti opzionali includono: argomento corrente, globale, ecc.|
|Chiave Dati|L'identificatore dei dati da leggere|Sì|Nessuno|Utilizzato per cercare l'identificatore unico dei dati, supporta l'utilizzo di variabili, come "@ID_Utente"|

### Parametri di Output

Dopo l'esecuzione riuscita del Nodo Caricamento Dati, verranno emesse le seguenti variabili, utilizzabili nei nodi successivi:
|Nome Variabile Output|Tipo Dati|Spiegazione|
|---|---|---|
|Valore Dati (value)|Stringa/Array|Secondo il tipo di dati al momento della memorizzazione, potrebbe essere una semplice stringa di testo, oppure un oggetto JSON complesso o array|

## Istruzioni per l'Uso

### Passi di Configurazione Base

1. **Selezionare Ambito**: Dal menu a tendina selezionare l'ambito dei dati da interrogare, solitamente ci sono opzioni come "Argomento Corrente", "Utente Corrente", ecc.
2. **Impostare Chiave Dati**: Nella casella di input "Chiave Dati" inserire l'identificatore dei dati da leggere
    1. È possibile inserire direttamente testo, come "Preferenze Utente"
    2. È anche possibile cliccare il pulsante "@" per selezionare una variabile dalla lista delle variabili come chiave dati
3. **Connettere Nodi Successivi**: Connettere l'output del nodo caricamento dati ai nodi successivi che necessitano di utilizzare questi dati

### Tecniche Avanzate

1. **Chiave Dati Dinamica**: Quando è necessario leggere dati diversi secondo diverse situazioni, è possibile utilizzare variabili come chiave dati. Ad esempio, è possibile utilizzare "@ID_Utente" come chiave dati, il sistema leggerà automaticamente i dati corrispondenti secondo l'ID utente corrente.
2. **Combinazione con Giudizio Condizionale**: Dopo aver letto i dati, è possibile utilizzare il nodo di giudizio condizionale per verificare se i dati esistono, se sono validi, costruendo così processi logici più complessi.
3. **Conversione Dati**: Se i dati letti sono in formato JSON, è possibile utilizzare il nodo codice per analizzarli e convertirli, estraendo campi specifici.

## Note Importanti

### Gestione Dati Inesistenti

Quando la chiave dati da leggere non esiste nel database, il Nodo Caricamento Dati emetterà un valore vuoto. Nei nodi successivi, si consiglia di verificare prima se questo valore è vuoto, per evitare che il processo vada in errore a causa di dati inesistenti.

### Problema Scadenza Dati

Se i dati hanno un tempo di scadenza impostato al momento della memorizzazione, dopo tale tempo i dati diventeranno automaticamente invalidi. Assicurarsi di avere schemi di elaborazione alternativi appropriati nel caso in cui i dati possano scadere.

### Consistenza Tipo Dati

Il Nodo Caricamento Dati restituirà dati dello stesso tipo di quando sono stati memorizzati. Ad esempio, se è stato memorizzato un oggetto JSON, al momento del caricamento si otterrà anche un oggetto JSON. Assicurarsi che i nodi successivi possano elaborare correttamente questo tipo di dati.

## Domande Frequenti

### Problema 1: Perché non riesco a leggere i dati precedentemente memorizzati?

**Possibili Cause**:
- Nome chiave dati errato o errori di ortografia
- Selezione ambito errata (ad esempio i dati sono memorizzati nell'ambito "Globale", ma durante la lettura è stato selezionato "Argomento Corrente")
- I dati sono scaduti (se al momento della memorizzazione è stato impostato un tempo di scadenza)
- I dati potrebbero essere stati eliminati o sovrascritti da altri processi

**Metodi di Risoluzione**:
- Confermare che il nome della chiave dati sia completamente identico a quello della memorizzazione
- Verificare che l'ambito sia lo stesso della memorizzazione
- Se si sospetta che i dati siano scaduti, è possibile memorizzarli nuovamente prima
- Dopo il nodo caricamento dati aggiungere nodi di log o debug, emettere i risultati del caricamento per verificarli

### Problema 2: Come giudicare se i dati sono stati caricati con successo?

**Metodo di Risoluzione**:

Dopo il nodo caricamento dati aggiungere un nodo di giudizio condizionale, verificare se il valore di output value sia vuoto. Se non è vuoto, significa che i dati sono stati caricati con successo; se è vuoto, potrebbe significare che i dati non esistono o sono scaduti.

## Nodi di Combinazione Comuni

|Tipo Nodo|Motivo Combinazione|
|---|---|
|Nodo Giudizio Condizionale|Dopo aver letto i dati effettuare giudizi, decidere il processo successivo|
|Nodo Esecuzione Codice|Elaborare e convertire dati complessi letti|
|Nodo Chiamata Modello Grande|Passare i dati letti come contesto al modello grande, migliorare la pertinenza delle risposte del modello|
|Nodo Memorizzazione Dati|Utilizzare prima il nodo memorizzazione dati per salvare i dati, successivamente utilizzare il nodo caricamento dati per leggerli|