# 🗑️ Nodo Cancellazione Vettoriale

## 🔍 Introduzione al Nodo

Il nodo Cancellazione Vettoriale è un nodo utilizzato per rimuovere frammenti di conoscenza specifici dalla knowledge base, può aiutarti a rimuovere selettivamente contenuti di conoscenza non più necessari. Questo nodo ti permette di mantenere l'attualità e l'accuratezza della knowledge base, rimuovendo frammenti di conoscenza obsoleti, errati o ridondanti.

**Spiegazione Immagine:**

L'interfaccia del nodo Cancellazione Vettoriale contiene principalmente tre parti: area selezione knowledge base, impostazioni corrispondenza metadati e area ID business. Dall'alto verso il basso puoi selezionare la knowledge base da operare, puoi impostare condizioni di cancellazione, includendo cancellazione per ID, cancellazione per parole chiave, ecc.
![Nodo Cancellazione Vettoriale](https://cdn.letsmagic.cn/static/img/Vector-deletion.png)

## 🤔 Perché Serve il Nodo Cancellazione Vettoriale?

**Nel processo di utilizzo della knowledge base vettoriale, con il passare del tempo, potresti incontrare le seguenti situazioni che richiedono la cancellazione di parte della conoscenza:**
- Il contenuto della conoscenza è obsoleto, necessita pulizia dati vecchi
- Sono stati importati erroneamente informazioni errate o non rilevanti, necessitano rimozione
- Regolazione struttura knowledge base, necessita cancellazione contenuti duplicati o ridondanti
- Informazioni privacy o sensibili necessitano rimozione dalla knowledge base
- La capacità della knowledge base si avvicina al limite, necessita cancellazione contenuti a basso valore
Il nodo Cancellazione Vettoriale fornisce capacità di cancellazione precisa, può rimuovere selettivamente frammenti di conoscenza specifici senza influenzare altri contenuti di conoscenza, mantenendo qualità e prestazioni della knowledge base.

## 🎯 Scenari Applicabili

### Scenario 1: Manutenzione Aggiornamento Contenuti
Quando i tuoi documenti business hanno aggiornamenti, puoi prima cancellare i frammenti di conoscenza della versione precedente, poi importare il contenuto della nuova versione, assicurando che le informazioni nella knowledge base mantengano sempre l'ultima versione.

### Scenario 2: Correzione Contenuti Errati
Quando scopri che nella knowledge base esistono informazioni errate o inaccurate, puoi utilizzare il nodo Cancellazione Vettoriale per rimuovere precisamente questi contenuti, evitando di influenzare l'esperienza utente.

### Scenario 3: Riorganizzazione e Pulizia Knowledge Base
Quando necessiti di riorganizzare o ripulire la knowledge base, puoi prima cancellare contenuti di categorie specifiche, poi reimportare strutture di conoscenza più ordinate.

## ⚙️ Spiegazione Parametri del Nodo

### Parametri di Input
|Nome Parametro|Descrizione|Obbligatorio|Tipo Parametro|
|---|---|---|---|
|Selezione Knowledge Base|Scegli la knowledge base da operare, attraverso 【Valore Fisso o Espressione】, seleziona dalla knowledge base già create nel sistema|Sì|Selezione Dropdown|
|Modalità Cancellazione|Quando selezioni "Cancellazione per ID Business", attraverso aggiunta variabile, cancella i dati della knowledge base specificata. Quando selezioni "Cancellazione per Condizione", attraverso espressione imposta condizioni di filtro, come parole chiave, intervallo temporale, ecc.|Sì|Scelta Binaria|

### Parametri di Output
Il nodo Cancellazione Vettoriale dopo esecuzione riuscita, completerà la cancellazione dei contenuti in background, ma non restituirà direttamente dati risultato specifici. Dopo cancellazione riuscita, il contenuto può essere confermato attraverso ricerca tramite il nodo Ricerca Vettoriale.

## 📋 Istruzioni per l'Uso

### Passi di Configurazione Base
1. **Selezione Knowledge Base**:
    1. Dal menu dropdown seleziona modalità diverse
    2. Attraverso @ riferimento dinamico alla knowledge base del nodo precedente oppure knowledge base già create
2. **Selezione Modalità Cancellazione**:
    1. Se selezioni "Cancellazione per ID", inserisci gli ID da cancellare nel campo "Lista ID Frammenti", ID multipli separati da virgola
    2. Se selezioni "Cancellazione per Condizione", imposta condizioni di filtro, come frammenti contenenti parole chiave specifiche
3. **Connessione Nodi**: Connetti il nodo Cancellazione Vettoriale con nodi upstream (che forniscono condizioni di cancellazione) e nodi downstream (che elaborano risultati di cancellazione)

### Tecniche Avanzate
1. **Utilizzo Variabili per Specificare Dinamicamente ID**: Puoi utilizzare variabili di output del nodo upstream come condizioni di cancellazione, realizzando cancellazione dinamica. Ad esempio, attraverso il nodo "Esecuzione Codice" filtra la lista ID da cancellare, passandola al nodo Cancellazione Vettoriale.
2. **Cancellazione Condizionale Batch**: Quando necessiti di ripulire grandi quantità di dati che soddisfano condizioni specifiche, puoi utilizzare la funzionalità di cancellazione condizionale in combinazione con molteplici condizioni (come intervallo temporale + parole chiave), migliorando l'efficienza.
3. **Utilizzo in Combinazione con Nodo Ciclo**: Per scenari di cancellazione complessi, puoi combinare con il nodo ciclo per realizzare cancellazione a lotti, evitando problemi di timeout causati da cancellazione eccessiva in una volta sola.

## ⚠️ Note Importanti

### Operazione di Cancellazione Irreversibile
Una volta eseguita l'operazione di cancellazione, i dati dei frammenti di conoscenza cancellati **non potranno essere recuperati**. Pertanto, prima di effettuare cancellazioni batch, si consiglia di:
- Esportare backup dei frammenti di conoscenza correlati
- Utilizzare test su piccola scala per verificare l'accuratezza delle condizioni di cancellazione
- Assicurarsi che l'operazione di cancellazione abbia chiare esigenze business

### Impatto sulle Prestazioni
Operazioni di cancellazione su larga scala potrebbero influenzare le prestazioni del sistema, presta attenzione a:
- Evitare di effettuare operazioni di cancellazione massiva durante i picchi di business
- Per knowledge base di grandi dimensioni, si consiglia cancellazione a lotti invece di cancellazione totale in una volta
- Dopo l'operazione di cancellazione, l'indice vettoriale della knowledge base necessita di tempo per la ricostruzione, durante questo periodo le prestazioni di ricerca potrebbero essere influenzate

### Limitazioni di Autorizzazione
L'esecuzione dell'operazione di cancellazione vettoriale necessita delle corrispondenti autorizzazioni, assicurati di:
- Il creatore del flusso di lavoro abbia autorizzazioni di gestione della knowledge base
- L'operazione di cancellazione sia conforme alle normative di gestione dati aziendali
- Operazioni di cancellazione su knowledge base critiche dovrebbero impostare appropriati flussi di approvazione

## ❓ Problemi Comuni

### L'Operazione di Cancellazione È Eseguita con Successo ma i Risultati di Ricerca della Knowledge Base Non Sono Aggiornati
**Problema**: L'operazione di cancellazione mostra successo, ma attraverso il nodo Ricerca Vettoriale è ancora possibile ricercare i contenuti cancellati.

**Soluzioni**:
- L'aggiornamento dell'indice della knowledge base vettoriale ha un certo ritardo, solitamente necessita di 1-5 minuti per completare il refresh dell'indice
- Se non si aggiorna da molto tempo, puoi provare ad aggiungere un appropriato nodo di attesa dopo il nodo di cancellazione
- Verifica se esistano contenuti duplicati, assicurati che le condizioni di cancellazione coprano tutti i contenuti da cancellare

### Errore di Timeout durante Cancellazione Batch
**Problema**: Durante la cancellazione di grandi quantità di frammenti di conoscenza, il nodo va in timeout o dà errore.

**Soluzioni**:
- Suddividi la cancellazione batch di grandi dimensioni in molteplici operazioni di piccoli lotti
- Utilizza il nodo ciclo per realizzare cancellazione a lotti
- Aumenta l'impostazione del timeout di esecuzione del nodo (se disponibile questa opzione)
- Seleziona orari con carico di sistema più basso per eseguire cancellazioni batch di grandi dimensioni

### Impossibile Cancellare Frammenti di Conoscenza Specifici
**Problema**: Alcuni frammenti di conoscenza non possono essere cancellati, anche fornendo l'ID corretto.

**Soluzioni**:
- Verifica se il frammento di conoscenza abbia marcatori di protezione speciali
- Conferma che l'account operativo abbia sufficienti autorizzazioni
- Verifica che l'ID del frammento di conoscenza sia corretto (presta attenzione al formato ID e maiuscole/minuscole)
- Prova ad utilizzare la modalità di cancellazione condizionale come soluzione alternativa

## 🏆 Migliori Pratiche

### Nodi Comuni da Abbinare

|Tipo Nodo|Motivo Abbinamento|
|---|---|
|Nodo Ricerca Vettoriale|Prima conferma attraverso ricerca vettoriale i contenuti da cancellare, poi procedi alla cancellazione|
|Nodo Esecuzione Codice|Utilizzato per elaborare logica di condizioni di cancellazione complesse o formattare liste ID di cancellazione|
|Nodo Ramificazione Condizionale|Giudica il flusso successivo in base al risultato di cancellazione|
|Nodo Ciclo|Realizza cancellazione a lotti di grandi quantità di dati|
|Nodo Archiviazione Vettoriale|Dopo la cancellazione dei contenuti vecchi, archivia contenuti aggiornati|

<font color="#CE2B2E">Nota: L'operazione di cancellazione sebbene semplice è irreversibile, utilizza con cautela dopo aver pienamente compreso l'impatto dell'operazione. La manutenzione e l'aggiornamento periodici della knowledge base manterranno le tue applicazioni intelligenti sempre nel migliore stato</font>

---

# 向量删除节点
## 一、节点介绍
向量删除节点是一个用于从知识库中移除特定知识片段的节点，它可以帮助您有选择地移除不再需要的知识内容。这个节点使您能够维护知识库的时效性和准确性，移除过时、错误或冗余的知识片段。

**图片说明：**

向量删除节点界面主要包含知识库选择区、元数据匹配设置和业务 ID区三部分个部分。从上往下可以选择需要操作的知识库，可以设置删除条件，包括按ID删除、按关键词删除等方式 
![向量删除节点](https://cdn.letsmagic.cn/static/img/Vector-deletion.png)

## 为什么需要向量删除节点？
**在使用向量知识库的过程中，随着时间推移，您可能会遇到以下情况需要删除部分知识：**
- 知识内容已过时，需要清理旧数据
- 误导入了错误或不相关的信息，需要移除
- 调整知识库结构，需要删除重复或冗余的内容
- 隐私或敏感信息需要从知识库中移除
- 知识库容量接近限制，需要删除低价值内容
向量删除节点提供了精确删除能力，可以在不影响其他知识内容的情况下，有选择地移除特定知识片段，保持知识库的质量和性能。
## 适用场景
### 场景一：内容更新维护
当您的业务文档有更新时，您可以先删除旧版知识片段，再导入新版内容，确保知识库中的信息始终保持最新状态。
### 场景二：错误内容纠正
当发现知识库中存在错误信息或不准确的内容时，可以使用向量删除节点精确移除这些内容，避免影响用户体验。
### 场景三：知识库重组与整理
在需要对知识库进行重新组织或整理时，可以先删除特定类别的内容，然后重新导入更有条理的知识结构。
## 节点参数说明
### 输入参数
|参数名|说明|是否必填|参数类型|
|---|---|---|---|
|选择知识库|选择要操作的知识库，通过【固定值或表达式】，从系统中已创建的知识库中选择|是|下拉选择|
|删除方式|当选择"按业务 ID删除"时，通过添加变量，删除指定知识库的数据当选择"按条件删除"时，通过表达式设置筛选条件，如关键词、时间范围等|是|二选一|

### 输出参数
向量删除节点执行成功后，会在后台完成内容的删除，但不会直接输出特定的结果数据。成功删除后，该内容可通过向量搜索节点进行检索确认。
## 使用说明
### 基本配置步骤
1. **选择知识库**：
    1. 从下拉菜单中选择不同的方式
    2. 通过@动态引用上个节点的知识库或者是已创建的知识库
2. **选择删除方式**：
    1. 如选择"按ID删除"，请在"片段ID列表"字段中输入要删除的ID，多个ID用逗号分隔
    2. 如选择"按条件删除"，请设置筛选条件，如包含特定关键词的片段
3. **连接节点**：将向量删除节点与上游节点（提供删除条件的节点）和下游节点（处理删除结果的节点）连接起来
### 进阶技巧
1. **使用变量动态指定ID**：您可以使用上游节点的输出变量作为删除条件，实现动态删除。例如，通过"代码执行"节点筛选出需要删除的ID列表，传递给向量删除节点。
2. **批量条件删除**：当需要清理大量符合特定条件的数据时，可以使用条件删除功能配合多个条件组合（如时间范围+关键词），提高效率。
3. **循环节点配合使用**：对于复杂的删除场景，可以结合循环节点实现逐批删除，避免一次性删除过多数据导致的超时问题。
## 注意事项
### 删除操作不可逆
一旦执行删除操作，被删除的知识片段数据将**无法恢复**。因此，在进行批量删除前，建议先:
- 导出相关知识片段备份
- 使用小范围测试验证删除条件准确性
- 确保删除操作有明确的业务需求
### 性能影响
大规模删除操作可能影响系统性能，请注意：
- 避免在业务高峰期进行大量删除操作
- 对于大型知识库，建议分批次删除而非一次性删除全部内容
- 删除操作完成后，知识库的向量索引需要一定时间重建，期间查询性能可能受到影响
### 权限限制
执行向量删除操作需要相应的权限，请确保：
- 工作流创建者具有知识库的管理权限
- 删除操作符合企业数据管理规范
- 关键知识库的删除操作应设置适当的审批流程
## 常见问题
### 删除操作执行成功但知识库查询结果未更新
**问题**: 删除操作显示成功，但通过向量搜索节点仍能查询到已删除的内容。

**解决方案**:
- 向量知识库的索引更新存在一定延迟，通常需要等待1-5分钟完成索引刷新
- 如长时间未更新，可尝试在删除节点后添加适当的等待节点
- 检查是否有重复内容存在，确保删除条件覆盖了所有需要删除的内容
### 批量删除时出现超时错误
**问题**: 在删除大量知识片段时，节点执行超时或报错。

**解决方案**:
- 将大批量删除拆分为多个小批次操作
- 使用循环节点实现分批删除
- 增加节点执行超时时间设置（如有此选项）
- 选择系统负载较低的时间执行大批量删除
### 无法删除特定知识片段
**问题**: 某些知识片段无法被删除，即使提供了正确的ID。

**解决方案**:
- 检查知识片段是否有特殊保护标记
- 确认操作账号是否有足够权限
- 检查知识片段ID是否正确（注意ID格式和大小写）
- 尝试使用条件删除方式作为替代方案
## 最佳实践
### 常见搭配节点
|**节点类型**|**搭配原因**|
|---|---|
|向量搜索节点|先通过向量搜索确认要删除的内容，再进行删除|
|代码执行节点|用于处理复杂的删除条件逻辑或格式化删除ID列表|
|条件分支节点|根据删除结果判断后续流程|
|循环节点|实现分批删除大量数据|
|向量存储节点|在删除旧内容后存储更新的内容|

<font color="#CE2B2E">注意：删除操作虽然简单但不可逆，请务必在充分了解操作影响的情况下谨慎使用。定期维护和更新知识库，将使您的智能应用始终保持最佳状态</font>