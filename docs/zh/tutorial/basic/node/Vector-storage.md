# 🔒 Nodo Memorizzazione Vettoriale
## ❓ Che Cos'è il Nodo Memorizzazione Vettoriale?
Il nodo Memorizzazione Vettoriale è un componente funzionale nel flusso di lavoro Magic Flow utilizzato per memorizzare il contenuto testuale nel database vettoriale. Può convertire il contenuto testuale in forma vettoriale e salvarlo nella knowledge base, facilitando la ricerca semantica e l'abbinamento dei contenuti successivi. In parole semplici, la memorizzazione vettoriale è come un magazzino di informazioni intelligente, non solo memorizza il contenuto stesso, ma conserva anche le caratteristiche semantiche del contenuto, rendendo possibile la query tramite similarità semantica successivamente.

**Spiegazione Immagine:**

L'interfaccia del nodo Memorizzazione Vettoriale mostra l'area principale di configurazione del nodo, includendo selezione knowledge base, input del contenuto da memorizzare, impostazioni metadati e configurazione ID business e altre opzioni di impostazione parametri
![Nodo Inizio](https://cdn.letsmagic.cn/static/img/Vector-storage.png)

## 🤔 Perché Serve il Nodo Memorizzazione Vettoriale?
**Nella costruzione di applicazioni intelligenti, il nodo Memorizzazione Vettoriale risolve i seguenti problemi chiave:**
- **Sedimentazione della Conoscenza**: Trasforma informazioni importanti in conoscenza ricercabile, costruisce knowledge base dedicate all'azienda
- **Comprensione Semantica**: Diverso dai database tradizionali, la memorizzazione vettoriale conserva le informazioni semantiche del contenuto, supporta ricerca per similarità
- **Organizzazione Informazioni**: Attraverso metadati e ID business, classifica e gestisce i contenuti memorizzati
- **Conoscenza Personalizzata**: Fornisce al modello grande supporto di conoscenza dedicato, risolvendo il problema della conoscenza limitata dei modelli generici
- **Base per Applicazioni Intelligenti**: Fornisce base dati per sistemi di domanda e risposta, sistemi di raccomandazione e altre applicazioni intelligenti

## 🎯 Scenari Applicabili

### 1. Costruzione di Knowledge Base Aziendale
Memorizza contenuti come documenti aziendali, manuali prodotto, guide operative nel database vettoriale, formando un sistema di conoscenza aziendale ricercabile, aiutando i dipendenti a ottenere rapidamente le informazioni necessarie.

### 2. Accumulo Conoscenza per Servizio Clienti Intelligente
Memorizza soluzioni a problemi comuni, informazioni prodotto, processi di servizio e altri contenuti, fornendo supporto di conoscenza ai chatbot, migliorando la qualità del servizio clienti.

### 3. Gestione Contenuti Personalizzata
Memorizza preferenze utente, cronologia interazioni e altre informazioni, fornendo supporto dati per raccomandazioni e servizi personalizzati, migliorando l'esperienza utente.

## ⚙️ Spiegazione Parametri del Nodo
### Parametri Base
|Nome Parametro|Descrizione|Obbligatorio|Valore Default|
|---|---|---|---|
|Selezione Knowledge Base|Scegli la knowledge base da operare, attraverso 【Valore Fisso o Espressione】, seleziona dalla knowledge base già create nel sistema|Sì|Nessuno|
|Contenuto da Memorizzare|Contenuto testuale da memorizzare nel database vettoriale|Sì|Nessuno|
|ID Business|Identificatore univoco del contenuto, utilizzato per query o operazioni di cancellazione successive|Sì|Nessuno|
|Metadati|Informazioni aggiuntive del contenuto, come categoria, fonte, tempo, ecc., facilitano il filtraggio|No|Nessuno|


### Contenuto Output
Dopo esecuzione riuscita, il nodo Memorizzazione Vettoriale completerà la memorizzazione dei contenuti in background, ma non restituirà direttamente dati risultato specifici. Dopo memorizzazione riuscita, il contenuto può essere ricercato attraverso il nodo Ricerca Vettoriale.

## 📋 Istruzioni per l'Uso
### Passi di Configurazione Base
1. **Selezione Knowledge Base**:
    1. Dal menu dropdown seleziona modalità diverse
    2. Attraverso @ riferimento dinamico alla knowledge base del nodo precedente oppure knowledge base già create
2. **Configurazione Frammenti da Memorizzare**:
    1. Inserisci il contenuto testuale da memorizzare
    2. Oppure utilizza riferimento variabile per contenuto dinamico, come `{{message_content}}` per referenziare l'output di altri nodi
3. **Impostazione ID Business**:
    1. Inserisci un identificatore di business univoco
    2. Si consiglia di utilizzare modalità di identificazione significative, come "FAQ_Prodotto_001" o UUID generato dinamicamente
    3. L'ID business è molto importante nelle operazioni di cancellazione o aggiornamento successive
4. **Configurazione Metadati (Opzionale)**:
    1. Aggiungi informazioni aggiuntive come categoria, tag, fonte del contenuto
    2. I metadati sono coppie chiave-valore, come "category: FAQ", "source: sito ufficiale"
    3. I metadati possono essere utilizzati come condizioni di filtro durante la ricerca vettoriale

### Tecniche Avanzate
#### Ottimizzazione Contenuto
**Per migliorare l'effetto della memorizzazione vettoriale e della ricerca successiva, si consiglia di ottimizzare adeguatamente il contenuto memorizzato:**
1. **Memorizzazione a Blocchi del Contenuto**:
    1. Suddividi testi lunghi in blocchi di contenuto indipendenti più piccoli prima di memorizzarli
    2. Utilizza il nodo Segmentazione Testo per elaborare testi lunghi prima di memorizzarli
    3. Si consiglia di controllare ogni blocco di contenuto tra 500-1000 caratteri
2. **Controllo Qualità Contenuto**:
    1. Assicurati che il contenuto memorizzato sia semanticamente chiaro ed espresso accuratamente
    2. Rimuovi simboli di formattazione inutili e contenuti ridondanti
    3. Aggiungi adeguate informazioni di contesto per migliorare la comprensibilità
3. **Progettazione Metadati**:
    1. Progetta strutture metadati ragionevoli per facilitare filtri successivi
    2. Metadati comuni includono: categoria (category), fonte (source), tempo (time), ecc.
    3. Utilizza formati e convenzioni di denominazione unificati

#### Collaborazione con Altri Nodi
**Il nodo Memorizzazione Vettoriale necessita solitamente di essere utilizzato in combinazione con altri nodi:**
1. **In Combinazione con Nodo Segmentazione Testo**:
    1. Segmenta prima il testo lungo in frammenti adatti alla memorizzazione
    2. Poi memorizza in ciclo ogni frammento segmentato
    3. Mantieni l'associazione dell'ID business, come utilizzare prefisso + numero indice
2. **In Combinazione con Nodo Esecuzione Codice**:
    1. Utilizza il nodo Esecuzione Codice per generare ID business univoco
    2. Oppure per elaborare e formattare contenuti e metadati da memorizzare
3. **In Combinazione con Nodo Richiesta HTTP**:
    1. Ottieni dati da interfacce esterne
    2. Dopo elaborazione, memorizza nel database vettoriale

## ⚠️ Note Importanti
### Progettazione ID Business
**La progettazione dell'ID business influisce direttamente sull'efficienza di gestione del contenuto successivo:**
- Assicura l'unicità dell'ID business, evita sovrascritture di contenuti esistenti dovute a memorizzazione duplicata
- Utilizza modalità di denominazione ID significative e facilmente identificabili per facilitare la gestione
- Considera la modalità di denominazione prefisso + categoria + numero, come "PRD_FAQ_001"
- Se utilizzi ID casuali, assicurati di salvare la corrispondenza tra ID e contenuto

### Formato e Qualità del Contenuto
**La qualità del contenuto memorizzato influisce direttamente sull'effetto di ricerca successivo:**
- Evita di memorizzare troppe informazioni irrilevanti, concentrati sul contenuto core
- Assicura formati di testo uniformi, rimuovi tag HTML e altri simboli di formattazione
- Per contenuti non testuali come tabelle e grafici, converti in descrizioni testuali prima di memorizzare
- Aggiorna e mantieni regolarmente il contenuto della knowledge base per mantenere accuratezza e tempestività delle informazioni

### Sicurezza e Permessi
**La sicurezza dei dati della knowledge base richiede particolare attenzione:**
- Evita di memorizzare informazioni personali sensibili o segreti aziendali
- Imposta marcatori di permessi di accesso attraverso metadati
- Verifica regolarmente il contenuto della knowledge base per garantire conformità

## ❓ Problemi Comuni
### Problema 1: Dopo la memorizzazione del contenuto non riesco a trovarlo tramite ricerca vettoriale, come fare?
**Soluzioni**:
- Verifica se l'ID del database vettoriale corrisponde, assicurati che ricerca e memorizzazione utilizzino lo stesso database vettoriale
- Conferma la qualità del contenuto memorizzato, contenuti troppo brevi o privi di significato potrebbero essere difficili da ricercare
- Regola la soglia di similarità del nodo Ricerca Vettoriale, abbassala adeguatamente per ottenere più risultati
- Verifica se il testo di query di ricerca sia semanticamente correlato al contenuto memorizzato

### Problema 2: Come aggiornare contenuti già memorizzati?
**Soluzioni**:
- Utilizza lo stesso ID business per memorizzare nuovamente il contenuto, sovrascriverà il contenuto originale
- Se necessiti di eliminare completamente e poi creare, puoi prima utilizzare il nodo Cancellazione Vettoriale per eliminare, poi memorizzare nuovo contenuto
- Per aggiornamenti parziali, si consiglia di utilizzare nuovo contenuto completo per sovrascrivere quello vecchio, invece di aggiornare solo una parte

### Problema 3: La memorizzazione di grandi quantità di contenuti è lenta, come gestire?
**Soluzioni**:
- Elabora grandi quantità di contenuti in batch, evita di memorizzare troppi dati in una sola volta
- Utilizza il nodo ciclo per memorizzare contenuti in batch
- Ottimizza la dimensione del contenuto, memorizza solo informazioni necessarie
- Pre-elabora adeguatamente il contenuto per ridurre il carico computazionale durante la memorizzazione

## 🏆 Migliori Pratiche
### Nodi Comuni da Abbinare
|Tipo Nodo|Motivo Abbinamento|
|---|---|
|Nodo Segmentazione Testo|Segmenta testi lunghi in frammenti adatti alla memorizzazione|
|Nodo Esecuzione Codice|Elabora contenuti, genera ID business o metadati|
|Nodo Ricerca Vettoriale|Ricerca contenuti vettoriali già memorizzati|
|Nodo Cancellazione Vettoriale|Elimina contenuti vettoriali non più necessari|
|Nodo Ciclo|Elabora e memorizza in batch numerosi contenuti|

---

# 向量存储节点
## 什么是向量存储节点？
向量存储节点是Magic Flow工作流中用于将文本内容存储到向量数据库的功能组件。它能够将文本内容转换为向量形式并保存在知识库中，便于后续的语义检索和内容匹配。简单来说，向量存储就像是一个智能信息仓库，不仅存储了内容本身，还保留了内容的语义特征，使得后续可以通过语义相似度进行查询。

**图片说明：**

向量存储节点界面展示了节点的主要配置区域，包括知识库选择、存储内容输入、元数据设置以及业务ID配置等参数设置选项
![开始节点](https://cdn.letsmagic.cn/static/img/Vector-storage.png)

## 为什么需要向量存储节点？
**在构建智能应用时，向量存储节点解决了以下关键问题：**
- **知识沉淀**：将重要信息转化为可检索的知识，建立企业专属知识库
- **语义理解**：不同于传统数据库，向量存储保留了内容的语义信息，支持相似度检索
- **信息组织**：通过元数据和业务ID，对存储的内容进行分类和管理
- **自定义知识**：为大模型提供专属知识支持，解决通用模型知识有限的问题
- **智能应用基础**：为问答系统、推荐系统等智能应用提供数据基础
## 适用场景

### 1. 构建企业知识库
将公司文档、产品手册、操作指南等内容存储到向量库，形成可检索的企业知识体系，帮助员工快速获取所需信息。
### 2. 智能客服知识积累
存储常见问题解决方案、产品信息、服务流程等内容，为智能客服机器人提供知识支持，提高客户服务质量。
### 3. 个性化内容管理
存储用户偏好、历史交互记录等信息，为个性化推荐和服务提供数据支持，提升用户体验。
## 节点参数说明
### 基本参数
|参数名称|说明|是否必填|默认值|
|---|---|---|---|
|选择知识库|选择要操作的知识库，通过【固定值或表达式】，从系统中已创建的知识库中选择|是|无|
|存储内容|需要存储到向量库的文本内容|是|无|
|业务ID|内容的唯一标识符，用于后续查询或删除操作|是|无|
|元数据|内容的附加信息，如分类、来源、时间等，便于筛选|否|无|


### 输出内容
向量存储节点执行成功后，会在后台完成内容的存储，但不会直接输出特定的结果数据。成功存储后，该内容可通过向量搜索节点进行检索。
## 使用说明
### 基本配置步骤
1. **选择知识库**：
    1. 从下拉菜单中选择不同的方式
    2. 通过@动态引用上个节点的知识库或者是已创建的知识库
2. **配置存储片段**：
    1. 输入需要存储的文本内容
    2. 或使用变量引用动态内容，如`{{message_content}}`引用其他节点的输出
3. **设置业务ID**：
    1. 输入一个唯一的业务标识符
    2. 推荐使用有意义的标识方式，如"产品FAQ_001"或动态生成的UUID
    3. 业务ID在后续删除或更新内容时非常重要
4. **配置元数据（可选）**：
    1. 添加内容的分类、标签、来源等附加信息
    2. 元数据采用键值对形式，如"category: FAQ"、"source: 官网"
    3. 元数据可用于向量搜索时的筛选条件
### 进阶技巧
#### 内容优化
**为提高向量存储和后续检索的效果，建议对存储内容进行适当优化：**
1. **内容分块存储**：
    1. 将长文本切分为较小的独立内容块再存储
    2. 使用文本切割节点处理长文本后再进行存储
    3. 推荐每个内容块控制在500-1000字之间
2. **内容质量把控**：
    1. 确保存储内容语义清晰、表达准确
    2. 去除无用的格式符号和冗余内容
    3. 适当增加上下文信息，提高可理解性
3. **元数据设计**：
    1. 设计合理的元数据结构，便于后续筛选
    2. 常用元数据包括：分类(category)、来源(source)、时间(time)等
    3. 使用统一的格式和命名规范
#### 与其他节点协同
**向量存储节点通常需要与其他节点结合使用：**
1. **搭配文本切割节点**：
    1. 先将长文本切割成适合存储的片段
    2. 再循环存储每个切割后的片段
    3. 保持业务ID的关联性，如使用前缀+索引号
2. **结合代码执行节点**：
    1. 使用代码执行节点生成唯一业务ID
    2. 或处理和格式化要存储的内容和元数据
3. **配合HTTP请求节点**：
    1. 从外部接口获取数据
    2. 经过处理后存储到向量库中
## 注意事项
### 业务ID设计
**业务ID的设计直接影响到后续的内容管理效率：**
- 确保业务ID的唯一性，避免重复存储覆盖现有内容
- 使用有意义且容易识别的ID命名方式，便于管理
- 考虑使用前缀+类别+序号的命名方式，如"PRD_FAQ_001"
- 如果使用随机ID，确保保存好ID与内容的对应关系
### 内容格式与质量
**存储内容的质量直接影响到后续检索效果：**
- 避免存储过多无关信息，专注于核心内容
- 确保文本格式统一，去除HTML标签等格式符号
- 对于表格、图表等非文本内容，转换为文字描述后再存储
- 定期更新和维护知识库内容，保持信息的准确性和时效性
### 安全与权限
**知识库数据的安全性需要特别注意：**
- 避免存储敏感个人信息或公司机密
- 通过元数据设置访问权限标记
- 定期审核知识库内容，确保合规性
## 常见问题
### 问题1：存储内容后无法通过向量搜索找到怎么办？
**解决方案**：
- 检查向量库ID是否匹配，确保搜索与存储使用同一个向量库
- 确认存储的内容质量，过短或无意义的内容可能难以检索
- 调整向量搜索节点的相似度阈值，适当降低以获取更多结果
- 检查搜索的查询文本是否与存储内容语义相关
### 问题2：如何更新已存储的内容？
**解决方案**：
- 使用相同的业务ID重新存储内容，会覆盖原有内容
- 如需完全删除再创建，可先使用向量删除节点删除，再存储新内容
- 对于部分更新，建议使用完整的新内容覆盖旧内容，而不是仅更新部分
### 问题3：大量内容存储性能较慢怎么处理？
**解决方案**：
- 对大量内容进行批次处理，避免一次存储过多数据
- 使用循环节点分批次存储内容
- 优化内容大小，仅存储必要信息
- 提前做好内容处理工作，减少存储时的运算负担
## 常见搭配节点
|节点类型|搭配原因|
|---|---|
|文本切割节点|将长文本分割成适合存储的片段|
|代码执行节点|处理内容、生成业务ID或元数据|
|向量搜索节点|检索已存储的向量内容|
|向量删除节点|删除不再需要的向量内容|
|循环节点|批量处理和存储多条内容|