# Super Magic Module - Modulo di Intelligenza Artificiale Avanzata 🚀

## Introduzione

Super Magic Module è un pacchetto di estensioni basato sul framework Hyperf, progettato specificamente come modulo di estensione avanzata per magic-service. Questo modulo adotta l'architettura Domain-Driven Design (DDD), fornendo una struttura a strati chiara e componenti funzionali ricchi per le applicazioni.

Super Magic Module deve essere utilizzato insieme a magic-service, e la sua funzionalità principale è quella di prendere il controllo degli eventi di messaggistica di magic-service, stabilendo un canale di comunicazione tra utenti e agenti intelligenti Super Magic. Questo design permette agli utenti di interagire senza soluzione di continuità con gli agenti intelligenti, ottenendo un'esperienza di servizio più intelligente.

Come modulo ponte, Super Magic Module non solo gestisce la trasmissione dei messaggi, ma è anche responsabile della conversione dei formati dati, del coordinamento dei flussi di eventi e della fornitura delle informazioni contestuali necessarie, assicurando che gli agenti possano comprendere accuratamente le intenzioni degli utenti e fornire risposte appropriate.

## Caratteristiche Principali

- Costruito su Hyperf 3.1, perfettamente adattato all'architettura esistente di magic-service
- Segue l'architettura Domain-Driven Design (DDD), con organizzazione del codice chiara e facile da mantenere
- Fornisce funzionalità di condivisione risorse, supportando l'accesso alle risorse tra moduli
- Come canale di messaggistica, collega utenti e agenti intelligenti Super Magic
- Supporta l'ascolto e la gestione degli eventi, rispondendo in tempo reale alle richieste degli utenti
- Fornisce gestione dell'area di lavoro, supportando elaborazione multi-argomento e multi-task
- Implementa sistema di gestione file, supportando le operazioni degli agenti sui file
- Organizzazione del codice conforme agli standard PSR, garantendo la qualità del codice

## Architettura di Sistema

Super Magic Module come estensione di magic-service, gioca il seguente ruolo nel sistema complessivo:

```
Richiesta utente → magic-service → Super Magic Module → Agente Super Magic
                 ↑                 |
                 └─────────────────┘
              Risposta di ritorno
```

Il modulo si integra con magic-service nei seguenti modi:

1. Ascolta gli eventi di messaggistica di magic-service
2. Elabora e converte i formati dei messaggi
3. Trasmette i messaggi all'agente Super Magic
4. Riceve ed elabora le risposte dell'agente
5. Restituisce i risultati elaborati a magic-service

## Installazione

Installa tramite Composer:

```bash
composer require dtyq/super-magic-module
```

## Utilizzo Base

### Configurazione

Il modulo fornisce `ConfigProvider` per registrare servizi e funzionalità correlati. Nella directory `config/autoload` dell'applicazione Hyperf configura:

```php
<?php

return [
    // Carica ConfigProvider
    \Dtyq\SuperMagic\ConfigProvider::class,
];
```

### Integrazione con magic-service

Per integrare Super Magic Module con magic-service, è necessario prendere il controllo delle dipendenze in magic-service:

```php
[
    'dependencies_priority' => [
        // Evento di esecuzione assistente
        AgentExecuteInterface::class => SuperAgentMessageSubscriberV2::class,
        SuperAgentMessageInterface::class => SuperAgentMessage::class,
    ]
]
```

### Utilizzo del Livello Domain

Il modulo è progettato basato sull'architettura DDD, comprendendo i seguenti livelli principali:

- Domain (Livello Domain): Contiene logica di business e entità, come elaborazione messaggi, gestione area di lavoro e altre funzionalità core
- Application (Livello Applicazione): Coordina gli oggetti domain per completare scenari di business complessi, come flussi di trasmissione messaggi
- Infrastructure (Livello Infrastruttura): Fornisce supporto tecnico, inclusi archiviazione dati, chiamate servizi esterni, ecc.
- Interfaces (Livello Interfacce): Gestisce richieste e risposte esterne, fornisce interfacce API

## Sviluppo

### Struttura delle Directory

```
src/
├── Application/      # Livello Applicazione, elabora flussi di business
│   ├── Share/        # Servizi di condivisione risorse
│   └── SuperAgent/   # Servizi agenti super intelligenti
├── Domain/           # Livello Domain, contiene logica di business core
│   ├── Share/        # Modelli domain di condivisione risorse
│   └── SuperAgent/   # Modelli domain agenti super intelligenti
├── Infrastructure/   # Livello Infrastruttura, fornisce implementazioni tecniche
│   ├── ExternalAPI/  # Chiamate API esterne
│   └── Utils/        # Classi di utilità
├── Interfaces/       # Livello Interfacce, gestisce interazioni esterne
│   ├── Share/        # Interfacce di condivisione risorse
│   └── SuperAgent/   # Interfacce agenti super intelligenti
├── Listener/         # Ascoltatori di eventi
└── ConfigProvider.php # Fornitore di configurazione
```

### Comandi

Il pacchetto di estensioni fornisce una serie di comandi utili:

```bash
# Riparazione stile codice
composer fix

# Analisi statica codice
composer analyse

# Esecuzione test
composer test

# Avvio servizio Hyperf
composer start
```

## Flusso dei Messaggi

Il flusso base di elaborazione dei messaggi di Super Magic Module è il seguente:

1. L'utente invia un messaggio in magic-service
2. magic-service attiva l'evento messaggio
3. Super Magic Module ascolta l'evento, estrae il contenuto del messaggio
4. Il messaggio viene convertito nel formato comprensibile dall'agente Super Magic
5. Il messaggio viene inviato all'agente Super Magic
6. L'agente elabora il messaggio e genera una risposta
7. Super Magic Module riceve la risposta e converte il formato
8. La risposta viene trasmessa indietro a magic-service tramite evento
9. L'utente riceve la risposta dell'agente

## Test

Esegui i test:

```bash
composer test
```

## Guida ai Contributi

1. Fai il fork di questo repository
2. Crea un branch per la funzionalità (`git checkout -b feature/fantastica-funzionalita`)
3. Applica le modifiche (`git commit -m 'Aggiungi una fantastica funzionalità'`)
4. Fai il push del branch (`git push origin feature/fantastica-funzionalita`)
5. Crea una Pull Request

## Risorse Correlate

- [Documentazione ufficiale Hyperf](https://hyperf.wiki)
- [Standard PSR](https://www.php-fig.org/psr/)
- [Riferimento Domain-Driven Design](https://www.domainlanguage.com/ddd/)
- [Documentazione Magic Service](https://docs.dtyq.com/magic-service/)

## Autori

- **team dtyq** - [team@dtyq.com](mailto:team@dtyq.com)

## Licenza

Questo progetto utilizza una licenza privata - per i dettagli consulta la documentazione interna del team.

## Stato del Progetto

Questo modulo è in attivo sviluppo come componente di miglioramento di magic-service, fornendo continuamente aggiornamenti delle capacità di interazione intelligente. Accogliamo con favore feedback e suggerimenti dai membri del team per perfezionare insieme questo modulo chiave.

---

<!-- Testo originale (cinese) — mantenuto sotto: -->

# Super Magic Module

## 简介

Super Magic Module 是一个基于 Hyperf 框架的扩展包，专为 magic-service 设计的增强扩展模块。该模块采用领域驱动设计（DDD）架构，为应用程序提供了清晰的分层结构和丰富的功能组件。

Super Magic Module 需要结合 magic-service 一起使用，其核心功能是通过接管 magic-service 的消息事件，建立用户与超级麦吉智能体之间的信息传递通道。这种设计使得用户可以无缝地与智能体进行交互，从而获得更加智能化的服务体验。

作为一个桥接模块，Super Magic Module 不仅处理消息的传递，还负责转换数据格式、协调事件流程，以及提供必要的上下文信息，确保智能体能够准确理解用户意图并给出恰当的响应。

## 功能特性

- 基于 Hyperf 3.1 构建，完美适配现有 magic-service 架构
- 遵循领域驱动设计（DDD）架构，代码组织清晰，易于维护
- 提供资源共享功能，支持跨模块资源访问
- 作为消息通道，连接用户与超级麦吉智能体
- 支持事件监听与处理，实时响应用户请求
- 提供工作区管理，支持多话题、多任务处理
- 实现文件管理系统，支持智能体对文件的操作
- 符合 PSR 规范的代码组织，确保代码质量

## 系统架构

Super Magic Module 作为 magic-service 的扩展，在整个系统中扮演以下角色：

```
用户请求 → magic-service → Super Magic Module → 超级麦吉智能体
                 ↑                 |
                 └─────────────────┘
              响应返回
```

该模块通过以下方式与 magic-service 集成：

1. 监听 magic-service 的消息事件
2. 处理和转换消息格式
3. 传递消息至超级麦吉智能体
4. 接收并处理智能体的响应
5. 将处理结果返回给 magic-service

## 安装

通过 Composer 安装：

```bash
composer require dtyq/super-magic-module
```

## 基本使用

### 配置

模块提供了 `ConfigProvider` 用于注册相关服务和功能。在 Hyperf 应用的 `config/autoload` 目录下配置：

```php
<?php

return [
    // 加载 ConfigProvider
    \Dtyq\SuperMagic\ConfigProvider::class,
];
```

### 与 magic-service 集成

要将 Super Magic Module 与 magic-service 集成，需要在 magic-service 中依赖进行接管：

```php
[
    'dependencies_priority' => [
        // 助理执行事件
        AgentExecuteInterface::class => SuperAgentMessageSubscriberV2::class,
        SuperAgentMessageInterface::class => SuperAgentMessage::class,
    ]
]
```

### 领域层使用

模块基于 DDD 架构设计，包含以下几个主要层次：

- Domain（领域层）：包含业务逻辑和实体，如消息处理、工作区管理等核心功能
- Application（应用层）：协调领域对象完成复杂的业务场景，如消息传递流程
- Infrastructure（基础设施层）：提供技术支持，包括数据存储、外部服务调用等
- Interfaces（接口层）：处理外部请求和响应，提供API接口

## 开发

### 目录结构

```
src/
├── Application/      # 应用层，处理业务流程
│   ├── Share/        # 资源共享服务
│   └── SuperAgent/   # 超级智能体服务
├── Domain/           # 领域层，包含核心业务逻辑
│   ├── Share/        # 资源共享领域模型
│   └── SuperAgent/   # 超级智能体领域模型
├── Infrastructure/   # 基础设施层，提供技术实现
│   ├── ExternalAPI/  # 外部API调用
│   └── Utils/        # 工具类
├── Interfaces/       # 接口层，处理外部交互
│   ├── Share/        # 资源共享接口
│   └── SuperAgent/   # 超级智能体接口
├── Listener/         # 事件监听器
└── ConfigProvider.php # 配置提供者
```

### 命令

该扩展包提供了一系列有用的命令：

```bash
# 代码风格修复
composer fix

# 代码静态分析
composer analyse

# 执行测试
composer test

# 启动 Hyperf 服务
composer start
```

## 消息流程

Super Magic Module 处理消息的基本流程如下：

1. 用户在 magic-service 发送消息
2. magic-service 触发消息事件
3. Super Magic Module 监听到事件，提取消息内容
4. 消息被转换为超级麦吉智能体可理解的格式
5. 消息发送给超级麦吉智能体
6. 智能体处理消息并生成响应
7. Super Magic Module 接收响应并转换格式
8. 响应通过事件传递回 magic-service
9. 用户收到智能体的回应

## 测试

执行测试：

```bash
composer test
```

## 贡献指南

1. Fork 该仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建一个 Pull Request

## 相关资源

- [Hyperf 官方文档](https://hyperf.wiki)
- [PSR 标准](https://www.php-fig.org/psr/)
- [领域驱动设计参考](https://www.domainlanguage.com/ddd/)
- [Magic Service 文档](https://docs.dtyq.com/magic-service/)

## 作者

- **dtyq team** - [team@dtyq.com](mailto:team@dtyq.com)

## 许可证

该项目采用私有许可证 - 详情请参阅团队内部文档。

## 项目状态

该模块正在积极开发中，作为 magic-service 的增强组件，持续提供智能交互能力的升级。我们欢迎团队成员提供反馈和建议，共同完善这一关键模块。