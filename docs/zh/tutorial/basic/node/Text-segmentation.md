# ✂️ Nodo ## 🤔 Perché Serve il Nodo Segmentazione Testo?

Nell'elaborazione di grandi quantità di testo, il blocco di testo intero spesso è troppo grande, non conveniente per analisi precise e elaborazione. Il nodo Segmentazione Testo risolve questo problema:
1. **Limitazioni Elaborazione Modello Grande**: I modelli di linguaggio di grandi dimensioni solitamente hanno limiti sulla quantità di caratteri in input, dopo la segmentazione possono essere elaborati in batch
2. **Elaborazione Raffinata**: Dividere testi lunghi in piccoli frammenti, conveniente per elaborazioni raffinate su contenuti specifici
3. **Migliorare l'Efficienza di Elaborazione**: Effettuare segmentazioni ragionevoli del testo, può migliorare l'efficienza di analisi ed elaborazione successive
4. **Facilitare Archiviazione e Ricerca**: I frammenti di testo dopo la segmentazione sono più adatti all'archiviazione in sistemi come database vettoriali, migliorando la precisione di ricercatazione Testo
## ❓ Che Cos'è il Nodo Segmentazione Testo?

Il nodo Segmentazione Testo è un nodo di elaborazione dati speciale nel flusso di lavoro Magic, utilizzato principalmente per dividere testi lunghi secondo strategie specifiche in frammenti di testo più piccoli. Questo nodo è particolarmente utile nell'elaborazione di grandi quantità di dati testuali, potendo dividere contenuti testuali troppo lunghi in blocchi adatti all'elaborazione dei modelli grandi, migliorando efficienza e accuratezza dell'elaborazione.

**Spiegazione Immagine:**

L'interfaccia del nodo Segmentazione Testo è composta principalmente da aree di input e output. Nell'area di input, puoi specificare il contenuto testuale da segmentare o fare riferimento a variabili; nell'area di output, puoi scegliere il formato di output e impostare il nome della variabile risultato.
![Nodo Segmentazione Testo](https://cdn.letsmagic.cn/static/img/Text-segmentation.png)

## 为什么需要文本切割节点？
在处理大量文本时，整块文本往往过于庞大，不便于精确分析和处理。文本切割节点解决了这个问题：
1. **大模型处理限制**：大语言模型通常有输入字符数量限制，切割后可分批处理
2. **精细化处理**：将长文本切割成小片段，便于针对特定内容进行精细处理
3. **提高处理效率**：对文本进行合理切分，可以提高后续分析和处理的效率
4. **便于存储和检索**：切割后的文本片段更适合存入向量数据库等系统，提高检索精度
## 🎯 Scenari Applicabili

### Scenario 1: Costruzione Knowledge Base Documenti Lunghi
Quando necessiti di importare documenti lunghi (come manuali prodotto, report di ricerca) nella knowledge base, puoi prima utilizzare il nodo Segmentazione Testo per dividere il documento in frammenti di dimensione appropriata, poi importarli nel database vettoriale, questo può migliorare la precisione di ricerca successiva.

### Scenario 2: Elaborazione Testi di Grande Scala
Nell'elaborazione di report giornalistici, feedback clienti e altri testi di grande scala, puoi prima segmentare in paragrafi o frasi, poi analizzare uno per uno, estraendo informazioni chiave o tendenze sentimentali.

### Scenario 3: Elaborazione Messaggi Storici Conversazione
Nell'elaborazione di registrazioni storiche di conversazioni lunghe, puoi utilizzare il nodo Segmentazione Testo per segmentare i messaggi storici secondo tempo o tema, conveniente per analizzare il filo della conversazione o estrarre informazioni chiave.
## ⚙️ Spiegazione Parametri del Nodo

### Parametri di Input
|Nome Parametro|Descrizione|Obbligatorio|Tipo Parametro|Valore Esempio|
|---|---|---|---|---|
|Testo Lungo|Contenuto testuale da segmentare, può essere input diretto o riferimento variabile|Sì|Testo/Riferimento Variabile|"Questo è un contenuto testuale molto lungo..." oppure |

### Parametri di Output
|Nome Parametro|Descrizione|Tipo Parametro|Valore Esempio|
|---|---|---|---|
|Tipo Output|Formato di output del testo dopo segmentazione, può scegliere "Frammenti Testo" o "Array Stringhe"|Selezione|Frammenti Testo|
|Nome Variabile Output|Imposta il nome della variabile del risultato di output, per utilizzo nei nodi successivi|Testo|split_texts|

## 📋 Istruzioni per l'Uso

### Passi di Configurazione Base
1. **Aggiungi Nodo Segmentazione Testo**: Nell'editor del flusso di lavoro, trascina il nodo Segmentazione Testo nel canvas
2. **Configura Testo di Input**:
    1. Input diretto del contenuto testuale nel box di input, oppure
    2. Clicca il pulsante "@" per selezionare dalla lista dropdown la variabile contenente testo (come output del nodo precedente)
3. **Imposta Formato di Output**:
    1. Scegli "Frammenti Testo": formato di output è il formato standard utilizzato internamente dal sistema, adatto per operazioni successive come ricerca vettoriale
    2. Scegli "Array Stringhe": output è array di testo ordinario, adatto per elaborazioni e visualizzazioni generali
4. **Imposta Nome Variabile Output**: Input un nome di variabile significativo, come "split_texts", conveniente per riferimento nei nodi successivi
5. **Connetti Nodi Successivi**: Connetti il nodo Segmentazione Testo con nodi di elaborazione successivi, formando un flusso di lavoro completo

### Tecniche Avanzate
1. **Input Combinazione Variabili**: Puoi combinare molteplici variabili in un testo lungo per poi segmentarlo, ad esempio: `@input_utente + "\n\n" + @storico`
2. **Combinazione con Giudizio Condizionale**: Puoi impostare nodi condizionali, effettuando segmentazione solo quando la lunghezza del testo supera un certo valore
3. **Elaborazione Batch**: In combinazione con nodi ciclo, puoi elaborare in batch molteplici input testuali
## ⚠️ Note Importanti

### Limitazioni Lunghezza Testo
Quando il testo di input è troppo lungo, potrebbe influenzare le prestazioni del sistema. Si consiglia di effettuare pre-elaborazione o importazione a frammenti per testi particolarmente lunghi (come documenti superiori a 10MB).

### Impatto Qualità Segmentazione
La qualità della segmentazione testo influenza direttamente l'effetto di elaborazione successiva. Il sistema attualmente adotta strategia di segmentazione fissa, in futuro verranno aperti più scelte di strategia di segmentazione.

### Norme Denominazione Variabili
Imposta nomi significativi per le variabili di output, evita l'utilizzo di nomi generici come "result", per evitare confusione nell'output di nodi diversi in flussi di lavoro complessi.
## ❓ Problemi Comuni

### Problema 1: Dopo la Segmentazione Testo i Frammenti Sono Troppi, Come Gestirli?
**Soluzioni**:
1. Considera di filtrare i frammenti dopo segmentazione, mantenendo solo contenuti importanti
2. In combinazione con nodi ciclo elabora questi frammenti in batch
3. Nei nodi successivi imposta limiti di elaborazione, come elaborare solo i primi N frammenti

### Problema 2: Dopo la Segmentazione i Frammenti di Testo Perdono Correlazione Contestuale, Come Mantenere Coerenza Semantica?
**Soluzioni**:
1. Assicurati che la granularità di segmentazione sia appropriata, non segmentare troppo finemente
2. Nell'elaborazione successiva, puoi considerare di introdurre contenuti di frammenti adiacenti come contesto
3. Nell'utilizzo di modelli grandi per l'elaborazione, puoi specificare chiaramente nella parola chiave che questi frammenti di testo sono correlati
## 🔗 Nodi Comuni da Abbinare

|Tipo Nodo|Motivo Abbinamento|
|---|---|
|Nodo Parsing Documenti|Prima analizza documenti, poi effettua segmentazione testo|
|Nodo Archiviazione Vettoriale|Archivia i frammenti di testo dopo segmentazione nel database vettoriale|
|Nodo Chiamata Modello Grande|Analizza ed elabora i frammenti di testo dopo segmentazione|
|Nodo Ciclo|Elabora in batch i molteplici frammenti di testo dopo segmentazione|

---

# 文本切割节点
## 什么是文本切割节点？
文本分割节点是Magic工作流中的一个特殊数据处理节点，主要用于将长文本按照特定策略分割成更小的文本片段。这个节点在处理大量文本数据时特别有用，能够将过长的文本内容切分成适合大模型处理的小块，提高处理效率和准确性。

**图片说明：**

文本切割节点界面主要由输入区域和输出区域组成。在输入区域，您可以指定要切割的文本内容或引用变量；在输出区域，您可以选择输出格式并设置结果变量名。
![文本切割节点](https://cdn.letsmagic.cn/static/img/Text-segmentation.png)

## 为什么需要文本切割节点？
在处理大量文本时，整块文本往往过于庞大，不便于精确分析和处理。文本切割节点解决了这个问题：
1. **大模型处理限制**：大语言模型通常有输入字符数量限制，切割后可分批处理
2. **精细化处理**：将长文本切割成小段，便于针对特定内容进行精细处理
3. **提高处理效率**：对文本进行合理切分，可以提高后续分析和处理的效率
4. **便于存储和检索**：切割后的文本片段更适合存入向量数据库等系统，提高检索精度
## 适用场景
### 场景一：长文档知识库构建
当您需要将长篇文档（如产品手册、研究报告）导入知识库时，可以先使用文本切割节点将文档切割成合适大小的片段，再导入向量数据库，这样能提高后续检索的精确度。
### 场景二：大规模文本处理
处理新闻报道、客户反馈等大规模文本时，可以先切割成段落或句子，然后逐一分析，提取关键信息或情感倾向。
### 场景三：对话历史消息处理
在处理长时间的对话历史记录时，可以通过文本切割节点将历史消息按照时间或主题进行切割，便于分析对话脉络或提取关键信息。
## 节点参数说明
### 输入参数
|参数名称|描述|是否必填|参数类型|示例值|
|---|---|---|---|---|
|长文本|需要切割的文本内容，可以直接输入或从变量引用|是|文本/变量引用|"这是一段很长的文本内容..." 或 |

### 输出参数
|参数名称|描述|参数类型|示例值|
|---|---|---|---|
|输出类型|切割后文本的输出格式，可选"文本片段"或"字符串数组"|选择项|文本片段|
|输出变量名|设置输出结果的变量名，供后续节点使用|文本|split_texts|

## 使用说明
### 基本配置步骤
1. **添加文本切割节点**：在工作流编辑器中，将文本切割节点拖入画布
2. **配置输入文本**：
    1. 直接在输入框中输入文本内容，或
    2. 点击"@"按钮，从下拉菜单中选择包含文本的变量（如上一节点的输出）
3. **设置输出格式**：
    1. 选择"文本片段"：输出格式为系统内部使用的标准格式，适合后续进行向量搜索等操作
    2. 选择"字符串数组"：输出为普通文本数组，适合一般处理和显示
4. **设置输出变量名**：输入一个有意义的变量名，如"split_texts"，方便在后续节点中引用
5. **连接后续节点**：将文本切割节点与后续处理节点连接起来，形成完整工作流

### 进阶技巧
1. **变量组合输入**：可以将多个变量组合成一个长文本再进行切割，例如：`@用户输入 + "\n\n" + @历史记录`
2. **结合条件判断**：可以设置条件节点，仅在文本长度超过一定值时进行切割处理
3. **批量处理**：结合循环节点，可以批量处理多个文本输入
## 注意事项
### 文本长度限制
当输入文本过长时，可能会影响系统性能。建议对特别长的文本（如超过10MB的文档）先进行预处理或分批导入。
### 切割质量影响
文本切割的质量直接影响后续处理效果。系统目前采用的是固定策略切割，未来将开放更多切割策略选择。
### 变量命名规范
为输出变量设置有意义的名称，避免使用如"result"这样的通用名称，以防在复杂工作流中混淆不同节点的输出。
## 常见问题
### 问题一：文本切割后片段过多，如何处理？
**解决方案**：
1. 考虑对切割后的片段进行过滤，仅保留重要内容
2. 结合循环节点分批处理这些片段
3. 在后续节点中设置处理限制，如仅处理前N个片段
### 问题二：切割后的文本片段丢失了上下文关联，如何保持语义连贯？
**解决方案**：
1. 确保切割的粒度适中，不要切得过细
2. 在后续处理中，可以考虑引入相邻片段的内容作为上下文
3. 使用大模型处理时，可以在提示词中明确说明这些文本片段之间的关系
## 常见搭配节点
|**节点类型**|**搭配原因**|
|---|---|
|文档解析节点|先解析文档，再进行文本切割|
|向量存储节点|将切割后的文本片段存入向量数据库|
|大模型调用节点|对切割后的文本片段进行分析和处理|
|循环节点|批量处理切割后的多个文本片段|