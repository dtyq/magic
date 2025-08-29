# Nodo di Fine 🔚

## Che cos'è il nodo di fine?
Il nodo di fine è l'ultimo nodo di un flusso di lavoro; serve a restituire le informazioni di risultato al termine dell'esecuzione. Ogni flusso di lavoro necessita almeno di un nodo di fine, ma è possibile averne più di uno per gestire diversi percorsi di terminazione.

Immagine esplicativa:

L'interfaccia del nodo di fine contiene l'area di configurazione "Output", dove puoi definire i parametri da restituire alla fine del flusso. È possibile aggiungere più parametri di output; per ciascuno si impostano nome parametro, nome visualizzato e valore. Il valore può essere un'espressione o un valore fisso e può referenziare dati prodotti da altri nodi del flusso.
![结束节点](https://cdn.letsmagic.cn/static/img/End-node.png)

## Perché serve il nodo di fine?
Nel disegno dei flussi, il nodo di fine risolve questi punti chiave:
1. Chiarezza del punto di termine: marca esplicitamente dove termina l'esecuzione, rendendo più chiara la logica del flusso.
2. Definizione dell'output: consente di configurare cosa esporre come risultato finale.
3. Ritorno dati coerente: formatta e organizza l'output per garantirne coerenza e usabilità.
4. Supporto a flussi complessi: su percorsi multipli, nodi di fine diversi possono restituire risultati differenti.

## Scenari tipici
### 1. Flusso Q&A intelligente
Restituisce la risposta finale elaborata e, se necessario, raccomandazioni o riferimenti.
### 2. Flussi di elaborazione dati
Ritorna risultati elaborati come report statistici o conclusioni di analisi.
### 3. Sottoprocessi
Quando il flusso è invocato come sottoprocesso, definisce i dati da restituire al flusso principale, come il valore di ritorno di una funzione.

## Parametri del nodo
### Parametri di output
La configurazione centrale è l'output, ovvero i dati da restituire alla fine:
|Voce|Descrizione|Obbligatorio|
|---|---|---|
|Nome|Identificatore del parametro per i riferimenti nel sistema|Sì|
|Nome visualizzato|Nome amichevole per l'interfaccia|Sì|
|Tipo|Stringa, array, ecc.|Sì|
|Valore|Valore effettivo (fisso, espressione o variabile)|Sì|

## Istruzioni d'uso
### Passi base
1. Aggiungi il nodo di fine:
    1. Trascinalo dal pannello nel canvas
    2. Collega l'output del nodo precedente al nodo di fine
2. Configura gli output:
    1. Clicca "Aggiungi parametro" per ogni output necessario
    2. Imposta nome (es. "result") e nome visualizzato (es. "Risultato")
    3. Scegli tipo di valore (espressione o fisso)
    4. Con espressioni, usa `${nomeVariabile}` per referenziare variabili del flusso
3. Salva:
    1. Verifica di aver configurato tutti gli output necessari
    2. Salva la configurazione del nodo

### Suggerimenti avanzati
#### Organizzazione multi-parametro
Per restituire parametri correlati:
1. Raggruppa per funzione o tipo di dato
2. Usa strutture annidate JSON, ad es. `{"data": ${result}, "meta": ${metadata}}`
3. Segui regole di naming coerenti, es. `result_main`, `result_details`

#### Output dinamici
Restituisci risultati diversi su percorsi diversi:
1. Preponi una diramazione condizionale e collega a nodi di fine diversi
2. Pre-impacchetta i possibili risultati in un'unica variabile tramite un nodo codice e referenzialo qui

## Note
### Naming dei parametri
1. Evita caratteri speciali; usa lettere, numeri e underscore
2. Naming semantico, es. `search_result` invece di `data`
3. Mantieni coerenza tra più nodi di fine nello stesso flusso

### Tipi di dato
1. Garantisci la compatibilità con ciò che il consumer si aspetta
2. Converti formati con un nodo codice quando serve
3. Gestisci i null con default ragionevoli

### Gestione di più nodi di fine
1. Etichettali chiaramente
2. Pianifica i percorsi assicurando un nodo di fine per ciascuno
3. Mantieni coerente la struttura dei parametri chiave

## FAQ
### Perché i parametri di output non compaiono nel risultato?
1. Controlla il nome (typo)
2. Verifica la sintassi dell'espressione e l'esistenza della variabile
3. Verifica che l'esecuzione arrivi al nodo di fine
4. Verifica lo scope delle variabili

### Come restituire strutture complesse?
1. Usa JSON: `{"items": ${list}, "count": ${count}}`
2. Prepara i dati prima con un nodo codice
3. Usa naming gerarchico: `result_header`, `result_body`, `result_footer`

### Come garantire un termine corretto su percorsi multipli?
1. Analizza i percorsi possibili
2. Prevedi un nodo di fine per ogni percorso principale
3. Uniforma la struttura del payload
4. Includi uno stato (`status`, `code`) per distinguere i casi

## Nodi spesso abbinati
|Tipo nodo|Motivo|
|---|---|
|Diramazione condizionale|Collega a nodi di fine diversi per risultati diversi|
|Esecuzione codice|Prepara e formatta l'output finale|
|Chiamata modello LLM|Genera risposte strutturate poi restituite|
|Risposta messaggio|Invia un messaggio prima della fine e registra l'esito|

---

# 中文原文

## 什么是结束节点？
结束节点是工作流的最终节点，用于返回工作流程运行后的结果信息。每个工作流至少需要一个结束节点，但也可以有多个结束节点对应不同的结束路径。

**图片说明：**

结束节点界面主要包含"输出"配置区域，您可以在此处定义工作流结束时需要返回的参数。界面支持添加多个输出参数，每个参数需要设置参数名、显示名称和参数值。参数值可以是表达式或固定值，支持引用工作流中其他节点产生的数据。
![结束节点](https://cdn.letsmagic.cn/static/img/End-node.png)

## 为什么需要结束节点？
在构建工作流时，结束节点解决了以下关键问题：
1. **明确工作流终点**：结束节点清晰地标记了工作流执行的终止点，让整个流程逻辑更加清晰。
2. **定义输出结果**：结束节点可以配置输出参数，决定工作流最终对外展示哪些结果数据。
3. **规范数据返回**：结束节点对输出数据进行格式化和组织，确保返回结果的一致性和可用性。
4. **支持复杂流程**：在有多个可能结束点的复杂工作流中，不同的结束节点可以返回不同的结果数据。

## 适用场景
### 1. 智能问答流程
在问答型AI 助理中，结束节点可以输出经过处理的最终回答内容，以及可能的相关推荐或引用资料。
### 2. 数据处理工作流
在数据分析或处理流程中，结束节点返回处理完成的数据结果，如统计报表、分析结论等。
### 3. 子流程调用
当作为子流程被主流程调用时，结束节点定义了子流程需要返回给主流程的数据，类似函数的返回值。

## 节点参数说明
### 输出参数
结束节点的核心配置是输出参数，您可以定义工作流结束时需要返回的数据：
|配置项|描述|是否必填|
|---|---|---|
|参数名|输出参数的标识符，用于在系统中引用此参数|是|
|显示名称|参数的友好显示名称，用于界面展示|是|
|参数类型|支持设置不同的参数类型，如：字符串，数组等|是|
|参数值|参数的实际值，可以是固定值、表达式或变量引用|是|

## 使用说明
### 基本配置步骤
1. **添加结束节点**：
    1. 从节点面板中拖拽"结束节点"到画布上
    2. 将前一个节点的输出连接到结束节点
2. **配置输出参数**：
    1. 点击"添加参数"按钮添加需要输出的参数
    2. 设置参数名（如"result"）和显示名称（如"处理结果"）
    3. 选择参数值类型（表达式或固定值）
    4. 如果选择表达式，可使用`${变量名}`引用工作流中的变量
3. **保存配置**：
    1. 确认所有必要的输出参数都已配置完成
    2. 保存节点配置，完成结束节点的设置

### 进阶技巧
#### 多参数组织
当需要返回多个相关参数时，可以采用以下组织方式：
1. **相关参数分组**：按照功能或数据类型组织参数，使结构更清晰
2. **使用嵌套结构**：利用JSON格式组织复杂数据，如`{"data": ${result}, "meta": ${metadata}}`
3. **参数命名规范**：使用统一的命名规则，如`result_main`、`result_details`等

#### 动态输出处理
根据流程不同路径返回不同结果：
1. **条件判断前置**：在结束节点前使用条件分支节点，根据不同条件连接到不同的结束节点
2. **变量包装**：使用代码执行节点将多种可能的结果预先包装到一个变量中，然后在结束节点引用

## 注意事项
### 参数命名规范
1. **避免特殊字符**：参数名应使用字母、数字和下划线，避免空格和特殊字符
2. **语义化命名**：参数名应反映其内容和用途，如`search_result`而非简单的`data`
3. **保持一致性**：同一工作流中的多个结束节点应遵循统一的命名规范

### 数据类型处理
1. **类型一致性**：确保输出参数的数据类型符合调用方的预期
2. **格式转换**：必要时使用代码执行节点进行数据格式转换
3. **空值处理**：考虑参数可能为空的情况，提供合理的默认值

### 多结束节点管理
1. **清晰标识**：给不同的结束节点添加明确的标签或注释
2. **路径规划**：确保每个可能的执行路径都有对应的结束节点
3. **结果一致性**：即使是不同的结束节点，也应保持关键参数结构的一致性

## 常见问题
### 为什么我设置的输出参数没有显示在结果中？
1. **检查参数名称**：确认参数名没有拼写错误
2. **检查表达式**：如果使用表达式，确认语法正确且引用的变量存在
3. **检查流程执行**：确认工作流确实执行到了这个结束节点
4. **检查变量作用域**：确认引用的变量在结束节点的作用域内可访问

### 如何返回复杂的数据结构？
1. **使用JSON格式**：在表达式中使用JSON格式组织复杂数据，如`{"items": ${list}, "count": ${count}}`
2. **预处理数据**：在结束节点之前使用代码执行节点构建复杂数据结构
3. **结构化命名**：使用有层次的参数命名方式，如`result_header`、`result_body`、`result_footer`

### 如何确保工作流中有多个路径时，每个路径都有合适的结束？
1. **路径分析**：梳理工作流所有可能的执行路径
2. **对应结束节点**：为每个主要路径设置独立的结束节点
3. **统一返回结构**：保持所有结束节点的核心参数结构一致
4. **状态标识**：在输出中包含状态标识（如`status`、`code`），便于识别不同路径的结果

## 常见搭配节点
|节点类型|搭配原因|
|---|---|
|条件分支节点|根据不同条件连接到不同的结束节点，返回不同结果|
|代码执行节点|在结束前整理和格式化最终输出数据|
|大模型调用节点|生成结构化的回答内容，然后由结束节点返回|
|消息回复节点|在结束前向用户发送消息，结束节点则记录操作结果|
