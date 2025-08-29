# 🔀 Nodo Selettore

## ❓ Cos'è il Nodo Selettore?

Il nodo Selettore è un nodo di giudizio condizionale nei flussi di lavoro Magic Flow che permette di dividere il flusso di lavoro in percorsi di esecuzione diversi basandosi su condizioni impostate. È come un bivio stradale, dove si sceglie direzione diversa in base a situazioni diverse. Attraverso il nodo Selettore, puoi costruire flussi di lavoro intelligenti con ramificazioni logiche, implementando la funzionalità di eseguire operazioni diverse basate su condizioni diverse.

**Spiegazione Immagine:**

L'interfaccia del nodo Selettore mostra l'area di impostazione delle condizioni, inclusa la configurazione di riferimento variabile, selezione condizioni (come uguale, condizione, ecc.) e valori di confronto (espressioni o valori fissi). L'interfaccia supporta la combinazione di molteplici condizioni attraverso i pulsanti "O" e "E", implementando logica di giudizio complessa.
![Nodo Selettore](https://cdn.letsmagic.cn/static/img/Selector.png)

## 🤔 Perché Serve il Nodo Selettore?

Nella costruzione di flussi di lavoro intelligenti, il nodo Selettore svolge il ruolo di "decisore", fornendo alla tua applicazione capacità di giudizio condizionale e selezione percorso:
- **Elaborazione Ramificazioni Logiche**: Selezionare percorsi di elaborazione diversi basandosi su condizioni diverse
- **Adattamento Multi-scenario**: Eseguire operazioni diverse per diversi input utente o stati dati
- **Implementazione Regole Aziendali**: Convertire le regole aziendali in giudizi condizionali eseguibili
- **Gestione Errori**: Selezionare flusso normale o elaborazione eccezionale basandosi sui risultati delle operazioni
- **Flussi Personalizzati**: Fornire esperienze personalizzate basandosi su caratteristiche utente o comportamenti storici

## 🎯 Scenari Applicabili

### 1. Guida Classificazione Utente
Guidare gli utenti verso flussi di servizio diversi basandosi sulle informazioni fornite (come età, professione, esigenze, ecc.), fornendo aiuto mirato.

### 2. Processo di Approvazione
Decidere se necessiti di approvazione di livello superiore o approvazione diretta basandosi su importo richiesta, livello richiedente, ecc.

### 3. Sistema Domande&Risposte Intelligente
Analizzare il tipo di domanda dell'utente, indirizzare verso flussi di risposta specialistici corrispondenti basandosi su diverse categorie di domande.

### 4. Flusso Elaborazione Dati
Selezionare metodi di elaborazione successivi diversi basandosi su qualità dati, caratteristiche dati o risultati elaborazione.

## ⚙️ Spiegazione Parametri del Nodo

### Parametri Base
|Nome Parametro|Spiegazione|Obbligatorio|Valore Predefinito|
|---|---|---|---|
|Riferimento Variabile|Selezionare la variabile da giudicare|Sì|Nessuno|
|Selezione Condizione|Impostare il modo di confronto, come uguale, condizione, ecc.|Sì|Uguale|
|Valore Confronto|Impostare il valore target del confronto, può essere espressione o valore fisso|Sì|Nessuno|
|Logica Combinazione Condizioni|Relazione tra molteplici condizioni, può essere "E" o "O"|No|E|

### Spiegazione Tipi Condizione
|Tipo Condizione|Spiegazione|Tipi Dati Applicabili|
|---|---|---|
|Uguale|Giudicare se il valore della variabile è completamente identico al valore impostato|Testo, numero, valore booleano|
|Condizione|Utilizzare espressioni di condizione complesse per giudicare|Tutti i tipi|
|Valore Fisso|Confrontare con un valore fisso specifico|Testo, numero, valore booleano|
|Espressione|Utilizzare il risultato del calcolo dell'espressione per confrontare|Testo, numero, oggetto|

### Contenuto Output
Il nodo Selettore non ha contenuto di output specifico, ma seleziona percorsi di esecuzione diversi basandosi sui risultati del giudizio condizionale:
- Quando la condizione è soddisfatta: Esegue il ramo "Corrispondente"
- Quando la condizione non è soddisfatta: Esegue il ramo "Altrimenti"

## 📋 Istruzioni per l'Uso

### Passi di Configurazione Base
1. **Seleziona la variabile di giudizio**:
    1. Seleziona la variabile da giudicare dal menu a tendina
    2. Può essere input utente, output di nodi upstream o variabile globale
2. **Imposta la condizione di giudizio**:
    1. Seleziona il tipo di condizione appropriato (uguale, condizione, ecc.)
    2. Imposta il valore di confronto corrispondente secondo il tipo di condizione
3. **Configura multi-condizioni (opzionale)**:
    1. Clicca il pulsante "+" per aggiungere condizioni aggiuntive
    2. Utilizza il pulsante "E" per richiedere che tutte le condizioni siano soddisfatte contemporaneamente
    3. Utilizza il pulsante "O" per richiedere che almeno una condizione sia soddisfatta
4. **Connetti nodi downstream**:
    1. Connetti l'uscita "Corrispondente" al nodo da eseguire quando la condizione è soddisfatta
    2. Connetti l'uscita "Altrimenti" al nodo da eseguire quando la condizione non è soddisfatta

#### Collaborazione con Altri Nodi
Il nodo Selettore generalmente necessita di essere utilizzato in combinazione con altri nodi:
1. **In Combinazione con il Nodo Salvataggio Variabili**:
    1. Utilizza il nodo Salvataggio Variabili prima del selettore per registrare le informazioni necessarie per il giudizio
    2. Dopo il giudizio del selettore, salva nuovamente lo stato del risultato
2. **In Combinazione con il Nodo Chiamata Modello Grande**:
    1. Utilizza il modello grande per generare contenuto o analisi
    2. Il selettore decide l'elaborazione successiva basandosi sui risultati dell'analisi
3. **In Combinazione con il Nodo Elaborazione Dati**:
    1. Pre-elabora e controlla i dati
    2. Il selettore seleziona il metodo di elaborazione basandosi sulle caratteristiche dei dati

## ⚠️ Note Importanti

### Corrispondenza Tipi Variabile
Assicurati che il tipo della variabile di giudizio corrisponda al tipo del valore di confronto, per evitare risultati inaspettati:
- Confronto numero con numero (come `5 > 3`)
- Confronto testo con testo (come `"hello" == "hello"`)
- Confronto valore booleano con valore booleano (come `true == false`)

### Priorità Condizioni
Quando utilizzi molteplici condizioni, presta attenzione alla priorità della combinazione delle condizioni:
- La priorità di "E" è superiore a "O"
- Per condizioni complesse si consiglia di utilizzare espressioni per chiarire la priorità

### Gestione Percorsi
Assicurati che tutti i possibili rami condizionali abbiano flussi di elaborazione corrispondenti:
- Evita percorsi "sospesi"
- Verifica se sono state gestite tutte le situazioni possibili

## ❓ Problemi Comuni

### Problema 1: I Risultati del Giudizio Condizionale Non Corrispondono alle Aspettative?
**Soluzioni**: Potrebbe essere che il tipo o valore della variabile non corrisponda alle aspettative:
- Verifica il valore e tipo effettivo della variabile (puoi utilizzare il nodo Codice per output informazioni variabile)
- Conferma se le condizioni di confronto sono impostate correttamente
- Per confronti di testo, presta attenzione a differenze maiuscolo/minuscolo e spazi

### Problema 2: Come Gestire il Giudizio di Molteplici Situazioni Diverse?
**Soluzioni**: Per scenari che necessitano di giudicare molteplici situazioni diverse:
- Utilizza molteplici nodi Selettore in serie, formando una catena di giudizio completa
- Oppure utilizza prima il nodo Riconoscimento Intenzioni per classificare, poi utilizza il selettore per elaborazione ulteriore
- Situazioni complesse possono considerare l'utilizzo del nodo Esecuzione Codice per logica personalizzata

### Problema 3: Errore nel Giudizio di Oggetti o Array del Nodo Selettore?
**Soluzioni**: Oggetti e array necessitano di elaborazione speciale:
- Utilizza espressioni per accedere a proprietà specifiche dell'oggetto (come `user.name`)
- Per array puoi utilizzare espressioni per controllare lunghezza o elementi specifici
- Per confronti di oggetti complessi si consiglia di utilizzare prima il nodo Codice per conversione a tipi semplici

## 🔗 Nodi Comuni da Abbinare

|Tipo di Nodo|Motivo dell'Abbinamento|
|---|---|
|Nodo Chiamata Modello Grande|Analizzare contenuto poi giudicare basandosi sui risultati|
|Nodo Salvataggio Variabili|Registrare risultati di giudizio per riferimento nei flussi successivi|
|Nodo Esecuzione Codice|Gestire logica di giudizio complessa o conversione dati|
|Nodo Risposta Messaggio|Rispondere contenuti diversi basandosi su condizioni diverse|
|Nodo Richiesta HTTP|Selezionare modi di elaborazione diversi basandosi sui risultati della richiesta|

---

# 选择器节点
## 什么是选择器节点？
选择器节点是Magic Flow工作流中的条件判断节点，它允许您根据设定的条件将工作流分为不同的执行路径。就像在道路上的分叉口，根据不同情况选择不同的前进方向。通过选择器节点，您可以构建具有逻辑分支的智能工作流，实现根据不同条件执行不同操作的功能。

**图片说明：**

选择器节点界面展示了条件设置区域，包括引用变量、选择条件（如等于、条件等）和比较值（表达式或固定值）的配置。界面支持通过"或"和"且"按钮组合多个条件，实现复杂的判断逻辑。
![选择器节点](https://cdn.letsmagic.cn/static/img/Selector.png)

## 为什么需要选择器节点？
在构建智能工作流时，选择器节点扮演着"决策者"的角色，为您的应用提供条件判断和路径选择能力：
- **逻辑分支处理**：根据不同条件选择不同的处理路径
- **多场景适配**：针对不同用户输入或数据状态执行不同操作
- **业务规则实现**：将业务规则转化为可执行的条件判断
- **错误处理**：根据操作结果选择正常流程或异常处理
- **个性化流程**：根据用户特征或历史行为提供定制化体验
## 适用场景
### 1. 用户分类引导
根据用户提供的信息（如年龄、职业、需求等）将用户引导至不同的服务流程，提供针对性的帮助。
### 2. 审批流程
根据申请金额、申请人级别等条件，决定是否需要更高级别的审批或直接通过。
### 3. 智能问答系统
分析用户问题类型，根据不同问题类别转向相应的专业回答流程。
### 4. 数据处理流程
根据数据质量、数据特征或处理结果，选择不同的后续处理方式。
## 节点参数说明
### 基本参数
|参数名称|说明|是否必填|默认值|
|---|---|---|---|
|引用变量|选择要进行判断的变量|是|无|
|选择条件|设置比较方式，如等于、条件等|是|等于|
|比较值|设置比较的目标值，可以是表达式或固定值|是|无|
|条件组合逻辑|多个条件之间的关系，可选"且"或"或"|否|且|

### 条件类型说明
|条件类型|说明|适用数据类型|
|---|---|---|
|等于|判断变量值是否与设定值完全相同|文本、数字、布尔值|
|条件|使用复杂条件表达式进行判断|所有类型|
|固定值|与特定的固定值进行比较|文本、数字、布尔值|
|表达式|使用表达式计算结果进行比较|文本、数字、对象|

### 输出内容
选择器节点没有特定的输出内容，而是根据条件判断结果选择不同的执行路径：
- 条件满足时：执行"对应"分支
- 条件不满足时：执行"否则"分支
## 使用说明
### 基本配置步骤
1. **选择判断变量**：
    1. 从下拉菜单中选择要判断的变量
    2. 可以是用户输入、上游节点的输出或全局变量
2. **设置判断条件**：
    1. 选择适合的条件类型（等于、条件等）
    2. 根据条件类型设置相应的比较值
3. **配置多条件（可选）**：
    1. 点击"+"按钮添加额外的条件
    2. 使用"且"按钮要求所有条件同时满足
    3. 使用"或"按钮只要求任一条件满足
4. **连接下游节点**：
    1. 将"对应"出口连接到条件满足时要执行的节点
    2. 将"否则"出口连接到条件不满足时要执行的节点
#### 与其他节点协同
选择器节点通常需要与其他节点结合使用：
1. **搭配变量保存节点**：
    1. 在选择器之前使用变量保存节点记录判断所需的信息
    2. 选择器判断后再次保存结果状态
2. **结合大模型调用节点**：
    1. 使用大模型生成内容或分析
    2. 选择器根据分析结果决定后续处理
3. **配合数据处理节点**：
    1. 对数据进行预处理和检查
    2. 选择器根据数据特征选择处理方法
## 注意事项
### 变量类型匹配
确保判断变量的类型与比较值类型一致，避免出现意外结果：
- 数字与数字比较（如 `5 > 3`）
- 文本与文本比较（如 `"hello" == "hello"`）
- 布尔值与布尔值比较（如 `true == false`）
### 条件优先级
当使用多个条件时，注意条件组合的优先级：
- "且"的优先级高于"或"
- 复杂条件建议使用表达式明确优先级
### 路径处理
确保所有可能的条件分支都有相应的处理流程：
- 避免出现"悬空"的路径
- 检查是否处理了所有可能的情况
## 常见问题
### 问题1：条件判断结果与预期不符怎么办？
**解决方案**：可能是变量类型或值不符合预期：
- 检查变量的实际值和类型（可使用代码节点输出变量信息）
- 确认比较条件是否正确设置
- 对于文本比较，注意大小写和空格差异
### 问题2：如何处理多种情况的判断？
**解决方案**：对于需要判断多种不同情况的场景：
- 使用多个选择器节点串联，形成完整判断链
- 或使用意图识别节点先分类，再用选择器进一步处理
- 复杂情况可考虑使用代码节点进行自定义逻辑处理
### 问题3：选择器节点判断对象或数组时出错怎么办？
**解决方案**：对象和数组需要特殊处理：
- 使用表达式访问对象特定属性（如 `user.name`）
- 处理数组可使用表达式检查长度或特定元素
- 复杂对象比较建议先使用代码节点转换为简单类型
## 常见搭配节点
|节点类型|搭配原因|
|---|---|
|大模型调用节点|分析内容后根据结果进行条件判断|
|变量保存节点|记录判断结果用于后续流程参考|
|代码执行节点|处理复杂判断逻辑或数据转换|
|消息回复节点|根据不同条件回复不同内容|
|HTTP请求节点|根据请求结果选择不同处理方式|