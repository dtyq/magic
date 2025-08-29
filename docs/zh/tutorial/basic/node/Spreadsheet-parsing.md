# 📊 Nodo Parsing Fogli di Calcolo

## 🔍 Introduzione al Nodo

Il nodo Parsing Fogli di Calcolo è uno strumento specializzato per estrarre e analizzare il contenuto dei file Excel. A differenza del normale nodo di parsing documenti, il nodo Parsing Fogli di Calcolo è in grado di riconoscere la struttura del foglio di calcolo, preservando informazioni chiave come fogli di lavoro, righe, colonne, ecc., rendendo i dati utilizzabili in modo più **strutturato (diversamente dal parsing documenti)** nel flusso di lavoro. Senza bisogno di conoscenze di programmazione, con una semplice configurazione, puoi facilmente ottenere tutti i dati nel foglio Excel e salvarli e trasmetterli secondo la **struttura** originale del foglio.

**Spiegazione Immagine:**

L'interfaccia del nodo Parsing Fogli di Calcolo include due parti principali: input e output. La parte input può impostare la fonte del file (lista file, singolo file, ecc.), la parte output è invece la struttura dati del foglio di calcolo parsato, contenente informazioni file e contenuto del foglio.
![Nodo Parsing Fogli di Calcolo](https://cdn.letsmagic.cn/static/img/Spreadsheet-parsing.png)

## 🤔 Perché Serve il Nodo Parsing Fogli di Calcolo

Nel lavoro quotidiano, i file Excel sono un formato comune per memorizzare e trasmettere dati. Attraverso il nodo Parsing Fogli di Calcolo, puoi:
- **Acquisizione Automatica Contenuto**: Leggere automaticamente i dati nei file Excel, eliminando il processo noioso di copia-incolla manuale
- **Elaborazione Batch**: Elaborare in batch molteplici file di fogli di calcolo, migliorando l'efficienza lavorativa
- **Analisi Strutturata**: Convertire i dati del foglio in formato strutturato, facilitando l'analisi intelligente e l'elaborazione dei nodi successivi
- **Elaborazione Intelligente**: Utilizzare modelli grandi per comprendere e operare sui dati del foglio, implementando l'elaborazione intelligente dei dati

## 🎯 Scenari Applicabili

Il nodo Parsing Fogli di Calcolo è applicabile ai seguenti scenari:

### **Scenario 1: Automazione Analisi Dati**:
Leggere automaticamente file Excel come fogli presenze dipendenti, report vendite, ecc., effettuare analisi dati e generare report riassuntivi

### **Scenario 2: Elaborazione Import Dati**:
Importare cataloghi prodotti, dati clienti, ecc. in fogli di calcolo, e salvare i dati nel sistema o nella knowledge base

### **Scenario 3: Elaborazione Intelligente Moduli**:
Analizzare moduli Excel caricati dagli utenti, effettuare validazione dati, pulizia e conversione

## ⚙️ Spiegazione Parametri del Nodo

### Parametri di Input
|Nome Parametro|Spiegazione|Obbligatorio|Valore Predefinito|
|---|---|---|---|
|Lista File|Scegli la lista di file Excel da parsare, può essere la collezione di file passata dal nodo precedente|Obbligatorio|Nessuno|
|File|Singolo oggetto file foglio di calcolo, alternativo alla lista file|Condizionalmente Obbligatorio|Nessuno|
|Nome File|Nome del file del foglio di calcolo, generalmente utilizzato insieme al link file|Condizionalmente Obbligatorio|Nessuno|
|Link File|Link di download o percorso di accesso del foglio di calcolo|Condizionalmente Obbligatorio|Nessuno|

### Parametri di Output
Il nodo Parsing Fogli di Calcolo restituisce un oggetto file foglio strutturato, contenente le seguenti informazioni:
|Contenuto Output|Spiegazione|
|---|---|
|File Foglio (files_spreadsheet)|File del foglio di calcolo|
|Nome File (file_name)|Nome del file|
|Indirizzo File (file_url)|Indirizzo di accesso del foglio di calcolo|
|Estensione File (file_extension)|Estensione formato file, come xlsx, xls, ecc.|
|Foglio di Lavoro (sheet)|Contiene i dati dei fogli di lavoro nel foglio di calcolo|
|Nome Foglio (sheet_name)|Nome del foglio di lavoro|
|Righe (rows)|Collezione di dati delle righe nel foglio di lavoro|
|Indice Riga (row_index)|Numero di sequenza della riga, inizia da 0|
|Celle (cells)|Collezione di dati delle celle nella riga|
|Valore (value)|Valore effettivo della cella|
|Indice Colonna (column_index)|Numero di sequenza della colonna dove si trova la cella|

## 📋 Istruzioni per l'Uso

### Passi di Configurazione Base
1. **Aggiungi Nodo**: Trascina il nodo "Parsing Fogli di Calcolo" dal pannello nodi al canvas del flusso di lavoro
2. **Connetti Nodo Precedente**: Connetti l'output del nodo precedente (come "Nodo Inizio" o "Nodo Caricamento File", ecc.) al nodo Parsing Fogli di Calcolo
3. **Imposta Parametri di Input**:
    1. Se il nodo precedente fornisce una lista file, seleziona il parametro "Lista File" e fai riferimento alla variabile corrispondente
    2. Se necessiti di parsare un file specifico, compila i parametri "Nome File" e "Link File"
4. **Salva Configurazione**: Clicca il pulsante salva per confermare le impostazioni del nodo
5. **Connetti Nodi Successivi**: Connetti l'output del nodo Parsing Fogli di Calcolo ai nodi downstream (come "Chiamata Modello Grande" o "Esecuzione Codice", ecc.)

### Tecniche Avanzate
1. **Elaborazione Batch di Molteplici Fogli**:
    1. Configura il nodo Ciclo per scorrere ogni foglio di calcolo nella lista file
    2. Utilizza il nodo Parsing Fogli di Calcolo all'interno del ciclo per elaborare singoli file
    3. Utilizza il nodo Salvataggio Variabili per memorizzare i risultati dell'elaborazione
2. **Conversione Dati Foglio**:
    1. In combinazione con il nodo Esecuzione Codice, puoi effettuare conversioni di formato sui dati del foglio parsato
    2. Ad esempio convertire i dati del foglio in formato JSON o CSV
3. **Comprensione Intelligente Foglio**:
    1. Passa i dati del foglio parsato al nodo Chiamata Modello Grande
    2. Utilizza prompt per guidare il modello grande a comprendere la struttura del foglio e il significato dei dati
    3. Fai generare al modello grande riassunti dei dati del foglio o rispondere a domande correlate

## ⚠️ Note Importanti

### Supporto Formati File
- Formati file supportati includono: `.xlsx`, `.xls`, `.csv`
- Per file di fogli in altri formati, potrebbe essere necessario convertirli prima nei formati sopra menzionati per il parsing
- Fogli Excel particolarmente complessi (come quelli contenenti macro, grafici, ecc.) potrebbero influenzare l'effetto del parsing

### Limitazioni Quantità Dati
- Per fogli di grandi dimensioni (come dati con decine di migliaia di righe), il processo di parsing potrebbe richiedere più tempo
- Si consiglia di effettuare elaborazione a frammenti per fogli grandi, o filtrare prima la parte di dati necessaria per il parsing
- In caso di problemi di performance, puoi considerare l'utilizzo del nodo Esecuzione Codice per ottimizzazioni

### Codifica e Lingua
- Per fogli contenenti caratteri speciali o contenuti multilingue, assicurati che il file utilizzi codifica UTF-8
- Caratteri cinesi e altri non inglesi potrebbero necessitare di elaborazione aggiuntiva dopo il parsing per essere visualizzati correttamente

## ❓ Problemi Comuni

### Risultato Parsing Vuoto
**Problema**: Ho configurato il nodo Parsing Fogli di Calcolo, ma l'output è vuoto o senza dati.

**Soluzioni**:
1. Verifica se il file di input è valido, se il link file è accessibile
2. Conferma che il file Excel contenga effettivamente dati, non un foglio vuoto
3. Verifica se il formato file è supportato, formati Excel troppo vecchi potrebbero necessitare conversione
4. Prova prima a scaricare il file localmente, poi caricarlo sulla piattaforma per l'elaborazione

### Dati Parsing Incompleti
**Problema**: Vengono parsati solo alcuni dati del foglio, alcuni contenuti sono persi o errati.

**Soluzioni**:
1. Verifica se il foglio originale contiene celle unite, questo potrebbe influenzare l'effetto del parsing
2. Conferma se il foglio contiene formati speciali (come formule, grafici, ecc.), questi potrebbero non essere completamente parsabili
3. Per file Excel con molteplici fogli di lavoro, assicurati di prestare attenzione al foglio corretto
4. Prova a convertire Excel in formato semplice (come CSV) prima del parsing

### Impossibile Riconoscere Formato Data
**Problema**: Le date nel foglio dopo il parsing diventano numeri o altri formati.

**Soluzioni**:
1. In Excel imposta esplicitamente il formato della colonna data come formato data
2. Dopo il parsing utilizza il nodo Esecuzione Codice per convertire il formato data
3. Utilizza il nodo Chiamata Modello Grande per riconoscere e convertire il formato data

---

# 电子表格解析节点
## 节点介绍
电子表格解析节点是一个专门用于提取和解析Excel表格文件内容的工具。与普通的文档解析节点不同，电子表格解析节点能够识别表格的结构，保留工作表、行、列等关键信息，使得数据在工作流中可以更加**结构化（区别于文档解析）**地使用。无需编程知识，只要简单配置，即可轻松获取Excel表格中的所有数据，并按照表格原有的**结构**进行保存和传递。

**图片说明：**

电子表格解析节点界面包含输入和输出两个主要部分。输入部分可以设置文件来源（文件列表、单个文件等），输出部分则是解析后的表格数据结构，包含文件信息和表格内容。
![电子表格解析节点](https://cdn.letsmagic.cn/static/img/Spreadsheet-parsing.png)

## 为什么需要电子表格解析节点
在日常工作中，Excel文件是存储和传递数据的常用格式。通过电子表格解析节点，您可以：
- **内容自动获取**：自动读取Excel文件中的数据，省去手动复制粘贴的繁琐过程
- **批处理**：批量处理多个电子表格文件，提高工作效率
- **结构化分析**：将表格数据转换为结构化格式，便于后续节点进行智能分析和处理
- **智能处理**：利用大模型对表格数据进行理解和操作，实现智能数据处理
## 适用场景
电子表格解析节点适用于以下场景：
### **场景一：数据分析自动化**：
自动读取员工考勤表、销售报表等Excel文件，进行数据分析并生成摘要报告
### **场景二：数据导入处理**：
导入产品目录、客户资料等电子表格，并将数据存入系统或知识库
### **场景三：智能表单处理**：
解析用户上传的Excel表单，进行数据验证、清洗和转换
## 节点参数说明
### 输入参数
|参数名称|说明|是否必填|默认值|
|---|---|---|---|
|文件列表|选择需要解析的Excel文件列表，可以是上一节点传入的文件集合|必填|无|
|文件|单个电子表格文件对象，与文件列表二选一|条件必填|无|
|文件名称|电子表格的文件名，通常与文件链接配合使用|条件必填|无|
|文件链接|电子表格的下载链接或访问路径|条件必填|无|

### 输出参数
电子表格解析节点输出一个结构化的表格文件对象，包含以下信息：
|输出内容|说明|
|---|---|
|表格文件 (files_spreadsheet)|电子表格的文件|
|文件名称（file_name）|文件名称|
|文件地址 (file_url)|电子表格的访问地址|
|文件扩展名 (file_extension)|文件格式扩展名，如xlsx、xls等|
|工作表 (sheet)|包含电子表格中的工作表数据|
|工作表名称 (sheet_name)|工作表的名称|
|行 (rows)|工作表中的行数据集合|
|行索引 (row_index)|行的序号，从0开始|
|单元格 (cells)|行中的单元格数据集合|
|值 (value)|单元格的实际值|
|列索引 (column_index)|单元格所在的列序号|

## 使用说明
### 基本配置步骤
1. **添加节点**：从节点面板中拖拽"电子表格解析"节点到工作流画布上
2. **连接前置节点**：将前置节点（如"开始节点"或"文件上传节点"等）的输出连接到电子表格解析节点
3. **设置输入参数**：
    1. 如果前置节点提供了文件列表，选择"文件列表"参数并引用对应变量
    2. 如果需要解析指定文件，填写"文件名称"和"文件链接"参数
4. **保存配置**：点击保存按钮确认节点设置
5. **连接后续节点**：将电子表格解析节点的输出连接到下游节点（如"大模型调用"或"代码执行"等）
### 进阶技巧
1. **批量处理多个表格**：
    1. 配置循环节点，遍历文件列表中的每个电子表格
    2. 在循环内部使用电子表格解析节点处理单个文件
    3. 使用变量保存节点存储处理结果
2. **表格数据转换**：
    1. 配合代码执行节点，可以对解析后的表格数据进行格式转换
    2. 例如将表格数据转换为JSON格式或CSV格式
3. **智能表格理解**：
    1. 将解析后的表格数据传入大模型调用节点
    2. 使用提示词引导大模型理解表格结构和数据含义
    3. 让大模型生成表格数据的摘要或回答相关问题
## 注意事项
### 文件格式支持
- 支持的文件格式包括：`.xlsx`、`.xls`、`.csv`
- 对于其他格式的表格文件，可能需要先转换为上述格式再进行解析
- 特别复杂的Excel表格（如包含宏、图表等）可能会影响解析效果
### 数据量限制
- 对于超大型表格（如几十万行的数据），解析过程可能需要较长时间
- 建议对大型表格进行分片处理，或先筛选出所需的数据部分再进行解析
- 如遇性能问题，可以考虑使用代码执行节点进行优化处理
### 编码与语言
- 对于包含特殊字符或多语言内容的表格，请确保文件使用UTF-8编码
- 中文等非英文字符在解析后可能需要额外处理才能正确显示
## 常见问题
### 解析结果为空
**问题**：配置了电子表格解析节点，但输出结果为空或没有数据。

**解决方案**：
1. 检查输入文件是否有效，文件链接是否可访问
2. 确认Excel文件中确实包含数据，而不是空表格
3. 检查文件格式是否受支持，过老的Excel格式可能需要转换
4. 尝试先下载文件到本地，再上传到平台进行处理
### 解析数据不完整
**问题**：只解析出部分表格数据，有些内容丢失或错误。

**解决方案**：
1. 检查原始表格是否存在合并单元格，这可能影响解析效果
2. 确认表格中是否包含特殊格式（如公式、图表等），这些可能无法完全解析
3. 对于多工作表的Excel文件，确保关注的是正确的工作表
4. 尝试将Excel转换为简单格式（如CSV）后再进行解析
### 无法识别日期格式
**问题**：表格中的日期解析后变成了数字或其他格式。

**解决方案**：
1. 在Excel中将日期列格式明确设置为日期格式
2. 解析后使用代码执行节点转换日期格式
3. 使用大模型调用节点识别和转换日期格式