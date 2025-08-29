# Nodo Interrogazione Messaggi Storici 📜

## Che cos'è il Nodo Interrogazione Messaggi Storici?

Il Nodo Interrogazione Messaggi Storici è un nodo funzionale in Magic Flow utilizzato per recuperare registri di conversazioni storiche. È come una libreria di memoria intelligente che aiuta a estrarre informazioni importanti dalle conversazioni passate, realizzando interrogazioni e analisi rapide dei contenuti di interazioni storiche.

**Spiegazione Interfaccia:**

L'interfaccia del Nodo Interrogazione Messaggi Storici mostra le aree di configurazione principali del nodo, inclusa l'area di impostazione numero massimo record e l'area di filtro per intervallo temporale. Il numero massimo è impostato di default a 10 record, l'intervallo temporale può essere personalizzato selezionando date di inizio e fine. L'area di output in basso mostra che i risultati della query conterranno lista messaggi storici (history_messages), ruolo messaggio (role) e contenuto messaggio (content).
![Nodo Interrogazione Messaggi Storici](https://cdn.letsmagic.cn/static/img/Historical-message-query.png)

## Perché serve il Nodo Interrogazione Messaggi Storici?

Nei sistemi di conversazione intelligente, comprendere il contesto e le interazioni storiche è la chiave per fornire servizi coerenti e personalizzati. Il Nodo Interrogazione Messaggi Storici aiuta a:
1. **Tracciare il Flusso di Conversazione**: Recuperare rapidamente contenuti di comunicazione precedenti, comprendere il contesto della conversazione corrente
2. **Estrarre Informazioni Chiave**: Trovare dalle registrazioni storiche informazioni importanti già fornite dall'utente, evitare domande ripetitive
3. **Analizzare Abitudini Utente**: Comprendere preferenze e modelli di comportamento dell'utente attraverso registrazioni di interazioni storiche
4. **Realizzare Conversazione Continua**: Costruire esperienze di interazione coerenti basate su conversazioni storiche, migliorare la soddisfazione dell'utente

## Scenari di Applicazione

### Scenario 1: Robot Assistenza Clienti Personalizzato
Il robot assistenza clienti necessita di conoscere contenuti di consultazione precedenti dell'utente e soluzioni fornite, per evitare risposte ripetitive o contraddittorie. Attraverso il Nodo Interrogazione Messaggi Storici, il sistema può recuperare registrazioni di consultazione precedenti dell'utente, fornire esperienze di servizio coerenti.

### Scenario 2: Funzione Memoria Assistente di Apprendimento
Nelle applicazioni educative, l'assistente di apprendimento necessita di ricordare contenuti di apprendimento e problemi precedenti dello studente. Il Nodo Interrogazione Messaggi Storici può aiutare a recuperare registrazioni di apprendimento precedenti dello studente, fornire basi per raccomandazioni di apprendimento personalizzate.

### Scenario 3: Gestione Contesto in Conversazioni Multi-turno
In scenari di conversazioni multi-turno complesse, i contenuti di conversazione potrebbero coinvolgere molteplici argomenti. Il Nodo Interrogazione Messaggi Storici può aiutare a estrarre paragrafi di conversazione storica relativi ad argomenti specifici, mantenere coerenza e integrità del contesto della conversazione.

## Spiegazione Parametri del Nodo

### Parametri di Input

I parametri di input del Nodo Interrogazione Messaggi Storici sono utilizzati per impostare condizioni di query, includono principalmente:
|Nome Parametro|Spiegazione|Obbligatorio|Valore Default|
|---|---|---|---|
|Numero Massimo|Limitare il numero di record di messaggi storici restituiti|Sì|10|
|Filtro Intervallo Temporale|Impostare l'intervallo di tempo della query, inclusi data di inizio e data di fine|No|Nessuno|

### Parametri di Output

I risultati della query saranno utilizzati come parametri di output del nodo, per nodi successivi:
|Nome Parametro|Spiegazione|Tipo Dati|
|---|---|---|
|Messaggi Storici (history_messages)|Lista registrazioni messaggi storici|Array|
|Ruolo (role)|Ruolo mittente messaggio (come utente, sistema)|Stringa|
|Contenuto (content)|Contenuto del messaggio|Stringa|

## Istruzioni per l'Uso

### Passi di Configurazione Base

1. **Aggiungere Nodo**: Trascinare il nodo interrogazione messaggi storici nell'editor del flusso di lavoro
2. **Impostare Numero Massimo**: Nella casella di input "Numero Massimo" inserire il numero di messaggi storici da interrogare (si consiglia di impostare valori ragionevoli, come 10-20 record)
3. **Impostare Intervallo Temporale** (opzionale): Se necessario filtrare per tempo, cliccare il selettore intervallo temporale per impostare date di inizio e fine
4. **Connettere Nodi**: Connettere il nodo interrogazione messaggi storici con nodi precedenti (come nodi di inizio o trigger) e nodi successivi (come nodi chiamata modello grande)

### Tecniche Avanzate

1. **Controllo Temporale Preciso**: Per scenari che richiedono filtri temporali ad alta precisione, è possibile impostare intervalli temporali precisi, ottenere registrazioni di conversazione di periodi specifici
2. **Combinazione con Variabili**: È possibile salvare i risultati della query `history_messages` in variabili, per l'utilizzo in nodi successivi
3. **Combinazione con Nodo Modello Grande**: Utilizzare i risultati dell'interrogazione messaggi storici come input del nodo chiamata modello grande, realizzare risposte intelligenti basate su conversazioni storiche

## Note Importanti

### Considerazioni Prestazionali

- **Limitazione Numero Query**: Impostare numeri troppo grandi di messaggi storici potrebbe ridurre l'efficienza di esecuzione del flusso di lavoro; si consiglia di impostare numeri massimi ragionevoli secondo le esigenze effettive
- **Impostazione Intervallo Temporale**: Intervalli temporali troppo ampi potrebbero restituire troppi messaggi irrilevanti, influenzare l'efficienza dell'analisi successiva

### Sicurezza Contenuto

- **Gestione Informazioni Sensibili**: I messaggi storici potrebbero contenere informazioni sensibili, considerare la sicurezza delle informazioni quando si passano i risultati della query a nodi successivi
- **Uso Dati Conforme**: Assicurarsi che l'uso dei messaggi storici sia conforme alle normative sulla protezione della privacy

## Domande Frequenti

### Risultati Query Vuoti

**Problema**: È stato configurato il nodo interrogazione messaggi storici ma si ottengono risultati vuoti.
**Soluzioni**:
1. Verificare che l'impostazione dell'intervallo temporale sia corretta, assicurarsi che nell'intervallo di tempo della query ci siano registrazioni di conversazione
2. Confermare che i nodi precedenti abbiano passato correttamente le informazioni di sessione
3. Considerare di allentare le condizioni di query, come ampliare l'intervallo temporale o aumentare il numero massimo

### Risultati Query Incompleti

**Problema**: Nei risultati della query mancano alcuni messaggi storici previsti.
**Soluzioni**:
1. Aumentare l'impostazione del numero massimo, assicurarsi di recuperare registrazioni storiche sufficienti
2. Verificare l'impostazione dell'intervallo temporale, assicurarsi di coprire tutti i periodi di tempo dei messaggi storici necessari
3. Confermare che i messaggi storici siano stati correttamente memorizzati nel sistema

## Nodi di Combinazione Comuni

|Tipo Nodo|Spiegazione Combinazione|
|---|---|
|Nodo Chiamata Modello Grande|Fornire al modello grande messaggi storici, realizzare risposte intelligenti basate su contesto|
|Nodo Diramazione Condizionale|Prendere decisioni secondo i contenuti dei messaggi storici, scegliere percorsi di elaborazione diversi|
|Nodo Esecuzione Codice|Effettuare analisi e elaborazione approfondite dei messaggi storici|
|Nodo Risposta Messaggio|Costruire contenuti di risposta basati sui risultati dell'analisi storica|