# Nodo Esecuzione Codice 🚀

## Che cos'è il Nodo Esecuzione Codice?

Il Nodo Esecuzione Codice è uno strumento potente che permette di scrivere ed eseguire frammenti di codice personalizzati all'interno del flusso di lavoro. Attraverso questo nodo, è possibile utilizzare linguaggi di programmazione (attualmente supportati PHP e Python) per elaborare dati, eseguire calcoli o implementare logiche complesse che altri nodi non possono gestire direttamente. È come avere un piccolo ambiente di programmazione integrato nel flusso di lavoro, che offre flessibilità per affrontare varie esigenze speciali.

**Spiegazione Immagine:**

L'interfaccia del Nodo Esecuzione Codice è composta principalmente da tre parti: la zona di input del nodo in alto, l'area di modifica del codice al centro, e la zona di configurazione dell'output in basso. Nell'area di modifica del codice, è possibile scrivere direttamente il codice; in alto e in basso, è possibile impostare i parametri di input necessari al codice e i parametri di output generati.
![Nodo Esecuzione Codice](https://cdn.letsmagic.cn/static/img/20250408165220.jpg)

## Perché serve il Nodo Esecuzione Codice?

Durante la costruzione dei flussi di lavoro, potresti incontrare queste situazioni:
1. **Elaborazione dati complessa**: Necessità di trasformare, calcolare o riorganizzare dati in modi complessi
2. **Logica condizionale**: Implementare giudizi condizionali più complessi rispetto ai semplici nodi di diramazione
3. **Funzionalità personalizzate**: Implementare funzionalità specifiche che altri nodi non possono fornire direttamente
4. **Algoritmi speciali**: Applicare algoritmi o formule aziendali specifici

Il Nodo Esecuzione Codice è progettato per risolvere queste situazioni. Permette di liberarsi dalle limitazioni delle funzionalità preimpostate, implementando logiche completamente personalizzate attraverso la programmazione.

## Scenari di Applicazione

### 1. Conversione Formato Dati
Quando è necessario convertire i dati ottenuti dalle API in formati specifici, o combinare dati da molteplici fonti in una struttura unificata, il Nodo Esecuzione Codice può gestire facilmente queste conversioni.

### 2. Calcoli Complessi
Per scenari che coinvolgono calcoli multi-step, elaborazione ciclica o l'uso di algoritmi specifici, il Nodo Esecuzione Codice può implementare logiche di calcolo di qualsiasi complessità.

### 3. Giudizi di Regole Personalizzate
Quando le regole aziendali sono complesse e non possono essere espresse con semplici nodi condizionali, il Nodo Esecuzione Codice può implementare logiche di giudizio multi-condizione e multi-livello.

## Spiegazione Parametri del Nodo

### Parametri Base

|Nome Parametro|Descrizione|Obbligatorio|Valore Default|
|---|---|---|---|
|Linguaggio Codice|Selezionare il linguaggio di esecuzione del codice, supporta PHP e Python|Sì|PHP|
|Modalità Codice|Selezionare la modalità di origine del codice, può essere scrittura diretta o importazione variabile|Sì|Scrittura Diretta|
|Contenuto Codice|Il frammento di codice da eseguire|Sì|Vuoto|
|Importa Codice|Quando si seleziona la modalità "Importa Variabile", specificare la variabile che contiene il codice|Obbligatorio solo in modalità importazione|Nessuno|
|Parametri Input|Il Nodo Esecuzione Codice può ricevere dati passati dai nodi upstream come input. È possibile aggiungere e configurare questi parametri nella scheda "Input" del nodo|Sì|Nessuno|
|Parametri Output|Il risultato dell'esecuzione del codice può essere configurato come parametri di output, da passare ai nodi downstream. È possibile aggiungere e configurare questi parametri nella scheda "Output" del nodo|Sì|Nessuno|

### Spiegazione Tipi di Dati

I parametri di input e output supportano molteplici tipi di dati:
- Stringa
- Numero
- Booleano
- Array
- Oggetto
- Array di Stringhe
- Array di Interi
- Array di Booleani
- Array di Oggetti
- Valore Numerico
- Array di Valori Numerici

## Istruzioni per l'Uso

### Passi di Configurazione Base

1. **Aggiungere Nodo Esecuzione Codice**: Nell'editor del flusso di lavoro, trascinare il nodo "Esecuzione Codice" sulla tela.
2. **Selezionare Linguaggio Codice**: Cliccare sul nodo, nel pannello delle proprietà a destra selezionare il linguaggio del codice (PHP o Python).
3. **Scrivere Codice**:
    1. Se si seleziona la modalità "Scrittura Diretta", inserire il codice nell'editor di codice
    2. Se si seleziona la modalità "Importa Variabile", selezionare la variabile che contiene il codice
4. **Configurare Parametri Input**:
    1. Cliccare sulla scheda "Input"
    2. Cliccare il pulsante "Aggiungi Parametro"
    3. Impostare nome parametro, tipo e valore
5. **Configurare Parametri Output**:
    1. Cliccare sulla scheda "Output"
    2. Cliccare il pulsante "Aggiungi Parametro"
    3. Impostare nome parametro e tipo
6. **Connettere Nodi**: Connettere i nodi upstream al nodo di esecuzione codice, e il nodo di esecuzione codice ai nodi downstream.
7. **Salvare Flusso di Lavoro**: Cliccare il pulsante di salvataggio per salvare la configurazione.

### Tecniche Avanzate

#### Esempio Codice PHP
In modalità PHP, il codice riceverà i parametri di input come variabili e fornirà l'output attraverso un array di ritorno:
```php
<?php
// Ottenere parametri di input
$name = $name ?? 'Ospite';
$age = $age ?? 0;

// Logica di elaborazione
$greeting = "Ciao, {$name}!";
$isAdult = $age >= 18;
$message = $isAdult ? "Sei maggiorenne." : "Non sei maggiorenne.";

// Restituire risultato (diventerà parametro di output)
return [
    'greeting' => $greeting,
    'isAdult' => $isAdult,
    'message' => $message
];
```

#### Esempio Codice Python
In modalità Python, il codice riceverà i parametri di input come variabili e fornirà l'output definendo variabili globali:
```python
# Ottenere parametri di input
name = globals().get('name', 'Ospite')
age = globals().get('age', 0)

# Logica di elaborazione
greeting = f"Ciao, {name}!"
is_adult = age >= 18
message = "Sei maggiorenne." if is_adult else "Non sei maggiorenne."

# Impostare parametri di output (diventeranno variabili globali)
globals()['greeting'] = greeting
globals()['is_adult'] = is_adult
globals()['message'] = message
```

## Note Importanti

### Limitazioni di Sicurezza del Codice

1. **Limite Tempo Esecuzione**: L'esecuzione del codice ha un limite di tempo, codici che richiedono molto tempo potrebbero essere interrotti.
2. **Limitazioni Risorse**: L'ambiente di esecuzione ha memoria e capacità di elaborazione limitate, evitare operazioni troppo complesse o intensive in risorse.
3. **Limitazioni Accesso**: Per motivi di sicurezza, l'ambiente di esecuzione del codice non può accedere direttamente al file system o effettuare richieste di rete.

### Tecniche di Debug

1. **Output Informazioni Debug**: Usare `echo` in PHP o `print` in Python per output di informazioni di debug, queste informazioni verranno mostrate nei log di esecuzione del nodo.
2. **Test Graduale**: Logiche complesse dovrebbero essere scomposte in piccoli passi, testare gradualmente per garantire che ogni parte sia corretta.
3. **Validazione Dati**: Aggiungere controlli all'inizio del codice per validare l'esistenza e la correttezza dei parametri di input.

## Domande Frequenti

### Perché il mio codice non viene eseguito correttamente?

1. **Controllare Errori Sintassi**: Assicurarsi che il codice non abbia errori di sintassi, come punti e virgola mancanti, parentesi non corrispondenti, ecc.
2. **Controllare Nomi Variabili**: Assicurarsi che i nomi dei parametri di input referenziati nel codice corrispondano esattamente ai nomi dei parametri di input configurati, inclusi maiuscole e minuscole.
3. **Controllare Formato Ritorno**: Assicurarsi che il codice PHP restituisca correttamente l'array, o che il codice Python imposti correttamente le variabili globali.

### Come utilizzare i risultati dei nodi upstream nel codice?

1. **Configurare Parametri Input**: Prima aggiungere nella scheda "Input" i parametri corrispondenti ai risultati dei nodi upstream.
2. **Referenziare Valori Variabili**: Impostare il valore del parametro come variabile di output del nodo upstream.
3. **Utilizzare nel Codice**: Nel codice referenziare direttamente questi parametri di input attraverso il nome della variabile.

## Migliori Pratiche

### Nodi di Combinazione Comuni

|Tipo Nodo|Motivo Combinazione|
|---|---|
|Nodo Diramazione Condizionale|Il Nodo Esecuzione Codice può elaborare logiche complesse, poi passare i risultati al Nodo Diramazione Condizionale per il giudizio.|
|Nodo Richiesta HTTP|Elaborare i dati restituiti dalle richieste API, effettuare conversioni di formato o estrarre informazioni chiave.|
|Nodo Chiamata Modello Grande|Elaborare i contenuti generati dal modello grande, come estrarre informazioni specifiche, formattare o classificare.|

---

# 中文原文

## 什么是代码执行节点？

代码执行节点是一个强大的工具，允许在工作流中编写并执行自定义代码片段。通过该节点，可以使用编程语言（当前支持 PHP 和 Python）对数据进行处理、计算，或实现其他节点无法直接完成的复杂逻辑。它就像工作流中的一个小型编程环境，为应对各种特殊需求提供了灵活性。

图片说明：

代码执行节点界面主要由三部分组成：上方的节点输入区、中间的代码编辑区以及下方的输出配置区。在代码编辑区可以直接编写代码；在上下区域可以分别配置代码所需的输入参数与产出的输出参数。
![代码执行节点](https://cdn.letsmagic.cn/static/img/20250408165220.jpg)

## 为什么需要代码执行节点？

在构建工作流时，可能会遇到如下场景：
1. 复杂数据处理：需要对数据进行复杂的转换、计算或重组
2. 条件逻辑控制：实现比简单分支更复杂的条件判断
3. 自定义功能：实现其他节点无法直接提供的特定功能
4. 特殊算法：应用某些业务专用的算法或公式

代码执行节点正是为了解决这些情况而设计。它让我们摆脱预设功能的限制，通过编程实现完全自定义的业务逻辑。

## 适用场景

### 1. 数据格式转换
当需要将 API 获取的数据转换为特定结构，或者将来自多来源的数据合并为统一结构时，代码执行节点可以轻松处理这些转换。

### 2. 复杂计算
对于涉及多步计算、循环处理或使用特定算法的场景，代码执行节点都可以实现任意复杂度的计算逻辑。

### 3. 自定义规则判断
当业务规则较复杂，无法用简单的条件分支表达时，代码执行节点可以实现多条件、多层级的判断逻辑。

## 节点参数说明

### 基础参数

|参数名|说明|是否必填|默认值|
|---|---|---|---|
|代码语言|选择代码运行语言，支持 PHP 和 Python|是|PHP|
|代码模式|选择代码来源方式，可为直接书写或变量导入|是|直接书写|
|代码内容|需要执行的代码片段|是|空|
|导入代码|选择“变量导入”模式时，指定承载代码的变量|仅在导入模式必填|无|
|输入参数|可在“输入”配置页添加并配置，接收上游节点传入的数据|是|无|
|输出参数|可在“输出”配置页添加并配置，将运行结果传递给下游|是|无|

### 数据类型说明

输入与输出参数支持多种类型：
- 字符串
- 数字
- 布尔
- 数组
- 对象
- 字符串数组
- 整数数组
- 布尔数组
- 对象数组
- 数值
- 数值数组

## 使用说明

### 基本配置步骤

1. 添加代码执行节点：在画布中拖入“代码执行”节点
2. 选择语言：在右侧属性面板选择 PHP 或 Python
3. 编写/导入代码：
    1. 选择“直接书写”时，在编辑器中输入代码
    2. 选择“变量导入”时，选择承载代码的变量
4. 配置输入参数：
    1. 切换到“输入”页
    2. 点击“添加参数”，设置名称、类型与取值
5. 配置输出参数：
    1. 切换到“输出”页
    2. 点击“添加参数”，设置名称与类型
6. 连接上下游节点：将上游输出连入本节点，并将本节点输出连接至下游
7. 保存：点击保存按钮保存配置

### 进阶技巧

#### PHP 代码示例
在 PHP 模式下，代码通过返回数组的方式输出结果：
```php
<?php
// 获取输入参数
$name = $name ?? '访客';
$age = $age ?? 0;

// 处理逻辑
$greeting = "你好，{$name}!";
$isAdult = $age >= 18;
$message = $isAdult ? "已成年。" : "未成年。";

// 返回结果（作为输出参数）
return [
    'greeting' => $greeting,
    'isAdult' => $isAdult,
    'message' => $message
];
```

#### Python 代码示例
在 Python 模式下，通过设置全局变量的方式输出结果：
```python
# 获取输入参数
name = globals().get('name', '访客')
age = globals().get('age', 0)

# 处理逻辑
greeting = f"你好，{name}!"
is_adult = age >= 18
message = "已成年。" if is_adult else "未成年。"

# 设置输出参数（作为全局变量）
globals()['greeting'] = greeting
globals()['is_adult'] = is_adult
globals()['message'] = message
```

## 注意事项

### 安全限制

1. 执行超时：代码运行有时间限制，长时间运行会被中断
2. 资源限制：执行环境的内存与算力有限，避免过于复杂或高开销操作
3. 访问限制：出于安全考虑，运行环境不可直接访问文件系统或发起网络请求

### 调试技巧

1. 调试输出：PHP 使用 `echo`、Python 使用 `print` 输出调试信息，可在节点执行日志查看
2. 逐步测试：复杂逻辑建议拆分为小步骤，逐步验证
3. 数据校验：在代码开头添加参数校验，确保输入存在且格式正确

## 常见问题

### 代码未正确执行怎么办？
1. 检查语法错误：如分号、括号是否匹配等
2. 检查变量名：代码引用的输入变量需与“输入”参数配置完全一致（区分大小写）
3. 检查返回格式：PHP 需返回数组；Python 需正确设置全局变量

### 如何在代码中使用上游结果？
1. 在“输入”页添加与上游结果对应的参数
2. 将参数值配置为上游节点的输出变量
3. 在代码中直接以变量名使用

## 最佳实践

### 常见搭配节点

|节点类型|搭配原因|
|---|---|
|条件分支节点|先由代码节点处理复杂逻辑，再交由分支判断|
|HTTP 请求节点|对 API 响应数据做二次处理、格式转换或关键信息提取|
|大模型调用节点|对大模型产出的文本做进一步抽取、格式化或分类|
