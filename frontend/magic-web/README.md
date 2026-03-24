# Magic

## 开发环境

- Node.js : 使用最新稳定版本(v18+)
- pnpm: v9+

## 快速开始

```bash
# 安装依赖
pnpm install

# 启动开发服务器（HTTPS，端口 443）
pnpm dev

# 构建生产版本
pnpm build

# 预览生产构建
pnpm preview

# 运行测试
pnpm test

# 监听模式运行测试
pnpm test:watch

# CI 环境运行测试
pnpm test:ci

# 运行测试覆盖率
pnpm coverage

# 代码检查
pnpm lint

# 自动修复代码问题
pnpm lint:fix
```

### 其他命令

```bash
# 生成图标标签（开发前自动执行）
pnpm generate:icon-tags

# 代码混淆（构建前自动执行）
pnpm obfuscate

# Lighthouse 性能审计
pnpm lh:audit

# 安装 Lighthouse 浏览器依赖
pnpm lh:install

# 查看 Lighthouse 审计报告
pnpm lh:view
```

## 技术栈

### 核心框架

- React 18
- TypeScript
- Vite

### 状态管理

- MobX（全局状态）
- Zustand（组件级状态）
- SWR（服务端状态）

### UI 组件库

- Ant Design 5.x（现有组件维护）
- shadcn/ui（新组件开发）
- Ant Design Mobile（移动端）

### 样式方案

- Tailwind CSS（新组件）
- antd-style（现有组件，CSS-in-JS）

### 其他核心库

- TipTap（富文本编辑器）
- react-router（路由）
- react-i18next（国际化）
- Vitest（测试框架）

## 开发规范

### 代码风格

- 项目使用 ESLint 和 Prettier 进行代码格式化
- 提交代码前请确保通过所有 lint 检查
- 组件文件使用 PascalCase 命名
- 工具函数文件使用 camelCase 命名

### 组件开发规范

#### 样式编写

项目采用双样式系统，根据组件类型选择对应的样式方案：

**新组件（推荐）**：

- 使用 **Tailwind CSS** + **shadcn/ui**
- 组件位置：`src/components/shadcn-ui/`
- 配置文件：`components.json`、`tailwind.config.js`
- 样式变量：`src/index.css`

**现有组件（维护模式）**：

- 使用 **antd-style**（CSS-in-JS）
- 遵循 `ant-design@5.x` 的设计规范
- 参考：[`antd-style` 使用规范](https://ant-design.github.io/antd-style/guide/create-styles)

**样式编写规范**：

##### 1. 新组件（Tailwind CSS + shadcn/ui）

**文件结构**：

- 组件文件：`Component.tsx`（样式直接写在组件内）
- 无需单独的样式文件

**编写方式**：

```tsx
import { cn } from "@/lib/utils"

// 基础组件示例
function Button({ className, variant, ...props }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md",
        "bg-primary text-primary-foreground hover:bg-primary/90",
        variant === "outline" && "border bg-transparent",
        className
      )}
      {...props}
    />
  )
}

// 使用 class-variance-authority 定义变体
import { cva, type VariantProps } from "class-variance-authority"

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        outline: "border bg-transparent",
      },
      size: {
        default: "h-9 px-4",
        sm: "h-8 px-3",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({ className, variant, size, ...props }: VariantProps<typeof buttonVariants>) {
  return (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}
```

**关键要点**：

- 使用 `cn()` 工具函数（来自 `@/lib/utils`）合并 Tailwind 类名
- 使用 `class-variance-authority` (cva) 定义组件变体
- 直接在 `className` prop 中使用 Tailwind 工具类
- 支持响应式：使用 `sm:`、`md:`、`lg:` 等前缀
- 支持深色模式：使用 `dark:` 前缀

##### 2. 现有组件（antd-style）

**文件结构**：

- 组件文件：`Component.tsx`
- 样式文件：`styles.ts` 或 `useStyle.ts`（与组件同级）

**编写方式**：

```tsx
// styles.ts
import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token, prefixCls, responsive }) => {
  return {
    container: css`
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px;
      background: ${token.colorBgContainer};
      border-radius: ${token.borderRadius}px;

      ${responsive.mobile} {
        padding: 12px;
      }
    `,

    title: css`
      font-size: 18px;
      font-weight: 600;
      color: ${token.colorText};
      margin: 0;
    `,

    button: css`
      height: 32px;
      padding: 6px 16px;
      background: ${token.colorPrimary};
      border: none;
      border-radius: 8px;
      color: #fff;
      cursor: pointer;
      transition: opacity 0.2s;

      &:hover {
        opacity: 0.9;
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    `,
  }
})

// Component.tsx
import { useStyles } from "./styles"

function Component() {
  const { styles, cx } = useStyles()

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>标题</h2>
      <button className={cx(styles.button, isDisabled && styles.disabled)}>
        按钮
      </button>
    </div>
  )
}
```

**关键要点**：

- 使用 `createStyles` 创建样式，返回 `useStyles` hook
- 使用 `token` 访问 Ant Design 设计令牌（颜色、间距、圆角等）
- 使用 `responsive` 对象处理响应式样式
- 使用 `prefixCls` 访问 Ant Design 组件类名前缀
- 使用 `cx` 函数（从 `useStyles` 解构）合并类名
- 样式文件与组件文件分离，保持代码清晰

##### 3. 通用规范

- **禁止使用**：`less`、`styled-components`、CSS modules 等其他样式方案
- **禁止混合**：不要在同一组件中混合使用 Tailwind CSS 和 antd-style
- **样式分离**：现有组件必须将样式文件与组件文件分离
- **类名合并**：
    - 新组件：使用 `cn()` 函数
    - 现有组件：使用 `cx()` 函数（来自 `useStyles`）
- **响应式设计**：
    - 新组件：使用 Tailwind 响应式前缀（`sm:`、`md:`、`lg:`）
    - 现有组件：使用 `responsive` 对象（`responsive.mobile`、`responsive.tablet`）

#### 公共组件

**新组件开发（推荐）**：

- shadcn/ui 组件：位于 `src/components/shadcn-ui/`，基于 Tailwind CSS
- 使用 `pnpm dlx shadcn@latest add [component]` 添加新组件

**现有组件（维护模式）**：

- 基础组件：基于 antd 封装了部分基础组件，完善了组件样式，或扩展了参数接口，文件目录位于 `src/components/base`，请优先使用
- 业务组件：封装了日常业务中常用的组件，文件目录位于 `src/components/business`
- 开源版本组件：位于 `src/components/`，包含 base、business、shadcn-ui 等目录

#### 组件开发原则

- 组件应该是可复用的，避免过度耦合业务逻辑
- 组件应该有完整的类型定义
- 复杂组件需要编写使用文档
- 组件应遵循单一职责原则

### Git 工作流

- 主分支：`released`（TODO）
- 预发布分支：`pre-release`（TODO）
- 测试分支：`master`
- 功能分支：`feature/功能名称`
- 修复分支：`hotfix/问题描述`

提交信息格式：

```
type(scope): commit message

- type: feat|fix|docs|style|refactor|test|chore
- scope: 影响范围
- message: 提交说明
```

### 单元测试

测试框架：[Vitest](https://cn.vitest.dev/)

在满足功能开发的基础上，尤其对于工具函数，尽可能的补充足够多的代码单元测试用例，以提交代码健壮性，减少后续重构的维护成本。

单元测试文件放置在该函数所在文件目录下的 `__tests__` 文件夹中，以 `{filename}.test.ts` 的方式命名。

#### 测试规范

- 每个工具函数都应该有对应的测试用例
- 测试用例应该覆盖正常流程和异常流程
- 测试描述应该清晰明了
- 使用 `describe` 和 `it` 组织测试用例

#### 测试命令

```bash
# 运行所有测试
pnpm test

# 监听模式运行测试（开发时使用）
pnpm test:watch

# CI 环境运行测试
pnpm test:ci

# 运行测试并生成覆盖率报告
pnpm coverage

# 运行指定测试文件
pnpm test path/to/test.test.ts
```

### 国际化规范

项目支持多语言国际化，所有用户可见的文本都必须使用翻译键：

#### 基本使用

```typescript
import { useTranslation } from "react-i18next"

const Component = () => {
  const { t } = useTranslation("interface")

  return (
    <div>
      <h1>{t("componentName.title")}</h1>
      <button>{t("button.save")}</button>
    </div>
  )
}
```

#### 翻译文件位置

- 中文：`src/assets/locales/zh_CN/interface.json`
- 英文：`src/assets/locales/en_US/interface.json`

#### 规范要求

- 禁止硬编码中文文本
- 翻译键使用嵌套结构组织
- 同时更新中英文语言包
- 复用现有的通用翻译键

详细规范请参考：`.cursor/rules/i18n-internationalization.mdc`

### 开发建议

1. 在开始开发前，请确保已经阅读完本文档
2. 遇到问题先查看项目文档和相关依赖的官方文档
3. 开发新功能时，建议先写好类型定义
4. 代码提交前进行自测，确保功能正常且测试用例通过
5. 新增用户可见文本时，必须同时添加中英文翻译
6. 新组件优先使用 shadcn/ui + Tailwind CSS，现有组件继续使用 antd-style
7. 提交代码前运行 `pnpm lint` 确保代码质量

### 项目结构

```
magic-web/
├── src/                    # 主应用代码（商业版）
│   ├── components/         # 组件（base、business）
│   ├── pages/              # 页面
│   ├── stores/             # MobX 状态管理
│   └── ...
├── packages/               # 内部包
│   └── logger/             # 日志包
├── server/                 # Express 服务器（SSR、API 代理）
└── ...
```

### 性能优化

项目集成了 Lighthouse 性能审计工具：

```bash
# 安装浏览器依赖（首次使用）
pnpm lh:install

# 运行性能审计
pnpm lh:audit

# 查看审计报告
pnpm lh:view
```

## Vscode 插件安装推荐

- i18n Ally
- Vitest, Vitest Runner
- Git Graph
