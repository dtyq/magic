# Nodo Memorizzazione Messaggi Storici 💾

## Che cos'è il Nodo Memorizzazione Messaggi Storici?

Il Nodo Memorizzazione Messaggi Storici è un nodo funzionale in Magic Flow utilizzato per registrare e salvare messaggi di conversazione. È come un'unità di memoria che può salvare informazioni testuali specificate nella cronologia della conversazione, per essere recuperate e utilizzate successivamente. Questi messaggi memorizzati possono essere recuperati nelle interazioni successive, fornendo all'assistente AI capacità di memoria di sessione.

**Spiegazione Interfaccia:**

L'area superiore è utilizzata per la selezione del tipo di messaggio, attualmente supporta tipi di messaggio testo, immagine e scheda file; l'area inferiore è utilizzata per l'input del contenuto del messaggio, supporta l'utilizzo di "@" per aggiungere variabili per realizzare memorizzazione dinamica del contenuto.
![Nodo Memorizzazione Messaggi Storici](https://cdn.letsmagic.cn/static/img/Historical-message-storage.png)

## Perché serve il Nodo Memorizzazione Messaggi Storici?

Nei sistemi di conversazione intelligente, la memoria e la gestione del contesto sono la chiave per fornire esperienze di interazione coerenti. Il Nodo Memorizzazione Messaggi Storici aiuta a:
1. **Costruire Memoria Assistente AI**: Far "ricordare" all'assistente AI informazioni importanti, senza bisogno che l'utente le fornisca ripetutamente
2. **Salvare Risultati Intermedi**: Memorizzare dati chiave e risultati intermedi nel flusso di lavoro, per riferimento nei processi successivi
3. **Mantenere Coerenza Conversazione**: Attraverso la memorizzazione di informazioni contestuali, garantire continuità e consapevolezza del contesto della conversazione
4. **Creare Profilo Utente**: Registrare informazioni chiave fornite dall'utente, costruire gradualmente un profilo utente, fornire esperienze personalizzate

## Scenari di Applicazione

### Scenario 1: Raccolta e Memoria Informazioni Utente

Dopo che l'utente fornisce per la prima volta informazioni personali (come nome, preferenze, ecc.), è possibile utilizzare il Nodo Memorizzazione Messaggi Storici per registrare queste informazioni. Nelle conversazioni successive, il sistema può utilizzare direttamente questi ricordi, evitando domande ripetitive, migliorando l'esperienza utente.

### Scenario 2: Gestione Memoria Conversazioni Multi-turno

In scenari di conversazioni multi-turno complesse, alcune informazioni chiave necessitano di essere utilizzate in molteplici turni di conversazione. Attraverso il Nodo Memorizzazione Messaggi Storici, è possibile salvare selettivamente contenuti importanti, piuttosto che affidarsi solo alla memoria automatica dei messaggi recenti.

### Scenario 3: Registrazione Stato Flusso di Lavoro

In scenari di elaborazione ticket, approvazioni, ecc., è possibile utilizzare il Nodo Memorizzazione Messaggi Storici per registrare lo stato e i risultati di ogni passo, formare registrazioni complete di elaborazione, facilitando query e tracciamento successivi.

## Spiegazione Parametri del Nodo

### Parametri di Input

**I principali parametri di input del Nodo Memorizzazione Messaggi Storici includono:**
|Nome Parametro|Spiegazione|Obbligatorio|Valore Default|
|---|---|---|---|
|Tipo Messaggio|Attualmente supporta tipi di messaggio testo, immagine e scheda file|Sì|Testo|
|Contenuto Messaggio|Le informazioni testuali da memorizzare, supporta riferimento variabili|Sì|Nessuno|

### Contenuto di Output

Il Nodo Memorizzazione Messaggi Storici non ha parametri di output standard; la sua funzione principale è scrivere il contenuto nei registri di messaggi storici del sistema.

## Istruzioni per l'Uso

### Passi di Configurazione Base

1. **Aggiungere Nodo**: Trascinare il nodo memorizzazione messaggi storici nell'editor del flusso di lavoro
2. **Selezionare Tipo Messaggio**: Dal menu a tendina del tipo di messaggio selezionare "Testo"
3. **Scrivere Contenuto Messaggio**: Nella casella di input del contenuto del messaggio inserire il testo da memorizzare
    1. È possibile inserire direttamente testo fisso, come "Preferenze utente registrate"
    2. È anche possibile utilizzare il simbolo "@" per referenziare variabili, come "Preferenza utente: @user_preference"
4. **Connettere Nodi**: Connettere il nodo memorizzazione messaggi storici con nodi precedenti (come diramazione condizionale o esecuzione codice) e nodi successivi

### Tecniche Avanzate

1. **Utilizzo Combinato Variabili**: Il contenuto del messaggio supporta combinazione di molteplici variabili, costruire contenuti di memoria strutturati
2. **Utilizzo Filtraggio Condizionale**: In combinazione con il nodo diramazione condizionale, memorizzare informazioni solo quando condizioni specifiche sono soddisfatte
3. **Formattazione Contenuto Memorizzato**: Utilizzare template di testo ben formattati, facilitare recupero e elaborazione successivi

## Note Importanti

### Limitazioni Quantità Memorizzazione

- **Memorizzazione Adeguata**: Non memorizzare troppe informazioni non necessarie, potrebbe causare eccessiva lunghezza dei registri storici
- **Focus sui Punti Chiave**: Memorizzare solo informazioni chiave che hanno valore per le interazioni successive, migliorare l'efficienza di memorizzazione

### Sicurezza Contenuto

- **Gestione Informazioni Sensibili**: Evitare di memorizzare privacy utente e informazioni sensibili, come password, dettagliati contatti, ecc.
- **Uso Conforme**: Assicurarsi che il contenuto memorizzato sia conforme alle normative sulla privacy dei dati

### Formato Contenuto

- **Struttura Chiara**: Progettare formato di memorizzazione strutturato, facilitare recupero e comprensione successivi
- **Controllo Lunghezza**: Contenuti troppo lunghi potrebbero essere difficili da elaborare nelle query successive, si consiglia di controllare lunghezze ragionevoli

## Domande Frequenti

### Non riesco a trovare il contenuto memorizzato nei processi successivi

**Soluzioni**:
1. Confermare che l'ordine di esecuzione del flusso di lavoro sia corretto; il nodo di memorizzazione deve essere eseguito prima del nodo di query
2. Verificare l'impostazione dell'intervallo temporale del nodo interrogazione messaggi storici, assicurarsi di coprire il punto temporale del messaggio memorizzato
3. Aumentare l'impostazione del numero massimo record del nodo interrogazione messaggi storici, assicurarsi di coprire il messaggio memorizzato

### Il contenuto della variabile memorizzata non è corretto

**Soluzioni**:
1. Verificare che il riferimento alla variabile sia corretto, assicurarsi di utilizzare il nome variabile corretto
2. Validare che i nodi precedenti abbiano emesso con successo i valori variabili previsti
3. Utilizzare il nodo esecuzione codice per stampare il contenuto delle variabili per debug, confermare che il passaggio delle variabili nel flusso di lavoro sia corretto

## Nodi di Combinazione Comuni

|Tipo Nodo|Spiegazione Combinazione|
|---|---|
|Nodo Interrogazione Messaggi Storici|Utilizzo combinato di memorizzazione e interrogazione, realizzare gestione memoria completa|
|Nodo Chiamata Modello Grande|Fornire al modello grande informazioni storiche memorizzate, migliorare comprensione del contesto|
|Nodo Diramazione Condizionale|Decidere secondo condizioni se memorizzare informazioni specifiche|
|Nodo Esecuzione Codice|Elaborare e formattare il contenuto da memorizzare|