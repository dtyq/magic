# 🧠 Nodo di Chiamata Modello Grande
## ❓ Cosa è il Nodo di Chiamata Modello Grande?
Il nodo di chiamata modello grande è il nodo core nel flusso di lavoro Magic Flow, permette di interagire direttamente con modelli di linguaggio di grandi dimensioni (come GPT-4, ecc.), utilizzato per generare contenuti testuali, rispondere a domande, analizzare contenuti o effettuare ragionamenti. In parole semplici, questo nodo è come un ponte per dialogare con l'intelligenza artificiale sulla piattaforma Magic.

**Spiegazione Immagine:**

L'interfaccia del nodo di chiamata modello grande include aree di configurazione core come selezione modello, prompt di sistema, prompt utente, e opzioni di configurazione avanzate come regolazione parametri modello, configurazione knowledge base, ecc.
![Nodo Modello Grande](https://cdn.letsmagic.cn/static/img/Large-model.png)

## 🎯 Perché Serve il Nodo di Chiamata Modello Grande?
Nel processo di costruzione di applicazioni intelligenti, il nodo di chiamata modello grande svolge il ruolo di "cervello", fornendo capacità di decisione intelligente e generazione contenuti per il flusso di lavoro:
- **Elaborazione Linguaggio Naturale**: Comprensione e generazione di linguaggio umano, permettendo all'applicazione di comunicare con gli utenti in modo naturale
- **Creazione Contenuti**: Generazione di copy, riassunti, traduzioni o altri contenuti creativi
- **Domande e Risposte Conoscenza**: Risposta a domande in campi professionali basate sulla knowledge base configurata
- **Ragionamento Logico**: Analisi informazioni e raggiungimento conclusioni, assistenza nella formulazione decisioni
- **Interazione Personalizzata**: Fornitura risposte personalizzate basate sulle esigenze utente e storico

## 📋 Scenari Applicabili
### 1. 🤖 Robot Assistente Clienti Intelligente
Progettare un robot assistente clienti capace di rispondere a consulenze prodotto, risolvere problemi utente, attraverso configurazione knowledge base professionale, fornire informazioni accurate sui prodotti e soluzioni.
### 2. ✍️ Assistente Creazione Contenuti
Costruire un assistente capace di generare vari tipi di copy, riassunti o contenuti creativi, come copy marketing, descrizioni prodotto o post social media.
### 3. 📚 Sistema Domande e Risposte Knowledge Base
Creare un sistema di domande e risposte basato su documenti interni aziendali, permettendo ai dipendenti di ottenere rapidamente informazioni professionali, migliorando l'efficienza lavorativa.
### 4. 📊 Analisi e Interpretazione Dati
Convertire risultati di analisi dati in spiegazioni di linguaggio naturale facilmente comprensibili, aiutando il personale non tecnico a comprendere dati complessi.

## ⚙️ Spiegazione Parametri Nodo
### Parametri Base
|Nome Parametro|Spiegazione|Obbligatorio|Valore Default|
|---|---|---|---|
|Modello|Selezione del modello di linguaggio da utilizzare, come GPT-4, Claude, ecc.|Sì|gpt-4o-global|
|Strumenti|Configurazione capacità strumenti associati, permettere al modello di rispondere basandosi su conoscenze specifiche|||
|Impostazione Knowledge Base|Configurazione knowledge base associata, permettere al modello di rispondere basandosi su conoscenze specifiche|No|Nessuna|
|Prompt Sistema|Istruzioni di background per il modello, definizione ruolo e comportamento generale del modello|Sì|Nessuno|
|Prompt Utente|Domanda specifica o istruzioni dell'utente|No|Nessuno|

### Configurazione Modello
|Nome Parametro|Spiegazione|Obbligatorio|Valore Default|
|---|---|---|---|
|Temperatura|Controllo casualità output, valore maggiore risposta più creativa, valore minore risposta più deterministica|No|0.5|
|Caricamento Automatico Memoria|Se abilitare funzione memoria automatica, ricordare storico conversazione|No|Sì|
|Numero Massimo Memoria|Quantità massima messaggi storici da ricordare|No|50|
|Modello Comprensione Visiva|Nome modello grande per elaborazione immagini|No|Nessuno|
|Messaggi Storici|Impostazione messaggi conversazione storica, per costruire contesto dialogo|No|Nessuno|

### Contenuto Output
|Campo Output|Spiegazione|
|---|---|
|Risposta Modello Grande (response)|Contenuto risposta del modello grande, utilizzabile per mostrare all'utente o passare a nodi downstream|
|Strumenti Chiamati (tool_calls)|Informazioni strumenti chiamati dal modello, contenenti nome strumento, parametri, risultati, ecc.|

## 📖 Istruzioni per l'Uso
### Passi di Configurazione Base
1. **Selezionare il Modello Appropriato**：
    1. Selezionare il modello di linguaggio grande corrispondente in base alle esigenze
    2. Per compiti generali è possibile selezionare modelli ordinari, per compiti complessi selezionare modelli avanzati come GPT-4
2. **Scrivere il Prompt di Sistema**：
    1. Definire chiaramente il ruolo del modello, come "Sei un addetto al servizio clienti"
    2. Impostare lo stile e l'ambito delle risposte
    3. Informare il modello sulle risorse o strumenti utilizzabili
3. **Configurare il Prompt Utente**：
    1. È possibile inserire direttamente domande o istruzioni fisse
    2. È anche possibile utilizzare riferimenti variabili per contenuti dinamici, come `{{user_message}}` per fare riferimento all'input effettivo dell'utente
4. **Impostare i Parametri del Modello**：
    1. Regolare la temperatura per controllare la creatività o accuratezza delle risposte
    2. Impostare se abilitare la memoria automatica e la quantità di record storici
5. **Configurare la Knowledge Base (Opzionale)**：
    1. Selezionare la knowledge base da associare
    2. Impostare la soglia di similarità e il numero di risultati di ricerca

### Tecniche Avanzate
#### Ottimizzazione Prompt
Scrivere prompt di alta qualità è la chiave per utilizzare efficacemente i modelli grandi：
1. **Essere Specifico e Chiaro**：Esprimere chiaramente le proprie aspettative e esigenze
2. **Impostazione Ruolo**：Assegnare al modello una posizione di ruolo chiara nel prompt di sistema
3. **Suddivisione Passi**：Guidare il modello a pensare per passi su problemi complessi

#### Collaborazione con Altri Nodi
1. **In Combinazione con il Nodo Risposta Messaggio**：
    1. Mostrare all'utente l'output generato dal modello grande attraverso il nodo risposta messaggio
    2. Impostare il prompt utente come vuoto, permettendo al messaggio dell'utente di diventare automaticamente l'input
2. **In Combinazione con il Nodo Ramo Condizionale**：
    1. Utilizzare il nodo riconoscimento intento per analizzare l'intento dell'utente
    2. Dirigere verso diversi flussi di elaborazione in base a diversi intenti
3. **In Combinazione con il Nodo Recupero Conoscenza**：
    1. Utilizzare prima il nodo recupero conoscenza per ottenere informazioni rilevanti
    2. Fornire poi i risultati della ricerca come contesto al modello grande

## ⚠️ Note di Attenzione
### Limitazioni Token
Ogni modello ha un limite massimo di token elaborabili, superarlo causerà errori：
- GPT-3.5：Supporta al massimo 16K tokens
- GPT-4：Supporta al massimo 128K tokens
- Claude：Supporta al massimo 200K tokens

*<font color="#CE2B2E">Suggerimento：Circa 1 carattere cinese ≈ 1.5-2 tokens, 1 parola inglese ≈ 1-2 tokens</font>*

### Aggiornabilità delle Conoscenze
Le conoscenze dei modelli grandi hanno una data di cutoff dell'addestramento, potrebbero non conoscere le informazioni più recenti, si consiglia：
- Per scenari che richiedono informazioni aggiornate, considerare l'utilizzo combinato del nodo richiesta HTTP per ottenere dati in tempo reale
- O aggiornare regolarmente le ultime informazioni attraverso la knowledge base

### Gestione Informazioni Sensibili
I modelli grandi potrebbero elaborare informazioni fornite dagli utenti, prestare attenzione：
- Evitare di includere informazioni riservate o sensibili nei prompt
- Per dati che necessitano di riservatezza, si consiglia di utilizzare la knowledge base invece dell'input diretto

## ❓ Domande Frequenti
### Domanda 1: Cosa fare se il contenuto della risposta del modello grande non corrisponde alle aspettative?
**Soluzioni**：Potrebbe essere che il prompt non sia abbastanza chiaro. Provare：
- Modificare il prompt di sistema, definire più specificamente il compito e le aspettative
- Aggiungere esempi, mostrare la modalità di domanda e risposta ideale
- Regolare il parametro temperatura, abbassare la temperatura per rendere la risposta più deterministica

### Domanda 2: Come gestire domande professionali che il modello grande non riesce a rispondere?
**Soluzioni**：Il modello grande dipende dai dati di addestramento, potrebbe avere conoscenze limitate in campi specifici：
- Configurare una knowledge base professionale, fornire supporto di conoscenze di settore
- Aggiungere conoscenze di background necessarie nel prompt di sistema
- Utilizzare l'istruzione "se non si trova informazione, informare chiaramente" per evitare di inventare risposte

### Domanda 3: Cosa fare se l'esecuzione del nodo chiamata modello grande è lenta?
**Soluzioni**：I fattori che influenzano la velocità sono molteplici：
- Provare a utilizzare modelli con risposta più veloce (come GPT-3.5 al posto di GPT-4)
- Ridurre la quantità di messaggi storici, diminuire il carico di elaborazione
- Ottimizzare il prompt, renderlo più conciso e chiaro

## 🌟 Migliori Pratiche
### Nodi di Combinazione Comuni
|Tipo di Nodo|Motivo di Combinazione|
|---|---|
|Nodo Risposta Messaggio|Inviare all'utente il contenuto generato dal modello grande|
|Nodo Ramo Condizionale|Decidere l'operazione successiva in base all'output del modello grande|
|Nodo Recupero Conoscenza|Fornire supporto di conoscenze professionali|
|Nodo Query Messaggi Storici|Fornire contesto di conversazione, migliorare la coerenza|
|Nodo Salvataggio Variabili|Salvare informazioni importanti per l'utilizzo nei flussi successivi|

---

# 大模型调用节点
## 什么是大模型调用节点？
大模型调用节点是Magic Flow工作流中的核心节点，它允许您直接与大型语言模型（如GPT-4等）进行交互，用于生成文本内容、回答问题、分析内容或进行推理。简单来说，这个节点就像是您在Magic平台上与人工智能对话的桥梁。

**图片说明：**

大模型调用节点界面包括模型选择、系统提示词、用户提示词等核心配置区域，以及高级配置选项如模型参数调整、知识库配置等。
![大模型调用节点](https://cdn.letsmagic.cn/static/img/Large-model.png)

## 为什么需要大模型调用节点？
在智能应用的构建过程中，大模型调用节点充当"大脑"的角色，为您的工作流提供智能决策和内容生成能力：
- **自然语言处理**：理解和生成人类语言，使应用能够以自然方式与用户交流
- **内容创作**：生成文案、摘要、翻译或其他创意内容
- **知识问答**：根据配置的知识库回答专业领域问题
- **逻辑推理**：分析信息并得出结论，协助决策制定
- **个性化交互**：根据用户需求和历史记录提供定制化的回复
## 适用场景
### 1. 智能客服机器人
设计一个能够回答产品咨询、解决用户问题的客服机器人，通过配置专业知识库，提供准确的产品信息和解决方案。
### 2. 内容创作助手
构建一个能够生成各类文案、摘要或创意内容的助手，如营销文案、产品描述或社交媒体帖子。
### 3. 知识库问答系统
创建基于企业内部文档的问答系统，让员工能快速获取专业信息，提高工作效率。
### 4. 数据分析与解读
将数据分析结果转化为易于理解的自然语言解释，帮助非技术人员理解复杂数据。
## 节点参数说明
### 基本参数
|参数名称|说明|是否必填|默认值|
|---|---|---|---|
|模型|选择要使用的大语言模型，如GPT-4、Claude等|是|gpt-4o-global|
|工具|配置关联的工具能力，让模型基于特定知识回答|||  
|知识库设置|配置关联的知识库，让模型基于特定知识回答|否|无|
|系统提示词|给模型的背景指令，定义模型的角色和整体行为|是|无|
|用户提示词|用户的具体问题或指令|否|无|

### 模型配置
|参数名称|说明|是否必填|默认值|
|---|---|---|---|
|温度|控制输出的随机性，值越大回答越具创造性，值越小回答越确定性|否|0.5|
|自动加载记忆|是否启用自动记忆功能，记住对话历史|否|是|
|最大记忆条数|记忆的最大历史消息数量|否|50|
|视觉理解模型|用于处理图像的大模型名称|否|无|
|历史消息|设置历史对话消息，用于构建对话上下文|否|无|

### 输出内容
|输出字段|说明|
|---|---|
|大模型响应（response）|大模型的回复内容，可用于显示给用户或传递给下游节点|
|调用过的工具（tool_calls）|模型调用的工具信息，包含工具名称、参数、结果等|

## 使用说明
### 基本配置步骤
1. **选择合适的模型**：
    1. 根据需求选择相应的大语言模型
    2. 一般任务可选择普通模型，复杂任务可选择高级模型如GPT-4
2. **编写系统提示词**：
    1. 明确定义模型的角色，如"你是一位客服专员"
    2. 设定回答的风格和范围
    3. 告知模型可以使用的资源或工具
3. **配置用户提示词**：
    1. 可直接输入固定的问题或指令
    2. 也可使用变量引用动态内容，如`{{user_message}}`引用用户的实际输入
4. **设置模型参数**：
    1. 调整温度以控制回答的创造性或准确性
    2. 设置是否启用自动记忆和历史记录数量
5. **配置知识库（可选）**：
    1. 选择要关联的知识库
    2. 设置相似度阈值和搜索结果数量
### 进阶技巧
#### 提示词优化
编写高质量的提示词是有效使用大模型的关键：
1. **明确具体**：清晰表达您的期望和需求
2. **角色设定**：在系统提示词中给模型明确的角色定位
3. **步骤拆分**：引导模型按步骤思考复杂问题
#### 与其他节点协同
1. **搭配消息回复节点**：
    1. 将大模型的输出通过消息回复节点展示给用户
    2. 设置用户提示词为空，让用户的消息自动作为输入
2. **结合条件分支节点**：
    1. 使用意图识别节点分析用户意图
    2. 根据不同意图转向不同的处理流程
3. **配合知识检索节点**：
    1. 先使用知识检索获取相关信息
    2. 再将检索结果作为上下文提供给大模型
## 注意事项
### Token限制
每个模型都有最大token处理限制，超出限制会导致错误：
- GPT-3.5：最多支持16K tokens
- GPT-4：最多支持128K tokens
- Claude：最多支持200K tokens

*<font color="#CE2B2E">提示：大约1个汉字≈1.5-2个tokens，1个英文单词≈1-2个tokens</font>*
### 知识时效性
大模型的知识有训练截止日期，对于最新信息可能不了解，建议：
- 对于需要最新信息的场景，考虑结合HTTP请求节点获取实时数据
- 或通过知识库定期更新最新信息
### 敏感信息处理
大模型可能会处理用户提供的信息，注意：
- 避免在提示词中包含机密或敏感信息
- 对于需保密的数据，建议使用知识库而非直接输入
## 常见问题
### 问题1：大模型回复内容不符合预期怎么办？
**解决方案**：可能是提示词不够明确。尝试：
- 修改系统提示词，更具体地定义任务和期望
- 增加示例，展示理想的问答模式
- 调整温度参数，降低温度使回答更确定性
### 问题2：如何处理大模型无法回答的专业问题？
**解决方案**：大模型依赖训练数据，对特定领域可能知识有限：
- 配置专业知识库，提供领域知识支持
- 在系统提示词中加入必要的背景知识
- 使用"查无信息则明确告知"的指令，避免编造答案
### 问题3：大模型调用节点执行很慢怎么办？
**解决方案**：影响速度的因素有多种：
- 尝试使用响应更快的模型（如GPT-3.5替代GPT-4）
- 减少历史消息数量，降低处理负担
- 优化提示词，使指令更简洁明确
## 最佳实践
### 常见搭配节点
|**节点类型**|**搭配原因**|
|---|---|
|消息回复节点|将大模型生成的内容发送给用户|
|条件分支节点|根据大模型的输出决定下一步操作|
|知识检索节点|提供专业领域知识支持|
|历史消息查询|提供对话上下文，增强连贯性|
|变量保存节点|保存重要信息供后续流程使用|