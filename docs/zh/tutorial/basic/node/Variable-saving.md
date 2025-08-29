# 💾 Nodo Salvataggio Variabili

## ❓ Che Cos'è il Nodo Salvataggio Variabili?

Il nodo Salvataggio Variabili è un nodo di elaborazione dati di base in Magic Flow, utilizzato per creare, impostare o aggiornare variabili nel flusso di lavoro. Questo nodo aiuta a memorizzare dati temporanei nel flusso, per l'utilizzo nei nodi successivi, realizzando passaggio e condivisione dati tra nodi diversi.

**Spiegazione Interfaccia:**

L'interfaccia del nodo Salvataggio Variabili è composta da area impostazioni informazioni base variabile a sinistra e area configurazione valore variabile a destra. Qui puoi impostare nome variabile, nome visualizzato, selezionare tipo variabile e assegnare valori specifici alla variabile.
![Nodo Salvataggio Variabili](https://cdn.letsmagic.cn/static/img/Variable-saving.png)

## 🤔 Perché Serve il Nodo Salvataggio Variabili?

Nella costruzione di flussi di lavoro, spesso necessitiamo di memorizzare temporaneamente alcuni dati, come input utente, risultati di calcolo o stati intermedi, per utilizzarli in diverse fasi del flusso di lavoro. Il nodo Salvataggio Variabili è progettato proprio per soddisfare questa esigenza. Può:
- Creare nuove variabili o aggiornare valori di variabili esistenti
- Supportare molteplici tipi di dati, soddisfacendo diverse esigenze di memorizzazione
- Fornire supporto dati per altri nodi nel flusso di lavoro
- Realizzare passaggio e condivisione dati all'interno del flusso di lavoro

## 🎯 Scenari Applicabili

### Scenario 1: Memorizzazione Input Utente
Quando necessiti di registrare informazioni fornite dall'utente nella conversazione (come nome, età, preferenze, ecc.), puoi utilizzare il nodo Salvataggio Variabili per salvare queste informazioni, per l'utilizzo nei nodi successivi.

### Scenario 2: Salvataggio Risultati di Calcolo Intermedi
In flussi di lavoro complessi, potresti necessitare di elaborazioni dati multi-step. Il nodo Salvataggio Variabili può aiutarti a memorizzare i risultati di calcolo di ogni step, evitando calcoli ripetuti.

### Scenario 3: Controllo Dinamico Direzione Flusso di Lavoro
Puoi utilizzare il nodo Salvataggio Variabili per memorizzare flag o valori di stato, poi utilizzare questi valori variabili nel nodo ramificazione condizionale per decidere il percorso di esecuzione del flusso di lavoro.

## ⚙️ Spiegazione Parametri del Nodo

I parametri del nodo Salvataggio Variabili si dividono principalmente in due parti: informazioni base variabile e impostazioni valore variabile.

### Informazioni Base Variabile
|Nome Parametro|Descrizione|Obbligatorio|Valore Esempio|
|---|---|---|---|
|Nome Variabile|Identificatore univoco della variabile, può contenere solo lettere, numeri e trattini bassi, utilizzato per riferimento della variabile in codice o altri nodi|Sì|user_name|
|Nome Visualizzato|Nome della variabile leggibile dall'uomo, rende più facile il riconoscimento nel flusso di lavoro|No|Nome Utente|
|Tipo Variabile|Tipo di dati della variabile, determina che tipo di dati può memorizzare la variabile|Sì|Stringa|
|Valore Variabile|Imposta il valore della variabile, può essere valore fisso o ottenuto da output di altri nodi|Sì|Valore Fisso|

### Opzioni Tipo Variabile
**Il nodo Salvataggio Variabili supporta i seguenti tipi di variabile comuni:**
1. **Stringa** - Utilizzata per memorizzare contenuto testuale
2. **Numero** - Utilizzata per memorizzare interi o decimali
3. **Valore Booleano** - Utilizzata per memorizzare valori binari sì/no, vero/falso
4. **Array** - Utilizzata per memorizzare collezione di molteplici valori
5. **Oggetto** - Utilizzata per memorizzare strutture dati complesse con molteplici coppie chiave-valore

### Impostazioni Valore Variabile
**Le modalità di impostazione del valore variabile differiscono secondo il tipo di variabile selezionato:**
- **Stringa**: Puoi input diretto testo o riferimento altre variabili
- **Numero**: Input valore numerico o espressione matematica
- **Valore Booleano**: Seleziona "Vero" o "Falso"
- **Array**: Aggiungi molteplici elementi, ogni elemento può essere di tipo diverso
- **Oggetto**: Aggiungi molteplici coppie chiave-valore, specifica nome chiave e valore per ogni proprietà

## 📋 Istruzioni per l'Uso

### Passi di Configurazione Base
1. **Aggiungi Nodo**: Nell'editor del flusso di lavoro, trova il nodo "Salvataggio Variabili" dal pannello nodi a sinistra, trascinalo nella posizione appropriata del canvas del flusso di lavoro.
2. **Imposta Nome Variabile**: Nel pannello proprietà a destra, specifica un nome significativo per la variabile, si consiglia utilizzo lettere minuscole con trattini bassi, come `user_age`.
3. **Aggiungi Nome Visualizzato (Opzionale)**: Input nome facilmente comprensibile in italiano, come "Età Utente".
4. **Seleziona Tipo Variabile**: Secondo il tipo di dati da memorizzare, seleziona il tipo di variabile appropriato.
5. **Imposta Valore Variabile**: Secondo il tipo di variabile selezionato, imposta il valore specifico della variabile.
6. **Connetti Nodi**: Connetti il nodo Salvataggio Variabili con altri nodi nel flusso di lavoro, formando un flusso di elaborazione completo.

### Tecniche Avanzate
#### Utilizzo Espressioni per Impostare Valori Variabile
Puoi utilizzare espressioni per calcolare dinamicamente valori variabile:
1. Seleziona "Espressione" come tipo valore
2. Utilizza `${nome_variabile}` per riferimento variabili esistenti
3. Combina molteplici variabili o applica calcoli semplici, come `${price} * ${quantity}`

#### Creazione Strutture Dati Annidate
Per dati complessi:
1. Utilizza tipo oggetto per creare strutture con molteplici proprietà
2. All'interno dell'oggetto puoi annidare array o altri oggetti
3. Ad esempio creazione profilo utente:
```javascript
{
  "informazioni_base": {
    "nome": "${user_name}",
    "età": ${user_age}
  },
  "preferenze": ["${preference1}", "${preference2}"]
}
```

#### Impostazione Variabile Condizionale
In combinazione con nodi ramificazione condizionale e nodi salvataggio variabili:
1. Utilizza diversi nodi salvataggio variabili in rami condizionali diversi
2. Secondo le condizioni imposta valori diversi per la stessa variabile
3. Nel flusso successivo utilizza questa variabile per prendere decisioni

## ⚠️ Note Importanti

### Norme Denominazione Variabili
1. **Utilizza Nomi Significativi**: I nomi variabile dovrebbero esprimere chiaramente il loro scopo, come `total_price` invece di semplice `tp`
2. **Evita Caratteri Speciali**: Utilizza solo lettere, numeri e trattini bassi
3. **Evita Parole Riservate**: Non utilizzare parole riservate JavaScript come nomi variabile
4. **Mantieni Stile Consistente**: O tutto camelCase (come `userName`), o tutto trattini bassi (come `user_name`)

### Ambito Variabili
1. **Variabili Globali**: Le variabili create nel flusso di lavoro sono disponibili in tutto il flusso di lavoro
2. **Sovrascrittura Variabili**: Variabili omonime verranno sovrascritte dai nuovi valori, presta attenzione ad evitare sovrascritture involontarie
3. **Variabili Sottoprocesso**: Le variabili del flusso principale non vengono automaticamente passate ai sottoprocessi, necessitano passaggio parametri esplicito

### Considerazioni Performance
1. **Evita Memorizzazione Grandi Quantità Dati**: Le variabili non sono adatte per memorizzare grandi dataset, questo potrebbe influenzare le prestazioni del flusso di lavoro
2. **Pulizia Variabili Temporanee**: Variabili temporanee non più necessarie possono essere impostate a null, liberando memoria
3. **Semplificazione Struttura Variabili**: Oggetti annidati troppo complessi potrebbero influenzare leggibilità e manutenibilità

## ❓ Problemi Comuni

### Problema 1: Perché la Mia Variabile Non È Accessibile in Altri Nodi?
**Soluzioni**:
1. Conferma che il nome variabile sia scritto correttamente, presta attenzione a maiuscole/minuscole
2. Verifica l'ordine di esecuzione del flusso di lavoro, assicurati che il nodo salvataggio variabili sia eseguito prima del riferimento alla variabile
3. Verifica che la sintassi di riferimento variabile sia corretta, come `${nome_variabile}`
4. Conferma che non ci siano variabili omonime sovrascritte involontariamente

### Problema 2: Come Memorizzare Strutture Dati Complesse in una Variabile?
**Soluzioni**:
1. Utilizza tipo oggetto per creare strutture chiave-valore
2. Utilizza tipo array per memorizzare dati lista
3. All'interno dell'oggetto puoi annidare oggetti o array, creando strutture multilivello
4. Per dati molto complessi, considera l'utilizzo del nodo esecuzione codice per l'elaborazione

### Problema 3: Come Aggiornare Elementi Specifici in una Variabile di Tipo Array?
**Soluzioni**:
1. Utilizza il nodo esecuzione codice per ottenere la variabile array
2. Modifica il valore nella posizione indice specifica
3. Utilizza il nodo salvataggio variabili per salvare l'array aggiornato
```javascript
// Nel nodo esecuzione codice
let myArray = context.variableGet("my_array", []);
myArray[2] = "nuovo_valore";  // Aggiorna elemento con indice 2
context.variableSave("my_array", myArray);
```

## 🔗 Nodi Comuni da Abbinare

|Tipo Nodo|Motivo Abbinamento|
|---|---|
|Nodo Esecuzione Codice|Effettua calcoli complessi e elaborazioni variabili|
|Nodo Ramificazione Condizionale|Prende decisioni basate sui valori delle variabili|
|Nodo Attesa|Memorizza informazioni di input utente|
|Nodo Chiamata Modello Grande|Salva risultati di elaborazione del modello grande|
|Nodo Richiesta HTTP|Memorizza dati di risposta API|

---

# 变量保存节点

## 什么是变量保存节点？
变量保存节点是 Magic Flow 中的一个基础数据处理节点，用于在工作流中创建、设置或更新变量。这个节点帮助您在流程中存储临时数据，供后续节点使用，实现不同节点之间的数据传递和共享。

**界面说明：**

变量保存节点界面由左侧的变量基本信息设置区和右侧的变量值配置区组成。您可以在这里设置变量名称、显示名称、选择变量类型，并为变量赋予具体的值。
![变量保存节点](https://cdn.letsmagic.cn/static/img/Variable-saving.png)

## 为什么需要变量保存节点？
在构建工作流时，我们经常需要临时存储一些数据，如用户输入、计算结果或中间状态，以便在工作流的不同阶段使用。变量保存节点正是为满足这一需求而设计的。它可以：
- 创建新变量或更新已有变量的值
- 支持多种数据类型，满足不同存储需求
- 为工作流中的其他节点提供数据支持
- 实现工作流内的数据传递和共享

## 应用场景
### 场景一：存储用户输入
当您需要记录用户在对话中提供的信息（如姓名、年龄、偏好等）时，可以使用变量保存节点保存这些信息，供后续节点使用。
### 场景二：保存中间计算结果
在复杂工作流中，您可能需要进行多步数据处理。变量保存节点可以帮助您存储每一步的计算结果，避免重复计算。
### 场景三：动态控制工作流方向
您可以使用变量保存节点存储标志或状态值，然后在条件分支节点中使用这些变量值来决定工作流的执行路径。

## 节点参数说明
变量保存节点的参数主要分为两部分：变量基本信息和变量值设置。

### 变量基本信息
|参数名称|说明|是否必填|示例值|
|---|---|---|---|
|变量名|变量的唯一标识符，只能包含字母、数字和下划线，用于在代码或其他节点中引用该变量|是|user_name|
|显示名称|变量的人类可读名称，使其在工作流中更容易识别|否|用户姓名|
|变量类型|变量的数据类型，决定变量可以存储什么类型的数据|是|字符串|
|变量值|设置变量的值，可以是固定值或从其他节点输出获取|是|固定值|

### 变量类型选项
**变量保存节点支持以下常见变量类型：**
1. **字符串** - 用于存储文本内容
2. **数字** - 用于存储整数或小数
3. **布尔值** - 用于存储是/否、真/假的二元值
4. **数组** - 用于存储多个值的集合
5. **对象** - 用于存储具有多个键值对的复杂数据结构

### 变量值设置
**设置变量值的方式根据选择的变量类型而不同：**
- **字符串**：可以直接输入文本或引用其他变量
- **数字**：输入数值或数学表达式
- **布尔值**：选择"真"或"假"
- **数组**：添加多个元素，每个元素可以是不同类型
- **对象**：添加多个键值对，为每个属性指定键名和值

## 使用说明
### 基本配置步骤
1. **添加节点**：在工作流编辑器中，从左侧节点面板找到"变量保存"节点，拖拽到工作流画布的适当位置。
2. **设置变量名**：在右侧属性面板中，为变量指定一个有意义的名称，建议使用小写字母配合下划线，如 `user_age`。
3. **添加显示名称**（可选）：输入容易理解的中文名称，如"用户年龄"。
4. **选择变量类型**：根据需要存储的数据类型，选择适当的变量类型。
5. **设置变量值**：根据选择的变量类型，设定变量的具体值。
6. **连接节点**：将变量保存节点与工作流中的其他节点连接起来，形成完整的处理流程。

### 高级技巧
#### 使用表达式设置变量值
您可以使用表达式动态计算变量值：
1. 选择"表达式"作为值类型
2. 使用 `${变量名}` 引用已有变量
3. 组合多个变量或应用简单计算，如 `${price} * ${quantity}`

#### 创建嵌套数据结构
对于复杂数据：
1. 使用对象类型创建具有多个属性的结构
2. 在对象内部可以嵌套数组或其他对象
3. 例如创建用户配置文件：
```javascript
{
  "基本信息": {
    "姓名": "${user_name}",
    "年龄": ${user_age}
  },
  "偏好": ["${preference1}", "${preference2}"]
}
```

#### 条件变量设置
结合条件分支节点和变量保存节点：
1. 在不同条件分支中使用不同的变量保存节点
2. 根据条件为同一变量设置不同的值
3. 在随后的流程中使用这个变量做决策

## 注意事项
### 变量命名规范
1. **使用有意义的名称**：变量名应能清晰表达其用途，如 `total_price` 而非简单的 `tp`
2. **避免特殊字符**：只使用字母、数字和下划线
3. **避免使用保留字**：不要使用 JavaScript 的保留字作为变量名
4. **保持一致的风格**：要么全部使用驼峰命名法（如 `userName`），要么全部使用下划线（如 `user_name`）

### 变量作用域
1. **全局变量**：在工作流中创建的变量在整个工作流内可用
2. **变量覆盖**：同名变量会被新值覆盖，请注意避免无意覆盖
3. **子流程变量**：主流程变量不会自动传递给子流程，需要明确传参

### 性能考量
1. **避免存储大量数据**：变量不适合存储大型数据集，这可能影响工作流性能
2. **清理临时变量**：不再需要的临时变量可以设为 null，释放内存
3. **简化变量结构**：过于复杂的嵌套对象可能影响可读性和维护性

## 常见问题
### 问题1：为什么我的变量在其他节点中无法访问？
**解决方案**：
1. 确认变量名称拼写正确，注意大小写
2. 检查工作流执行顺序，确保在引用变量前已执行变量保存节点
3. 验证引用变量的语法是否正确，如 `${变量名}`
4. 确认没有同名变量被意外覆盖

### 问题2：如何在变量中存储复杂的数据结构？
**解决方案**：
1. 使用对象类型可以创建键值对结构
2. 使用数组类型可以存储列表数据
3. 对象内可以嵌套对象或数组，创建多层结构
4. 对于非常复杂的数据，考虑使用代码执行节点进行处理

### 问题3：如何更新数组类型变量中的特定元素？
**解决方案**：
1. 使用代码执行节点获取数组变量
2. 修改特定索引位置的值
3. 使用变量保存节点保存更新后的数组
```javascript
// 在代码执行节点中
let myArray = context.variableGet("my_array", []);
myArray[2] = "新值";  // 更新索引为2的元素
context.variableSave("my_array", myArray);
```

## 常见配对节点
|节点类型|配对原因|
|---|---|
|代码执行节点|进行复杂的变量计算和处理|
|条件分支节点|基于变量值做出决策判断|
|等待节点|存储用户输入的信息|
|大模型调用节点|保存大模型处理的结果|
|HTTP请求节点|存储API响应数据|