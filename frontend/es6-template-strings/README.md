# @dtyq/es6-template-strings

Motore di Parsing per Template Strings ES6

[![license][license-badge]][license-link]
![NPM Version](https://img.shields.io/npm/v/@dtyq/es6-template-strings)
[![codecov][codecov-badge]][codecov-link]

[license-badge]: https://img.shields.io/badge/license-apache2-blue.svg
[license-link]: LICENSE
[codecov-badge]: https://codecov.io/gh/dtyq/es6-template-strings/branch/master/graph/badge.svg
[codecov-link]: https://codecov.io/gh/dtyq/es6-template-strings

## 📋 Panoramica

Questo pacchetto fornisce un motore di parsing per template strings che supporta la sintassi in stile ES6. Permette di interpolare variabili ed espressioni all'interno delle stringhe utilizzando la sintassi `${espressione}`.

## 🚀 Utilizzo

```typescript
import { resolveToString, resolveToArray } from "@dtyq/es6-template-strings";

// Utilizzo base
console.log(resolveToString("ciao ${nome}", { nome: "mondo" }));
// Output: "ciao mondo"

// Restituisce array di parti del template e sostituzioni
console.log(resolveToArray("ciao ${nome}", { nome: "mondo" }));
// Output: ["ciao ", "mondo"]
```

## ⚙️ Opzioni di Configurazione

| Opzione | Descrizione | Tipo | Default | Richiesto |
|:------:|:----------:|:----:|:-------:|:--------:|
| notation | Prefisso sintassi template | string | "$" | No |
| notationStart | Marcatore inizio sintassi template | string | "{" | No |
| notationEnd | Marcatore fine sintassi template | string | "}" | No |
| partial | Salta espressioni fallite invece di restituire undefined | boolean | false | No |

## 📝 Note

- Quando un'espressione non può essere risolta:
  - Se `partial: true`, la stringa originale `${espressione}` verrà preservata
  - Se `partial: false` (default), verrà restituito undefined per quell'espressione
- Il pacchetto gestisce correttamente espressioni annidate e sequenze di escape

## 🛠️ Sviluppo

Per configurare l'ambiente di sviluppo:

1. Clona il repository
2. Installa le dipendenze: `npm install`
3. Costruisci il pacchetto: `npm run build`
4. Esegui i test: `npm test`

## 🔄 Processo di Iterazione

Il pacchetto segue il versionamento semantico:

1. Le correzioni di bug risultano in incrementi di versione patch
2. Le nuove funzionalità che mantengono la retrocompatibilità risultano in incrementi di versione minor
3. I cambiamenti che rompono la compatibilità risultano in incrementi di versione major

Per contribuire:
1. Fai il fork del repository
2. Crea un branch per la funzionalità
3. Invia una pull request con descrizione dettagliata delle modifiche

---

# @dtyq/es6-template-strings

ES6 Template Strings Parser Engine

[![license][license-badge]][license-link]
![NPM Version](https://img.shields.io/npm/v/@dtyq/es6-template-strings)
[![codecov][codecov-badge]][codecov-link]

[license-badge]: https://img.shields.io/badge/license-apache2-blue.svg
[license-link]: LICENSE
[codecov-badge]: https://codecov.io/gh/dtyq/es6-template-strings/branch/master/graph/badge.svg
[codecov-link]: https://codecov.io/gh/dtyq/es6-template-strings

## Overview

This package provides a template string parsing engine that supports ES6-style syntax. It allows you to interpolate variables and expressions within strings using the `${expression}` syntax.

## Usage

```typescript
import { resolveToString, resolveToArray } from "@dtyq/es6-template-strings";

// Basic usage
console.log(resolveToString("hello ${name}", { name: "world" }));
// Output: "hello world"

// Return array of template parts and substitutions
console.log(resolveToArray("hello ${name}", { name: "world" }));
// Output: ["hello ", "world"]
```

## Configuration Options

| Option | Description | Type | Default | Required |
|:------:|:----------:|:----:|:-------:|:--------:|
| notation | Template syntax prefix | string | "$" | No |
| notationStart | Template syntax start marker | string | "{" | No |
| notationEnd | Template syntax end marker | string | "}" | No |
| partial | Skip failed expressions instead of returning undefined | boolean | false | No |

## Notes

- When an expression cannot be resolved:
  - If `partial: true`, the original `${expression}` string will be preserved
  - If `partial: false` (default), undefined will be returned for that expression
- The package handles nested expressions and escape sequences properly

## Development

To set up the development environment:

1. Clone the repository
2. Install dependencies: `npm install`
3. Build the package: `npm run build`
4. Run tests: `npm test`

## Iteration Process

The package follows semantic versioning:

1. Bug fixes result in patch version increments
2. New features that maintain backward compatibility result in minor version increments
3. Breaking changes result in major version increments

For contributing:
1. Fork the repository
2. Create a feature branch
3. Submit a pull request with detailed description of changes

