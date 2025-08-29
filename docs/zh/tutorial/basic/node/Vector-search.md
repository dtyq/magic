# 🔍 Nodo Ricerca Vettoriale

## ❓ Che Cos'è il Nodo Ricerca Vettoriale?

Il nodo Ricerca Vettoriale è un nodo funzionale nel flusso di lavoro Magic Flow utilizzato per ricercare rapidamente contenuti simili nel database vettoriale. Può trovare frammenti di contenuto semanticamente simili nella knowledge base pre-memorizzata in base al testo di query fornito dall'utente. In parole semplici, la ricerca vettoriale è come un motore di ricerca intelligente che non solo trova contenuti contenenti parole chiave, ma comprende anche la semantica della domanda e restituisce informazioni rilevanti.

**Spiegazione Immagine:**

L'interfaccia del nodo Ricerca Vettoriale mostra l'area di configurazione principale del nodo, includendo selezione knowledge base, input testo di query, impostazione soglia similarità e limitazione numero risultati e altre opzioni di configurazione parametri.
![Nodo Ricerca Vettoriale](https://cdn.letsmagic.cn/static/img/Vector-search.png)

## 🤔 Perché Serve il Nodo Ricerca Vettoriale?

**Nella costruzione di applicazioni intelligenti, il nodo Ricerca Vettoriale risolve il problema di trovare informazioni precise da grandi quantità di dati non strutturati:**
- **Comprensione Semantica**: Basata su semantica piuttosto che semplice abbinamento di parole chiave, può comprendere la vera intenzione della domanda dell'utente
- **Recupero Informazioni**: Trova rapidamente i frammenti di contenuto più rilevanti da documenti e knowledge base di massa
- **Supporto Conoscenza**: Fornisce al modello grande conoscenze professionali accurate e informazioni di background, migliorando la qualità delle risposte
- **Conoscenza Personalizzata**: Utilizza dati specifici dell'azienda per costruire capacità di domanda e risposta dedicate, risolvendo il problema della conoscenza limitata dei modelli generici
- **Elaborazione Efficiente**: Riduce la quantità di informazioni elaborate dal modello grande, migliora la velocità di risposta, risparmia consumo di token

## 🎯 Scenari Applicabili

### 1. Sistema di Domande e Risposte Knowledge Base Aziendale
Costruisci sistema di domande e risposte basato su documenti interni aziendali, manuali prodotto o documentazione tecnica, i dipendenti possono porre domande in linguaggio naturale per ottenere risposte precise, senza dover sfogliare numerosi file.

### 2. Assistente Clienti Intelligente
Fornisci all'assistente clienti supporto di conoscenza come informazioni prodotto, soluzioni a problemi comuni, ecc., aiutando il personale di assistenza clienti o chatbot a rispondere rapidamente e accuratamente alle domande dei clienti.

### 3. Analisi Documenti ed Estrazione Informazioni
Estrai informazioni specifiche da numerosi documenti, come termini contrattuali, specifiche tecniche o dati chiave nei rapporti di ricerca, risparmiando tempo di ricerca manuale.

## ⚙️ Spiegazione Parametri del Nodo

### Parametri Base
|Nome Parametro|Descrizione|Obbligatorio|Valore Default|
|---|---|---|---|
|Selezione Knowledge Base|Scegli la knowledge base da operare, attraverso 【Valore Fisso o Espressione】, seleziona dalla knowledge base già create nel sistema|Sì|Nessuno|
|Parole Chiave Ricerca|Testo utilizzato per ricercare contenuti simili, solitamente una domanda o descrizione chiave|Sì|Nessuno|
|Numero Massimo Richiami|Limite superiore del numero di contenuti simili restituiti|No|5|
|Similarità Minima|Requisito minimo di similarità dei contenuti, range 0-1, valore più alto significa requisito più severo|No|0.4|
|Abbinamento Metadati|Filtra in base alle informazioni metadati del documento, come fonte documento, tempo creazione, ecc.|No|-|

### Contenuto Output
|Campo Output|Descrizione|Tipo|
|---|---|---|
|Set Risultati Richiamo (similarities)|Array dei contenuti simili trovati, contiene tutti i frammenti di testo corrispondenti|Array Stringhe|
|Lista Frammenti (fragments)|Informazioni complete dei risultati di ricerca, contiene contenuto, metadati e ID business ecc.|Array Oggetti|

## 📋 Istruzioni per l'Uso

### Passi di Configurazione Base
1. **Selezione Knowledge Base**:
    1. Dal menu dropdown seleziona modalità diverse
    2. Attraverso @ riferimento dinamico alla knowledge base del nodo precedente oppure knowledge base già create
2. **Configurazione Parole Chiave**:
    1. Inserisci testo di ricerca fisso
    2. Oppure utilizza riferimento variabile per contenuto dinamico, come `{{user_message}}` per referenziare la domanda effettiva dell'utente
3. **Impostazione Numero Massimo Risultati Richiamo**:
    1. Imposta il limite superiore del numero di risultati restituiti secondo le esigenze
    2. Generalmente si consiglia 5-10 risultati, troppi potrebbero introdurre informazioni irrilevanti, troppo pochi potrebbero omettere contenuti importanti
4. **Regolazione Soglia Similarità**:
    1. Imposta la soglia di similarità per controllare la precisione dei risultati
    2. Soglia più alta significa risultati più precisi ma potrebbe omettere contenuti rilevanti
    3. Soglia più bassa significa copertura più ampia ma potrebbe includere contenuti non molto rilevanti
5. **Configurazione Filtro Metadati (Opzionale)**:
    1. Se necessiti di filtrare ulteriormente i risultati, puoi impostare condizioni di filtro metadati
    2. Ad esempio, limita documenti di fonte specifica o range temporale

### Tecniche Avanzate
#### Ottimizzazione Testo di Ricerca
La chiave per migliorare l'effetto della ricerca vettoriale è scrivere testo di query efficace:
1. **Specifico e Chiaro**: Utilizza descrizioni chiare e specifiche, non formulazioni vaghe
2. **Informazioni Chiave Prioritarie**: Posiziona le parole chiave e i concetti più importanti all'inizio del testo di query
3. **Evita Informazioni Irrilevanti**: Semplifica il testo di query, elimina parole che non aiutano la ricerca

#### Collaborazione con Altri Nodi
Il nodo Ricerca Vettoriale necessita solitamente di essere utilizzato in combinazione con altri nodi:
1. **In Combinazione con Nodo Chiamata Modello Grande**:
    1. Fornisci i risultati della ricerca vettoriale come contesto al modello grande
    2. Utilizza il nodo Esecuzione Codice per elaborare i risultati di ricerca, poi passali al modello grande
2. **In Combinazione con Nodo Ramificazione Condizionale**:
    1. Verifica se i risultati di ricerca sono vuoti
    2. Secondo numero risultati o similarità decide la modalità di elaborazione successiva
3. **In Combinazione con Nodo Segmentazione Testo**:
    1. Prima utilizza il nodo Segmentazione Testo per elaborare testi lunghi
    2. Poi effettua memorizzazione vettoriale e ricerca sui frammenti segmentati

## ⚠️ Note Importanti

### Preparazione Knowledge Base Vettoriale
**Prima di utilizzare il nodo Ricerca Vettoriale, è necessario preparare la knowledge base vettoriale:**
- Assicurati di aver creato e importato i documenti di conoscenza rilevanti
- Verifica lo stato di aggiornamento della knowledge base vettoriale, assicurati che i dati siano aggiornati
- Per knowledge base di grandi dimensioni, considera una classificazione ragionevole per migliorare la precisione di ricerca

### Lunghezza Testo Query
**La lunghezza del testo di query influenza l'effetto di ricerca:**
- Query troppo brevi potrebbero mancare di informazioni sufficienti per abbinamento accurato
- Query troppo lunghe potrebbero introdurre rumore, diluendo il peso delle parole chiave core
- Si consiglia di mantenere il testo di query tra 20-100 caratteri

### Ottimizzazione Soglia Similarità
**La soglia di similarità necessita di essere regolata secondo lo scenario applicativo specifico:**
- Domande e risposte generiche: si consiglia di utilizzare soglia 0.4-0.6
- Ricerca conoscenza professionale: può essere aumentata a 0.6-0.8 per assicurare accuratezza
- Ricerca esplorativa: può essere diminuita a 0.3-0.5 per ottenere più informazioni rilevanti

## ❓ Problemi Comuni

### Problema 1: I risultati di ricerca non corrispondono alle aspettative, come fare?

**Soluzioni**:
- Verifica se il contenuto della knowledge base include informazioni rilevanti
- Prova a riscrivere il testo di query, utilizzando descrizioni più precise
- Abbassa la soglia di similarità per ottenere risultati più ampi
- Utilizza filtro metadati per restringere l'ambito di ricerca

### Problema 2: Come gestire il caso in cui i risultati di ricerca sono vuoti?

**Soluzioni**:
- Aggiungi nel flusso di lavoro una ramificazione condizionale per rilevare il numero di risultati
- Imposta risposta di backup o conoscenza predefinita
- Abbassa la soglia di similarità, allenta le condizioni di abbinamento
- Utilizza testo di query più generico per ricercare nuovamente

### Problema 3: La velocità di ricerca è lenta, come ottimizzare?

**Soluzioni**:
- Riduci il numero di knowledge base da ricercare, seleziona solo quelle più rilevanti
- Ottimizza la struttura della knowledge base, evita librerie singole troppo grandi
- Riduci il limite del numero di risultati restituiti
- Utilizza filtro metadati per restringere l'ambito di ricerca

## 🏆 Migliori Pratiche

### Nodi Comuni da Abbinare

|Tipo Nodo|Motivo Abbinamento|
|---|---|
|Nodo Chiamata Modello Grande|Utilizza i risultati di ricerca per fornire supporto di conoscenza professionale al modello grande|
|Nodo Esecuzione Codice|Elabora e converte i risultati di ricerca, estrae informazioni chiave|
|Nodo Ramificazione Condizionale|Decide il flusso successivo in base ai risultati di ricerca|
|Nodo Segmentazione Testo|Elabora testi lunghi, prepara memorizzazione vettoriale o ricerca|
|Nodo Memorizzazione Vettoriale|In combinazione con ricerca vettoriale, realizza aggiornamento e ricerca della knowledge base|

---

# 向量搜索节点
## 什么是向量搜索节点？
向量搜索节点是Magic Flow工作流中用于在向量数据库中快速检索相似内容的功能节点。它能够根据用户提供的查询文本，在预先存储的知识库中找出语义相似的内容片段。简单来说，向量搜索就像是一个智能搜索引擎，不仅能找到包含关键词的内容，还能理解问题的语义并返回相关信息。

**图片说明：**

向量搜索节点界面展示了节点的主要配置区域，包括知识库选择、查询文本输入、相似度阈值设置以及结果数量限制等参数配置选项。
![向量搜索节点](https://cdn.letsmagic.cn/static/img/Vector-search.png)

## 为什么需要向量搜索节点？
**在构建智能应用时，向量搜索节点解决了从大量非结构化数据中精准找到相关信息的难题：**
- **语义理解**：基于语义而非简单关键词匹配，能够理解用户问题的真实意图
- **信息检索**：从海量文档和知识库中快速找到最相关的内容片段
- **知识支持**：为大模型提供准确的专业知识和背景信息，提升回答质量
- **自定义知识**：利用企业特有数据构建专属问答能力，解决通用模型知识有限的问题
- **高效处理**：减少大模型处理的信息量，提高响应速度，节省token消耗
## 适用场景
### 1. 企业知识库问答系统
基于公司内部文档、产品手册或技术资料构建问答系统，员工可以用自然语言提问获取精准答案，无需浏览大量文件。
### 2. 智能客服助手
为客服助手提供产品信息、常见问题解决方案等知识支持，帮助客服人员或聊天机器人快速、准确地回答客户问题。
### 3. 文档分析与信息提取
从大量文档中提取特定信息，如合同条款、技术规范或研究报告中的关键数据，节省人工查找时间。
## 节点参数说明
### 基本参数
|参数名称|说明|是否必填|默认值|
|---|---|---|---|
|选择知识库|选择要操作的知识库，通过【固定值或表达式】，从系统中已创建的知识库中选择|是|无|
|搜索关键词|用于搜索相似内容的文本，通常是问题或关键描述|是|无|
|最大召回数|返回的相似内容数量上限|否|5|
|最小匹配度|内容相似度的最低要求，范围0-1，值越大要求越严格|否|0.4|
|元数据匹配|根据文档元数据信息进行筛选，如文档来源、创建时间等|否|-|

### 输出内容
|输出字段|说明|类型|
|---|---|---|
|召回结果集（similarities）|搜索到的相似内容数组，包含所有匹配的文本片段|字符串数组|
|片段列表（fragments）|完整的搜索结果信息，包含内容、元数据和业务ID等详细信息|对象数组|

## 使用说明
### 基本配置步骤
1. **选择知识库**：
    1. 从下拉菜单中选择不同的方式，
    2. 通过@动态引用上个节点的知识库或者是已创建的知识库
2. **配置关键词**：
    1. 输入固定的搜索文本
    2. 或使用变量引用动态内容，如`{{user_message}}`引用用户的实际问题
3. **设置最大召回数量**：
    1. 根据需求设置返回结果的数量上限
    2. 一般建议5-10条，太多可能引入无关信息，太少可能遗漏重要内容
4. **调整匹配度阈值**：
    1. 设置相似度阈值，控制结果的精确性
    2. 阈值越高，结果越精确但可能遗漏相关内容
    3. 阈值越低，覆盖面越广但可能包含不太相关的内容
5. **配置元数据过滤（可选）**：
    1. 如需进一步筛选结果，可设置元数据过滤条件
    2. 例如，限定特定来源或时间范围的文档
### 进阶技巧
#### 优化搜索文本
提高向量搜索效果的关键是编写有效的查询文本：
1. **具体明确**：使用清晰、具体的描述，而非模糊的表述
2. **关键信息优先**：将最重要的关键词和概念放在查询文本的前面
3. **避免无关信息**：精简查询文本，删除对搜索无帮助的词语
#### 与其他节点协同
向量搜索节点通常需要与其他节点结合使用：
1. **搭配大模型调用节点**：
    1. 将向量搜索的结果作为上下文提供给大模型
    2. 使用代码执行节点处理搜索结果，再传递给大模型
2. **结合条件分支节点**：
    1. 检查搜索结果是否为空
    2. 根据结果数量或相似度决定后续处理方式
3. **配合文本切割节点**：
    1. 先使用文本切割处理长文本
    2. 再对切割后的片段进行向量存储和检索
## 注意事项
### 向量库准备
**在使用向量搜索节点前，需要先准备好向量知识库：**
- 确保已经创建并导入了相关知识文档
- 检查向量库的更新状态，确保数据是最新的
- 对于大型知识库，考虑合理分类以提高检索精度
### 查询文本长度
**查询文本的长度会影响搜索效果：**
- 过短的查询可能缺乏足够信息进行准确匹配
- 过长的查询可能引入噪音，稀释核心关键词的权重
- 建议查询文本保持在20-100个字符之间
### 相似度阈值调优
**相似度阈值需要根据具体应用场景调整：**
- 通用问答：建议使用0.4-0.6的阈值
- 专业知识检索：可以提高到0.6-0.8以确保准确性
- 探索性搜索：可以降低到0.3-0.5以获取更多相关信息
## 常见问题
### 问题1：搜索结果与预期不符怎么办？
**解决方案**：
- 检查知识库内容是否包含相关信息
- 尝试改写查询文本，使用更精确的描述
- 调低相似度阈值，获取更广泛的结果
- 使用元数据过滤缩小搜索范围
### 问题2：如何处理搜索结果为空的情况？
**解决方案**：
- 在工作流中添加条件分支，检测结果数量
- 设置备用响应或默认知识
- 降低相似度阈值，放宽匹配条件
- 使用更通用的查询文本重新搜索
### 问题3：搜索速度较慢怎么优化？
**解决方案**：
- 减少检索的知识库数量，只选择最相关的库
- 优化知识库结构，避免过大的单一库
- 减少返回结果数量限制
- 使用元数据过滤缩小搜索范围
## 常见搭配节点
|节点类型|搭配原因|
|---|---|
|大模型调用节点|使用搜索结果为大模型提供专业知识支持|
|代码执行节点|处理和转换搜索结果，提取关键信息|
|条件分支节点|根据搜索结果决定后续流程|
|文本切割节点|处理长文本，准备向量存储或搜索|
|向量存储节点|与向量搜索配合，实现知识库的更新和检索|