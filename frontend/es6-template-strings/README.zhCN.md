# @dtyq/es6-template-strings

Motore di analisi delle stringhe template ES6 🚀

[![license][license-badge]][license-link]
![NPM Version](https://img.shields.io/npm/v/@dtyq/es6-template-strings)
[![codecov][codecov-badge]][codecov-link]

[license-badge]: https://img.shields.io/badge/license-apache2-blue.svg
[license-link]: LICENSE
[codecov-badge]: https://codecov.io/gh/dtyq/es6-template-strings/branch/master/graph/badge.svg
[codecov-link]: https://codecov.io/gh/dtyq/es6-template-strings

## Panoramica 📋

Questo pacchetto fornisce un motore di analisi delle stringhe template che supporta la sintassi in stile ES6. Ti permette di inserire variabili ed espressioni nelle stringhe utilizzando la sintassi `${expression}`.

## Utilizzo 💻

```typescript
import { resolveToString, resolveToArray } from "@dtyq/es6-template-strings";

// Utilizzo base
console.log(resolveToString("hello ${name}", { name: "world" }));
// Output: "hello world"

// Restituisce un array delle parti del template e dei valori sostituiti
console.log(resolveToArray("hello ${name}", { name: "world" }));
// Output: ["hello ", "world"]
```

## Opzioni di configurazione ⚙️

|      Opzione       |       Descrizione        |  Tipo   | Valore predefinito  |  Obbligatorio  |
|:-----------------:|:-----------------------:|:------:|:------------------:|:-------------:|
|   notation       |   Prefisso della sintassi del template    | string |  "$"  |    No    |
| notationStart    |   Marcatore di inizio della sintassi del template    | string |  "{"  |    No    |
|  notationEnd     |   Marcatore di fine della sintassi del template    | string |  "}"  |    No    |
|   partial        | Se saltare le espressioni che non riescono a essere analizzate | boolean | false |    No    |

## Note importanti ⚠️

- Quando un'espressione non può essere analizzata:
  - Se `partial: true`, mantiene la stringa originale `${expression}`
  - Se `partial: false` (valore predefinito), l'espressione corrispondente restituisce undefined
- Il pacchetto gestisce correttamente espressioni annidate e sequenze di escape

## Modalità di sviluppo 🛠️

Impostazione dell'ambiente di sviluppo:

1. Clona il repository
2. Installa le dipendenze: `npm install`
3. Costruisci il pacchetto: `npm run build`
4. Esegui i test: `npm test`

## Modalità di rilascio 📈

Il pacchetto segue le specifiche di versionamento semantico:

1. Le correzioni di bug aumentano la versione patch
2. Le nuove funzionalità compatibili con le versioni precedenti aumentano la versione minor
3. Le modifiche breaking aumentano la versione major

Flusso di contributi:
1. Fork del repository
2. Crea un branch per la funzionalità
3. Invia una pull request con una descrizione dettagliata delle modifiche

---

## Testo originale (in cinese) 📜

# @dtyq/es6-template-strings

ES6 字符串模板解析引擎

[![license][license-badge]][license-link]
![NPM Version](https://img.shields.io/npm/v/@dtyq/es6-template-strings)
[![codecov][codecov-badge]][codecov-link]

[license-badge]: https://img.shields.io/badge/license-apache2-blue.svg
[license-link]: LICENSE
[codecov-badge]: https://codecov.io/gh/dtyq/es6-template-strings/branch/master/graph/badge.svg
[codecov-link]: https://codecov.io/gh/dtyq/es6-template-strings

## 概述

本包提供了一个支持 ES6 风格语法的模板字符串解析引擎。它允许你使用 `${expression}` 语法在字符串中插入变量和表达式。

## 用法

```typescript
import { resolveToString, resolveToArray } from "@dtyq/es6-template-strings";

// 基本用法
console.log(resolveToString("hello ${name}", { name: "world" }));
// 输出: "hello world"

// 返回模板部分和替换值的数组
console.log(resolveToArray("hello ${name}", { name: "world" }));
// 输出: ["hello ", "world"]
```

## 配置选项

|      选项       |       描述        |  类型   | 默认值  |  是否必填  |
|:-------------:|:---------------:|:-----:|:-----:|:-------:|
|   notation    |   模板语法前缀符号    | string |  "$"  |    否    |
| notationStart |   模板语法开始标记    | string |  "{"  |    否    |
|  notationEnd  |   模板语法结束标记    | string |  "}"  |    否    |
|   partial     | 是否跳过解析失败的表达式 | boolean | false |    否    |

## 注意事项

- 当表达式无法解析时：
  - 如果 `partial: true`，将保留原始 `${expression}` 字符串
  - 如果 `partial: false`（默认值），对应表达式将返回 undefined
- 该包能够正确处理嵌套表达式和转义序列

## 开发模式

设置开发环境：

1. 克隆仓库
2. 安装依赖：`npm install`
3. 构建包：`npm run build`
4. 运行测试：`npm test`

## 迭代模式

该包遵循语义化版本规范：

1. 错误修复导致补丁版本增加
2. 保持向后兼容性的新功能导致次要版本增加
3. 破坏性变更导致主要版本增加

贡献流程：
1. Fork 仓库
2. 创建功能分支
3. 提交拉取请求，详细描述更改
