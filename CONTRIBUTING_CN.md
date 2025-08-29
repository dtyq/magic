# Guida ai Contributi 🎉

Siamo felici che tu sia interessato a contribuire a Magic - è fantastico, non vediamo l'ora di vedere cosa farai. Come startup con risorse limitate in termini di personale e finanziamenti, abbiamo grandi ambizioni di costruire le applicazioni LLM più potenti. Qualsiasi aiuto dalla community conta davvero.

Considerando la nostra situazione attuale, dobbiamo essere agili e rilasciare velocemente, ma vogliamo anche assicurarci che contributori come te abbiano un'esperienza di contribuzione il più fluida possibile. Per questo abbiamo scritto questa guida ai contributi, con l'obiettivo di familiarizzarti con il codebase e con il modo in cui lavoriamo con i contributori, così potrai passare rapidamente alla parte divertente.

Questa guida, come Magic stesso, è un lavoro in corso. Apprezziamo molto la tua comprensione se a volte è in ritardo rispetto al progetto reale, e accogliamo con favore qualsiasi feedback per migliorare.

Per quanto riguarda la licenza, dedica un minuto a leggere il nostro breve [Accordo di Licenza e Contributore](./LICENSE). La community aderisce anche al [codice di condotta](https://github.com/dtyq/.github/blob/main/CODE_OF_CONDUCT.md).

## Prima di Iniziare 🔎

Cerchi qualcosa da affrontare? Sfoglia i nostri [problemi adatti ai principianti](https://github.com/dtyq/magic/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22good%20first%20issue%22) e scegline uno per iniziare!

Hai una bella idea o una funzionalità da aggiungere? Apri una PR nel nostro [repository principale](https://github.com/dtyq/magic) e mostraci cosa hai costruito.

Devi aggiornare una funzionalità esistente o risolvere dei bug? Apri una PR nel nostro [repository principale](https://github.com/dtyq/magic) e fai accadere la tua magia! ✨

Unisciti al divertimento, contribuisci e costruiamo qualcosa di straordinario insieme! 💡

Non dimenticare di collegare un issue esistente o aprirne uno nuovo nella descrizione della PR.

### Segnalazione Bug 🐛

> [!IMPORTANTE]
> Assicurati di includere le seguenti informazioni quando invii una segnalazione di bug:

- Un titolo chiaro e descrittivo
- Una descrizione dettagliata del bug, inclusi eventuali messaggi di errore
- Passi per riprodurre il bug
- Comportamento atteso
- **Log**, se disponibili; per problemi backend sono molto importanti, puoi trovarli nei log di docker-compose
- Screenshot o video, se applicabili 📷

Come determiniamo le priorità:

| Tipo di Problema | Priorità |
| ---------------- | --------- |
| Bug in funzioni core (servizio cloud, impossibile fare il login, applicazioni non funzionanti, falle di sicurezza) | Critica |
| Bug non critici, miglioramenti di performance | Priorità Media |
| Correzioni minori (refusi, UI confusa ma funzionante) | Bassa Priorità |

### Richieste di Funzionalità ✨

> [!NOTA]
> Assicurati di includere le seguenti informazioni quando invii una richiesta di funzionalità:

- Un titolo chiaro e descrittivo
- Una descrizione dettagliata della funzionalità
- Un caso d'uso per la funzionalità
- Qualsiasi altro contesto o screenshot relativo alla richiesta di funzionalità

Come determiniamo le priorità:

| Tipo di Funzionalità | Priorità |
| -------------------- | --------- |
| Funzionalità contrassegnate come ad alta priorità dai membri del team | Alta Priorità |
| Richieste di funzionalità popolari dal nostro [forum di feedback della community](https://github.com/dtyq/magic/discussions/categories/feedbacks) | Priorità Media |
| Funzionalità non core e piccoli miglioramenti | Bassa Priorità |
| Funzionalità preziose ma non urgenti | Funzionalità Future |

## Invia la tua PR 🚀

### Processo Pull Request

1. Fai il fork del repository
2. Prima di redigere la PR, crea un issue per discutere le modifiche che vuoi fare
3. Crea un nuovo branch per le tue modifiche
4. Aggiungi test appropriati per le tue modifiche
5. Assicurati che il tuo codice passi i test esistenti
6. Collega l'issue relativo nella descrizione della PR, `fixes #<issue_number>`
7. Merge riuscito!

### Configurazione Progetto

#### Frontend

Per configurare il servizio frontend, fai riferimento alla guida completa nel file `frontend/README.md`: https://github.com/dtyq/magic/blob/main/frontend/README.md. Questo documento fornisce istruzioni dettagliate per configurare correttamente l'ambiente frontend.

#### Backend

Per configurare il servizio backend, fai riferimento alle istruzioni nel file `backend/README.md`: https://github.com/dtyq/magic/blob/main/backend/README.md. Questo documento contiene indicazioni passo passo per avviare il backend senza problemi.

#### Altre Note

Ti consigliamo di leggere attentamente questo documento prima di procedere con la configurazione, poiché contiene informazioni importanti su:
- Prerequisiti e dipendenze
- Passi di installazione
- Dettagli di configurazione
- Suggerimenti comuni per la risoluzione dei problemi

Se incontri qualsiasi problema durante la configurazione, non esitare a contattarci.

## Ottieni Aiuto 🆘

Se incontri difficoltà durante il processo di contribuzione o hai problemi urgenti, sentiti libero di farci domande attraverso l'issue GitHub correlato.

---

# 贡献指南

很高兴你有兴趣为 Magic 做出贡献 - 这太棒了，我们迫不及待地想看看你会做些什么。作为一家人员和资金有限的创业公司，我们有宏大的抱负，致力于构建最强大的 LLM 应用程序。来自社区的任何帮助都非常重要，这是真的。

考虑到我们的现状，我们需要灵活并快速发布，但我们也想确保像你这样的贡献者获得尽可能流畅的贡献体验。我们为此编写了这份贡献指南，旨在帮助你熟悉代码库以及我们如何与贡献者合作，以便你能够快速进入有趣的部分。

这份指南，就像 Magic 本身一样，是不断完善的。如果有时它落后于实际项目，我们非常感谢你的理解，也欢迎任何有助于我们改进的反馈。

关于许可，请花一分钟阅读我们简短的[许可和贡献者协议](./LICENSE)。社区也遵守[行为准则](https://github.com/dtyq/.github/blob/main/CODE_OF_CONDUCT.md)。

## 开始之前

寻找可以处理的任务？浏览我们的[适合新手的问题](https://github.com/dtyq/magic/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22good%20first%20issue%22)并选择一个开始！

有一个很酷的想法或功能要添加？在我们的[主仓库](https://github.com/dtyq/magic)中开启一个 PR，向我们展示你构建的内容。

需要更新现有功能或修复一些 bug？在我们的[主仓库](https://github.com/dtyq/magic)中开启一个 PR，施展你的魔法吧！

加入我们，做出贡献，让我们一起构建令人惊叹的东西！💡✨

不要忘记在 PR 的描述中链接现有的 issue 或开启一个新的 issue。

### Bug 报告

> [! 重要]
> 提交 bug 报告时，请确保包含以下信息：

- 清晰描述性的标题
- 关于 bug 的详细描述，包括任何错误信息
- 重现 bug 的步骤
- 预期行为
- **日志**，如果可用，对于后端问题，这非常重要，你可以在 docker-compose 日志中找到它们
- 截图或视频，如适用

我们如何确定优先级：

| 问题类型 | 优先级 |
| ------ | ------ |
| 核心功能的 bug（云服务、无法登录、应用程序不工作、安全漏洞） | 关键 |
| 非关键 bug、性能提升 | 中等优先级 |
| 小修复（拼写错误、混淆但可工作的 UI） | 低优先级 |

### 功能请求

> [! 注意]
> 提交功能请求时，请确保包含以下信息：

- 清晰描述性的标题
- 关于功能的详细描述
- 功能的使用场景
- 有关功能请求的任何其他上下文或截图

我们如何确定优先级：

| 功能类型 | 优先级 |
| ------ | ------ |
| 被团队成员标记为高优先级的功能 | 高优先级 |
| 来自我们[社区反馈板](https://github.com/dtyq/magic/discussions/categories/feedbacks)的受欢迎功能请求 | 中等优先级 |
| 非核心功能和小增强 | 低优先级 |
| 有价值但不紧急的功能 | 未来功能 |

## 提交你的 PR

### Pull Request 流程

1. Fork 仓库
2. 在起草 PR 之前，请创建一个 issue 来讨论你想要做的更改
3. 为你的更改创建一个新分支
4. 请为你的更改添加相应的测试
5. 确保你的代码通过现有的测试
6. 请在 PR 描述中链接相关 issue，`fixes #<issue_number>`
7. 合并成功！

### 项目设置

#### 前端

关于设置前端服务，请参考 `frontend/README.md` 文件中的全面[指南](https://github.com/dtyq/magic/blob/main/frontend/README.md)。该文档提供了详细说明，帮助你正确设置前端环境。

#### 后端

关于设置后端服务，请参考 `backend/README.md` 文件中的详细[说明](https://github.com/dtyq/magic/blob/main/backend/README.md)。该文档包含分步指导，帮助你顺利运行后端。

#### 其他注意事项

我们建议在进行设置之前仔细阅读本文档，因为它包含关于以下方面的重要信息：
- 先决条件和依赖项
- 安装步骤
- 配置详情
- 常见故障排除提示

如果在设置过程中遇到任何问题，请随时联系我们。

## 获取帮助

如果在贡献过程中遇到困难或有紧急问题，只需通过相关的 GitHub issue 向我们提问即可。 