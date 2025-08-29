
# 🔧 Introduzione Base
【## 🛠️ Due, Creazione dell'Insieme di Strumenti Assistente Conoscenza
1. Accedi alla piattaforma [Magic](https://www.letsmagic.cn/login). (Se è un deployment privato, accedi alla piattaforma di login privata corrispondente)
2. Nella barra dei menu a sinistra clicca【AI Assistant】, a destra clicca【Crea Insieme Strumenti】
3. Carica l'immagine dell'insieme strumenti e compila il nome dell'assistente e una semplice descrizione
4. Clicca【Insieme Strumenti Assistente Conoscenza】, a destra clicca【Aggiungi Strumento】
5. Inserisci【srm_knowledge_search】, e aggiungi la descrizione corrispondente, come: "Recupera contenuti della knowledge base SRM"

![Screenshot Strumento](https://cdn.letsmagic.cn/static/img/tool-1.png)
![Screenshot Strumento](https://cdn.letsmagic.cn/static/img/tool-2.png)】e【Sottoprocesso】sono in realtà essenzialmente la stessa cosa, solo che l'uso e gli scenari sono diversi.

【Sottoprocesso】: Generalmente utilizzato per suddividere il flusso principale, permette di astrarre una parte delle funzionalità del flusso principale in uno strumento indipendente, evitando che il corpo del flusso diventi troppo grande, migliorando ulteriormente l'efficienza di manutenzione

【Strumento】: Gli strumenti sono generalmente utilizzati per essere chiamati dai modelli grandi, ma possono anche esistere come nodi strumento

**Per quanto riguarda gli "strumenti" ci sono alcuni concetti da capire**

**Parametri personalizzati del sistema**: Quando lo strumento esiste come forma di nodo strumento, definisce i parametri di input personalizzati del nodo strumento

**Parametri del modello grande**: Quando viene chiamato dal modello grande, definisce i parametri di input durante la chiamata del modello grande

**Output**: I dati restituiti dopo la chiamata dello strumento

## 🎯 Uno, Progetta l'Effetto che Vuoi Ottenere
Il sistema SRM è ampiamente utilizzato nei processi aziendali effettivi, gli utenti hanno frequentemente bisogno di cercare nella knowledge base SRM per risolvere problemi, ma non vogliono impostare ripetutamente più assistenti AI, sperano di supportare le domande e risposte di più sistemi su un singolo assistente AI, quindi abbiamo bisogno di astrarre la capacità dell'utente di cercare nella knowledge base SRM in uno strumento indipendente da chiamare per il modello grande.

Basandoci sugli obiettivi di scenario sopra, il flusso di lavoro che progettiamo includerà le seguenti parti:

1. Creare un insieme di strumenti assistente conoscenza

2. Nell'insieme di strumenti conoscenza corrispondente aggiungere lo strumento **srm_knowledge_search**

3. Nel【nodo modello grande】dell'assistente AI corrispondente configurare lo strumento corrispondente

## 二、创建知识助理工具集
1. 登录 [Magic](https://www.letsmagic.cn/login)平台。（如果私有化部署则登录对应私有化登录平台）
2. 在左边菜单栏点击【AI 助理】，右边点击【创建工具集】
3. 上传工具集图片，并填写助理的名称和对它的简单描述
4. 点击【知识助理工具集】，右边点击【添加工具】
5. 输入【srm_knowledge_search】，并增加对应描述，如：“检索 SRM 知识库内容”

![工具截图](https://cdn.letsmagic.cn/static/img/tool-1.png)
![工具截图](https://cdn.letsmagic.cn/static/img/tool-2.png)

## ⚙️ Tre, Orchestrazione del Flusso di Lavoro
### 1. Clicca per creare【nodo iniziale】
1.1 Clicca【Aggiungi Parametro】

1.2 Inserisci il contenuto di input del parametro del modello grande come mostrato nell'immagine

![Screenshot Strumento](https://cdn.letsmagic.cn/static/img/tool-3.png)

### 2. Connetti e crea【nodo ricerca vettoriale】
2.1 Seleziona knowledge base: valore fisso, seleziona knowledge base supply chain

2.2 Parole chiave di ricerca: tramite @ riferimento alla domanda del nodo iniziale

2.3 Corrispondenza metadati: imposta i valori dei parametri corrispondenti 

(Parametro nome: **knowledge_base_id**, valore parametro: **valore fisso, 716406779765358592**)

![Screenshot Strumento](https://cdn.letsmagic.cn/static/img/tool-4.png)

### 3. Connetti e crea【nodo modello grande】
3.1 Area modello, seleziona il nodo modello grande supportato, altri parametri rimangono invariati, e attiva anche la capacità di comprensione visiva (qui seleziona GPT-4o per default) 

![Screenshot Strumento](https://cdn.letsmagic.cn/static/img/tool-5.png)

3.2 Area input, casella System compila il prompt da dare al modello grande, area User tramite @riferimento alla **domanda del nodo iniziale** e alla **lista frammenti del nodo ricerca vettoriale**

3.3 Attiva caricamento automatico memoria
```
#Ruolo
Esperto di elaborazione dati
#Compito
In base alla domanda data, seleziona diversi frammenti con elevata correlazione, poi organizza la risposta più appropriata.
#Obiettivo
La risposta deve basarsi sui frammenti selezionati con elevata correlazione, estendendosi appropriatamente su questa base, essere conforme alla logica della domanda Q, grammaticalmente scorrevole.
#Requisiti
1. In base alla domanda Q data, seleziona i frammenti più rilevanti dalla lista opzioni frammenti;
2. Devi assicurarti che i frammenti selezionati siano correlati alla domanda. Se ritieni che tutti i frammenti non abbiano correlazione con la domanda, non è possibile recuperare informazioni rilevanti. Allora rispondi "Impossibile recuperare questo contenuto";
3. La risposta non deve essere rigida, può essere leggermente ritoccata in base alla risposta per renderla più scorrevole, ma non deve cambiare l'essenza della risposta originale;
4. Se tutti i frammenti hanno bassa correlazione, non è possibile recuperare informazioni rilevanti quindi non esiste risposta, allora output "Impossibile recuperare questo contenuto";
5. La tua risposta non deve omettere le immagini nei frammenti, deve mostrare insieme il rendering delle immagini nel tuo contenuto di risposta;

#Formato di ritorno
Restituisci solo la risposta; usa un bel formato markdown.
#Flusso
Devi seguire rigorosamente il seguente flusso per pensare ed eseguire ogni passo:
1. Ricevi una domanda (Q);
2. Dalla lista frammenti seleziona diversi frammenti con elevata correlazione;
3. In base ai frammenti selezionati con elevata correlazione del passo 2, organizza la risposta in base alla domanda Q e restituisci;
4. La risposta può essere leggermente ritoccata per rendere la grammatica scorrevole;
```
![Screenshot Strumento](https://cdn.letsmagic.cn/static/img/tool-6.png)
### 4. Connetti e crea【nodo finale】
4.1 Aggiungi il valore del parametro finale corrispondente (nome parametro: **response**, valore parametro: **valore fisso, e tramite @riferimento alla stringa di testo del modello grande**)
      
![Screenshot Strumento](https://cdn.letsmagic.cn/static/img/tool-7.png)

### 5. Pubblicazione strumento
5.1 Clicca pubblica, compila il nome versione corrispondente e la descrizione versione

![Screenshot Strumento](https://cdn.letsmagic.cn/static/img/tool-8.png)

### 6. Riferimento assistente AI conoscenza

6.1 Seleziona l'assistente AI che necessita di supportare le domande SRM, nel nodo modello grande clicca【Aggiungi Strumento】

6.2 Seleziona【Insieme Strumenti Assistente Conoscenza】, aggiungi lo strumento【srm_knowledge_search】, oppure puoi cercare rapidamente tramite barra di ricerca
![Screenshot Strumento](https://cdn.letsmagic.cn/static/img/tool-9.png)
![Screenshot Strumento](https://cdn.letsmagic.cn/static/img/tool-10.png)

---
Dopo aver completato la configurazione sopra, l'assistente AI corrispondente potrà supportare l'interrogazione dei contenuti della knowledge base SRM.