# ⚡ Costruzione Rapida Assistente AI Traduzione

Con il continuo sviluppo delle tecnologie di intelligenza artificiale, i modelli linguistici di grandi dimensioni hanno mostrato prestazioni eccellenti in termini di qualità traduzione, efficienza, comprensione contesto e supporto multilingue. Pertanto, sempre più persone iniziano a utilizzare modelli grandi per costruire rapidamente i propri assistenti traduzione, utilizzati per traduzione testi, migliorando l'efficienza e riducendo i costi.

Questo tutorial introdurrà in dettaglio come costruire rapidamente un assistente AI sulla piattaforma Magic.

# 🤖 Introduzione Assistente Traduzione AI
Hai solo bisogno di impostare la lingua traduzione target nelle impostazioni assistente AI, poi puoi fornire direttamente il testo da tradurre all'assistente AI attraverso la conversazione. L'assistente AI restituirà direttamente la lingua tradotta dal modello grande, efficiente e veloce.
![Screenshot Traduzione](https://cdn.letsmagic.cn/static/img/Translation-assistant-1.png)

## 1. 🎯 Progettazione Effetto Previsto
La funzionalità core di questa applicazione traduzione AI è soddisfare le esigenze di traduzione testi degli utenti. Non necessita introduzioni testo aggiuntive, l'utente inserisce il contenuto da tradurre, restituisce direttamente il testo traduzione corrispondente. La funzionalità traduzione può essere realizzata creando workflow, includendo nodi modello grande.

Basandosi sugli obiettivi scenario sopra, il workflow che progettiamo includerà i seguenti nodi:
1. Nodo input utente
2. Impostazione messaggio benvenuto assistente AI
3. Nodo che riceve input utente e traduce attraverso modello grande
4. Nodo che output contenuto traduzione

## 2. 🛠️ Creazione Assistente Traduzione AI
1. Accedi alla piattaforma [Magic](https://www.letsmagic.cn/login). (Se utilizzi deployment privato, accedi alla corrispondente piattaforma deployment privato)
2. Clicca sul menu laterale sinistro "Assistente AI", poi clicca su "Crea Assistente AI" a destra
3. Carica immagine assistente, compila nome e introduzione assistente
4. Clicca "Crea", entra con successo nell'interfaccia orchestrazione workflow assistente AI
![Screenshot Traduzione](https://cdn.letsmagic.cn/static/img/Translation-assistant-2.png)

## 3. 🔄 Orchestrazione Workflow
### 1. Clicca crea "Nodo Iniziale"
![Screenshot Traduzione](https://cdn.letsmagic.cn/static/img/Translation-assistant-3.png)

### 2. Nell'area "Quando aggiungi come amico", clicca "cerchietto piccolo" aggiungi nodo risposta messaggio, aggiungi messaggio benvenuto corrispondente
> Ciao <font color="#2045D4">@Nodo Iniziale/Nickname Utente</font>,
Sono il tuo assistente traduzione inglese dedicato. Puoi dirmi direttamente qualsiasi testo necessiti traduzione, ti fornirò la traduzione localizzata più autentica il più velocemente possibile.

![Screenshot Traduzione](https://cdn.letsmagic.cn/static/img/Translation-assistant-4.png)

### 3. Quando ricevi nuovo messaggio aggiungi "Nodo Chiamata Modello Grande"
3.1. Nell'area modello, seleziona nodo modello grande supportato, altri parametri rimangono invariati, contemporaneamente attiva capacità comprensione visiva (selezione predefinita GPT-4)
![Screenshot Traduzione](https://cdn.letsmagic.cn/static/img/Translation-assistant-5.png)

3.2. Nell'area input, nel campo System compila il prompt del modello grande, nell'area User attraverso @ cita il contenuto utente del nodo precedente
```
#Ruolo
Sei un traduttore inglese professionale, capace di tradurre accuratamente qualsiasi contenuto inserito dall'utente in inglese, senza espansioni arbitrarie.
##Abilità
###Abilità 1: Traduzione Testo
- Quando l'utente fornisce un testo, traducilo rapidamente in inglese.
- Garantisci accuratezza e fluidità della traduzione. Rendi la traduzione più localizzata possibile.
- Qualsiasi lingua va bene, sia cinese, giapponese, malese, thailandese ecc., necessitano traduzione in inglese secondo la semantica.
##Limitazioni:
- Esegui solo lavoro traduzione, non rispondere a domande non correlate alla traduzione.
- Segui rigorosamente la lingua target richiesta dall'utente, non modificare arbitrariamente.
```
![Screenshot Traduzione](https://cdn.letsmagic.cn/static/img/Translation-assistant-6.png)

### 4. Aggiungi Nodo Risposta Messaggio
4.1 Seleziona tipo messaggio come "Testo", nel contenuto messaggio attraverso @ cita il contenuto risposta modello grande restituito all'utente
![Screenshot Traduzione](https://cdn.letsmagic.cn/static/img/Translation-assistant-7.png)

### 5. Pubblica Assistente
La pubblicazione è divisa in "Uso Personale" e "Interno Aziendale". La differenza sta nel fatto che uso personale è visibile utilizzabile solo da sé, mentre pubblicazione interno aziendale supporta più gestione permessi, come record numero versione, impostazione ambito visibilità, pubblicazione su piattaforme terze ecc. Questa volta pubblica selezionando direttamente "Uso Personale".
5.1 Puoi conversare direttamente con l'assistente AI, ti aiuta rapidamente a tradurre diverse lingue in inglese
![Screenshot Traduzione](https://cdn.letsmagic.cn/static/img/Translation-assistant-8.png)

## 4. 📋 Importanti Spiegazioni
### 1. Cosa sono i Prompt Sistema?
I prompt sistema sono una serie di istruzioni che guidano il comportamento e l'ambito funzionale del modello. Possono includere come porre domande, come fornire informazioni, come richiedere funzionalità specifiche ecc. I prompt sistema sono anche utilizzati per impostare i confini della conversazione, come informare l'utente su quali tipi di domande o richieste non vengono accettate.

---

# 快速构建 AI 翻译助手

随着人工智能技术的不断发展，大语言模型在翻译质量、效率、上下文理解以及多语言支持方面都展现出了出色的表现。因此，越来越多的人开始使用大模型快速构建自己的翻译助手，用于文本翻译，提高效率，降低成本。

本教程将详细介绍如何在 Magic 平台上快速构建一个 AI 助手。

# AI 翻译助手介绍
您只需要在 AI 助手设置中设置目标翻译语言，然后就可以直接通过对话向 AI 助手提供需要翻译的文本。AI 助手会直接返回大模型翻译后的语言，高效快捷。
![翻译截图](https://cdn.letsmagic.cn/static/img/Translation-assistant-1.png)

## 1. 设计预期效果
这个 AI 翻译应用的核心功能是满足用户的文本翻译需求。不需要额外的文本介绍，用户输入需要翻译的内容，直接返回对应的翻译文本。翻译功能可以通过创建工作流，包含大模型节点来实现。

基于以上场景目标，我们设计的工作流将包含以下节点：
1. 用户输入节点
2. 设置 AI 助手欢迎语
3. 接收用户输入并通过大模型翻译的节点
4. 输出翻译内容的节点

## 2. 创建 AI 翻译助手
1. 登录 [Magic](https://www.letsmagic.cn/login) 平台。（如果使用私有部署，登录对应的私有部署平台）
2. 点击左侧菜单栏的"AI 助手"，然后点击右侧的"创建 AI 助手"
3. 上传助手图片，填写助手的名称和简介
4. 点击"创建"，成功进入 AI 助手的工作流编排界面
![翻译截图](https://cdn.letsmagic.cn/static/img/Translation-assistant-2.png)

## 3. 编排工作流
### 1. 点击创建"开始节点"
![翻译截图](https://cdn.letsmagic.cn/static/img/Translation-assistant-3.png)

### 2. 在"当添加为好友"区域，点击"小圆圈"添加消息回复节点，添加对应的欢迎语
> 你好 <font color="#2045D4">@开始节点/用户昵称</font>，
我是你的专属英文翻译助手。你可以直接告诉我需要翻译的任何文本，我会尽快为你提供最地道的本地化翻译。

![翻译截图](https://cdn.letsmagic.cn/static/img/Translation-assistant-4.png)

### 3. 接收新消息时添加"大模型调用节点"
3.1. 在模型区域，选择支持的大模型节点，其他参数保持不变，同时开启视觉理解能力（默认选择 GPT-4）
![翻译截图](https://cdn.letsmagic.cn/static/img/Translation-assistant-5.png)

3.2. 在输入区域，在 System 输入框中填写大模型的提示词，在 User 区域通过 @ 引用上一个节点的用户内容
```
#角色
你是一位专业的英文翻译，能够准确地将用户输入的任何内容翻译成英文，不随意扩展。
##技能
###技能 1：翻译文本
- 当用户提供一段文本时，快速将其翻译成英文。
- 确保翻译的准确性和流畅性。使翻译尽可能本地化。
- 任何语言都可以，无论是中文、日语、马来语、泰语等，都需要根据语义翻译成英文。
##限制：
- 只进行翻译工作，不回答与翻译无关的问题。
- 严格遵循用户要求的目标语言，不要擅自更改。
```
![翻译截图](https://cdn.letsmagic.cn/static/img/Translation-assistant-6.png)

### 4. 添加消息回复节点
4.1 选择消息类型为"文本"，在消息内容中通过 @ 引用大模型的响应内容返回给用户
![翻译截图](https://cdn.letsmagic.cn/static/img/Translation-assistant-7.png)

### 5. 发布助手
发布分为"个人使用"和"企业内部"。区别在于个人使用仅自己可见可用，而发布到企业内部支持更多的权限管理，如版本号记录、设置可见范围、发布到第三方平台等。本次发布直接选择"个人使用"。
5.1 可以直接与 AI 助手对话，快速帮你将不同语言翻译成英文
![翻译截图](https://cdn.letsmagic.cn/static/img/Translation-assistant-8.png)

## 4. 重要说明
### 1. 什么是系统提示词？
系统提示词是一组指导模型行为和功能范围的指令。它可以包括如何提问、如何提供信息、如何请求特定功能等。系统提示词也用于设置对话的边界，例如告知用户不接受哪些类型的问题或请求。