# 宿主项目迁移指南

[English](./migration-guide.md) | 中文

## 概述

本文档说明如何将宿主项目迁移到新版 `@dtyq/user-selector` 组件库，并给出推荐的配置方式与兼容注意事项。

## 前置要求

### 1. 安装依赖

在宿主项目中安装样式相关依赖：

```bash
pnpm add tailwindcss postcss autoprefixer
```

### 2. 配置 Tailwind CSS

创建或更新 `tailwind.config.js`：

```js
/** @type {import('tailwindcss').Config} */
export default {
	content: [
		"./index.html",
		"./src/**/*.{js,ts,jsx,tsx}",
		"./node_modules/@dtyq/user-selector/**/*.{js,ts,jsx,tsx}",
	],
	theme: {
		extend: {
			colors: {
				background: "hsl(var(--us-background))",
				foreground: "hsl(var(--us-foreground))",
				primary: {
					DEFAULT: "hsl(var(--us-primary))",
					foreground: "hsl(var(--us-primary-foreground))",
				},
			},
		},
	},
	plugins: [],
}
```

### 3. 配置 PostCSS

创建或更新 `postcss.config.js`：

```js
export default {
	plugins: {
		tailwindcss: {},
		autoprefixer: {},
	},
}
```

### 4. 导入组件库样式

在入口文件中导入：

```tsx
// main.tsx 或 App.tsx
import "@dtyq/user-selector"
import "@dtyq/user-selector/style.css"
```

## 主题变量接入

### 方式一：使用默认变量（推荐）

组件库内置默认变量，基础场景无需额外配置即可正常显示。

### 方式二：覆盖变量

在全局样式中覆盖 CSS 变量：

```css
/* globals.css 或 main.css */
:root {
	--us-primary: 220 90% 56%;
	--us-radius: 0.25rem;
	--us-background: 0 0% 100%;
	--us-foreground: 222.2 84% 4.9%;
}

.dark {
	--us-primary: 217.2 91.2% 59.8%;
	--us-background: 222.2 84% 4.9%;
	--us-foreground: 210 40% 98%;
}
```

### 方式三：在 Tailwind 中映射变量

在 `tailwind.config.js` 扩展主题：

```js
export default {
	theme: {
		extend: {
			colors: {
				background: "hsl(var(--us-background))",
				foreground: "hsl(var(--us-foreground))",
				primary: {
					DEFAULT: "hsl(var(--us-primary))",
					foreground: "hsl(var(--us-primary-foreground))",
				},
			},
			borderRadius: {
				lg: "var(--us-radius)",
				md: "calc(var(--us-radius) - 2px)",
				sm: "calc(var(--us-radius) - 4px)",
			},
		},
	},
}
```

## Toast 配置

如果使用 `message.success()` 等提示 API，需要在应用根节点挂载 `<Toaster />`：

```tsx
import { Toaster } from "@dtyq/user-selector"

function App() {
	return (
		<>
			{/* 应用内容 */}
			<Toaster />
		</>
	)
}
```

## API 变更说明

### 完全兼容

以下能力保持兼容，无需改动：

- 组件 props
- ref 接口
- 类型定义
- 事件回调

### 迁移注意点

#### 1. Modal -> Dialog

`UserSelector` 内部从 antd `Modal` 迁移到 shadcn/ui `Dialog`，对外 API 保持兼容。

```tsx
// 旧写法（仍支持）
<UserSelector open={open} onCancel={onClose} />

// 推荐写法
<UserSelector open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()} />
```

#### 2. message API

`message` 调用方式不变，但必须有 `<Toaster />`：

```tsx
import { message } from "@dtyq/user-selector"

message.success("操作成功")
message.error("操作失败")
```

#### 3. 样式选择器

如果你覆盖过旧结构的样式选择器，需要迁移到 Radix 结构：

```css
/* 旧选择器 */
.user-selector .ant-checkbox {
	/* ... */
}

/* 新选择器 */
.user-selector [data-radix-checkbox] {
	/* ... */
}
```

## 完整示例

### 1. 基础用法

```tsx
import { AppearanceProvider, Toaster, UserSelector } from "@dtyq/user-selector"
import { useState } from "react"

function App() {
	const [open, setOpen] = useState(false)
	const [selectedValues, setSelectedValues] = useState<string[]>([])

	return (
		<AppearanceProvider language="zh_CN" theme="light">
			<Toaster />
			<UserSelector
				open={open}
				onCancel={() => setOpen(false)}
				data={data}
				selectedValues={selectedValues}
				onSelectChange={setSelectedValues}
			/>
		</AppearanceProvider>
	)
}
```

### 2. 自定义样式

```css
/* globals.css */
:root {
	--us-primary: 220 90% 56%;
	--us-radius: 0.5rem;
}
```

### 3. 暗色模式

```tsx
<AppearanceProvider theme="dark">
	<UserSelector />
</AppearanceProvider>
```

暗色变量会自动生效。

## 故障排查

### 样式不生效

1. 确认已导入 `@dtyq/user-selector/style.css`。
2. 确认 Tailwind 的 `content` 已包含组件库路径。
3. 确认 CSS 变量加载顺序正确且未被意外覆盖。

### Toast 不显示

1. 确认已挂载 `<Toaster />`。
2. 确认其位置靠近应用根节点。

### 类型报错

1. 确认 TypeScript 版本 `>= 5.0`。
2. 确认依赖安装完整。

## 参考

- [Tailwind CSS 文档](https://tailwindcss.com/docs)
- [shadcn/ui 文档](https://ui.shadcn.com/)
- [变量参考（English）](./variables.md)
- [变量参考（中文）](./variables.zh.md)
