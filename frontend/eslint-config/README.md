# @dtyq/eslint-config 🔧

Pacchetto di configurazione ESLint per principianti, con tutte le dipendenze integrate, senza bisogno di installare ESLint e plugin correlati aggiuntivi.

## ✨ Caratteristiche

- ✅ Configurazione zero: Pronto all'uso, tutto in un passo
- ✅ Dipendenze integrate: Non richiede l'installazione di pacchetti ESLint aggiuntivi
- ✅ Configurazioni multiple: Supporta scenari base, TypeScript, React, Vue e altri
- ✅ Compatibile con pnpm workspace

## 🏢 Uso in pnpm workspace

1. Aggiungi la dipendenza nel `package.json` del pacchetto che necessita ESLint:

```json
{
  "devDependencies": {
    "@dtyq/eslint-config": "workspace:*"
  }
}
```

2. Crea il file `eslint.config.js`:

```javascript
// Uso più semplice (raccomandato)
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Utilizza direttamente la configurazione predefinita, risolto in una riga
const typescriptPreset = require('@dtyq/eslint-config/typescript-preset');

export default [
  { ...typescriptPreset },
  // Regole personalizzate (opzionale)
  {
    files: ['src/**/*.ts'],
    rules: {
      // Regole personalizzate
    }
  }
];
```

```javascript
// Uso avanzato (combinazione di configurazioni multiple)
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const baseConfig = require('@dtyq/eslint-config/base');
const typescriptConfig = require('@dtyq/eslint-config/typescript');

export default [
  { ...baseConfig },
  { ...typescriptConfig },
  // Regole personalizzate
  {
    files: ['src/**/*.ts'],
    rules: {
      // Regole personalizzate
    }
  }
];
```

```javascript
// Progetto CommonJS
const baseConfig = require('@dtyq/eslint-config/base');

module.exports = {
  ...baseConfig,
  // Regole personalizzate
};
```

3. Aggiungi script lint al `package.json`:

```json
{
  "scripts": {
    "lint": "eslint --config eslint.config.js 'src/**/*.{js,ts,tsx}'"
  }
}
```

## 📋 Configurazioni Disponibili

- `@dtyq/eslint-config` - Configurazione predefinita
- `@dtyq/eslint-config/base` - Regole base
- `@dtyq/eslint-config/typescript` - Regole TypeScript
- `@dtyq/eslint-config/typescript-preset` - Preset progetto TypeScript (include regole base e TS, raccomandato)
- `@dtyq/eslint-config/react` - Regole React
- `@dtyq/eslint-config/vue` - Regole Vue 3.x
- `@dtyq/eslint-config/vue2` - Regole Vue 2.x
- `@dtyq/eslint-config/prettier` - Integrazione Prettier
- `@dtyq/eslint-config/jsconfig` - Supporto jsconfig.json

---

# @dtyq/eslint-config

傻瓜式 ESLint 配置包，内置所有依赖，无需额外安装 ESLint 及相关插件。

## 特点

- ✅ 零配置：开箱即用，一步到位
- ✅ 内置所有依赖：不需要安装额外的 ESLint 相关包
- ✅ 多种配置：支持基础、TypeScript、React、Vue 等多种场景
- ✅ 与 pnpm workspace 完美兼容

## 在 pnpm workspace 中使用

1. 在需要使用 ESLint 的包的 `package.json` 中添加依赖：

```json
{
  "devDependencies": {
    "@dtyq/eslint-config": "workspace:*"
  }
}
```

2. 创建 `eslint.config.js` 文件：

```javascript
// 最简单的用法（推荐）
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// 直接使用预设配置，一行解决
const typescriptPreset = require('@dtyq/eslint-config/typescript-preset');

export default [
  { ...typescriptPreset },
  // 自定义规则（可选）
  {
    files: ['src/**/*.ts'],
    rules: {
      // 自定义规则
    }
  }
];
```

```javascript
// 高级用法（组合多个配置）
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const baseConfig = require('@dtyq/eslint-config/base');
const typescriptConfig = require('@dtyq/eslint-config/typescript');

export default [
  { ...baseConfig },
  { ...typescriptConfig },
  // 自定义规则
  {
    files: ['src/**/*.ts'],
    rules: {
      // 自定义规则
    }
  }
];
```

```javascript
// CommonJS 项目
const baseConfig = require('@dtyq/eslint-config/base');

module.exports = {
  ...baseConfig,
  // 自定义规则
};
```

3. 添加 lint 脚本到 `package.json`：

```json
{
  "scripts": {
    "lint": "eslint --config eslint.config.js 'src/**/*.{js,ts,tsx}'"
  }
}
```

## 可用配置

- `@dtyq/eslint-config` - 默认配置
- `@dtyq/eslint-config/base` - 基础规则
- `@dtyq/eslint-config/typescript` - TypeScript 规则
- `@dtyq/eslint-config/typescript-preset` - TypeScript 项目预设（包含基础和 TS 规则，推荐）
- `@dtyq/eslint-config/react` - React 规则
- `@dtyq/eslint-config/vue` - Vue 3.x 规则
- `@dtyq/eslint-config/vue2` - Vue 2.x 规则
- `@dtyq/eslint-config/prettier` - Prettier 集成
- `@dtyq/eslint-config/jsconfig` - jsconfig.json 支持
