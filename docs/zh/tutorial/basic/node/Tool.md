# 🔧 Nodo Strumento

## ❓ Che Cos'è il Nodo Strumento?

Il nodo Strumento è un nodo potente in Magic Flow che permette di richiamare e utilizzare vari strumenti preimpostati nel flusso di lavoro. Come un coltellino svizzero multifunzione, il nodo Strumento aiuta a eseguire compiti specifici, come elaborazione dati, ricerca informazioni o operazioni automatizzate. Puoi utilizzare questi strumenti in due modi: attraverso descrizione in linguaggio naturale (chiamata modello grande) o impostazione diretta parametri (chiamata parametri), soddisfacendo diverse esigenze di scenario.

**Spiegazione Interfaccia:**

L'interfaccia del nodo Strumento è composta principalmente da area di selezione modalità chiamata e area configurazione parametri. Nella parte superiore puoi scegliere modalità "Chiamata Modello Grande" o "Chiamata Parametri", sotto c'è l'area configurazione parametri di input personalizzata dal sistema, supporta aggiunta di molteplici parametri e relative espressioni.
![Nodo Strumento](https://cdn.letsmagic.cn/static/img/Tool.png)

## 🤔 Perché Serve il Nodo Strumento?

Nella costruzione di flussi di lavoro intelligenti, spesso necessiti di eseguire compiti standardizzati o richiamare funzionalità specifiche. Il nodo Strumento esiste proprio per risolvere questo problema:
1. **Estensione Funzionale**: Estende le capacità di Magic Flow, facendo sì che il flusso di lavoro possa eseguire compiti più professionali
2. **Operazioni Standardizzate**: Fornisce interfaccia unificata per richiamare vari strumenti, semplificando la progettazione del flusso di lavoro
3. **Chiamata Flessibile**: Supporta molteplici modalità di chiamata, facile da utilizzare anche senza background tecnico
4. **Automazione Flusso**: Trasforma operazioni manuali in flussi automatizzati, migliorando efficienza e consistenza

## 🎯 Scenari Applicabili

Il nodo Strumento è applicabile a vari scenari, inclusi ma non limitati a:
1. **Ricerca Informazioni**: Richiama strumenti di ricerca per ottenere informazioni in tempo reale o conoscenze professionali
2. **Elaborazione Dati**: Utilizza strumenti di conversione dati per elaborare e formattare dati del flusso di lavoro
3. **Operazioni Automatizzate**: Attiva compiti automatizzati, come invio notifiche o creazione calendario
4. **Miglioramento Assistente Intelligente**: Aggiunge capacità di strumenti pratici ai chatbot, come ricerca meteo o traduzione testo

## ⚙️ Spiegazione Parametri del Nodo

### Spiegazione Parametri di Input
I parametri di input del nodo Strumento si dividono principalmente in due categorie: impostazioni modalità chiamata e configurazione parametri strumento.
|Nome Parametro|Descrizione|Obbligatorio|Valore Predefinito|
|---|---|---|---|
|Modalità Chiamata|Scegli modalità chiamata strumento, include [Chiamata Modello Grande] e [Chiamata Parametri]|Sì|Chiamata Modello Grande|
|Selezione Strumento|Scegli nome strumento da utilizzare|Sì|Nessuno|
|Modello|Utilizzando [Chiamata Modello Grande], seleziona modello da utilizzare|Sì|GPT-4o|
|Parola Chiave|Utilizza parola chiave per guidare modello grande, assicurando utilizzo accurato, supporta utilizzo @ per riferimento variabili|No|Nessuno|

### Spiegazione Output
Dopo l'esecuzione del nodo Strumento, verranno restituiti i seguenti contenuti:
|Nome Output|Descrizione|Esempio|
|---|---|---|
|Testo Output|Testo risultato esecuzione strumento|"Meteo attuale Pechino: Sereno, 25°C"|
|Stato Esecuzione|Stato esecuzione strumento, successo o fallimento|"success"|
|Informazioni Errore|In caso di fallimento esecuzione, contiene dettagli errore|"Timeout chiamata API"|

## 📋 Istruzioni per l'Uso

### Passi di Configurazione Base
1. **Aggiungi Nodo Strumento**
    1. Trascina il nodo "Strumento" dal pannello nodi al canvas del flusso di lavoro
    2. Connetti il nodo con altri nodi nel flusso di lavoro
2. **Seleziona Modalità Chiamata**
    1. Nel pannello configurazione nodo seleziona "Chiamata Modello Grande" o "Chiamata Parametri"
    2. Chiamata Modello Grande: Adatta per utilizzare strumento attraverso descrizione in linguaggio naturale
    3. Chiamata Parametri: Adatta per utilizzare strumento attraverso configurazione diretta parametri
3. **Configura Parametri**
    1. Clicca pulsante "Aggiungi" per aggiungere parametri necessari allo strumento
    2. Compila nome parametro, imposta se obbligatorio
    3. Seleziona tipo espressione appropriato (come testo, numero, ecc.)
    4. Compila valore parametro o espressione
4. **Imposta Parametri Annidati (se necessario)**
    1. Per strumenti complessi, clicca pulsante "+" accanto al parametro per aggiungere sottoparametri
    2. Configura sottoparametri nello stesso modo
5. **Configura Output**
    1. Nella sezione "Output" seleziona formato output (predefinito testo)
    2. Abilita o disabilita voci output specifiche secondo necessità

### Tecniche Avanzate
1. **Utilizzo Riferimento Variabili**
    1. Seleziona opzione "Utilizza @variabili flusso" per utilizzare simbolo @ per riferimento variabili nel flusso di lavoro
    2. Ad esempio: Nell valore parametro input "@domanda_utente" utilizza valore variabile "domanda_utente" nel flusso di lavoro
2. **Calcolo Dinamico Parametri**
    1. Puoi utilizzare formule di calcolo semplici nelle espressioni
    2. Ad esempio: "{{count + 1}}" calcolerà automaticamente risultato di valore variabile count + 1
3. **Utilizzo Risultati Strumento in Giudizi Condizionali**
    1. L'output del nodo Strumento può essere utilizzato come input del nodo ramificazione condizionale
    2. Puoi scegliere diversi rami di elaborazione in base al risultato di esecuzione dello strumento

## ⚠️ Note Importanti

### Attenzione Configurazione Parametri
1. **Norme Denominazione Parametri**
    1. I nomi parametri dovrebbero essere concisi e chiari, riflettere lo scopo del parametro
    2. Evita spazi e caratteri speciali, si consiglia utilizzo lettere inglesi, numeri e trattini bassi
    3. Utilizza nomi descrittivi, come "search_query" invece di semplice "q"

2. **Tipo Valori Parametri**
    1. Assicurati che il tipo di valore parametro sia consistente con quanto atteso dallo strumento (come numero, valore booleano, testo, ecc.)
    2. Per tipi array o oggetto, presta attenzione alla correttezza formato JSON
    3. Per tipi data e ora presta attenzione ai requisiti di formato (come ISO8601)

3. **Gestione Parametri Obbligatori**
    1. Assicurati che tutti i parametri obbligatori abbiano valori appropriati
    2. Nell'utilizzo di riferimenti variabili, assicurati che le variabili abbiano certamente valori al momento dell'esecuzione
    3. Considera di aggiungere valori predefiniti o opzioni di fallback per parametri critici

### Gestione Errori
1. **Tipi Errori Comuni**
    1. Errori Parametri: Formato parametro non corretto o parametri obbligatori mancanti
    2. Limitazioni Chiamata: Frequenza chiamata API supera limiti
    3. Errori Connessione: Problemi di rete causano fallimento chiamata

2. **Soluzioni**
    1. Utilizza nodi ramificazione condizionale per verificare stato esecuzione strumento
    2. Progetta schemi di fallback per operazioni critiche
    3. Aggiungi logica di retry per gestire errori temporanei

## ❓ Problemi Comuni

### Problema 1: Come Scegliere la Modalità di Chiamata Appropriata?
**Soluzioni**: La scelta dipende dalle tue esigenze e background:
- Chiamata Modello Grande: Adatta per utenti non familiari con dettagli tecnici, può descrivere compiti attraverso linguaggio naturale
- Chiamata Parametri: Adatta per scenari che necessitano controllo preciso, impostazione parametri più diretta e controllabile

### Problema 2: Cosa Fare se il Risultato di Esecuzione Strumento Non Corrisponde alle Attese?
**Soluzioni**: Verifica i seguenti punti:
- I valori dei parametri sono compilati correttamente, specialmente formato e tipo dati
- Nella chiamata modello grande, la parola chiave è sufficientemente chiara e specifica
- Lo strumento stesso ha limitazioni funzionali o requisiti speciali
- Nell'utilizzo di riferimenti variabili, i valori delle variabili corrispondono alle attese

### Problema 3: Come Gestire Strumenti che Necessitano Autenticazione?
**Soluzioni**: Secondo i requisiti di autenticazione dello strumento:
- Utilizza campi parametri di autenticazione dedicati (come api_key, token, ecc.)
- Per autenticazione OAuth, potrebbe essere necessario ottenere prima token di accesso poi utilizzare
- Presta attenzione a proteggere informazioni di autenticazione sensibili, evita codifica diretta nel flusso di lavoro

## 🔗 Nodi Comuni da Abbinare

|Tipo Nodo|Motivo Abbinamento|
|---|---|
|Nodo Ramificazione Condizionale|Giudica flusso successivo in base al risultato di esecuzione strumento|
|Nodo Chiamata Modello Grande|Utilizza risultato strumento come contesto per rispondere|
|Nodo Risposta Messaggio|Mostra direttamente all'utente il risultato della ricerca strumento|
|Nodo Salvataggio Variabili|Salva informazioni importanti restituite dallo strumento per utilizzo nodi successivi|
|Nodo Esecuzione Codice|Elabora ulteriormente e converte dati restituiti dallo strumento|

---

# 工具节点

## 什么是工具节点？
工具节点是 Magic Flow 中的一个强大节点，它允许您在工作流中调用和使用各种预设工具。就像一把多功能瑞士军刀，工具节点帮助您执行特定任务，如数据处理、信息查询或自动化操作。您可以通过两种方式使用这些工具：通过自然语言描述（大模型调用）或直接参数设置（参数调用），满足不同场景需求。

**界面说明：**

工具节点界面主要由调用模式选择区和参数配置区组成。顶部可以选择"大模型调用"或"参数调用"模式，下方是系统自定义的输入参数配置区，支持添加多个参数及其表达式。
![工具节点](https://cdn.letsmagic.cn/static/img/Tool.png)

## 为什么需要工具节点？
在构建智能工作流时，您经常需要执行标准化任务或调用特定功能。工具节点正是为解决这个问题而存在：
1. **功能扩展**：扩展 Magic Flow 的能力，使工作流能够执行更专业的任务
2. **标准化操作**：提供统一的接口调用各种工具，简化工作流设计
3. **灵活调用**：支持多种调用方式，即使没有技术背景也容易使用
4. **流程自动化**：将手动操作转化为自动化流程，提高效率和一致性

## 应用场景
工具节点适用于各种场景，包括但不限于：
1. **信息查询**：调用搜索工具获取实时信息或专业知识
2. **数据处理**：使用数据转换工具处理和格式化工作流数据
3. **自动化操作**：触发自动化任务，如发送通知或创建日程
4. **智能助手增强**：为聊天机器人添加实用工具能力，如天气查询或文本翻译

## 节点参数说明
### 输入参数说明
工具节点的输入参数主要分为两类：调用模式设置和工具参数配置。
|参数名称|说明|是否必填|默认值|
|---|---|---|---|
|调用模式|选择工具调用方式，包括[大模型调用]和[参数调用]|是|大模型调用|
|选择工具|选择要使用的工具名称|是|无|
|模型|使用[大模型调用]时，选择要使用的模型|是|GPT-4o|
|提示词|使用提示词引导大模型，确保准确使用，支持使用@引用变量|否|无|

### 输出说明
工具节点执行后，会输出以下内容：
|输出名称|说明|示例|
|---|---|---|
|输出文本|工具执行的结果文本|"当前北京天气：晴，25°C"|
|执行状态|工具执行的状态，成功或失败|"success"|
|错误信息|执行失败时，包含错误详情|"API调用超时"|

## 使用说明
### 基本配置步骤
1. **添加工具节点**
    1. 从节点面板拖拽"工具"节点到工作流画布
    2. 将节点与工作流中的其他节点连接
2. **选择调用模式**
    1. 在节点配置面板中选择"大模型调用"或"参数调用"
    2. 大模型调用：适合通过自然语言描述使用工具
    3. 参数调用：适合通过直接参数配置使用工具
3. **配置参数**
    1. 点击"添加"按钮添加工具所需的参数
    2. 填写参数名称，设置是否必填
    3. 选择适当的表达式类型（如文本、数字等）
    4. 填写参数值或表达式
4. **设置嵌套参数（如需）**
    1. 对于复杂工具，点击参数旁的"+"按钮添加子参数
    2. 以同样方式配置子参数
5. **配置输出**
    1. 在"输出"部分选择输出格式（默认为文本）
    2. 根据需要启用或禁用特定输出项

### 高级技巧
1. **使用变量引用**
    1. 勾选"使用@flow变量"选项，可使用@符号引用工作流中的变量
    2. 例如：在参数值中输入"@user_question"使用工作流中的"user_question"变量值
2. **动态参数计算**
    1. 可以在表达式中使用简单计算公式
    2. 例如："{{count + 1}}"将自动计算count变量值加1的结果
3. **在条件判断中使用工具结果**
    1. 工具节点的输出可作为条件分支节点的输入
    2. 可根据工具执行结果选择不同的处理分支

## 注意事项
### 参数配置注意
1. **参数命名规范**
    1. 参数名应简洁明了，反映参数用途
    2. 避免空格和特殊字符，建议使用英文字母、数字和下划线
    3. 尽量使用描述性名称，如"search_query"而非简单的"q"

2. **参数值类型**
    1. 确保参数值类型与工具预期一致（如数字、布尔值、文本等）
    2. 对于数组或对象类型，注意JSON格式正确
    3. 日期时间类型注意格式要求（如ISO8601）

3. **必填参数处理**
    1. 确保所有必填参数都有合适的值
    2. 使用变量引用时，确保变量在执行时一定有值
    3. 考虑为关键参数添加默认值或回退选项

### 错误处理
1. **常见错误类型**
    1. 参数错误：参数格式不正确或缺少必填参数
    2. 调用限制：API调用频率超过限制
    3. 连接错误：网络问题导致调用失败

2. **解决方案**
    1. 使用条件分支节点检查工具执行状态
    2. 为关键操作设计回退方案
    3. 添加重试逻辑处理临时性错误

## 常见问题
### 问题1：如何选择合适的调用模式？
**解决方案**：选择取决于您的需求和背景：
- 大模型调用：适合不熟悉技术细节的用户，可通过自然语言描述任务
- 参数调用：适合需要精确控制的场景，参数设置更直接和可控

### 问题2：工具执行结果与预期不符怎么办？
**解决方案**：检查以下几点：
- 参数值是否正确填写，特别是格式和数据类型
- 大模型调用时，提示词是否足够明确和具体
- 工具本身是否有功能限制或特殊要求
- 使用变量引用时，变量值是否符合预期

### 问题3：如何处理需要认证的工具？
**解决方案**：根据工具的认证要求：
- 使用专门的认证参数字段（如api_key, token等）
- 对于OAuth认证，可能需要先获取访问令牌再使用
- 注意保护敏感认证信息，避免直接硬编码在工作流中

## 常见配对节点
|节点类型|配对原因|
|---|---|
|条件分支节点|根据工具执行结果判断后续流程|
|大模型调用节点|使用工具结果作为上下文进行回答|
|消息回复节点|将工具查询结果直接展示给用户|
|变量保存节点|保存工具返回的重要信息供后续节点使用|
|代码执行节点|进一步处理和转换工具返回的数据|
