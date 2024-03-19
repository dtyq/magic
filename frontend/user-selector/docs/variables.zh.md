# Tailwind CSS 变量参考手册

[English](./variables.md) | 中文

## 概述

本文档列出 User Selector 组件库使用的全部 CSS 变量。所有变量统一使用 `us-` 前缀（user-selector），用于避免与宿主项目变量冲突。

## 命名规范

- 全部变量使用 `us-` 前缀。
- 颜色值统一采用 HSL（更易与 Tailwind 体系集成）。
- 暗色模式可通过 `data-theme="dark"` 或 `.dark` 作用域启用（按宿主项目方案选择）。

## 颜色变量

### 背景色

| 变量名            | 默认值（亮色）   | 默认值（暗色）   | 用途       |
| ----------------- | ---------------- | ---------------- | ---------- |
| `--us-background` | `0 0% 100%`      | `222.2 84% 4.9%` | 主背景色   |
| `--us-foreground` | `222.2 84% 4.9%` | `210 40% 98%`    | 主文字色   |

### 主色类名示例

| 变量名                    | 默认值（亮色）      | 默认值（暗色）      | 用途         |
| ------------------------- | ------------------- | ------------------- | ------------ |
| `--us-primary`            | `221.2 83.2% 53.3%` | `217.2 91.2% 59.8%` | 品牌主色     |
| `--us-primary-foreground` | `210 40% 98%`       | `222.2 47.4% 11.2%` | 主色前景文字 |

### 次要色

| 变量名                      | 默认值（亮色）      | 默认值（暗色）      | 用途       |
| --------------------------- | ------------------- | ------------------- | ---------- |
| `--us-secondary`            | `210 40% 96.1%`     | `217.2 32.6% 17.5%` | 次级背景色 |
| `--us-secondary-foreground` | `222.2 47.4% 11.2%` | `210 40% 98%`       | 次级文字色 |

### 危险色

| 变量名                        | 默认值（亮色）  | 默认值（暗色）  | 用途                         |
| ----------------------------- | --------------- | --------------- | ---------------------------- |
| `--us-destructive`            | `0 84.2% 60.2%` | `0 62.8% 30.6%` | 危险操作（删除、告警等）     |
| `--us-destructive-foreground` | `210 40% 98%`   | `210 40% 98%`   | 危险色前景文字               |

### 静音色

| 变量名                  | 默认值（亮色）      | 默认值（暗色）      | 用途               |
| ----------------------- | ------------------- | ------------------- | ------------------ |
| `--us-muted`            | `210 40% 96.1%`     | `217.2 32.6% 17.5%` | 弱化背景           |
| `--us-muted-foreground` | `215.4 16.3% 46.9%` | `215 20.2% 65.1%`   | 辅助/次要文字      |

### 强调色

| 变量名                   | 默认值（亮色）      | 默认值（暗色）      | 用途                     |
| ------------------------ | ------------------- | ------------------- | ------------------------ |
| `--us-accent`            | `210 40% 96.1%`     | `217.2 32.6% 17.5%` | 强调背景（hover 等）     |
| `--us-accent-foreground` | `222.2 47.4% 11.2%` | `210 40% 98%`       | 强调色前景文字           |

### 边框与输入框

| 变量名        | 默认值（亮色）      | 默认值（暗色）      | 用途           |
| ------------- | ------------------- | ------------------- | -------------- |
| `--us-border` | `214.3 31.8% 91.4%` | `217.2 32.6% 17.5%` | 边框颜色       |
| `--us-input`  | `214.3 31.8% 91.4%` | `217.2 32.6% 17.5%` | 输入框边框颜色 |
| `--us-ring`   | `221.2 83.2% 53.3%` | `224.3 76.3% 48%`   | 焦点环颜色     |

## 尺寸变量

### 圆角类名示例

| 变量名        | 默认值   | 用途         |
| ------------- | -------- | ------------ |
| `--us-radius` | `0.5rem` | 基础圆角大小 |

对应 Tailwind 半径变体：

- `rounded-lg` = `var(--us-radius)`
- `rounded-md` = `calc(var(--us-radius) - 2px)`
- `rounded-sm` = `calc(var(--us-radius) - 4px)`

## 在宿主项目中使用

### 方式一：覆盖变量（推荐）

```css
/* globals.css */
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

### 方式二：扩展 Tailwind 主题

```js
export default {
	theme: {
		extend: {
			colors: {
				background: "hsl(var(--us-background))",
				foreground: "hsl(var(--us-foreground))",
			},
		},
	},
}
```

### 方式三：直接使用 CSS 变量

```css
.custom-button {
	background-color: hsl(var(--us-primary));
	color: hsl(var(--us-primary-foreground));
	border-radius: var(--us-radius);
}
```

## 旧变量到新变量映射

迁移期内保留以下映射关系以保证兼容：

| 旧变量           | 新变量                          | 说明       |
| ---------------- | ------------------------------- | ---------- |
| `--bg`           | `--us-background`               | 背景色     |
| `--border-color` | `--us-border`                   | 边框色     |
| `--text-color-0` | `--us-foreground`               | 主文字色   |
| `--text-color-1` | `--us-foreground` (80% opacity) | 次级文字色 |
| `--text-color-2` | `--us-muted-foreground`         | 辅助文字色 |
| `--text-color-3` | `--us-muted`                    | 禁用文字色 |
| `--brand`        | `--us-primary`                  | 品牌主色   |
| `--primary`      | `--us-primary-foreground`       | 主色前景   |
| `--danger`       | `--us-destructive`              | 危险色     |
| `--fill`         | `--us-accent`                   | 填充/强调色 |

迁移完成后旧变量会移除，建议新代码只使用 `--us-*` 变量。

## Tailwind 类名映射示例

### 背景与文字

```tsx
<div className="bg-background text-foreground">内容</div>
```

### 主色

```tsx
<button className="bg-primary text-primary-foreground">按钮</button>
```

### 边框

```tsx
<div className="border border-border">内容</div>
```

### 圆角

```tsx
<div className="rounded-lg">{/* var(--us-radius) */}</div>
<div className="rounded-md">{/* calc(var(--us-radius) - 2px) */}</div>
<div className="rounded-sm">{/* calc(var(--us-radius) - 4px) */}</div>
```

## 完整变量清单

### 亮色模式

```css
:root {
	--us-background: 0 0% 100%;
	--us-foreground: 222.2 84% 4.9%;
	--us-primary: 221.2 83.2% 53.3%;
	--us-primary-foreground: 210 40% 98%;
	--us-secondary: 210 40% 96.1%;
	--us-secondary-foreground: 222.2 47.4% 11.2%;
	--us-destructive: 0 84.2% 60.2%;
	--us-destructive-foreground: 210 40% 98%;
	--us-muted: 210 40% 96.1%;
	--us-muted-foreground: 215.4 16.3% 46.9%;
	--us-accent: 210 40% 96.1%;
	--us-accent-foreground: 222.2 47.4% 11.2%;
	--us-border: 214.3 31.8% 91.4%;
	--us-input: 214.3 31.8% 91.4%;
	--us-ring: 221.2 83.2% 53.3%;
	--us-radius: 0.5rem;
}
```

### 暗色模式

```css
[data-theme="dark"] {
	--us-background: 222.2 84% 4.9%;
	--us-foreground: 210 40% 98%;
	--us-primary: 217.2 91.2% 59.8%;
	--us-primary-foreground: 222.2 47.4% 11.2%;
	--us-secondary: 217.2 32.6% 17.5%;
	--us-secondary-foreground: 210 40% 98%;
	--us-destructive: 0 62.8% 30.6%;
	--us-destructive-foreground: 210 40% 98%;
	--us-muted: 217.2 32.6% 17.5%;
	--us-muted-foreground: 215 20.2% 65.1%;
	--us-accent: 217.2 32.6% 17.5%;
	--us-accent-foreground: 210 40% 98%;
	--us-border: 217.2 32.6% 17.5%;
	--us-input: 217.2 32.6% 17.5%;
	--us-ring: 224.3 76.3% 48%;
	--us-radius: 0.5rem;
}
```

## 参考资料

- [Tailwind CSS 自定义属性](https://tailwindcss.com/docs/customizing-colors#using-css-variables)
- [shadcn/ui 主题系统](https://ui.shadcn.com/docs/theming)
- [HSL 颜色格式](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/hsl)
