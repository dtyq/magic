# 🌐 Nodo Richiesta HTTP
## ❓ Cosa è il Nodo Richiesta HTTP?
Il nodo richiesta HTTP è un nodo importante nel flusso di lavoro Magic Flow utilizzato per interagire con API esterne e servizi di rete. È come un ponte per la comunicazione del flusso di lavoro con il mondo esterno, permette di inviare vari tipi di richieste di rete (come GET, POST, ecc.), ottenere dati esterni o sottoporre informazioni a sistemi esterni. Attraverso questo nodo, è possibile integrare facilmente servizi e fonti dati esterni nelle proprie applicazioni intelligenti.

**Spiegazione Immagine:**

L'interfaccia del nodo richiesta HTTP include aree di configurazione come URL richiesta, metodo richiesta, header richiesta e corpo richiesta, oltre a parti di impostazione risposta e output. Attraverso queste configurazioni, l'utente può definire come interagire con l'API esterna.
![Nodo Richiesta HTTP](https://cdn.letsmagic.cn/static/img/HTTP-request.png)

## 🎯 Perché Serve il Nodo Richiesta HTTP?
Nella costruzione di applicazioni intelligenti, spesso è necessario ottenere dati esterni o interagire con altri sistemi, il nodo richiesta HTTP è progettato proprio per questo:
- **Ottenere Dati in Tempo Reale**: Ottenere le ultime informazioni da API esterne, come previsioni del tempo, tassi di cambio, quotazioni azionarie, ecc.
- **Integrazione di Sistema**: Interfacciarsi con sistemi interni aziendali o di terze parti, realizzare scambio dati cross-sistema
- **Attivare Servizi Esterni**: Chiamare servizi esterni per completare funzioni specifiche, come inviare SMS, notifiche push, ecc.
- **Sottomissione Dati**: Sottoporre dati di form o altre informazioni a sistemi esterni
- **Autenticazione**: Interfacciarsi con servizi di autenticazione di terze parti, come autenticazione OAuth

## 📋 Scenari Applicabili
### 1. 📊 Applicazione Aggregazione Dati
Creare un'applicazione che aggrega informazioni da molteplici fonti dati, come integrare dati di vendita da diverse piattaforme in un unico report, fornire una visione completa per il decision-making.
### 2. 🏢 Integrazione Sistemi Interni Aziendali
Integrare il flusso di lavoro Magic Flow con sistemi interni aziendali (come CRM, ERP, OA, ecc.), realizzare circolazione dati e collaborazione operativa.
### 3. 🤖 Miglioramento Assistente Intelligente
Attraverso la chiamata di API professionali (come API meteo, API traduzione, ecc.), espandere i confini delle capacità dell'assistente intelligente, fornire servizi più ricchi.
### 4. 🔔 Sistema Trigger e Notifiche
Costruire un sistema capace di monitorare eventi specifici e attivare notifiche, come avvisi scorte, promemoria oscillazioni prezzi, ecc.

## ⚙️ Spiegazione Parametri Nodo
### Parametri Base
|Nome Parametro|Spiegazione|Obbligatorio|Valore Default|
|---|---|---|---|
|URL Richiesta|Specificare l'indirizzo target della richiesta|Sì|Nessuno|
|Metodo Richiesta|Selezionare il metodo richiesta HTTP (GET/POST/PUT/DELETE, ecc.)|Sì|GET|
|Header Richiesta|Impostare informazioni header richiesta HTTP, come Content-Type, Authorization, ecc.|No|Nessuno|
|Corpo Richiesta|Quando si utilizzano metodi come POST/PUT, impostare i dati da inviare|No|Nessuno|

#### Parametri Query
I parametri query vengono allegati all'URL in forma di coppie chiave-valore, formato `?key1=value1&key2=value2`
|Elemento Configurazione|Spiegazione|
|---|---|
|Nome Parametro|Nome del parametro query|
|Tipo Parametro|Tipo dati del parametro, come stringa, numero, ecc.|
|Valore Parametro|Valore specifico del parametro, supporta riferimento variabili|

#### Parametri Path
I parametri path sono la parte dinamica nel percorso URL, comunemente utilizzati nelle API, come `/user/{id}`
|Elemento Configurazione|Spiegazione|
|---|---|
|Nome Parametro|Nome del parametro path|
|Nome Visualizzato|Nome parametro visualizzato nell'interfaccia|
|Tipo Parametro|Tipo dati del parametro|
|Valore Parametro|Valore specifico del parametro, supporta riferimento variabili|

#### Corpo Richiesta (Body)
Il corpo richiesta viene utilizzato per inviare dati in richieste POST, PUT, ecc.
|Elemento Configurazione|Spiegazione|
|---|---|
|Tipo Contenuto|Formato del corpo richiesta, come JSON, Form, ecc.|
|Contenuto Corpo Richiesta|Contenuto specifico del corpo richiesta, diversi modi di editing in base al tipo di contenuto|

#### Header Richiesta (Headers)
Gli header richiesta vengono utilizzati per inviare metadati della richiesta HTTP
|Elemento Configurazione|Spiegazione|
|---|---|
|Nome Parametro|Nome dell'header richiesta|
|Nome Visualizzato|Nome parametro visualizzato nell'interfaccia|
|Tipo Parametro|Tipo dati del parametro|
|Valore Parametro|Valore specifico del parametro, supporta riferimento variabili|

### Impostazioni Output
|Elemento Configurazione|Spiegazione|
|---|---|
|Output Sistema|Il risultato della risposta alla richiesta HTTP verrà automaticamente memorizzato nell'output sistema|
|Output Personalizzato|È possibile estrarre parti specifiche del risultato della risposta come variabili personalizzate|

## 📖 Istruzioni per l'Uso
### Passi di Configurazione Base
1. **Impostare URL Richiesta**：
    1. Inserire l'indirizzo API completo, includendo il protocollo ([http:// o https://](http:// o https://))
    2. È possibile utilizzare riferimento variabili per URL dinamici, come `https://api.example.com/users/{{user_id}}`
2. **Selezionare Metodo Richiesta**：
    1. GET：Utilizzato per ottenere dati, come interrogare informazioni
    2. POST：Utilizzato per sottoporre dati, come creare record
    3. PUT：Utilizzato per aggiornare dati, come aggiornare informazioni utente
    4. DELETE：Utilizzato per eliminare dati
3. **Configurare Header Richiesta**：
    1. Impostare Content-Type (come application/json, multipart/form-data, ecc.)
    2. Aggiungere informazioni di autenticazione, come Authorization: Bearer token
    3. Altri header necessari come Accept, User-Agent, ecc.
4. **Scrivere Corpo Richiesta (applicabile a metodi POST/PUT, ecc.)**：
    1. Per formato JSON, è possibile utilizzare l'editor JSON
    2. È possibile fare riferimento a variabili, come `{"name": "{{user_name}}", "age": {{user_age}}}`
5. **Configurare Parsing Risposta**：
    1. Selezionare il formato risposta appropriato (JSON, XML, Text, ecc.)
    2. Impostare il percorso di estrazione dei dati risposta (se necessario)

### Tecniche Avanzate
#### Elaborazione Dati JSON
L'elaborazione di API in formato JSON è lo scenario più comune：
1. **Inviare Dati JSON**：
    1. Impostare Content-Type come application/json
    2. Utilizzare il formato JSON corretto nel corpo richiesta
1. **Elaborare Risposta JSON**：
    1. Selezionare il modo di parsing risposta JSON
    2. È possibile estrarre campi specifici tramite percorso JSON, come `response.data.items`
2. **Elaborare Dati Annidati**：
    1. Per JSON complessi annidati, è possibile elaborarli ulteriormente in nodi successivi (come nodo esecuzione codice)

#### Autenticazione e Sicurezza
L'interazione con API esterne generalmente richiede autenticazione：
1. **Autenticazione Base**：
    1. Utilizzare header Authorization: `Basic base64(username:password)`
    2. È possibile configurarlo direttamente negli header richiesta
2. **Autenticazione OAuth**：
    1. Ottenere token di accesso (potrebbe richiedere un nodo richiesta HTTP separato)
    2. Utilizzare nell'header Authorization: `Bearer your_access_token`
3. **Autenticazione Chiave API**：
    1. In base ai requisiti dell'API, potrebbe essere necessario aggiungere la chiave in parametri query URL, header richiesta o corpo richiesta
    2. Esempio：`https://api.example.com/data?api_key=your_api_key`
## ⚠️ Note di Attenzione
### Timeout e Performance
Le chiamate API esterne possono causare ritardi nell'esecuzione del flusso di lavoro：
- Impostare un timeout ragionevole per API importanti o potenzialmente lente
- Configurare un numero appropriato di tentativi per API instabili
- Considerare l'utilizzo di modalità asincrone per gestire richieste a lunga esecuzione

### Gestione Errori
Le richieste di rete possono fallire per molteplici motivi：
- Configurare meccanismi di gestione errori corretti, come rami condizionali per giudicare lo stato della risposta
- Controllare i campi di output errore per ottenere informazioni dettagliate sugli errori
- Aggiungere meccanismi di fallback per flussi critici, come soluzioni alternative quando l'API non è disponibile

### Sicurezza Dati
Attenzione nella gestione di dati sensibili：
- Evitare di includere informazioni sensibili negli URL (come password), utilizzare header o corpo richiesta
- Utilizzare protocollo HTTPS per garantire la crittografia della trasmissione dati
- Considerare l'utilizzo di variabili d'ambiente o sistemi di gestione chiavi per memorizzare informazioni sensibili come chiavi API

## ❓ Domande Frequenti
### Domanda 1: Come Gestire i Problemi di Limitazione API?
**Soluzioni**：Molteplici API hanno limiti di frequenza di chiamata, è possibile：
- Implementare controllo velocità richieste, evitare di inviare troppe richieste in breve tempo
- Gestire correttamente il codice di stato 429 (Too Many Requests), aggiungere logica di attesa
- Quando possibile, considerare la cache dei dati per ridurre le chiamate API

### Domanda 2: Cosa Fare se il Formato dei Dati Restituiti dalla Richiesta non è Corretto?
**Soluzioni**：Quando il formato dati non corrisponde alle aspettative：
- Verificare se il modo di parsing della risposta è corretto (JSON/XML/Text)
- Utilizzare il nodo esecuzione codice per conversioni e elaborazioni dei dati
- Confermare la documentazione API, verificare se i parametri richiesta sono corretti

### Domanda 3: Come Trasmettere File o Dati Binari?
**Soluzioni**：La trasmissione di file richiede elaborazioni speciali：
- Impostare Content-Type come multipart/form-data
- Utilizzare il formato corpo richiesta corretto per incapsulare i dati del file
- Per file di grandi dimensioni, prestare attenzione alle impostazioni di timeout della richiesta

## 🌟 Migliori Pratiche
### Nodi di Combinazione Comuni
|Tipo di Nodo|Motivo di Combinazione|
|---|---|
|Nodo Esecuzione Codice|Elaborare dati di risposta, convertire formati o estrarre informazioni chiave|
|Nodo Ramo Condizionale|Decidere l'operazione successiva in base allo stato della risposta API o al contenuto|
|Nodo Chiamata Modello Grande|Fornire i dati ottenuti dall'API come contesto al modello grande|
|Nodo Salvataggio Variabili|Salvare dati chiave restituiti dall'API per l'utilizzo nei flussi successivi|
|Nodo Ciclo|Elaborare API con paginazione o richieste batch di molteplici risorse|

---

# HTTP请求节点
## 什么是HTTP请求节点？
HTTP请求节点是Magic Flow工作流中用于与外部API和网络服务进行交互的重要节点。它就像是您的工作流与外部世界沟通的桥梁，允许您发送各种网络请求（如GET、POST等），获取外部数据或向外部系统提交信息。通过这个节点，您可以轻松地将外部服务和数据源集成到您的智能应用中。

**图片说明：**

HTTP请求节点界面包括请求URL、请求方法、请求头和请求体等配置区域，以及响应解析和输出设置部分。通过这些配置，用户可以定义如何与外部API交互。
![HTTP 请求节点](https://cdn.letsmagic.cn/static/img/HTTP-request.png)

## 为什么需要HTTP请求节点？
在构建智能应用时，往往需要获取外部数据或与其他系统交互，HTTP请求节点正是为此设计：
- **获取实时数据**：从外部API获取最新信息，如天气预报、汇率、股票行情等
- **系统集成**：与企业内部或第三方系统对接，实现跨系统数据交换
- **触发外部服务**：调用外部服务完成特定功能，如发送短信、推送通知等
- **数据提交**：向外部系统提交表单数据或其他信息
- **身份验证**：对接第三方身份验证服务，如OAuth认证
## 适用场景
### 1. 数据聚合应用
创建一个汇总多个数据源信息的应用，如将不同平台的销售数据整合到一个报表中，为决策提供全面视图。
### 2. 集成企业内部系统
将Magic Flow工作流与企业内部系统（如CRM、ERP、OA等）进行集成，实现数据流转和业务协同。
### 3. 智能助手增强
通过调用专业API（如天气API、翻译API等），增强智能助手的能力边界，提供更丰富的服务。
### 4. 触发器和通知系统
构建能够监控特定事件并触发通知的系统，如库存预警、价格波动提醒等。
## 节点参数说明
### 基本参数
|参数名称|说明|是否必填|默认值|
|---|---|---|---|
|请求URL|指定请求的目标地址|是|无|
|请求方法|选择HTTP请求方法(GET/POST/PUT/DELETE等)|是|GET|
|请求头|设置HTTP请求头信息，如Content-Type、Authorization等|否|无|
|请求体|当使用POST/PUT等方法时，设置要发送的数据|否|无|

#### 查询参数 (Query)
查询参数会以键值对的形式附加在URL后面，格式为`?key1=value1&key2=value2`
|配置项|说明|
|---|---|
|参数名|查询参数的名称|
|参数类型|参数的数据类型，如字符串、数字等|
|参数值|参数的具体值，支持变量引用|

#### 路径参数 (Path)
路径参数是URL路径中的动态部分，通常在API中使用，如`/user/{id}`
|配置项|说明|
|---|---|
|参数名|路径参数的名称|
|显示名称|在界面上显示的参数名称|
|参数类型|参数的数据类型|
|参数值|参数的具体值，支持变量引用|

#### 请求体 (Body)
请求体用于在POST、PUT等请求中发送数据
|配置项|说明|
|---|---|
|内容类型|请求体的格式，如JSON、Form表单等|
|请求体内容|请求体的具体内容，根据内容类型有不同的编辑方式|

#### 请求头 (Headers)
请求头用于发送HTTP请求的元数据
|配置项|说明|
|---|---|
|参数名|请求头的名称|
|显示名称|在界面上显示的参数名称|
|参数类型|参数的数据类型|
|参数值|参数的具体值，支持变量引用|

### 输出设置
|配置项|说明|
|---|---|
|系统输出|HTTP请求的响应结果会自动存储在系统输出中|
|自定义输出|可以将响应结果的特定部分提取为自定义变量|

## 使用说明
### 基本配置步骤
1. **设置请求URL**：
    1. 输入完整的API地址，包含协议（[http://或https://）](http://或https://）)
    2. 可使用变量引用动态URL，如`https://api.example.com/users/{{user_id}}`
2. **选择请求方法**：
    1. GET：用于获取数据，如查询信息
    2. POST：用于提交数据，如创建记录
    3. PUT：用于更新数据，如更新用户信息
    4. DELETE：用于删除数据
3. **配置请求头**：
    1. 设置Content-Type（如application/json、multipart/form-data等）
    2. 添加认证信息，如Authorization: Bearer token
    3. 其他必要的头信息如Accept、User-Agent等
4. **编写请求体（适用于POST/PUT等方法）**：
    1. 对于JSON格式，可使用JSON编辑器
    2. 可引用变量，如`{"name": "{{user_name}}", "age": {{user_age}}}`
5. **配置响应解析**：
    1. 选择适当的响应格式（JSON、XML、Text等）
    2. 设置响应数据的提取路径（如需要）
### 进阶技巧
#### JSON数据处理
处理JSON格式的API是最常见的场景：
1. **发送JSON数据**：
    1. 设置Content-Type为application/json
    2. 在请求体中使用正确的JSON格式
1. **处理JSON响应**：
    1. 选择JSON响应解析方式
    2. 可通过JSON路径提取特定字段，如`response.data.items`
2. **处理嵌套数据**：
    1. 对于复杂的嵌套JSON，可以在后续节点（如代码执行节点）中进一步处理
#### 认证与安全
与外部API交互通常需要认证：
1. **基本认证**：
    1. 使用Authorization头: `Basic base64(username:password)`
    2. 可以在请求头中直接配置
2. **OAuth认证**：
    1. 获取访问令牌（可能需要单独的HTTP请求节点）
    2. 在Authorization头中使用: `Bearer your_access_token`
3. **API密钥认证**：
    1. 根据API要求，可能在URL查询参数、请求头或请求体中添加密钥
    2. 示例：`https://api.example.com/data?api_key=your_api_key`
## 注意事项
### 超时与性能
外部API调用可能导致工作流执行延迟：
- 对重要或可能慢的API调用设置合理的超时时间
- 对不稳定的API配置适当的重试次数
- 考虑使用异步模式处理长时间运行的请求
### 错误处理
网络请求可能因多种原因失败：
- 配置正确的错误处理机制，如条件分支判断响应状态
- 检查错误输出字段以获取详细的错误信息
- 对关键流程添加回退机制，如API不可用时的替代方案
### 数据安全
处理敏感数据时的注意事项：
- 避免在URL中包含敏感信息（如密码），应使用请求头或请求体
- 使用HTTPS协议确保数据传输加密
- 考虑使用环境变量或密钥管理系统存储API密钥等敏感信息
## 常见问题
### 问题1：如何处理API限流问题？
**解决方案**：许多API有调用频率限制，可以：
- 实现请求速率控制，避免短时间内发送过多请求
- 正确处理429（Too Many Requests）状态码，添加等待逻辑
- 在条件允许的情况下，考虑数据缓存减少API调用次数
### 问题2：请求返回的数据格式不正确怎么办？
**解决方案**：数据格式不符合预期时：
- 检查响应解析方式是否正确（JSON/XML/Text）
- 使用代码执行节点对数据进行转换处理
- 确认API文档，验证请求参数是否正确
### 问题3：如何传递文件或二进制数据？
**解决方案**：传递文件需要特殊处理：
- 设置Content-Type为multipart/form-data
- 使用正确的请求体格式封装文件数据
- 对于大文件，需要注意请求超时设置
## 常见搭配节点
|节点类型|搭配原因|
|---|---|
|代码执行节点|处理响应数据，转换格式或提取关键信息|
|条件分支节点|根据API响应状态或内容决定下一步操作|
|大模型调用节点|将API获取的数据作为上下文提供给大模型|
|变量保存节点|保存API返回的关键数据供后续流程使用|
|循环节点|处理分页API或批量请求多个资源|