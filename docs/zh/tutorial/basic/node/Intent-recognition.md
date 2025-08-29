# 🎯 Nodo Riconoscimento Intenzioni

## ❓ Cos'è il Nodo Riconoscimento Intenzioni?

Il nodo Riconoscimento Intenzioni è un nodo di analisi intelligente nei flussi di lavoro Magic Flow che può comprendere e analizzare il contenuto testuale dell'input dell'utente, identificando l'intenzione dell'utente al suo interno. In parole semplici, questo nodo è come un "interprete intelligente" che può distinguere cosa vuole fare l'utente, poi guida il flusso di lavoro verso percorsi di elaborazione diversi basati su intenzioni diverse.

**Spiegazione Immagine:**

L'interfaccia del nodo Riconoscimento Intenzioni include l'area di selezione del modello e configurazione dei rami. Qui puoi definire molteplici rami di intenzione, ogni ramo contiene il nome dell'intenzione e la descrizione, oltre ai percorsi di flusso corrispondenti a diverse intenzioni.
![Nodo Riconoscimento Intenzioni](https://cdn.letsmagic.cn/static/img/Intent-recognition.png)

## 🤔 Perché Serve il Nodo Riconoscimento Intenzioni?

Nella costruzione di applicazioni intelligenti, il nodo Riconoscimento Intenzioni svolge un ruolo chiave di "navigazione intelligente":
- **Elaborazione Automatica di Classificazione**: Identifica automaticamente l'intenzione dell'utente basandosi sul suo input, senza bisogno che l'utente scelga esplicitamente la funzionalità
- **Design di Flussi Multi-percorso**: Attiva diversi flussi di elaborazione basati su intenzioni diverse, fornendo esperienze personalizzate
- **Miglioramento dell'Esperienza Utente**: Permette agli utenti di esprimere le proprie esigenze in linguaggio naturale, invece di seguire comandi fissi o menu
- **Riduzione del Giudizio Manuale**: Automatizza il processo di analisi delle intenzioni, risparmiando risorse umane
- **Semplificazione di Flussi Complessi**: Semplifica giudizi condizionali complessi in riconoscimento delle intenzioni basato sulla semantica

## 🎯 Scenari Applicabili

### 1. Smistamento Assistenza Clienti Intelligente
Progetta un sistema di assistenza clienti che può giudicare automaticamente il tipo di consultazione dell'utente, come consultazione prodotto, servizio post-vendita, reclami e suggerimenti, ecc., e guida l'utente verso i rispettivi flussi di elaborazione professionale.

### 2. Assistente Multi-funzione
Costruisci un assistente personale integrato con molteplici funzionalità che può giudicare dall'input in linguaggio naturale dell'utente se vuole controllare il meteo, impostare promemoria, cercare informazioni o chiacchierare, ed eseguire la funzionalità corrispondente.

### 3. Compilazione Intelligente Moduli
Crea un assistente moduli intelligente che può estrarre informazioni chiave dalle descrizioni in linguaggio naturale dell'utente e compilare automaticamente i campi del modulo corrispondenti, semplificando il processo di inserimento dati.

## ⚙️ Spiegazione Parametri del Nodo

### Parametri Base
|Nome Parametro|Spiegazione|Obbligatorio|Valore Predefinito|
|---|---|---|---|
|Modello|Seleziona il modello di linguaggio grande da utilizzare per il riconoscimento delle intenzioni|Sì|gpt-4o-mini-global|
|Intenzione|Il contenuto dell'input dell'utente, utilizzato per l'analisi delle intenzioni|Sì|Nessuno|
|Rami Intenzione|Definisci diverse categorie di intenzione e i loro flussi di elaborazione|Sì|Nessuno|

### Parametri Modello
|Nome Parametro|Spiegazione|Obbligatorio|Valore Predefinito|
|---|---|---|---|
|Caricamento Automatico Memoria|Se abilitare la funzione di memoria automatica, ricordare la cronologia delle conversazioni per assistere il riconoscimento delle intenzioni|No|Sì|
|Numero Massimo Memoria|Questo nodo ricorderà al massimo n messaggi, n è il numero massimo di memoria che imposti|No|10|

### Parametri Intenzione
|Nome Parametro|Spiegazione|Obbligatorio|
|---|---|---|
|Nome Intenzione|Definisci un nome di intenzione specifico, come "consultazione prodotto", "richiesta rimborso", ecc.|Sì|
|Descrizione Intenzione|Descrizione dettagliata di questa intenzione, aiuta il modello a riconoscere più accuratamente l'intenzione|No|

## 📋 Istruzioni per l'Uso

### Passi di Configurazione Base
1. **Seleziona il modello appropriato**:
    1. Per garantire l'accuratezza del riconoscimento, si consiglia di scegliere modelli avanzati come GPT-4
    2. Per compiti di riconoscimento intenzioni semplici, si possono anche utilizzare modelli più veloci come GPT-3.5
2. **Imposta l'input dell'intenzione**:
    1. Nel parametro "Intenzione" fai riferimento al messaggio di input dell'utente, generalmente utilizzando variabili come `{{user_message}}`
    2. Assicurati che il contenuto di input contenga informazioni sufficienti per l'analisi delle intenzioni del modello
3. **Definisci i rami delle intenzioni**:
    1. Clicca il pulsante "Aggiungi Ramo" per creare molteplici rami di intenzione
    2. Imposta nomi di intenzione chiari e descrizioni dettagliate per ogni ramo
    3. Imposta almeno un ramo "else" di fallback per gestire situazioni non riconoscibili
4. **Configura la destinazione dei rami**:
    1. Imposta per ogni ramo di intenzione il nodo verso cui il flusso dovrebbe andare quando viene riconosciuta questa intenzione
    2. Assicurati che tutti i possibili percorsi di intenzione abbiano elaborazione corrispondente
5. **Regola parametri avanzati (opzionale)**:
    1. Regola parametri come temperatura, memoria automatica secondo necessità
    2. Per scenari che richiedono alta accuratezza, puoi impostare la temperatura più bassa (come 0.2)

#### Collaborazione con Altri Nodi
Il nodo Riconoscimento Intenzioni generalmente necessita di essere utilizzato in combinazione con altri nodi:
1. **In Combinazione con il Nodo Attesa**:
    1. Dopo l'input dell'utente, utilizza il nodo Attesa per ottenere il messaggio
    2. Utilizza l'output del nodo Attesa come input per il riconoscimento delle intenzioni
2. **In Combinazione con il Nodo Chiamata Modello Grande**:
    1. Basandosi sull'intenzione riconosciuta, utilizza diversi template di prompt
    2. Puoi passare il risultato del riconoscimento delle intenzioni al modello grande per migliorare la comprensione del contesto
3. **Complementare al Nodo Ramo Condizionale**:
    1. Per giudizi con regole chiare utilizza il nodo Ramo Condizionale
    2. Per comprensione semantica fuzzy utilizza il nodo Riconoscimento Intenzioni

## ⚠️ Note Importanti

### Quantità e Qualità delle Intenzioni
La quantità di intenzioni influisce sulla precisione e efficienza del riconoscimento:
- Troppe intenzioni possono causare confusione e giudizi errati
- Si consiglia di controllare ogni nodo tra 5-10 intenzioni, assicurando distinzioni chiare tra le varie intenzioni
- Per sistemi complessi, considera l'utilizzo di riconoscimento intenzioni multi-livello, come riconoscere prima la categoria principale, poi la sottocategoria

### Impostazione Ramo Predefinito
Assicurati sempre di impostare un ramo predefinito di tipo "else":
- Come percorso di fallback quando non viene riconosciuta alcuna intenzione predefinita
- Può guidare l'utente a chiarire l'intenzione o fornire più informazioni
- Previene l'interruzione del flusso a causa dell'impossibilità di riconoscere l'intenzione

### Considerazioni sulle Performance
Il processo di riconoscimento delle intenzioni può consumare una certa quantità di risorse computazionali:
- Sistemi di intenzioni complessi possono aumentare il tempo di riconoscimento
- Per scenari con requisiti di real-time elevati, puoi semplificare leggermente le descrizioni delle intenzioni
- Considera l'utilizzo di modelli più veloci o ottimizzazione della struttura dei prompt

## ❓ Problemi Comuni

### Problema 1: Come Migliorare l'Accuratezza del Riconoscimento delle Intenzioni?
**Soluzioni**: Diversi fattori chiave per migliorare l'accuratezza:
- Fornire descrizioni dettagliate delle intenzioni ed esempi diversificati
- Assicurare sufficiente distinzione tra diverse intenzioni
- Utilizzare modelli più avanzati (come GPT-4 al posto di GPT-3.5)
- Abbassare il parametro temperatura (come 0.2-0.3) per aumentare la determinabilità
- Considerare l'abilitazione della funzione memoria per utilizzare la cronologia delle conversazioni come contesto

### Problema 2: Il Riconoscimento delle Intenzioni Va Sempre Verso il Ramo Predefinito?
**Soluzioni**: Possibili cause e soluzioni:
- Verifica se le descrizioni delle intenzioni sono sufficientemente chiare e dettagliate
- Conferma se l'input dell'utente contiene informazioni sufficienti per indicare l'intenzione
- Controlla se ci sono sovrapposizioni tra intenzioni che causano confusione
- Prova ad aggiungere alcune espressioni comuni nelle descrizioni delle intenzioni
- Utilizza la funzione di debug per visualizzare il processo di riconoscimento del modello e la confidenza

### Problema 3: Come Gestire Situazioni di Intenzioni Multiple?
**Soluzioni**: Quando l'input dell'utente può contenere molteplici intenzioni:
- Progetta priorità dei rami, lascia che il modello riconosca l'intenzione principale
- Considera l'impostazione di rami di intenzione ibrida per gestire combinazioni di intenzioni comuni
- Aggiungi passi di chiarimento nel flusso, chiedi all'utente di confermare l'intenzione principale
- Utilizza elaborazione a catena: prima elabora l'intenzione principale, poi quella secondaria

## 💡 Migliori Pratiche

### Nodi Comuni da Abbinare

|Tipo di Nodo|Motivo dell'Abbinamento|
|---|---|
|Nodo Attesa|Ottieni l'input dell'utente come fonte per il riconoscimento delle intenzioni|
|Nodo Chiamata Modello Grande|Genera risposte corrispondenti basandosi sull'intenzione riconosciuta|
|Nodo Ramo Condizionale|Gestisci giudizi semplici basati su regole|
|Nodo Risposta Messaggio|Feedback all'utente del risultato del riconoscimento o richiesta di chiarimento|
|Nodo Sottoprocesso|Esegui flussi di elaborazione indipendenti per ciascuna intenzione|

---

# 意图识别节点
## 什么是意图识别节点？
意图识别节点是Magic Flow工作流中的智能分析节点，它能够理解和分析用户输入的文本内容，从中识别出用户的意图。简单来说，这个节点就像是一个"理解师"，能够分辨用户想要做什么，然后根据不同意图将工作流引导到不同的处理路径。

**图片说明：**

意图识别节点界面包括模型选择、分支设置区域，您可以在这里定义多个意图分支，每个分支包含意图名称和描述，以及不同意图对应的流程走向。
![意图识别节点](https://cdn.letsmagic.cn/static/img/Intent-recognition.png)

## 为什么需要意图识别节点？
在构建智能应用过程中，意图识别节点发挥着"智能导航"的关键作用：
- **自动分类处理**：根据用户的输入自动识别其意图，无需用户明确选择功能
- **多路径流程设计**：根据不同意图触发不同的处理流程，提供个性化体验
- **提升用户体验**：让用户以自然语言表达需求，而不是遵循固定命令或菜单
- **减少人工判断**：自动化意图分析过程，节省人力资源
- **简化复杂流程**：将复杂的条件判断简化为基于语义的意图识别
## 适用场景
### 1. 智能客服分流
设计一个能够自动判断用户咨询类型的客服系统，如产品咨询、售后服务、投诉建议等，并将用户引导至相应的专业处理流程。
### 2. 多功能助手
构建一个集成多种功能的个人助手，能够根据用户的自然语言输入判断用户是想查询天气、设置提醒、查找信息还是闲聊等，并执行相应功能。
### 3. 表单智能填写
创建一个智能表单助手，能够从用户的自然语言描述中提取关键信息，并自动填入相应的表单字段，简化数据录入过程。
## 节点参数说明
### 基本参数
|参数名称|说明|是否必填|默认值|
|---|---|---|---|
|模型|选择用于意图识别的大语言模型|是|gpt-4o-mini-global|
|意图|用户输入的内容，用于意图分析|是|无|
|意图分支|定义不同的意图类别及其处理流程|是|无|

### 模型参数
|参数名称|说明|是否必填|默认值|
|---|---|---|---|
|自动加载记忆|是否启用自动记忆功能，记住对话历史辅助意图识别|否|是|
|最大记忆条数|该节点最多只会记得n条消息，n为你设置的最大记忆数|否|10|

### 意图参数
|参数名称|说明|是否必填|
|---|---|---|
|意图名称|定义一个具体的意图名称，如"咨询产品"、"申请退款"等|是|
|意图描述|对该意图的详细描述，帮助模型更准确识别意图|否|

## 使用说明
### 基本配置步骤
1. **选择合适的模型**：
    1. 为保证识别准确性，建议选择高级模型如GPT-4
    2. 对于简单意图识别任务，也可使用更快的GPT-3.5等模型
2. **设置意图输入**：
    1. 在"意图"参数中引用用户输入的消息，通常使用变量如`{{user_message}}`
    2. 确保输入的内容包含足够的信息供模型分析意图
3. **定义意图分支**：
    1. 点击"添加分支"按钮创建多个意图分支
    2. 为每个分支设置明确的意图名称和详细描述
    3. 至少设置一个"else"类型的兜底分支，处理无法识别的情况
4. **配置分支去向**：
    1. 为每个意图分支设置当识别到此意图时流程应该去向的节点
    2. 确保所有可能的意图都有相应的处理路径
5. **调整高级参数**（可选）：
    1. 根据需要调整温度、自动记忆等参数
    2. 对于需要高准确性的场景，可将温度设置较低(如0.2)
#### 与其他节点协同
意图识别节点通常需要与其他节点结合使用：
1. **与等待节点配合**：
    1. 在用户输入后使用等待节点获取消息
    2. 将等待节点的输出作为意图识别的输入
2. **与大模型调用节点配合**：
    1. 根据识别出的意图，使用不同的提示词模板
    2. 可以将意图识别结果传递给大模型，增强上下文理解
3. **与条件分支节点互补**：
    1. 对于明确规则的判断使用条件分支节点
    2. 对于模糊语义理解使用意图识别节点
## 注意事项
### 意图数量与质量
意图数量会影响识别精度和效率：
- 过多的意图可能导致混淆和误判
- 建议每个节点控制在5-10个意图，确保各意图间有明显区别
- 对于复杂系统，考虑使用多级意图识别，如先识别大类，再识别子类
### 默认分支设置
始终确保设置"else"类型的默认分支：
- 作为未能识别任何预定义意图时的兜底路径
- 可以引导用户澄清意图或提供更多信息
- 防止流程因无法识别意图而中断
### 性能考量
意图识别过程可能消耗一定的计算资源：
- 复杂的意图体系可能增加识别时间
- 对于实时性要求高的场景，可以适当简化意图描述
- 考虑使用更快的模型或优化提示词结构
## 常见问题
### 问题1：如何提高意图识别的准确性？
**解决方案**：提高准确性的几个关键因素：
- 提供详细的意图描述和多样化的示例
- 确保不同意图之间有足够的区分度
- 使用更高级的模型（如GPT-4代替GPT-3.5）
- 将温度参数调低（如0.2-0.3）增加确定性
- 考虑启用记忆功能，利用对话历史提供上下文
### 问题2：意图识别总是走向默认分支怎么办？
**解决方案**：可能的原因和解决方案：
- 检查意图描述是否足够清晰详细
- 确认用户输入是否包含足够的信息表明意图
- 查看是否有意图之间的重叠导致混淆
- 尝试增加一些常见表达方式到意图描述中
- 使用调试功能查看模型的识别过程和置信度
### 问题3：如何处理多重意图的情况？
**解决方案**：当用户输入可能包含多个意图时：
- 设计分支优先级，让模型识别主要意图
- 考虑设置混合意图分支，处理常见的意图组合
- 在流程中添加澄清步骤，请用户确认主要意图
- 使用链式处理，先处理主要意图，再处理次要意图
## 最佳实践
### 常见搭配节点
|节点类型|搭配原因|
|---|---|
|等待节点|获取用户输入作为意图识别的源|
|大模型调用节点|根据识别的意图生成相应回复|
|条件分支节点|处理基于规则的简单判断|
|消息回复节点|向用户反馈识别结果或请求澄清|
|子流程节点|对各意图执行独立的处理流程|