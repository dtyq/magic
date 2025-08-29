# Nodo Memorizzazione Dati 💾

## Che cos'è il Nodo Memorizzazione Dati?

Il Nodo Memorizzazione Dati è un componente funzionale nella piattaforma Magic utilizzato per salvare in modo persistente informazioni chiave. È come un affidabile blocco note che può registrare importanti dati nel flusso di lavoro e consultarli in qualsiasi momento necessario, mantenendo queste informazioni anche dopo la fine della conversazione.

**Spiegazione Immagine:**

L'interfaccia del Nodo Memorizzazione Dati contiene principalmente quattro parti principali: area di selezione dell'ambito, area di input della chiave dati, area di modifica del valore dati e area di impostazione del tempo di scadenza. Attraverso la configurazione di queste aree, gli utenti possono specificare i dati da salvare e il loro metodo di memorizzazione.
![Nodo Memorizzazione Dati](https://cdn.letsmagic.cn/static/img/Data-storage.png)

## Perché serve il Nodo Memorizzazione Dati?

Durante l'utilizzo dell'assistente AI, spesso abbiamo bisogno di ricordare alcune informazioni importanti per utilizzi successivi, ad esempio:
1. **Memoria tra Sessioni**: Preferenze utente, registri di interazioni storiche, ecc. che necessitano di essere salvati a lungo termine
2. **Persistenza Dati**: Salvare dati importanti generati temporaneamente (come risultati di analisi, informazioni chiave inserite dall'utente)
3. **Gestione Stato**: Registrare lo stato di esecuzione del flusso di lavoro, supportare la continuazione da punto di interruzione per processi aziendali complessi
4. **Condivisione Informazioni**: Condividere dati tra diversi assistenti AI o flussi di lavoro

Il Nodo Memorizzazione Dati è come la "memoria a lungo termine" dell'assistente AI, permette all'assistente AI di avere la capacità di "non dimenticare mai ciò che ha visto", migliorando enormemente l'esperienza utente e l'utilità dell'assistente AI.

## Scenari di Applicazione

### Scenario 1: Memoria Informazioni Utente
Ricordare nome utente, preferenze, ecc., richiamarli direttamente nelle interazioni successive, senza bisogno di chiedere ripetutamente, fornendo servizi personalizzati.

### Scenario 2: Salvataggio Contesto Conversazione Multi-turno
Nel processo di risoluzione di problemi complessi, salvare risultati intermedi o punti chiave della discussione, in modo che anche se la conversazione viene interrotta e ripresa, si possa tornare rapidamente allo stato di discussione precedente.

### Scenario 3: Tracciamento Stato Aziendale
Nel processo di gestione di pratiche aziendali, registrare a quale passo è arrivato l'utente attualmente, in modo che al prossimo proseguimento della pratica non sia necessario ricominciare da capo.

## Spiegazione Parametri del Nodo

### Spiegazione Input

|Nome Parametro|Spiegazione|Obbligatorio|
|---|---|---|
|Ambito|Selezionare l'ambito di memorizzazione dei dati, determinare chi può accedere a questi dati. L'opzione predefinita solitamente è "Argomento Corrente".|Sì|
|Chiave Dati|Utilizzata per identificare i dati memorizzati, equivalente al "nome" dei dati, facilitando la ricerca e l'utilizzo successivi. Supporta l'utilizzo di "@" per referenziare variabili.|Sì|
|Valore Dati|Il contenuto specifico da memorizzare, può essere testo, numeri o dati in altri formati. Supporta l'utilizzo di "@" per referenziare variabili.|Sì|
|Tempo Scadenza (secondi)|Impostare il periodo di validità dei dati, dopo tale tempo i dati verranno automaticamente eliminati. Se non compilato significa che non scade mai. Supporta l'utilizzo di "@" per referenziare variabili.|No|

### Spiegazione Output

Il Nodo Memorizzazione Dati salverà i dati specificati nel deposito persistente, ma non genera direttamente variabili di output. Dopo il salvataggio riuscito, è possibile utilizzare il "Nodo Caricamento Dati" con lo stesso nome chiave per recuperare i dati salvati.

## Istruzioni per l'Uso

### Passi di Configurazione Base

1. **Aggiungere Nodo Memorizzazione Dati**: Nell'editor del flusso di lavoro, trascinare il nodo memorizzazione dati nella tela.
2. **Configurare Ambito**: Selezionare l'ambito appropriato, solitamente utilizzare "Argomento Corrente" può soddisfare la maggior parte delle esigenze.
3. **Impostare Chiave Dati**: Specificare un nome chiaro e significativo per i dati da memorizzare, per facilitare l'identificazione futura.
    1. Ad esempio: `user_preference`, `last_order_id`, ecc.
    2. Se necessario utilizzare variabile come nome chiave, cliccare il pulsante "@" per selezionare variabili esistenti.
4. **Compilare Valore Dati**: Inserire il contenuto specifico da memorizzare.
    1. Può essere testo fisso, come `"Ordine Completato"`.
    2. Può anche referenziare variabile, come `@user_response`.
5. **Impostare Tempo Scadenza** (opzionale): Secondo lo scenario di utilizzo dei dati impostare un tempo di scadenza appropriato.
    1. Dati temporanei possono impostare tempo breve, come `3600` (1 ora).
    2. Dati per utilizzo a lungo termine possono lasciare vuoto (mai scadenza) o impostare tempo lungo.

### Tecniche Avanzate

1. **Progettazione Nome Chiave Dinamica**:
    1. È possibile utilizzare combinazioni di variabili per generare nomi chiave dinamici, come `user_@user_id`, in questo modo è possibile creare voci dati dedicate per diversi utenti.
    2. Utilizzare prefissi nome con regolarità, come `temp_data_1`, `temp_data_2`, facilitando la gestione in batch di dati correlati.
2. **Ottimizzazione Organizzazione Dati**:
    1. Per dati complessi, considerare l'utilizzo del formato JSON per la memorizzazione, come `{"name": "Mario", "age": 28}`.
    2. Utilizzare prefissi per distinguere dati aziendali diversi, come `order_xxx` e `user_xxx`.

## Note Importanti

### Norme Denominazione Chiave Dati

1. **Evitare Caratteri Speciali**: Il nome chiave dovrebbe utilizzare principalmente lettere, numeri e trattini bassi, evitare caratteri speciali che potrebbero causare problemi di analisi.
2. **Mantenere Unicità**: Nello stesso ambito, dati diversi dovrebbero utilizzare nomi chiave diversi, altrimenti il nuovo valore sovrascriverà il vecchio.
3. **Denominazione Significativa**: Utilizzare nomi chiave che possano riflettere il contenuto dei dati, migliorare la leggibilità del codice, come `user_age` è più intuitivo di `u_a`.

### Limitazioni Memorizzazione Dati

1. **Limitazione Dimensione Dati**: La dimensione di ogni singolo elemento dati dovrebbe essere controllata in un range ragionevole (solitamente suggerito non superare 10MB).
2. **Considerazione Capacità Deposito**: Il deposito persistente ha una limitazione di capacità totale, pianificare ragionevolmente l'utilizzo, pulire tempestivamente i dati non necessari.
3. **Gestione Informazioni Sensibili**: Evitare di memorizzare informazioni sensibili come privacy utente, se necessario memorizzare, assicurarsi di crittografarle.

## Domande Frequenti

### Cosa fare se i dati salvati non si trovano?

**Risposta**: Le possibili cause sono:
- Errore ortografia nome chiave: Verificare se il nome chiave utilizzato nel caricamento dati sia completamente identico a quello della memorizzazione.
- Selezione ambito diverso: Assicurarsi che nell'ambito di caricamento dati sia selezionato lo stesso di quello di memorizzazione.
- Dati scaduti: Verificare se il tempo di scadenza impostato nella memorizzazione sia già trascorso.
- Dati sovrascritti da altri processi: Chiavi con lo stesso nome verranno sovrascritte dai nuovi valori, verificare se altri processi abbiano utilizzato lo stesso nome chiave.

### Come gestire efficientemente molteplici dati correlati?

**Risposta**: Si raccomandano i seguenti metodi:
- Utilizzare prefissi nome: Come tutti i dati correlati all'utente iniziano con "user_".
- Adottare formato JSON: Organizzare dati correlati in oggetti JSON da memorizzare insieme, piuttosto che memorizzarli in modo disperso.
- Impostare tempo di scadenza ragionevole: Dati temporanei impostare tempo di scadenza breve, pulizia automatica dei dati non più necessari.

## Nodi di Combinazione Comuni

|Tipo Nodo|Motivo Combinazione|
|---|---|
|Nodo Diramazione Condizionale|Secondo i risultati del caricamento dati giudicare se esistano dati specifici, scegliere percorsi di elaborazione diversi.|
|Nodo Chiamata Modello Grande|Utilizzare le informazioni di contesto memorizzate, fornire esperienze di conversazione più coerenti.|