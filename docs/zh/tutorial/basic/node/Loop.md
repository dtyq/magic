# 🔄 Nodo Ciclo

## ❓ Cos'è il Nodo Ciclo?

Il nodo Ciclo è un tipo di nodo di controllo del flusso nei flussi di lavoro Magic Flow che permette di ripetere l'esecuzione di una serie di operazioni fino a quando non viene soddisfatta una condizione specifica o completato un numero designato di volte. In parole semplici, il nodo Ciclo è come un'istruzione "ripeti esecuzione" che aiuta ad automatizzare compiti ripetitivi, migliorando l'efficienza lavorativa.

**Spiegazione Immagine:**
L'interfaccia del nodo Ciclo include due parti principali: il componente "Ciclo" esterno e il "Nodo Inizio" interno. Nel componente Ciclo, puoi impostare il tipo di ciclo, le condizioni di ciclo o il numero di volte; il nodo Inizio rappresenta invece il punto di partenza per ogni esecuzione del ciclo.
![Nodo Ciclo](https://cdn.letsmagic.cn/static/img/Loop.png)

## 🤔 Perché Serve il Nodo Ciclo?

Nella costruzione di applicazioni intelligenti, il nodo Ciclo risolve il problema dell'esecuzione ripetuta di alcune operazioni, ed è in grado di:
- **Elaborazione Dati in Batch**: Eseguire la stessa operazione su ogni elemento di una lista o array
- **Tentativi Ripetuti**: Continuare l'esecuzione di un compito fino a quando non viene soddisfatta una condizione specifica
- **Esecuzione Programmata**: Ripetere l'esecuzione di compiti secondo un numero fisso di volte
- **Flussi di Lavoro Dinamici**: Decidere flessibilmente il numero di esecuzioni secondo la situazione effettiva
- **Risparmio di Lavoro**: Evitare la copia manuale e incolla di sequenze di nodi identiche

## 🎯 Scenari Applicabili

### 1. Elaborazione Dati in Batch
Elaborare un gruppo di dati, come scorrere una lista clienti per inviare messaggi personalizzati, o elaborare ogni riga di dati in una tabella.

### 2. Meccanismo di Retry
Effettuare retry quando alcune operazioni falliscono, fino al successo o al raggiungimento del numero massimo di tentativi.

### 3. Richieste Paginazione
Quando è necessario chiamare più volte un'API per ottenere dati paginati, controllare il numero di richieste e la variazione dei parametri attraverso il ciclo.

### 4. Controlli Programmati
Ripetere controlli di uno stato secondo il numero impostato o le condizioni, come controllare periodicamente lo stato di completamento di un compito.

## ⚙️ Spiegazione Parametri del Nodo

### Parametri Base
|Nome Parametro|Tipo Parametro|Obbligatorio|Descrizione|
|---|---|---|---|
|Tipo Ciclo|Selezione Dropdown|Sì|Scegli il tipo di ciclo, include "Ciclo Conteggio", "Ciclo Array" e "Ciclo Condizionale"|
|Numero Cicli|Numero/Variabile|A seconda del tipo|Quando si sceglie "Ciclo Conteggio", imposta il numero totale di esecuzioni del ciclo|
|Array Ciclo|Variabile|A seconda del tipo|Quando si sceglie "Ciclo Array", specifica l'array o lista da scorrere|
|Ciclo Condizionale|Espressione|A seconda del tipo|Quando si sceglie "Ciclo Condizionale", imposta l'espressione di condizione per continuare il ciclo|
|Nome Variabile Indice Corrente|Testo|No|Utilizzato per memorizzare il nome della variabile dell'indice corrente del ciclo, predefinito "loopIndex"|
|Nome Variabile Elemento Corrente|Testo|No|Utilizzato per memorizzare il nome della variabile dell'elemento corrente del ciclo, predefinito "loopItem"|
|Numero Massimo Cicli|Numero|No|Limitazione di sicurezza per prevenire cicli infiniti, imposta il numero massimo di cicli eseguibili|

## 📋 Istruzioni per l'Uso

### Passi di Configurazione Base
1. **Seleziona il tipo di ciclo**:
    1. Per numero: Adatto per situazioni in cui si conosce il numero esatto di esecuzioni
    2. Scorrimento array: Adatto per situazioni in cui è necessario elaborare ogni elemento dell'array
    3. Giudizio condizionale: Adatto per situazioni in cui è necessario fermarsi quando viene soddisfatta una condizione specifica
2. **Configura i parametri del ciclo**:
    1. Per numero: Imposta il numero specifico di cicli, come "10"
    2. Scorrimento array: Seleziona o inserisci la variabile array da scorrere
    3. Giudizio condizionale: Imposta l'espressione di condizione del ciclo e il numero massimo di cicli
3. **Configura il corpo del ciclo**:
    1. Aggiungi all'interno del nodo Ciclo i nodi che necessitano di esecuzione ripetuta
    2. Questi nodi verranno ripetuti secondo le impostazioni del ciclo
4. **Gestisci i risultati del ciclo**:
    1. Puoi utilizzare il nodo Salvataggio Variabili all'interno del ciclo per salvare risultati intermedi
    2. Dopo la fine del ciclo, queste variabili possono essere utilizzate dai nodi successivi

## ⚠️ Note Importanti

### Considerazioni sulle Performance
Il nodo Ciclo può causare un prolungamento del tempo di esecuzione del flusso di lavoro:
- Cerca di evitare di impostare numeri di cicli troppo grandi
- Per grandi quantità di dati, considera l'elaborazione in batch
- Per i cicli condizionali è necessario impostare un numero massimo di cicli ragionevole per prevenire cicli infiniti

### Ambito delle Variabili nel Ciclo
Le variabili modificate nel ciclo influenzeranno i cicli successivi:
- Se necessiti di variabili indipendenti per ogni ciclo, reinizializzale all'inizio del ciclo
- Le modifiche delle variabili all'interno del ciclo verranno mantenute fino alla fine del ciclo

### Limitazioni dei Cicli Annidati
Anche se tecnicamente supporta cicli annidati, presta attenzione:
- I cicli annidati aumenteranno significativamente la complessità e il tempo di esecuzione
- Si consiglia di non superare 2 livelli di annidamento per mantenere la manutenibilità del flusso di lavoro
- Nei cicli annidati presta particolare attenzione all'impostazione di numeri di cicli ragionevoli

## ❓ Problemi Comuni

### Problema 1: Il Numero di Esecuzioni del Nodo Ciclo Supera le Aspettative?
**Soluzioni**: Potrebbe essere dovuto a impostazioni errate delle condizioni del ciclo. Si consiglia:
- Verifica se le condizioni del ciclo sono impostate correttamente
- Assicurati di aggiornare le variabili di giudizio delle condizioni al momento opportuno
- Utilizza il nodo Esecuzione Codice per impostare manualmente un flag di interruzione per terminare anticipatamente il ciclo

### Problema 2: I Nodi all'Interno del Ciclo Non Vengono Eseguiti Come Previsto?
**Soluzioni**: Questo potrebbe avere diverse cause:
- Assicurati che i nodi all'interno del corpo del ciclo siano connessi correttamente
- Verifica se i giudizi condizionali di ogni nodo sono corretti
- Utilizza il nodo Salvataggio Variabili per salvare risultati intermedi, facilitando il debug
- Verifica se le variabili utilizzate nel ciclo sono inizializzate correttamente

### Problema 3: Come Salvare i Risultati di Ogni Iterazione nel Ciclo?
**Soluzioni**: Puoi:
- Utilizzare variabili array per raccogliere i risultati di ogni ciclo
- Nel nodo Esecuzione Codice aggiungere i risultati all'array
- Dopo la fine del ciclo, l'array conterrà tutti i risultati delle iterazioni

```javascript
// Inizializza array risultati (prima del ciclo)
context.variableSave("results", []);

// Nel ciclo salva ogni risultato
let results = context.variableGet("results", []);
results.push(someResult);
context.variableSave("results", results);
```

## 💡 Migliori Pratiche

### Nodi Comuni da Abbinare

|Tipo di Nodo|Motivo dell'Abbinamento|
|---|---|
|Nodo Esecuzione Codice|Gestisce logica complessa nel ciclo, opera su array e oggetti|
|Nodo Ramo Condizionale|Esegue diverse operazioni nel ciclo basate su condizioni|
|Nodo Salvataggio Variabili|Memorizza risultati intermedi o valori cumulativi nel ciclo|
|Nodo Richiesta HTTP|Invia richieste in batch o ottiene dati paginati|
|Nodo Memorizzazione Dati|Salva i risultati dell'elaborazione del ciclo in memoria persistente|

---

# 循环节点
## 什么是循环节点？
循环节点是Magic Flow工作流中的一种流程控制节点，它允许您重复执行一系列操作，直到满足特定的条件或完成指定的次数。简单来说，循环节点就像是一个"重复执行"的指令，帮助您自动化重复性任务，提高工作效率。

**图片说明：**
循环节点界面包括两个主要部分：外层的"循环"组件和内部的"开始节点"。在循环组件中，您可以设置循环类型、循环条件或次数；开始节点则表示每次循环执行的起点。
![循环节点](https://cdn.letsmagic.cn/static/img/Loop.png)

## 为什么需要循环节点？
在构建智能应用的过程中，循环节点解决了需要重复执行某些操作的问题，它能够：
- **批量处理数据**：对列表或数组中的每个元素执行相同的操作
- **重复尝试**：在特定条件满足前持续执行某项任务
- **定时执行**：按照固定次数重复执行任务
- **动态工作流**：根据实际情况灵活决定执行次数
- **节省工作量**：避免手动复制粘贴相同的节点序列
## 适用场景
### 1. 批量数据处理
处理一组数据，如遍历客户列表发送个性化消息，或处理表格中的每一行数据。
### 2. 重试机制
在某些操作失败时进行重试，直到成功或达到最大尝试次数。
### 3. 分页请求
需要多次调用API获取分页数据时，通过循环控制请求次数和参数变化。
### 4. 定时检查
按照设定的次数或条件重复检查某个状态，如定期检查任务完成情况。
## 节点参数说明
### 基本参数
|参数名称|参数类型|必填|描述|
|---|---|---|---|
|循环类型|下拉选择|是|选择循环的类型，包括"计数循环"、"循环数组"和"条件循环"|
|循环次数|数值/变量|视类型而定|当选择"计数循环"时，设置循环执行的总次数|
|循环数组|变量|视类型而定|当选择"循环数组"时，指定要遍历的数组或列表|
|条件循环|表达式|视类型而定|当选择"条件循环"时，设置循环继续的条件表达式|
|当前索引变量名|文本|否|用于存储当前循环索引的变量名，默认为"loopIndex"|
|当前元素变量名|文本|否|用于存储当前循环元素的变量名，默认为"loopItem"|
|最大循环次数|数值|否|防止无限循环的安全限制，设置最大可执行的循环次数|

## 使用说明
### 基本配置步骤
1. **选择循环类型**：
    1. 按次数：适用于知道确切执行次数的情况
    2. 遍历数组：适用于需要处理数组每个元素的情况
    3. 条件判断：适用于需要满足特定条件才停止的情况
2. **配置循环参数**：
    1. 按次数：设置具体循环次数，如"10"
    2. 遍历数组：选择或输入要遍历的数组变量
    3. 条件判断：设置循环条件表达式和最大循环次数
3. **配置循环体**：
    1. 在循环节点内部添加需要重复执行的节点
    2. 这些节点将根据循环设置重复执行
4. **处理循环结果**：
    1. 可以在循环内部使用变量保存节点保存中间结果
    2. 循环结束后，这些变量可供后续节点使用
## 注意事项
### 性能考量
循环节点可能导致工作流执行时间延长：
- 尽量避免设置过大的循环次数
- 对于大量数据，考虑分批处理
- 条件循环一定要设置合理的最大循环次数，防止无限循环
### 循环中的变量作用域
在循环中修改的变量会影响后续循环：
- 如需每次循环使用独立的变量，请在循环开始时重新初始化
- 循环内的变量修改会保留到循环结束后
### 循环嵌套限制
虽然技术上支持循环嵌套，但请注意：
- 嵌套循环会显著增加执行复杂度和时间
- 建议嵌套不超过2层，以保持工作流的可维护性
- 嵌套循环时尤其要注意设置合理的循环次数
## 常见问题
### 问题1：循环节点执行次数超出预期怎么办？
**解决方案**：可能是循环条件设置不当。建议：
- 检查循环条件是否正确设置
- 确保在适当时机更新条件判断的变量
- 使用代码节点手动设置中断标记提前结束循环
### 问题2：循环内的节点没有按预期执行怎么办？
**解决方案**：这可能有几个原因：
- 确保循环体内的节点连接正确
- 检查每个节点的条件判断是否正确
- 使用变量保存节点保存中间结果，便于调试
- 检查循环内使用的变量是否正确初始化
### 问题3：如何在循环中保存每次迭代的结果？
**解决方案**：您可以：
- 使用数组变量收集每次循环的结果
- 在代码执行节点中将结果添加到数组
- 循环结束后，该数组将包含所有迭代的结果
```javascript
// 初始化结果数组（在循环前）
context.variableSave("results", []);

// 在循环内保存每次结果
let results = context.variableGet("results", []);
results.push(someResult);
context.variableSave("results", results);
```
## 最佳实践
### 常见搭配节点
|节点类型|搭配原因|
|---|---|
|代码执行节点|处理循环中的复杂逻辑，操作数组和对象|
|条件分支节点|在循环内基于条件执行不同操作|
|变量保存节点|存储循环中的中间结果或累计值|
|HTTP请求节点|批量发送请求或分页获取数据|
|数据存储节点|保存循环处理的结果到持久存储|