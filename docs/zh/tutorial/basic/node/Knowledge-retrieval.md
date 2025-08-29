# 🔍 Nodo Recupero Conoscenza

## ❓ Cosa è il Nodo Recupero Conoscenza?

Il nodo recupero conoscenza è uno strumento potente di ricerca semantica, capace di cercare contenuti rilevanti nella knowledge base Magic specificata basandosi sulle parole chiave inserite dall'utente. Questo nodo utilizza la tecnologia di matching di similarità vettoriale per aiutare a localizzare rapidamente i frammenti di conoscenza necessari, realizzando un recupero e un'applicazione efficiente della conoscenza.

**Spiegazione Immagine:**

L'interfaccia del nodo recupero conoscenza include principalmente l'area di selezione knowledge base, l'area di impostazione parametri di ricerca e l'area di configurazione output. È possibile selezionare la fonte della knowledge base al centro e impostare parametri come soglia di similarità, numero massimo, ecc.
![Nodo Recupero Conoscenza](https://cdn.letsmagic.cn/static/img/Knowledge-retrieval-node.png)

## 🎯 Perché Serve il Nodo Recupero Conoscenza?
Nel processo di costruzione di applicazioni intelligenti, il nodo recupero conoscenza risolve i seguenti problemi chiave:
- **Acquisizione Conoscenza Professionale**: Permettere all'AI di ottenere e utilizzare documenti, materiali o conoscenze professionali interne all'azienda
- **Migliorare Accuratezza Risposte**: Attraverso il recupero di informazioni rilevanti, rendere le risposte AI più accurate e professionali, ridurre risposte "immaginate" o obsolete
- **Aggiornabilità Conoscenze**: È possibile ottenere contenuti di conoscenza aggiornati, risolvere la limitazione della data di cutoff delle conoscenze dei modelli grandi
- **Contenuti Personalizzati**: Fornire risposte di conoscenza mirate in base alle esigenze specifiche dell'utente
- **Ridurre Costi Addestramento**: Non è necessario riaddestrare il modello per ogni nuova conoscenza, basta aggiornare la knowledge base

## 📋 Scenari Applicabili
### 1. 🏢 Sistema Domande e Risposte Interne Aziendali
Costruire un assistente capace di rispondere a domande su policy aziendali, processi, informazioni prodotto, ecc., aiutare i nuovi dipendenti a comprendere rapidamente le informazioni aziendali o assistere i dipendenti esperti nella consultazione delle ultime disposizioni.
### 2. 🤖 Robot Assistente Clienti Professionale
Creare un robot assistente clienti capace di rispondere con precisione a domande su prodotti, risoluzione problemi, guide d'uso, ecc., migliorare la qualità e l'efficienza del servizio clienti.
### 3. 📄 Assistente Intelligente Documenti
Progettare un assistente intelligente capace di comprendere e rispondere a contenuti di documenti specifici, come interpretazione manuali prodotto, spiegazione termini contrattuali, analisi rapporti di ricerca, ecc.
### 4. 🎓 Sistema Tutoraggio Didattico
Costruire un sistema di tutoraggio capace di rispondere a domande di apprendimento basate su materiali didattici, fornire spiegazioni di conoscenza, aiutare gli studenti a comprendere meglio concetti complessi.

## ⚙️ Spiegazione Parametri Nodo
### Parametri Base
|Nome Parametro|Spiegazione|Obbligatorio|Valore Default|
|---|---|---|---|
|Knowledge Base|Selezionare la knowledge base da ricercare, è possibile scegliere una o più|Sì|Nessuna|
|Parole Chiave Ricerca|Parole chiave o domanda per la ricerca, utilizzate per trovare contenuti rilevanti|Sì|Nessuna|
|Similarità Minima|Impostare il requisito di similarità minima per il matching della conoscenza, range 0~1|-|0.4|
|Numero Massimo Richiami|Numero massimo di risultati da restituire|-|5|

### Parametri Avanzati
### Contenuto Output
|Campo Output|Spiegazione|
|---|---|
|Lista Frammenti (fragments)|Lista dei frammenti di conoscenza recuperati, contenenti contenuto e informazioni di similarità|
|Set Risultati Richiamati (similarities)|Lista dei punteggi di similarità di ciascun frammento|
|total_count|Quantità totale di frammenti di conoscenza recuperati|

## 📖 Istruzioni per l'Uso
### Passi di Configurazione Base
1. **Selezionare Knowledge Base**：
    1. Cliccare sul menu a tendina della knowledge base, selezionare una o più knowledge base da ricercare
    2. È possibile scegliere knowledge base pubbliche o knowledge base dedicate create autonomamente
2. **Impostare Parole Chiave Ricerca**：
    1. Inserire le parole chiave o la domanda per la ricerca
    2. È possibile inserire direttamente testo fisso, come "Qual è la policy aziendale per le ferie annuali?"
    3. È anche possibile utilizzare riferimento variabili per contenuti dinamici, come `user_question}}` per fare riferimento alla domanda effettiva dell'utente
3. **Regolare Similarità Minima**：
    1. Trascinare il cursore per impostare la soglia di similarità (tra 0.01 e 0.99)
    2. Valore più alto richiede matching più preciso, ma potrebbe perdere contenuti rilevanti
    3. Valore più basso include più contenuti rilevanti, ma potrebbe mostrare risultati non molto correlati
4. **Impostare Numero Massimo Richiami**：
    1. Impostare il numero massimo di risultati da restituire in base alle esigenze
    2. Si consiglia 3-5 elementi, per fornire informazioni sufficienti senza eccedere

### Tecniche Avanzate
#### Ottimizzazione Effetto Ricerca
1. **Migliorare Precisione Ricerca**：
    1. Utilizzare domande chiare e specifiche piuttosto che parole chiave generiche
    2. Aumentare la soglia di similarità (come 0.7 o superiore) per ottenere matching più precisi
    3. Selezionare knowledge base specializzate per temi specifici piuttosto che knowledge base generali
2. **Aumentare Copertura Ricerca**：
    1. Utilizzare molteplici knowledge base correlate contemporaneamente
    2. Abbassare appropriatamente la soglia di similarità (come 0.5 circa)
    3. Aumentare il numero massimo di restituzioni

#### Collaborazione con Altri Nodi
1. **In Combinazione con Nodo Chiamata Modello Grande**：
    1. Fornire i risultati di ricerca come contesto al modello grande
    2. Permettere al modello grande di generare risposte più accurate basate sulla conoscenza recuperata
2. **In Combinazione con Nodo Ramo Condizionale**：
    1. Verificare se sono stati trovati contenuti rilevanti (lunghezza fragments > 0)
    2. Se ci sono risultati, fornire risposta professionale
    3. Se non ci sono risultati, passare a risposta generica o servizio umano
3. **In Combinazione con Nodo Salvataggio Variabili**：
    1. Salvare i risultati di ricerca per l'utilizzo in molteplici nodi successivi
    2. Evitare ricerche ripetute dello stesso contenuto, migliorare l'efficienza

## ⚠️ Note di Attenzione
### Qualità Knowledge Base
L'effetto del recupero conoscenza dipende in larga misura dalla qualità della knowledge base:
- Assicurarsi che i contenuti della knowledge base siano accurati, completi e aggiornati
- Aggiornare regolarmente la knowledge base, eliminare informazioni obsolete
- Classificare e taggare appropriatamente i contenuti di conoscenza, migliorare la precisione di ricerca

### Efficienza Ricerca
La ricerca in knowledge base di grandi dimensioni potrebbe influenzare le performance:
- Cercare di selezionare la knowledge base più correlata alla domanda, piuttosto che ricercare in tutte le knowledge base
- Impostare ragionevolmente il numero massimo, evitare di restituire troppi risultati non necessari
- Considerare di mettere in cache i risultati di ricerca per domande comuni, migliorare la velocità di risposta

### Privacy e Sicurezza
La knowledge base potrebbe contenere informazioni sensibili:
- Assicurarsi che le impostazioni dei permessi di accesso alla knowledge base siano corrette
- Evitare di esporre contenuti di conoscenza sensibili in scenari pubblici
- Applicare filtri di contenuto necessari ai risultati di ricerca

## ❓ Domande Frequenti
### Domanda 1: Cosa fare se non si riescono a recuperare contenuti rilevanti?
**Soluzioni**：
- Provare ad abbassare la soglia di similarità, ad esempio da 0.7 a 0.5
- Riorganizzare la domanda di ricerca, utilizzare più parole chiave o espressioni più concise
- Verificare se la knowledge base contiene contenuti correlati, aggiornare la knowledge base se necessario
- Considerare di selezionare più knowledge base correlate per la ricerca

### Domanda 2: Cosa fare se i risultati di ricerca includono troppi contenuti non rilevanti?
**Soluzioni**：
- Aumentare la soglia di similarità, ad esempio da 0.5 a 0.7 o superiore
- Utilizzare descrizioni di domanda più precise
- Restringere l'ambito della knowledge base, selezionare knowledge base più focalizzate su temi specifici
- Ridurre il numero massimo di restituzioni

### Domanda 3: Come gestire domande diversificate degli utenti?
**Soluzioni**：
- Utilizzare il nodo riconoscimento intento per analizzare prima il tipo di domanda dell'utente
- Selezionare knowledge base diverse in base a tipi di domanda differenti
- Configurare soglie di similarità e numeri massimi diversi
- Combinare con il modello grande per integrare e ottimizzare i risultati di ricerca

## 🌟 Migliori Pratiche
### Nodi di Combinazione Comuni
|Tipo di Nodo|Motivo di Combinazione|
|---|---|
|Nodo Chiamata Modello Grande|Fornire i risultati di ricerca come contesto al modello grande, generare risposte basate sulla conoscenza|
|Nodo Ramo Condizionale|Decidere il flusso di elaborazione successivo in base ai risultati di ricerca|
|Nodo Risposta Messaggio|Rispondere i contenuti di conoscenza elaborati all'utente|
|Nodo Segmentazione Testo|Elaborare risultati di ricerca troppo lunghi, assicurarsi che siano adatti per l'elaborazione successiva|
|Nodo Salvataggio Variabili|Salvare i risultati di ricerca per l'utilizzo in molteplici nodi|

---

# 知识检索节点

## 什么是知识检索节点？

知识检索节点是一个强大的语义搜索工具，能够根据用户输入的关键词，在指定的天书知识库中查找相关内容。该节点利用向量相似度匹配技术，帮助您快速定位需要的知识片段，实现高效的知识检索与应用。

**图片说明：**

知识检索节点界面主要包含知识库选择区、检索参数设置区和输出配置区。中间可以选择知识库来源，并设置相似度阈值、最大条数等参数。
![知识检索节点](https://cdn.letsmagic.cn/static/img/Knowledge-retrieval-node.png)


## 为什么需要知识检索节点？
在构建智能应用过程中，知识检索节点解决了以下关键问题：
- **专业知识获取**：让AI能够获取并使用企业内部的专业资料、文档或知识
- **提高答案准确性**：通过检索相关信息，使AI回答更加准确、专业，减少"想象"或过时答案
- **知识时效性**：可以获取最新更新的知识内容，解决大模型知识截止日期的限制
- **个性化内容**：根据用户的具体需求，提供有针对性的专业知识回答
- **减少训练成本**：无需为每个新知识重新训练模型，只需更新知识库即可
## 适用场景
### 1. 企业内部知识问答系统
构建能够回答公司政策、流程、产品信息等问题的内部助手，帮助新员工快速了解公司信息或协助老员工查询最新规定。
### 2. 专业客服机器人
创建能够精准回答产品问题、故障排除、使用指南等专业问题的客服机器人，提高客户服务质量和效率。
### 3. 文档智能助手
设计一个可以理解并回答关于特定文档内容的智能助手，如产品手册解读、合同条款解释、研究报告分析等。
### 4. 学习辅导系统
构建能够基于教育资料回答学习问题、提供知识解释的学习辅导系统，帮助学生更好地理解复杂概念。
## 节点参数说明
### 基本参数
|参数名称|说明|是否必填|默认值|
|---|---|---|---|
|知识库|选择要检索的知识库，可选择一个或多个|是|无|
|搜索关键词|检索的关键词或问题，用于查找相关内容|是|无|
|最小匹配度|设置知识匹配的最低相似度要求，范围0~1|-|0.4|
|最大召回数|返回的最大结果条数|-|5|

### 高级参数
### 输出内容
|输出字段|说明|
|---|---|
|片段列表（fragments）|检索到的知识片段列表，包含内容和相似度信息|
|召回的结果集（similarities）|各片段的相似度分数列表|
|total_count|检索到的总知识片段数量|

## 使用说明
### 基本配置步骤
1. **选择知识库**：
    1. 点击知识库下拉框，选择一个或多个要检索的知识库
    2. 可以选择公共知识库或自己创建的专用知识库
2. **设置搜索关键词**：
    1. 输入检索的关键词或问题
    2. 可直接输入固定文本，如"公司的年休假政策是什么？"
    3. 也可使用变量引用动态内容，如`user_question}}`引用用户的实际提问
3. **调整最小匹配度**：
    1. 拖动滑块设置相似度阈值（0.01至0.99之间）
    2. 值越高要求匹配越精确，但可能漏掉相关内容
    3. 值越低包含更多相关内容，但可能出现不太相关的结果
4. **设置最大召回数**：
    1. 根据需要设置返回的最大结果条数
    2. 建议为3-5条，既能提供足够信息又不会过多
### 进阶技巧
#### 优化检索效果
1. **提高检索精确性**：
    1. 使用明确、具体的问题而非宽泛的关键词
    2. 调高相似度阈值（如0.7以上）获取更精确的匹配
    3. 选择专门针对特定主题的知识库而非综合知识库
2. **增加检索覆盖面**：
    1. 使用多个相关知识库同时检索
    2. 适当降低相似度阈值（如0.5左右）
    3. 增加返回的最大条数
#### 与其他节点协同
1. **搭配大模型调用节点**：
    1. 将检索结果作为上下文提供给大模型
    2. 让大模型基于检索到的知识生成更准确的回答
2. **结合条件分支节点**：
    1. 检查是否找到相关知识（fragments长度>0）
    2. 如有结果，则提供专业回答
    3. 如无结果，则转向通用回答或人工服务
3. **配合变量保存节点**：
    1. 保存检索结果供多个后续节点使用
    2. 避免重复检索相同内容，提高效率
## 注意事项
### 知识库质量
知识检索的效果很大程度上取决于知识库的质量：
- 确保知识库内容准确、完整、最新
- 定期更新知识库，删除过时信息
- 适当对知识内容进行分类和标记，提高检索精度
### 检索效率
检索大型知识库可能影响性能：
- 尽量选择与问题最相关的知识库，而非检索所有知识库
- 合理设置最大条数，避免返回过多不必要的结果
- 考虑将常见问题的检索结果缓存起来，提高响应速度
### 隐私安全
知识库可能包含敏感信息：
- 确保知识库的访问权限设置正确
- 避免在公共场景暴露敏感知识内容
- 对检索结果进行必要的内容过滤
## 常见问题
### 问题1：检索不到相关内容怎么办？
**解决方案**：
- 尝试降低相似度阈值，如从0.7降至0.5
- 重新组织检索问题，使用更多关键词或更简洁的表述
- 检查知识库是否包含相关内容，必要时更新知识库
- 考虑选择更多相关知识库进行检索
### 问题2：检索结果包含过多不相关内容？
**解决方案**：
- 提高相似度阈值，如从0.5提高到0.7或更高
- 使用更精确的问题描述
- 缩小知识库范围，选择更专注于特定主题的知识库
- 减少返回的最大条数
### 问题3：如何处理多样化的用户问题？
**解决方案**：
- 使用意图识别节点先分析用户问题类型
- 根据不同问题类型选择不同的知识库
- 配置不同的相似度阈值和最大条数
- 结合大模型对检索结果进行整合和优化
## 最佳实践
### 常见搭配节点
|节点类型|搭配原因|
|---|---|
|大模型调用节点|将检索结果作为上下文提供给大模型，生成基于知识的回答|
|条件分支节点|根据检索结果决定后续处理流程|
|消息回复节点|将处理后的知识内容回复给用户|
|文本切割节点|处理过长的检索结果，确保适合后续处理|
|变量保存节点|保存检索结果供多个节点使用|