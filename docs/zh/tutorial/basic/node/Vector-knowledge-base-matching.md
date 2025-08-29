# 🔍 Nodo Corrispondenza Knowledge Base Vettoriale

## ❓ Che Cos'è il Nodo Corrispondenza Knowledge Base Vettoriale?

Il nodo Corrispondenza Knowledge Base Vettoriale è un nodo specializzato nel flusso di lavoro Magic Flow per recuperare e abbinare contenuti della knowledge base vettoriale. Può aiutarti a filtrare le knowledge base vettoriali necessarie in base a condizioni specifiche, fornendo supporto di base per operazioni successive (come ricerca di similarità, domande e risposte sulla conoscenza, ecc.). In parole semplici, questo nodo è come filtrare gli "scaffali" appropriati nella tua knowledge base vettoriale, per poter successivamente cercare informazioni rilevanti su questi "scaffali".

**Spiegazione Immagine:**

L'interfaccia del nodo Corrispondenza Knowledge Base Vettoriale è composta principalmente da due parti - l'area "Configurazione Condizioni di Filtro" in alto, utilizzata per impostare le condizioni di filtro delle knowledge base vettoriali; l'area "Output" in basso, che mostra la lista delle knowledge base vettoriali filtrate. Le condizioni di filtro supportano molteplici modalità di abbinamento come uguale, diverso, contiene, non contiene per ID o nome.
![Nodo Inizio](https://cdn.letsmagic.cn/static/img/Vector-knowledge-base-matching.png)

## 🤔 Perché Serve il Nodo Corrispondenza Knowledge Base Vettoriale?

**Nel processo di costruzione di applicazioni intelligenti, il nodo Corrispondenza Knowledge Base Vettoriale svolge il ruolo di "filtro della conoscenza", può aiutarti a:**
- **Localizzare Precisamente le Fonti di Conoscenza**: Filtrare knowledge base vettoriali che soddisfano condizioni specifiche da molteplici knowledge base
- **Migliorare l'Efficienza di Ricerca**: Ridurre l'ambito della ricerca vettoriale successiva, migliorando precisione e velocità di ricerca
- **Selezionare Dinamicamente Knowledge Base**: Secondo scenari diversi o esigenze degli utenti, selezionare dinamicamente knowledge base appropriate
- **Filtro Combinato Multi-Condizioni**: Supportare combinazione multi-condizioni per realizzare logica di abbinamento knowledge base complessa
- **Fornire Dati ai Nodi Downstream**: Fornire la lista delle knowledge base filtrate ai successivi nodi di ricerca vettoriale

## 🎯 Scenari Applicabili

### 1. Sistema di Domande e Risposte Intelligente Multi-Dominio
Quando costruisci un sistema di domande e risposte che copre molteplici domini, puoi prima utilizzare il nodo Corrispondenza Knowledge Base Vettoriale per filtrare le knowledge base relative al dominio delle domande dell'utente, poi procedere con la ricerca precisa dei contenuti, migliorando l'accuratezza delle risposte.

### 2. Ricerca di Conoscenza con Controllo Permessi
All'interno dell'azienda, diversi dipartimenti o ruoli potrebbero avere il diritto di accedere a knowledge base diverse. Attraverso il nodo Corrispondenza Knowledge Base Vettoriale, puoi filtrare le knowledge base che l'utente ha il diritto di accedere in base alle informazioni di dipartimento o ruolo dell'utente, assicurando la sicurezza delle informazioni.

### 3. Ricerca Collaborativa Multi-Knowledge Base
Quando necessiti di effettuare ricerca collaborativa in molteplici knowledge base correlate, puoi prima utilizzare il nodo Corrispondenza Knowledge Base Vettoriale per filtrare queste knowledge base correlate, poi effettuare ricerca unificata in queste knowledge base, ottenendo informazioni più complete.

## ⚙️ Spiegazione Parametri del Nodo

### Parametri Base
|Nome Parametro|Descrizione|Obbligatorio|Valore Default|
|---|---|---|---|
|Condizioni di Ricerca|Imposta la combinazione di condizioni per ricercare knowledge base vettoriali|Sì|Nessuno|

### Dettagli Condizioni di Ricerca
|Componenti Condizione|Valori Opzionali|Descrizione|
|---|---|---|
|Tipo Valore Sinistro|ID Knowledge Base|Filtra per identificatore univoco knowledge base|
||Nome Knowledge Base|Filtra per nome knowledge base|
|Operatore|Uguale|Abbinamento completo al valore specificato|
||Diverso|Esclude risultati che corrispondono completamente al valore specificato|
||Contiene|Contiene la stringa specificata|
||Non Contiene|Non contiene la stringa specificata|
|Valore Destro|Input Personalizzato|Inserisci il valore di filtro specifico, può essere ID o nome (dipende dal tipo valore sinistro)|

### Contenuto Output
|Campo Output|Descrizione|
|---|---|
|Lista Knowledge Base Vettoriali (vector_databases)|Lista delle knowledge base vettoriali filtrate, contiene ID e nome di ciascuna knowledge base|

## 📋 Istruzioni per l'Uso

### Passi di Configurazione Base
1. **Aggiungere Condizioni di Ricerca**:
    1. Clicca il pulsante "Aggiungi Condizione" per aggiungere una condizione di filtro
    2. Dal menu dropdown tipo valore sinistro seleziona "ID Knowledge Base" o "Nome Knowledge Base"
    3. Seleziona l'operatore appropriato (uguale, diverso, contiene, non contiene)
    4. Nel campo input valore destro inserisci il valore di filtro specifico
2. **Impostare Molteplici Condizioni (Opzionale)**:
    1. Se necessiti di impostare molteplici condizioni, ripeti cliccando il pulsante "Aggiungi Condizione"
    2. Tra molteplici condizioni puoi scegliere relazione "E" o "O"
3. **Combinazione Condizioni (Opzionale)**:
    1. Per logica di filtro complessa, puoi creare gruppi di condizioni
    2. Clicca il pulsante "Aggiungi Gruppo Condizioni" per creare un nuovo gruppo di condizioni
    3. Nel gruppo di condizioni aggiungi condizioni e imposta relazioni tra condizioni
4. **Anteprima Output**:
    1. Dopo la configurazione, puoi visualizzare in anteprima la lista delle knowledge base vettoriali filtrate nella sezione output del nodo

### Tecniche Avanzate
#### Strategie di Ricerca Efficienti
1. **Filtro Preciso**: Quando conosci chiaramente l'ID o il nome completo della knowledge base target, utilizza l'operatore "Uguale" per abbinamento preciso
2. **Filtro Fuzzy**: Quando conosci solo parte delle informazioni del nome della knowledge base, utilizza l'operatore "Contiene" per abbinamento fuzzy
3. **Strategia di Esclusione**: Utilizza gli operatori "Diverso" o "Non Contiene" per escludere knowledge base non necessarie

#### Collaborazione con Altri Nodi
**Il nodo Corrispondenza Knowledge Base Vettoriale necessita solitamente di essere utilizzato in combinazione con altri nodi:**
1. **In Combinazione con Nodo Ricerca Vettoriale**:
    1. Utilizza il nodo Corrispondenza Knowledge Base Vettoriale per filtrare knowledge base rilevanti
    2. Poi utilizza il nodo Ricerca Vettoriale per effettuare ricerca di similarità dei contenuti in queste knowledge base
2. **In Combinazione con Nodo Ramificazione Condizionale**:
    1. Secondo se i risultati di filtro sono vuoti decide il flusso successivo
    2. Puoi impostare soluzioni di backup quando non vengono trovate knowledge base corrispondenti
3. **In Combinazione con Nodo Chiamata Modello Grande**:
    1. Passa le informazioni delle knowledge base filtrate al modello grande
    2. Fa sì che il modello grande generi risposte basate su queste knowledge base specifiche

## ⚠️ Note Importanti

### Limitazioni di Autorizzazione
Il nodo può filtrare solo le knowledge base vettoriali che l'utente corrente ha il permesso di accedere:
- Le knowledge base senza permesso di accesso non appariranno nei risultati di filtro, anche se soddisfano le condizioni di filtro
- Assicurati che il creatore del flusso abbia permessi di lettura sulle knowledge base rilevanti

### Considerazioni sulle Prestazioni
Quando il numero di knowledge base è elevato, condizioni di filtro complesse potrebbero influenzare l'efficienza di esecuzione:
- Cerca di utilizzare condizioni di filtro precise
- Evita di utilizzare troppi operatori "Contiene" o "Non Contiene"
- Riduci il più possibile i livelli di annidamento dei gruppi di condizioni

### Gestione Risultati Vuoti
Se le condizioni di filtro sono troppo restrittive, potrebbero portare a nessuna knowledge base che soddisfa le condizioni:
- Assicurati di gestire nel flusso i possibili casi di risultati vuoti
- Considera di utilizzare il nodo Ramificazione Condizionale per verificare se i risultati di filtro sono vuoti

## ❓ Problemi Comuni

### Problema 1: Dopo la ricerca non viene restituita alcuna knowledge base, ma sono sicuro che esistono knowledge base che soddisfano le condizioni, quale potrebbe essere la causa?

**Soluzioni**: Le possibili cause includono:
- Problema di permessi: Potresti non avere il permesso di accedere a queste knowledge base
- Impostazione condizioni errata: Verifica che l'ortografia, maiuscole/minuscole delle condizioni di filtro siano corrette
- Stato knowledge base: La knowledge base target potrebbe essere disabilitata o eliminata

### Problema 2: Come filtrare contemporaneamente per ID e nome delle knowledge base?

**Soluzioni**: Puoi aggiungere molteplici condizioni di filtro:
- Aggiungi la prima condizione, seleziona "ID Knowledge Base" come tipo valore sinistro, imposta operatore e valore destro corrispondenti
- Clicca "Aggiungi Condizione" per aggiungere la seconda condizione
- Seleziona "Nome Knowledge Base" come tipo valore sinistro, imposta operatore e valore destro corrispondenti
- Tra le due condizioni scegli la relazione "E" o "O"

### Problema 3: Come utilizzare la lista delle knowledge base vettoriali in output del nodo nei nodi successivi?

**Soluzioni**: La lista delle knowledge base vettoriali in output può essere utilizzata nei nodi successivi attraverso riferimento variabile:
- Nel nodo Ricerca Vettoriale, puoi referenziare `output_nodo_precedente.vector_databases`
- Se necessiti di ottenere l'ID di una knowledge base specifica, puoi utilizzare `output_nodo_precedente.vector_databases[0].id`
- Nel nodo Esecuzione Codice, puoi accedere e elaborare questi dati attraverso JavaScript

## 🏆 Migliori Pratiche

### Nodi Comuni da Abbinare

|Tipo Nodo|Motivo Abbinamento|
|---|---|
|Nodo Ricerca Vettoriale|Effettua ricerca di similarità dei contenuti nelle knowledge base filtrate|
|Nodo Ramificazione Condizionale|Decide il flusso di elaborazione successivo in base ai risultati di filtro|
|Nodo Chiamata Modello Grande|Utilizza le knowledge base filtrate per domande e risposte con arricchimento di conoscenza|
|Nodo Salvataggio Variabili|Salva i risultati di filtro per utilizzo in molteplici nodi successivi|
|Nodo Esecuzione Codice|Effettua elaborazione o conversione avanzata dei risultati di filtro|

---

# 向量知识库匹配节点
## 什么是向量知识库匹配节点？
向量知识库匹配节点是 Magic Flow 工作流中专门用于检索和匹配向量知识库内容的节点。它能帮助您根据特定条件筛选出需要的向量知识库，为后续的相关操作（如相似度搜索、知识问答等）提供基础支持。简单来说，这个节点就像是在您的向量知识库中筛选出合适的"书架"，以便后续可以在这些"书架"上查找相关信息。

**图片说明：**

向量知识库匹配节点界面主要由两部分组成 - 上方的"配置筛选条件"区域，用于设置向量知识库的筛选条件；下方的"输出"区域，显示筛选后的向量知识库列表。筛选条件支持按ID或名称进行等于、不等于、包含、不包含等多种匹配方式。
![开始节点](https://cdn.letsmagic.cn/static/img/Vector-knowledge-base-matching.png)

## 为什么需要向量知识库匹配节点？
**在智能应用的构建过程中，向量知识库匹配节点扮演着"知识筛选器"的角色，它能够帮助您：**
- **精准定位知识源**：从多个向量知识库中筛选出符合特定条件的知识库
- **提高检索效率**：缩小后续向量搜索的范围，提高检索精度和速度
- **动态选择知识库**：根据不同场景或用户需求，动态选择适合的知识库
- **多条件组合筛选**：支持多条件组合筛选，实现复杂的知识库匹配逻辑
- **为下游节点提供数据**：为后续的向量搜索节点提供经过筛选的知识库列表
## 适用场景
### 1. 多领域智能问答系统
当您构建一个涵盖多个领域的问答系统时，可以先通过向量知识库匹配节点根据用户的问题领域筛选出相关领域的知识库，然后再进行精确的内容检索，提高回答的准确性。
### 2. 权限控制的知识检索
在企业内部，不同部门或角色可能有权访问不同的知识库。通过向量知识库匹配节点，可以根据用户的部门或角色信息筛选出其有权访问的知识库，确保信息安全。
### 3. 多知识库协同检索
当需要在多个相关知识库中进行协同检索时，可以先通过向量知识库匹配节点筛选出这些相关知识库，然后在这些知识库中进行统一检索，获取更全面的信息。
## 节点参数说明
### 基本参数
|参数名称|说明|是否必填|默认值|
|---|---|---|---|
|检索条件|设置检索向量知识库的条件组合|是|无|

### 检索条件详解
|条件组成部分|可选值|说明|
|---|---|---|
|左值类型|知识库ID|按知识库唯一标识符筛选|
||知识库名称|按知识库名称筛选|
|操作符|等于|完全匹配指定值|
||不等于|排除与指定值完全匹配的结果|
||包含|包含指定字符串|
||不包含|不包含指定字符串|
|右值|自定义输入|输入具体的筛选值，可以是ID或名称（取决于左值类型）|

### 输出内容
|输出字段|说明|
|---|---|
|向量知识库列表（vector_databases）|筛选后的向量知识库列表，包含每个知识库的ID和名称|

## 使用说明
### 基本配置步骤
1. **添加检索条件**：
    1. 点击"添加条件"按钮添加一个筛选条件
    2. 从左值类型下拉菜单中选择"知识库ID"或"知识库名称"
    3. 选择适当的操作符（等于、不等于、包含、不包含）
    4. 在右值输入框中输入具体的筛选值
2. **设置多个条件（可选）**：
    1. 如需设置多个条件，重复点击"添加条件"按钮
    2. 多个条件之间可以选择"且"或"或"的关系
3. **条件组合（可选）**：
    1. 对于复杂的筛选逻辑，可以创建条件组
    2. 点击"添加条件组"按钮创建一个新的条件组
    3. 在条件组内添加条件，并设置条件之间的关系
4. **预览输出**：
    1. 配置完成后，可以在节点的输出部分预览筛选后的向量知识库列表
### 进阶技巧
#### 高效的检索策略
1. **精确筛选**：当您明确知道目标知识库的ID或完整名称时，使用"等于"操作符进行精确匹配
2. **模糊筛选**：当您只知道知识库名称的部分信息时，使用"包含"操作符进行模糊匹配
3. **排除策略**：使用"不等于"或"不包含"操作符排除不需要的知识库
#### 与其他节点协同
**向量知识库匹配节点通常需要与其他节点结合使用：**
1. **搭配向量搜索节点**：
    1. 使用向量知识库匹配节点筛选出相关知识库
    2. 然后使用向量搜索节点在这些知识库中进行内容相似度检索
2. **结合条件分支节点**：
    1. 根据筛选结果是否为空决定后续流程
    2. 可以设置在未找到匹配知识库时的备用方案
3. **配合大模型调用节点**：
    1. 将筛选出的知识库信息传递给大模型
    2. 让大模型基于这些特定知识库生成回答
## 注意事项
### 权限限制
节点只能筛选当前用户有权限访问的向量知识库：
- 无权限访问的知识库不会出现在筛选结果中，即使它们符合筛选条件
- 确保流程创建者对相关知识库有读取权限
### 性能考量
当知识库数量较多时，复杂的筛选条件可能影响执行效率：
- 尽量使用精确的筛选条件
- 避免使用过多的"包含"或"不包含"操作符
- 尽可能减少条件组的嵌套层级
### 空结果处理
如果筛选条件过于严格，可能导致没有知识库符合条件：
- 务必在流程中处理可能出现的空结果情况
- 考虑使用条件分支节点检查筛选结果是否为空
## 常见问题
### 问题1：检索后没有返回任何知识库，但我确定有符合条件的知识库，可能是什么原因？
**解决方案**：可能的原因包括：
- 权限问题：您可能没有访问这些知识库的权限
- 条件设置错误：检查筛选条件的拼写、大小写等是否正确
- 知识库状态：目标知识库可能已禁用或删除
### 问题2：如何同时按ID和名称筛选知识库？
**解决方案**：您可以添加多个筛选条件：
- 添加第一个条件，选择"知识库ID"作为左值类型，设置相应的操作符和右值
- 点击"添加条件"按钮，添加第二个条件
- 选择"知识库名称"作为左值类型，设置相应的操作符和右值
- 在两个条件之间选择"且"或"或"的关系
### 问题3：节点输出的向量知识库列表如何在后续节点中使用？
**解决方案**：输出的向量知识库列表可以在后续节点中通过变量引用使用：
- 在向量搜索节点中，可以引用 `上一节点输出.vector_databases`
- 如需获取特定知识库的ID，可以使用 `上一节点输出.vector_databases[0].id`
- 在代码执行节点中，可以通过JavaScript访问和处理这些数据
## 常见搭配节点
|节点类型|搭配原因|
|---|---|
|向量搜索节点|在筛选出的知识库中进行内容相似度检索|
|条件分支节点|根据筛选结果决定后续处理流程|
|大模型调用节点|将筛选后的知识库用于知识增强问答|
|变量保存节点|保存筛选结果供后续多个节点使用|
|代码执行节点|对筛选结果进行高级处理或转换|