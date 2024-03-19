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
