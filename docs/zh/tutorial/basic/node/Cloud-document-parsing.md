# Nodo Analisi Documenti Cloud ☁️📄
## Che cos'è il nodo Analisi Documenti Cloud?
Il nodo Analisi Documenti Cloud è un modulo per leggere ed elaborare documenti Markdown archiviati nel cloud. Permette di ottenere e usare direttamente nel flusso i documenti di conoscenza interni dell'azienda, senza copiare-incollare manualmente. Con questo nodo puoi caricare automaticamente il contenuto del documento nel flusso per l'elaborazione a valle.

Immagine esplicativa:

L'interfaccia di configurazione comprende l'area di selezione documento, in cui puoi indicare tramite selettore il documento cloud da analizzare.
![云文档解析节点](https://cdn.letsmagic.cn/static/img/Cloud-document-parsing.png)

## Perché serve?
Nella costruzione di flussi intelligenti spesso bisogna riferirsi/analizzare documenti esistenti. Questo nodo risolve:
1. Automazione acquisizione: lettura automatica dei documenti cloud, niente copia manuale
2. Integrazione della conoscenza: integra la knowledge base interna nei flussi
3. Aggiornamento in tempo reale: quando il documento cambia, il flusso può leggere il contenuto più recente
4. Elaborazione strutturata: converte Markdown in strutture dati utilizzabili dai nodi successivi

## Scenari d'uso
### Scenario 1: Q&A su knowledge base
Costruisci un sistema Q&A basato su documenti interni: all'interrogazione, estrae info dai documenti e genera la risposta.
### Scenario 2: Analisi contenuto documenti
Analizza automaticamente contenuti, estrae chiavi/metriche o genera report riassuntivi.
### Scenario 3: Alert aggiornamento documenti
Monitora documenti critici e notifica quando ci sono aggiornamenti con changelog o sommario.

## Parametri del nodo
### Input
|Nome|Descrizione|Obbligatorio|Default|
|---|---|---|---|
|Selettore documento|Scegli il documento cloud da analizzare|Sì|—|

### Output
|Nome|Descrizione|Tipo|
|---|---|---|
|Contenuto (content)|Testo del documento analizzato|Stringa|

## Istruzioni d'uso
### Passi base
1. Aggiungi il nodo al canvas dall'elenco nodi
2. Seleziona documento:
    1. Dal menu a discesa scegli direttamente il documento cloud da analizzare
3. Collega i nodi a valle: collega l'output a nodi di elaborazione successivi

### Suggerimenti avanzati
1. Selezione dinamica: passa l'ID documento come variabile per scegliere dinamicamente
2. Estrazione mirata: insieme al nodo codice estrai sezioni specifiche
3. Multi-documento: usa un ciclo per elaborare più documenti in batch
4. Diff contenuti: confronta versioni diverse con logiche personalizzate nel nodo codice

## Note
### Permessi di accesso
Assicurati che l'esecutore del flusso abbia accesso al documento selezionato.
### Dimensione documenti
Documenti molto grandi possono impattare le performance; valuta split o pre-estrazioni.
### Supporto Markdown
Supporta Markdown standard; formati speciali/custom potrebbero non essere interpretati correttamente.
### Tempistiche
Si legge il contenuto al momento dell'esecuzione; per documenti che cambiano spesso valuta una cache.

## FAQ
### Il documento non si visualizza o analizza correttamente
Soluzioni:
- Verifica la conformità del formato Markdown
- Verifica caratteri speciali/encoding
- Verifica i permessi sul documento

### Come gestire immagini e allegati?
Soluzioni:
- Il nodo estrae solo testo per default
- Per immagini usa un nodo Richiesta HTTP per recuperarle
- Per allegati usa API dedicate ai file

### Come trattare tabelle formattate?
Soluzioni:
- Le tabelle Markdown vengono estratte come testo
- Converti in strutture con un nodo codice a valle
- Per casi complessi valuta il nodo analisi fogli di calcolo

## Nodi spesso abbinati
|Tipo|Motivo|
|---|---|
|Chiamata LLM|Riassumere, rispondere, estrarre info dal contenuto
|Segmentazione testo|Spezzare testi lunghi in chunk
|Codice|Trasformazioni/estrazioni personalizzate
|Ricerca conoscenza|Q&A basato su vettori e similarità

---

# 中文原文
## 什么是云文档解析节点？
云文档解析节点是一个专门用于读取和处理云端存储的Markdown文档的功能模块。它能够帮助您直接在工作流中获取和使用企业内部的知识文档，无需手动复制粘贴文档内容。通过此节点，您可以将文档内容自动加载到工作流中，以便后续节点进行处理和分析。

**图片说明：**

云文档解析节点的配置界面包含文档选择区域，在文档选择区域，您可以通过选择器指定需要解析的云文档。
![云文档解析节点](https://cdn.letsmagic.cn/static/img/Cloud-document-parsing.png)

## 为什么需要云文档解析节点？
在构建智能工作流时，我们经常需要参考、分析或处理企业内部已有的文档资料。云文档解析节点解决了以下问题：
1. **自动化信息获取**：无需手动复制文档内容，实现自动读取云端文档
2. **知识集成**：将企业内部知识库与智能工作流无缝集成
3. **实时信息更新**：当云文档更新时，工作流可以读取最新内容，保持信息的时效性
4. **结构化处理**：将Markdown文档转换为可处理的数据结构，便于后续节点使用
## 适用场景
### 场景一：知识库问答系统
构建基于企业内部文档的智能问答系统，当用户提问时，系统自动从相关文档中提取信息并生成答案。
### 场景二：文档内容分析
自动分析企业文档内容，提取关键信息、统计数据或生成摘要报告。
### 场景三：文档内容更新提醒
监控重要文档的变化，当文档内容更新时，自动向相关人员发送通知或摘要。
## 节点参数说明
### 输入参数
|参数名称|说明|是否必填|默认值|
|---|---|---|---|
|文选择文件|选择需要解析的云文档|是|无|

### 输出参数
|参数名称|说明|数据类型|
|---|---|---|
|文档内容（content）|解析后的文档文本内容|字符串|

## 使用说明
### 基本配置步骤
1. **添加云文档解析节点**：从节点面板中拖拽"云文档解析"节点到工作流画布中
2. **选择文档**：
    1. 方式一：从下拉菜单中直接选择需要解析的云文档
3. **连接后续节点**：将云文档解析节点的输出连接到后续处理节点
### 进阶技巧
1. **动态文档选择**：使用变量传入文档ID，可以根据用户输入或其他条件动态选择不同文档
2. **文档内容提取**：结合代码节点，可以提取文档中的特定部分内容
3. **多文档处理**：通过循环节点，可以批量处理多个云文档
4. **内容比对**：结合代码节点，可以对比不同版本文档的内容差异
## 注意事项
### 文档访问权限
确保工作流执行者对所选云文档有访问权限，否则无法成功获取文档内容。
### 文档大小限制
解析超大文档可能会影响工作流执行效率，建议对大型文档先进行分割或提取关键部分。
### Markdown格式支持
节点支持标准Markdown语法，但某些特殊格式或自定义语法可能无法正确解析。
### 实时性考虑
节点获取的是执行时刻的文档内容，如果文档频繁更新，可能需要考虑缓存策略。
## 常见问题
### 问题一：文档内容无法正确显示或解析

**解决方案**：
- 检查文档格式是否规范，避免使用过于复杂的Markdown语法
- 确认文档没有包含特殊字符或编码问题
- 检查文档访问权限是否正确设置
### 问题二：如何处理文档中的图片和附件？

**解决方案**：
- 云文档解析节点默认只提取文本内容，不包括图片
- 如需处理图片，可以使用HTTP请求节点单独获取图片资源
- 对于附件，需要使用单独的文件访问API获取
### 问题三：如何处理格式化的表格数据？

**解决方案**：
- Markdown表格会被解析为文本形式
- 如需将表格转换为结构化数据，可以在后续使用代码节点进行处理
- 对于复杂表格，建议考虑使用电子表格解析节点代替
## 常见搭配节点
|**节点类型**|**搭配原因**|
|---|---|
|大模型调用节点|将解析的文档内容传入大模型，生成摘要、回答问题或提取关键信息|
|文本切割节点|将长文档切割成小段落，便于进一步处理|
|代码节点|对文档内容进行格式转换、数据提取或自定义处理|
|知识检索节点|结合向量搜索，实现基于文档内容的智能问答|
