# 🔄 Nodo Sottoprocesso

## ❓ Che Cos'è il Nodo Sottoprocesso?

Il nodo Sottoprocesso è uno strumento organizzativo potente che permette di isolare una parte di moduli funzionali, formando un flusso separato, e poi richiamarlo nel flusso principale. Proprio come quando si scrive un articolo, dividiamo il contenuto in capitoli e paragrafi, il sottoprocesso aiuta a suddividere flussi di lavoro complessi in parti più piccole e gestibili.

**Spiegazione Immagine:**

L'interfaccia del nodo Sottoprocesso è composta da aree di selezione flusso e configurazione flusso. L'area di configurazione contiene principalmente due parti: impostazioni parametri di input e ricezione parametri di output, dove puoi configurare i dati da scambiare con il sottoprocesso.
![Nodo Sottoprocesso](https://cdn.letsmagic.cn/static/img/Subprocess.png)

## 🤔 Perché Serve il Nodo Sottoprocesso?

Nella progettazione di flussi di lavoro complessi, se si mettono tutte le funzionalità in un singolo flusso, il diagramma del flusso diventa enorme e difficile da gestire. Il nodo Sottoprocesso può aiutarti a:
1. **Semplificare il Flusso Principale**: Separare la logica complessa nei sottoprocessi, rendendo il flusso principale più chiaro
2. **Migliorare la Riutilizzabilità**: Un sottoprocesso può essere richiamato da molteplici flussi principali diversi
3. **Facilitare la Collaborazione di Team**: Diversi membri del team possono concentrarsi sullo sviluppo di sottoprocessi diversi
4. **Aumentare l'Efficienza di Manutenzione**: Quando si modifica una funzionalità, è necessario aggiornare solo il sottoprocesso corrispondente

## 🎯 Scenari Applicabili

### Scenario 1: Elaborazione Modularizzata di Compiti Complessi
Quando il tuo assistente AI deve eseguire una serie di operazioni complesse (come elaborazione dati multi-step, giudizi condizionali multipli, ecc.), puoi suddividere queste operazioni in molteplici sottoprocessi, rendendo la struttura complessiva più chiara.

### Scenario 2: Incapsulamento di Funzionalità Riutilizzabili
Per funzionalità che necessitano di essere riutilizzate in molteplici luoghi (come autenticazione utente, conversione formato dati, ecc.), puoi incapsularle come sottoprocessi, realizzando sviluppo una volta, utilizzo multiplo.

### Scenario 3: Collaborazione di Team in Progetti di Grandi Dimensioni
In progetti di grandi dimensioni, puoi assegnare moduli funzionali diversi a diversi membri del team per sviluppare sottoprocessi, poi integrarli nel flusso principale, migliorando l'efficienza della collaborazione di team.

## ⚙️ Spiegazione Parametri del Nodo

Il nodo Sottoprocesso contiene principalmente configurazione parametri di input e output:

### Parametri di Input
|Nome Parametro|Descrizione Parametro|Obbligatorio|Tipo Parametro|Valore Predefinito|
|---|---|---|---|---|
|Nome Sottoprocesso|Nome del sottoprocesso da richiamare|Sì|Selezione Dropdown|Nessuno|
|Parametri di Input|Dopo aver selezionato il sottoprocesso, dati passati al sottoprocesso|Sì|Stringa/Numero/Valore Booleano ecc.|Nessuno|

Il nodo Sottoprocesso permette di impostare molteplici parametri di input, ogni parametro ha il proprio nome, tipo e valore. Questi parametri verranno passati come dati iniziali per l'utilizzo del sottoprocesso.

### Parametri di Output
|Nome Parametro|Descrizione Parametro|Tipo Parametro|
|---|---|---|
|Output (output)|Riceve il risultato restituito dal sottoprocesso|Stringa/Numero/Valore Booleano ecc.|

I parametri di output servono a ricevere i valori restituiti dopo il completamento dell'esecuzione del sottoprocesso, puoi utilizzare questi valori nei nodi successivi.

## 📋 Istruzioni per l'Uso

### Passi di Configurazione Base
1. **Crea Sottoprocesso**:
    1. Crea un nuovo flusso sulla piattaforma Magic
    2. Configura nodi di inizio e fine appropriati
    3. Progetta la logica interna del sottoprocesso
2. **Aggiungi Nodo Sottoprocesso nel Flusso Principale**:
    1. Trascina il nodo Sottoprocesso nel canvas del flusso principale
    2. Connetti nodi precedenti e successivi
3. **Configura Nodo Sottoprocesso**:
    1. Nel menu dropdown ID Sottoprocesso seleziona il sottoprocesso da richiamare
    2. Imposta parametri di input: clicca il pulsante "+" per aggiungere parametri, specifica nome parametro, tipo e valore
    3. Imposta parametri di output: specifica il nome della variabile per ricevere il risultato restituito dal sottoprocesso
4. **Salva e Testa**:
    1. Salva la progettazione del flusso principale
    2. Esegui il flusso principale e verifica se il sottoprocesso viene eseguito come previsto

### Tecniche Avanzate
1. **Ottimizzazione Passaggio Parametri**:
    1. Utilizza il modo riferimento variabile per passare parametri, può passare dinamicamente l'output del nodo precedente
    2. Per strutture dati complesse, puoi utilizzare formato JSON per il passaggio, migliorando la capacità di scambio dati
2. **Gestione Errori**:
    1. Aggiungi nodi di giudizio condizionale nel sottoprocesso, gestisci situazioni eccezionali che potrebbero verificarsi
    2. Restituisci lo stato di esecuzione attraverso parametri di output, fai sapere al flusso principale se il sottoprocesso è stato eseguito con successo
3. **Sottoprocessi Annidati**:
    1. Nel sottoprocesso puoi richiamare nuovamente altri sottoprocessi, formando strutture annidate multilivello
    2. Presta attenzione a controllare la profondità di annidamento, evita complessità eccessiva che renda difficile la manutenzione

## ⚠️ Note Importanti

### Evita Chiamate Circolari
Non richiamare il flusso padre nel sottoprocesso, questo causerà chiamate circolari infinite, consumando infine le risorse di sistema.

### Corrispondenza Tipi Parametri
Assicurati che i tipi dei parametri passati al sottoprocesso corrispondano ai tipi attesi dal sottoprocesso, tipi non corrispondenti potrebbero causare errori di esecuzione del sottoprocesso.

### Gestione Versioni Flusso
Quando modifichi il sottoprocesso, presta attenzione al fatto che potrebbe influenzare tutti i flussi principali che richiamano quel sottoprocesso. Si consiglia di creare prima una copia del sottoprocesso per testare prima di modifiche importanti.

### Limitazioni Risorse
Anche i sottoprocessi consumano risorse di sistema, sottoprocessi eccessivamente annidati potrebbero causare calo delle prestazioni. Si consiglia di controllare che il livello di annidamento non superi i 3 livelli.

## ❓ Problemi Comuni

### Impossibile Ottenere l'Output del Sottoprocesso nel Flusso Principale
**Problema**: Ho configurato il nodo Sottoprocesso, ma non riesco a ottenere il risultato di output del sottoprocesso nel flusso principale.

**Soluzioni**:
- Verifica se il sottoprocesso ha impostato correttamente i parametri di output del nodo finale
- Conferma che la configurazione del nome variabile di output nel nodo Sottoprocesso sia corretta
- Verifica se il sottoprocesso viene eseguito normalmente fino al completamento, senza rimanere bloccato in qualche fase

### Esecuzione Sottoprocesso Fallita ma Senza Messaggio di Errore
**Problema**: Il sottoprocesso non viene eseguito come previsto, ma il sistema non mostra informazioni di errore chiare.

**Soluzioni**:
- Testa il sottoprocesso separatamente, verifica se può funzionare normalmente
- Verifica se i parametri di input vengono passati correttamente
- Aggiungi nodi di log o nodi di risposta messaggio nel sottoprocesso, output informazioni di processo intermedio, aiutando a localizzare il problema

## 🔗 Nodi Comuni da Abbinare

|Tipo Nodo|Motivo Abbinamento|
|---|---|
|Nodo Ramificazione Condizionale|Decide il percorso successivo del flusso in base al risultato di esecuzione del sottoprocesso|
|Nodo Salvataggio Variabili|Salva il risultato di output del sottoprocesso come variabile, per utilizzo successivo|
|Nodo Chiamata Modello Grande|Elabora i dati restituiti dal sottoprocesso, genera risposte più intelligenti|
|Nodo Risposta Messaggio|Mostra all'utente il risultato elaborato dal sottoprocesso|

---

# 子流程节点
## 什么是子流程节点？
子流程节点是一个强大的组织工具，它允许您将一部分功能模块独立出来，形成单独的流程，然后在主流程中调用这个子流程。就像在写文章时，我们会将内容分为章节和段落，子流程就是帮助您将复杂工作流拆分成更小、更易管理的部分。

**图片说明：**

子流程节点界面由选择流程和配置流程区域组成。配置区域主要包含输入参数设置和输出参数接收两部分，您可以在这里配置与子流程交换的数据。
![子流程节点](https://cdn.letsmagic.cn/static/img/Subprocess.png)

## 为什么需要子流程节点？
在设计复杂的工作流时，如果将所有功能都放在一个流程中，会导致流程图变得庞大且难以管理。子流程节点可以帮助您：
1. **简化主流程**：将复杂逻辑分离到子流程中，使主流程更清晰
2. **提高可复用性**：一个子流程可以被多个不同的主流程调用
3. **便于团队协作**：不同团队成员可以专注于不同子流程的开发
4. **提升维护效率**：修改某个功能时，只需要更新相应的子流程即可
## 适用场景
### 场景一：复杂任务的模块化处理
当您的AI 助理需要执行一系列复杂操作（如多步骤的数据处理、多重条件判断等），可以将这些操作拆分为多个子流程，使整体结构更清晰。
### 场景二：重复使用的功能封装
对于在多个地方需要重复使用的功能（如用户身份验证、数据格式转换等），可以将其封装为子流程，实现一次开发多处使用。
### 场景三：大型项目的团队协作
在大型项目中，可以将不同功能模块分配给不同团队成员开发为子流程，然后整合到主流程中，提高团队协作效率。
## 节点参数说明
子流程节点主要包含输入和输出两部分参数配置：
### 输入参数
|参数名称|参数描述|是否必填|参数类型|默认值|
|---|---|---|---|---|
|子流程名称|要调用的子流程的名称|是|下拉选择|无|
|输入参数|选中的子流程后，传递给子流程的数据|是|字符串/数字/布尔值等|无|

子流程节点允许您设置多个输入参数，每个参数都有自己的名称、类型和值。这些参数将作为初始数据传递给子流程使用。
### 输出参数
|参数名称|参数描述|参数类型|
|---|---|---|
|输出（output）|接收子流程返回的结果|字符串/数字/布尔值等|

输出参数用于接收子流程执行完成后的返回值，您可以在后续节点中使用这些值。
## 使用说明
### 基本配置步骤
1. **创建子流程**：
    1. 在Magic平台上创建一个新的流程
    2. 配置适当的开始节点和结束节点
    3. 设计子流程的内部逻辑
2. **在主流程中添加子流程节点**：
    1. 拖拽子流程节点到主流程画布中
    2. 连接前置节点和后续节点
3. **配置子流程节点**：
    1. 在子流程ID下拉菜单中选择要调用的子流程
    2. 设置输入参数：点击"+"按钮添加参数，指定参数名称、类型和值
    3. 设置输出参数：指定用于接收子流程返回结果的变量名
4. **保存并测试**：
    1. 保存主流程设计
    2. 运行主流程并检查子流程是否按预期执行
### 进阶技巧
1. **参数传递优化**：
    1. 使用变量引用方式传递参数，可以动态传入前置节点的输出
    2. 对于复杂的数据结构，可以使用JSON格式传递，增强数据交换能力
2. **错误处理**：
    1. 在子流程内添加条件判断节点，处理可能出现的异常情况
    2. 通过输出参数返回执行状态，让主流程知道子流程是否成功执行
3. **嵌套子流程**：
    1. 子流程中可以再次调用其他子流程，形成多层嵌套结构
    2. 注意控制嵌套深度，避免过于复杂导致难以维护
## 注意事项
### 避免循环调用
不要在子流程中调用其父流程，这会导致无限循环调用，最终造成系统资源耗尽。
### 参数类型匹配
确保传入子流程的参数类型与子流程期望的类型相匹配，类型不匹配可能导致子流程执行错误。
### 流程版本管理
当修改子流程时，要注意可能影响所有调用该子流程的主流程。建议在进行重大修改前先创建子流程的副本进行测试。
### 资源限制
子流程也会消耗系统资源，嵌套过多的子流程可能导致性能下降。建议控制嵌套层级不超过3层。
## 常见问题
### 子流程的输出无法在主流程中获取
**问题**：配置了子流程节点，但无法在主流程中获取子流程的输出结果。
**解决方案**：
- 检查子流程是否有正确设置结束节点的输出参数
- 确认子流程节点中的输出变量名称配置正确
- 验证子流程是否正常执行完成，没有卡在某个环节
### 子流程执行失败但没有错误提示
**问题**：子流程没有按预期执行，但系统没有显示明确的错误信息。
**解决方案**：
- 单独测试子流程，查看是否能正常运行
- 检查输入参数是否正确传递
- 在子流程中添加日志节点或消息回复节点，输出中间过程信息，帮助定位问题
## 常见搭配节点
|**节点类型**|**搭配原因**|
|---|---|
|条件分支节点|根据子流程的执行结果决定后续流程走向|
|变量保存节点|将子流程的输出结果保存为变量，供后续使用|
|大模型调用节点|处理子流程返回的数据，生成更智能的响应|
|消息回复节点|向用户展示子流程处理的结果|