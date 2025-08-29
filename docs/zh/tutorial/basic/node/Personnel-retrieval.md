# 👥 Nodo Recupero Personale

## ❓ Cos'è il Nodo Recupero Personale?

Il nodo Recupero Personale è un nodo funzionale specializzato nei flussi di lavoro Magic Flow per interrogare e filtrare le informazioni del personale organizzativo. Permette di localizzare e ottenere rapidamente dati del personale basati su molteplici condizioni (come nome, numero dipendente, posizione, dipartimento, ecc.), proprio come effettuare una ricerca precisa nella rubrica aziendale.

**Spiegazione Interfaccia:**

L'interfaccia del nodo Recupero Personale è composta principalmente dall'area di impostazione delle condizioni di ricerca e dall'area di anteprima della struttura dei dati di output. In alto vengono mostrati vari opzioni di configurazione delle condizioni di filtro, inclusi condizioni di filtro come nome utente, numero dipendente, posizione, ecc.; in basso viene mostrata la struttura dei dati dei risultati della query, inclusi campi di informazioni di base dell'utente e informazioni del dipartimento.
![Nodo Recupero Personale](https://cdn.letsmagic.cn/static/img/Personnel-retrieval.png)

## 🤔 Perché Serve il Nodo Recupero Personale?

Nel flusso di lavoro aziendale, ottenere accuratamente le informazioni del personale è una esigenza di base per molti processi di automazione:
- **Associazione Dati**: Associare i dati aziendali con responsabili specifici o team
- **Controllo Permessi**: Dividere i permessi di accesso alle informazioni secondo il ruolo o dipartimento del personale
- **Flusso del Processo**: Identificare la persona che gestisce o approva il passo successivo del processo
- **Notifiche Messaggi**: Inviare notifiche automatiche a personale specifico o team
- **Collaborazione Team**: Costruire processi di collaborazione intelligente basati sulla struttura organizzativa

## 🎯 Scenari Applicabili

### 1. Processo di Approvazione Intelligente
Basandosi sul contenuto della richiesta, trovare automaticamente la persona di approvazione del dipartimento corrispondente, inoltrare con precisione la richiesta di approvazione, migliorare l'efficienza del processo.

### 2. Riepilogo Informazioni Dipartimentali
Recuperare rapidamente le informazioni di tutti i membri di un dipartimento specifico, utilizzato per generare report dipartimentali, analisi team o allocazione risorse.

### 3. Collegamento Dati Personale
Quando l'utente presenta una richiesta, associare automaticamente informazioni come il suo dipartimento, superiore diretto, ecc. basandosi sulla sua identità, riducendo l'input manuale.

### 4. Distribuzione Messaggi Intelligente
Trovare automaticamente i responsabili correlati secondo le regole aziendali, consegnare con precisione i messaggi di sistema o i promemoria di lavoro alla persona appropriata.

## ⚙️ Spiegazione Parametri del Nodo

### Parametri Condizioni di Ricerca
|Nome Parametro|Spiegazione|Obbligatorio|Valore Predefinito|
|---|---|---|---|
|Nome Utente|Corrispondenza secondo il nome reale del personale|No|Nessuno|
|Numero Dipendente|Corrispondenza secondo il numero dipendente del personale|No|Nessuno|
|Posizione|Corrispondenza secondo la posizione o titolo del personale|No|Nessuno|
|Numero Cellulare|Corrispondenza secondo il numero di cellulare del personale|No|Nessuno|
|Nome Dipartimentale|Corrispondenza secondo il nome del dipartimento|No|Nessuno|
|Nome Chat di Gruppo|Corrispondenza secondo il nome della chat di gruppo|No|Nessuno|

### Spiegazione Regole Condizioni
Ogni condizione di ricerca supporta i seguenti tipi di regole:
|Tipo Regola|Spiegazione|Esempio|
|---|---|---|
|Uguale|Il valore del campo è completamente uguale al valore specificato|Nome uguale a "Mario Rossi"|
|Diverso|Il valore del campo non è uguale al valore specificato|Posizione diversa da "Stagista"|
|Contiene|Il valore del campo contiene il contenuto specificato|Nome dipartimento contiene "Tecnico"|
|Non Contiene|Il valore del campo non contiene il contenuto specificato|Nome non contiene "Test"|
|Vuoto|Il valore del campo è vuoto|Numero cellulare vuoto|
|Non Vuoto|Il valore del campo non è vuoto|Numero dipendente non vuoto|

### Impostazione Tipo Valore
|Tipo Valore|Spiegazione|Esempio|
|---|---|---|
|Valore Fisso|Inserire direttamente il valore di query specifico|"Mario Rossi", "Dipartimento Sviluppo"|
|Valore Variabile|Fare riferimento a variabili nel flusso di lavoro come valore di query|department_name|

### Contenuto Output
|Campo Output|Spiegazione|
|---|---|
|Dati Utente (Array)|Lista utenti che soddisfano le condizioni, ogni utente contiene: ID utente univoco, nome reale, nome posizione, ecc.|

## 📋 Istruzioni per l'Uso

### Passi di Configurazione Base
1. **Imposta le condizioni di ricerca base**:
    1. Clicca sulla condizione di ricerca necessaria (come "Nome Utente")
    2. Seleziona la regola di corrispondenza (come "Uguale", "Contiene", ecc.)
    3. Seleziona il tipo di valore ("Valore Fisso" o "Valore Variabile")
    4. Inserisci il valore di query specifico o seleziona la variabile
2. **Aggiungi molteplici condizioni di ricerca (opzionale)**:
    1. Clicca il pulsante "Aggiungi Condizione" per aumentare ulteriori condizioni di filtro
    2. Molteplici condizioni sono predefinite come relazione "E", cioè tutte le condizioni devono essere soddisfatte
3. **Visualizza i campi di output**:
    1. Espandi la sezione "Output" per conoscere la struttura dei dati dei risultati della query
    2. Familiarizzati con il significato dei campi per fare riferimento corretto nei nodi successivi
4. **Connetti i nodi successivi**:
    1. Connetti l'output del nodo Recupero Personale ai nodi che necessitano di informazioni del personale
    2. Utilizza `NomeNodo.userData` nei nodi successivi per fare riferimento ai risultati della ricerca

## ⚠️ Note Importanti

### Efficienza di Ricerca
Quando la scala dell'organizzazione è grande, è necessario prestare attenzione all'impatto delle impostazioni delle condizioni di ricerca sull'efficienza:
- Dai priorità all'utilizzo di condizioni precise (come numero dipendente, numero cellulare) piuttosto che condizioni fuzzy (come nome contiene)
- Combina ragionevolmente molteplici condizioni per restringere l'ambito di ricerca
- Evita query complete non necessarie, riduci il carico del sistema

### Permessi sui Dati
Il recupero del personale è limitato dai permessi dell'account Bot corrente:
- Può recuperare solo dipartimenti e personale che il Bot ha il permesso di accedere
- Alcune informazioni sensibili (come numero cellulare) potrebbero richiedere permessi specifici
- Assicurati che l'account Bot abbia permessi sufficienti di accesso alla struttura organizzativa

### Tempestività dei Dati
Le informazioni del personale potrebbero cambiare, è necessario prestare attenzione:
- I risultati della ricerca riflettono lo stato della struttura organizzativa al momento attuale
- È necessaria una strategia per affrontare cambiamenti di posizione del personale, dimissioni, ecc.
- Si consiglia di aggiungere logica di verifica dei risultati nei processi critici

## ❓ Problemi Comuni

### Problema 1: Ho Impostato le Condizioni di Ricerca ma Non Ho Ottenuto i Risultati Previsti?
**Soluzioni**: Potrebbe essere un problema di mancata corrispondenza delle condizioni o di permessi, si consiglia:
- Verifica se i valori delle condizioni sono corretti, specialmente i riferimenti alle variabili
- Conferma che gli operatori di confronto siano utilizzati correttamente (come "Uguale" e "Contiene")
- Prova ad allentare le condizioni o utilizzare condizioni più precise (come numero dipendente)
- Verifica se l'account Bot ha i permessi per accedere alle informazioni del personale target

### Problema 2: Come Gestire Situazioni di Omonimia?
**Soluzioni**: Il fenomeno dell'omonimia è comune nelle grandi organizzazioni:
- Combina molteplici condizioni (come nome+dipartimento) per filtrare
- Dai priorità all'utilizzo di identificatori univoci (come numero dipendente o ID utente) per la ricerca
- Aggiungi logica di giudizio dell'omonimia nell'elaborazione dei risultati (come distinzione per dipartimento)

### Problema 3: C'è un Limite alla Quantità dei Risultati di Ricerca?
**Soluzioni**: Sì, generalmente c'è un limite al numero di restituzioni:
- Per impostazione predefinita vengono restituiti al massimo 50 record corrispondenti
- Per scenari che necessitano di interrogare grandi quantità di utenti, considera l'elaborazione in batch o l'ottimizzazione delle condizioni di ricerca
- Per scenari di ampio raggio come query di intero dipartimento, considera l'utilizzo di strumenti di report più professionali

## 🔗 Nodi Comuni da Abbinare

|Tipo di Nodo|Motivo dell'Abbinamento|
|---|---|
|Nodo Risposta Messaggio|Mostrare all'utente le informazioni del personale recuperate|
|Nodo Ramo Condizionale|Decidere il flusso successivo basandosi sull'esistenza di risultati di ricerca|
|Nodo Chiamata Modello Grande|Utilizzare le informazioni del personale per costruire risposte personalizzate o analisi|
|Nodo Creazione Chat di Gruppo|Creare automaticamente chat di gruppo specifiche basandosi sui risultati della ricerca|
|Nodo Richiesta HTTP|Inviare le informazioni del personale a sistemi esterni per l'elaborazione|

---

# 人员检索节点

## 什么是人员检索节点？
人员检索节点是 Magic Flow 工作流中专门用于查询和筛选组织人员信息的功能节点。它允许您基于多个条件（如姓名、工号、职位、部门等）快速定位和获取人员数据，就像在企业通讯录中进行精确搜索一样。

**界面说明：**

人员检索节点界面主要由搜索条件设置区和输出数据结构预览区组成。上部显示各种过滤条件配置选项，包括用户名、工号、职位等筛选条件；下部显示查询结果的数据结构，包括用户基本信息和部门信息字段。
![人员检索节点](https://cdn.letsmagic.cn/static/img/Personnel-retrieval.png)

## 为什么需要人员检索节点？
在企业工作流中，准确获取人员信息是许多自动化流程的基础需求：
- **数据关联**：将业务数据与具体负责人或团队关联
- **权限控制**：根据人员角色或部门划分信息访问权限
- **流程流转**：识别下一步流程的处理人或审批人
- **消息通知**：向特定人员或团队发送自动化通知
- **团队协作**：基于组织架构构建智能协作流程

## 应用场景
### 1. 智能审批流程
根据申请内容自动找到对应部门的审批人，精准转发审批请求，提高流程效率。

### 2. 部门信息汇总
快速检索特定部门的所有成员信息，用于生成部门报表、团队分析或资源分配。

### 3. 人员数据联动
当用户提交请求时，根据其身份自动关联其所在部门、直属上级等信息，减少人工输入。

### 4. 智能消息分发
根据业务规则自动找到相关负责人，将系统消息或工作提醒精准送达合适的人。

## 节点参数说明
### 搜索条件参数
|参数名称|说明|是否必填|默认值|
|---|---|---|---|
|用户名|按人员真实姓名匹配|否|无|
|工号|按人员工号匹配|否|无|
|职位|按人员职位或职称匹配|否|无|
|手机号|按人员手机号码匹配|否|无|
|部门名称|按部门名称匹配|否|无|
|群聊名称|按群聊名称匹配|否|无|

### 条件规则说明
每个搜索条件支持以下规则类型：
|规则类型|说明|示例|
|---|---|---|
|等于|字段值完全等于指定值|姓名等于"张三"|
|不等于|字段值不等于指定值|职位不等于"实习生"|
|包含|字段值包含指定内容|部门名称包含"技术"|
|不包含|字段值不包含指定内容|姓名不包含"测试"|
|为空|字段值为空|手机号为空|
|不为空|字段值不为空|工号不为空|

### 值类型设置
|值类型|说明|示例|
|---|---|---|
|固定值|直接输入具体查询值|"张三"、"研发部"|
|变量值|引用工作流中的变量作为查询值|department_name|

### 输出内容
|输出字段|说明|
|---|---|
|用户数据（数组）|符合条件的用户列表，每个用户包含：唯一用户ID、真实姓名、职位名称等|

## 使用说明
### 基本配置步骤
1. **设置基本搜索条件**：
    1. 点击需要的搜索条件（如"用户名"）
    2. 选择匹配规则（如"等于"、"包含"等）
    3. 选择值类型（"固定值"或"变量值"）
    4. 输入具体查询值或选择变量
2. **添加多个搜索条件**（可选）：
    1. 点击"添加条件"按钮增加更多过滤条件
    2. 多个条件默认为"且"关系，即所有条件都必须满足
3. **查看输出字段**：
    1. 展开"输出"部分了解查询结果数据结构
    2. 熟悉字段含义，以便在后续节点中正确引用
4. **连接后续节点**：
    1. 将人员检索节点输出连接到需要人员信息的节点
    2. 使用 `节点名称.userData` 在后续节点中引用搜索结果

## 重要提示
### 搜索效率
当组织规模较大时，需注意搜索条件设置对效率的影响：
- 优先使用精确条件（如工号、手机号）而非模糊条件（如姓名包含）
- 合理组合多个条件以缩小搜索范围
- 避免不必要的全量查询，减少系统负载

### 数据权限
人员检索受当前 Bot 账号权限限制：
- 只能检索 Bot 有权限访问的部门和人员
- 部分敏感信息（如手机号）可能需要特定权限
- 确保 Bot 账号具有足够的组织架构访问权限

### 数据时效性
人员信息可能发生变化，需要注意：
- 搜索结果反映当前时刻的组织架构状态
- 需要有应对人员职位变动、离职等情况的策略
- 建议在关键流程中添加结果验证逻辑

## 常见问题
### 问题1：设置了搜索条件但未返回预期结果怎么办？
**解决方案**：可能是条件不匹配或权限问题，建议：
- 检查条件值是否正确，尤其是变量引用
- 确认比较运算符使用正确（如"等于"与"包含"）
- 尝试放宽条件或使用更精确的条件（如工号）
- 检查 Bot 账号是否有权限访问目标人员信息

### 问题2：如何处理重名情况？
**解决方案**：大型组织中重名现象常见：
- 组合多个条件（如姓名+部门）进行筛选
- 优先使用唯一标识符（如工号或用户ID）进行搜索
- 在结果处理时添加重名判断逻辑（如按部门区分）

### 问题3：搜索结果数量是否有限制？
**解决方案**：是的，通常有返回数量限制：
- 默认最多返回50条匹配记录
- 对于需要查询大量用户的场景，考虑分批处理或优化搜索条件
- 对于大范围场景如全部门查询，考虑使用更专业的报表工具

## 常见配对节点
|节点类型|配对原因|
|---|---|
|消息回复节点|向用户展示检索到的人员信息|
|条件分支节点|根据是否存在搜索结果决定后续流程|
|大模型调用节点|利用人员信息构建个性化回复或分析|
|创建群聊节点|根据搜索结果自动创建特定群聊|
|HTTP请求节点|将人员信息发送给外部系统处理|