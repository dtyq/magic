# Spiegazione Nomi 📚

Questo articolo spiega i termini core e i concetti importanti utilizzati in Magic.

## Concetti Fondamentali 🧠

| Termine | Descrizione |
| ------- | ----------- |
| Modello (Model) | Il modello contiene numerosi parametri ed è addestrato su grandi quantità di dati diversi. Puoi utilizzare il modello per eseguire vari compiti, come generazione immagini, domande e risposte, generazione codice, riscrittura, ecc. |
| Chiave di Accesso (Access Token) | Quando si chiama Magic API e SDK, è necessario verificare l'identità utente e autorizzare attraverso la chiave di accesso. Gli utenti possono impostare diverse autorizzazioni per ciascuna chiave di accesso, realizzando l'accesso sicuro alle risorse. |
| Token | Nei modelli di linguaggio di grandi dimensioni, il token è l'unità fondamentale di elaborazione del testo, il modello solitamente divide il testo di input in una serie di token, poi elabora e analizza questi token. Il token può essere una parola, un carattere, un frammento di subword o altre forme di frammento di testo, il modo specifico di divisione dipende dall'algoritmo di tokenizzazione utilizzato dal modello, quindi il calcolo e il modo di elaborazione del token possono variare a seconda dell'architettura specifica e del design del modello. Quando si conversa con l'assistente AI, i Token prodotti sono la somma dei token di input e dei token di output. |
| Prompt (Prompt) | Istruzioni in linguaggio naturale che dicono al modello di eseguire compiti. Ad esempio, "Traduci il testo in inglese".<br>Si consiglia di specificare il ruolo del modello, progettare lo stile linguistico delle risposte, limitare l'ambito delle risposte del modello nella configurazione personaggio e logica di risposta, rendendo la conversazione più conforme alle aspettative dell'utente. |
| Workflow (Workflow) | Il workflow è uno strumento utilizzato per pianificare e implementare logica funzionale complessa. Puoi progettare compiti multi-step complessi trascinando diversi nodi di compito, migliorando l'efficienza di costruzione in scenari aziendali complessi. |
| Knowledge Base (Knowledge) | La knowledge base è una raccolta privata di conoscenza dell'assistente AI, utilizzata per memorizzare dati di conoscenza in campi professionali, risolvendo il problema dell'insufficienza di conoscenza in campi professionali dei modelli generici di grandi dimensioni, migliorando la professionalità e l'accuratezza delle risposte dell'assistente AI. |
| Memoria | La memoria si riferisce alla capacità dell'intelligenza artificiale di memorizzare, recuperare e utilizzare informazioni nel tempo, migliorando le prestazioni del modello fornendo risposte più accurate e contestuali.<br>Magic fornisce una serie di funzionalità di memoria, inclusi variabili, database e memoria a lungo termine, per soddisfare diversi casi d'uso. Sulla base di queste memorie possono essere fornite risposte personalizzate, migliorando l'esperienza utente. |

## Nomi dei Nodi 🔧

| Categoria | Nome Nodo | Spiegazione Nodo |
| --------- | --------- | --------------- |
| Base | Nodo Inizio | Quando viene attivato il seguente evento, il flusso inizierà l'esecuzione da questo modulo |
| Base | Risposta Messaggio | Rispondi o rispondi con contenuto specificato all'utente |
| Base | Nodo Fine | Nodo finale del flusso, utilizzato per restituire le informazioni sui risultati dopo l'esecuzione del workflow |
| Base | Attesa | Il flusso attenderà l'operazione successiva dell'utente in questo nodo |
| Modello Grande | Chiamata Modello Grande | Chiama il modello di linguaggio di grandi dimensioni, utilizza variabili e prompt per generare risposte |
| Modello Grande | Riconoscimento Intento | Il modello grande riconosce l'intento effettivo del contenuto basato sul contenuto di input |
| Operazione | Selettore | Connette più rami downstream, se la condizione impostata è vera esegue il ramo "corrispondente", altrimenti esegue il ramo "altrimenti" |
| Operazione | Esecuzione Codice | Scrivi codice per elaborare le variabili di input, poi genera valori di ritorno attraverso l'output |
| Operazione | Richiesta HTTP | Invia richiesta al servizio HTTP esterno secondo i parametri impostati e ottieni i dati di risposta |
| Operazione | Sottoprocesso | Assegna moduli funzionali parziali all'orchestrazione del sottoprocesso, evitando che il processo principale diventi troppo grande |
| Operazione | Strumento | Processo strumento riutilizzabile, trasferisce parte delle funzionalità del processo all'implementazione dello strumento |
| Operazione | Ricerca Personale | Cerca informazioni personali che soddisfano le condizioni, supporta solo la visualizzazione di persone e informazioni correlate visibili al parlante |
| Operazione | Ciclo | Ripete l'esecuzione di una serie di compiti impostando il numero di cicli e la logica |
| Operazione | Ricerca Conoscenza | Effettua ricerca conoscenza sulle parole chiave di input, restituisce contenuti correlati corrispondenti |
| Operazione | Analisi Documento Cloud | Output del contenuto del documento cloud specificato in struttura Markdown attraverso il nodo |
| Operazione | Generazione Immagini | Genera immagini attraverso descrizioni testuali |
| Operazione | Crea Chat di Gruppo | Crea una chat di gruppo contenente i membri del gruppo specificati |
| Elaborazione Dati | Query Messaggi Storici | Query messaggi storici secondo condizioni specificate |
| Elaborazione Dati | Archiviazione Messaggi Storici | Memoria archiviazione personalizzata, libera scelta di archiviare qualsiasi contenuto |
| Knowledge Base Vettoriale | Archiviazione Vettoriale | Archivia nella knowledge base in forma di frammenti |
| Knowledge Base Vettoriale | Ricerca Vettoriale | Effettua matching di similarità dall'alto verso il basso in molteplici knowledge base, output frammenti con similarità e quantità specificate |
| Knowledge Base Vettoriale | Eliminazione Vettoriale | Effettua matching di similarità dall'alto verso il basso in molteplici knowledge base, output frammenti con similarità e quantità specificate |
| Knowledge Base Vettoriale | Matching Knowledge Base Vettoriale | Matching knowledge base vettoriali correlate attraverso condizioni di query |
| Database Persistente | Archiviazione Dati | Archivia dati persistenti |
| Database Persistente | Caricamento Dati | Leggi dati persistenti |
| Variabili | Salvataggio Variabili | Se la variabile esiste la aggiorna, se non esiste la crea nuova |
| Magic Table | Nuovo Record | Aggiungi nuovo record alla tabella dati specificata |
| Magic Table | Modifica Record | Modifica record della tabella dati specificata |
| Magic Table | Query Record | Query righe record della tabella dati secondo condizioni specificate |
| Magic Table | Elimina Record | Elimina righe record della tabella dati secondo condizioni specificate |
| Correlato File | Analisi Documento | Estrai contenuto testo del file, output in forma testo per l'uso del prossimo nodo |
| Correlato File | Analisi Foglio Elettronico | Estrai contenuto testo del file, output in forma testo per l'uso del prossimo nodo |
| Correlato Testo | Taglio Testo | Taglia testi lunghi secondo strategia stabilita, in futuro sarà aperta la selezione strategia |

---

# 名称解释
本文阐释了在 Magic 中所使用的核心术语与重要概念。

## 基础概念

| 术语 | 描述 |
| ---- | ---- |
| 模型（Model） | 模型包含大量参数，并基于大量不同的数据进行训练。您可以使用模型执行各种任务，如图像生成、问答、代码生成、重写等。 |
| 访问密钥（Access Token） | 调用 Magic API 和 SDK 时，需要通过访问密钥验证用户身份、鉴权。用户可以为各个访问密钥设置不同的权限，实现资源的安全访问。 |
| Token | 在大语言模型中，token 是文本处理的基本单位，模型通常将输入文本分解成一系列 token，然后对这些 token 进行处理和分析。token 可以是单词、字符、子词片段或其他形式的文本片段，具体的划分方式取决于模型使用的分词算法，所以 token 的计算和处理方式可能会根据模型的具体架构和设计而有所不同。和AI 助理对话时，产生的 Token 为输入 token 和输出 token 之和。 |
| 提示词 (Prompt) | 告诉模型执行任务的自然语言指令。例如，"将文本翻译成英文"。<br>建议在人设与回复逻辑中指定模型的角色、设计回复的语言风格、限制模型的回答范围，让对话更符合用户预期。 |
| 工作流（Workflow） | 工作流是一种用于规划和实现复杂功能逻辑的工具。你可以通过拖拽不同的任务节点来设计复杂的多步骤任务，提升复杂业务场景下的搭建效率。 |
| 知识库（Knowledge） | 知识库是AI 助理的私有知识合集，用于存储专业领域的知识数据，解决通用大模型专业领域知识不足的问题，提高AI 助理回复的专业性和准确性。 |
| 记忆 | 记忆是指人工智能随着时间的推移存储、检索和利用信息的能力，通过提供更准确、更符合语境的响应来提高模型的性能。<br>麦吉提供了一组记忆功能，包括变量、数据库和长期记忆，以满足不同的用例。基于这些记忆可以提供个性化回复，提升用户体验。 |

## 节点名称

| 类别 | 节点名称 | 节点说明 |
| ---- | -------- | -------- |
| 基础 | 开始节点 | 当以下事件被触发时，流程将会从这个模块开始执行 |
| 基础 | 消息回复 | 回复或回复一段指定内容给用户 |
| 基础 | 结束节点 | 流程的最终节点，用于返回工作流程运行后的结果信息 |
| 基础 | 等待 | 流程将在此节点等待用户下一步操作 |
| 大模型 | 大模型调用 | 调用大语言模型，使用变量和提示词生成回复 |
| 大模型 | 意图识别 | 大模型根据输入的内容识别内容实际的意图 |
| 操作 | 选择器 | 连接多个下游分支，若设定条件成立则运行"对应"分支，不成立则运行"否则"分支 |
| 操作 | 代码执行 | 编写代码处理输入变量，再通过输出生成返回值 |
| 操作 | HTTP 请求 | 根据设定参数向外部 HTTP 服务发送请求并获取响应数据 |
| 操作 | 子流程 | 将部分功能模块分配给子流程编排，避免主流程过于庞大 |
| 操作 | 工具 | 可复用工具流程，将部分流程功能转交给工具实现 |
| 操作 | 人员检索 | 查找符合条件的人员信息，仅支持查看对话者可见的人员及相关信息 |
| 操作 | 循环 | 通过设定循环次数和逻辑，重复执行一系列任务 |
| 操作 | 知识检索 | 对输入关键词进行知识检索，返回匹配的相关内容 |
| 操作 | 云文档解析 | 通过节点将指定云文档以 Markdown 结构输出内容 |
| 操作 | 图像生成 | 通过文字描述生成图片 |
| 操作 | 创建群聊 | 创建包含指定群成员的群聊 |
| 数据处理 | 历史消息查询 | 根据指定条件查询历史消息 |
| 数据处理 | 历史消息存储 | 记忆自定义存储，自由选择存储任何内容 |
| 向量知识库 | 向量存储 | 以片段形式存储到知识库 |
| 向量知识库 | 向量搜索 | 在多个知识库中从上到下进行相似度匹配，输出指定相似度和数量的片段 |
| 向量知识库 | 向量删除 | 在多个知识库中从上到下进行相似度匹配，输出指定相似度和数量的片段 |
| 向量知识库 | 向量知识库匹配 | 通过查询条件匹配相关的向量知识库 |
| 持久化数据库 | 数据存储 | 存储持久化数据 |
| 持久化数据库 | 数据加载 | 读取持久化数据 |
| 变量 | 变量保存 | 变量存在则更新，不存在则新增 |
| 神奇表格 | 新增记录 | 向指定数据表新增记录 |
| 神奇表格 | 修改记录 | 修改指定数据表记录 |
| 神奇表格 | 查询记录 | 根据指定条件查询数据表的行记录 |
| 神奇表格 | 删除记录 | 根据指定条件删除数据表的行记录 |
| 文件相关 | 文档解析 | 提取文件文本内容，以文本形式输出至下一个节点使用 |
| 文件相关 | 电子表格解析 | 提取文件文本内容，以文本形式输出至下一个节点使用 |
| 文本相关 | 文本切割 | 按既定策略切割长文本，未来将开放策略选择 |
