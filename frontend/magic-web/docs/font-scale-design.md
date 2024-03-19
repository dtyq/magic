# 前端字体大小自适应方案

## 概述

本方案提供了一套基于缩放比例的字体自适应系统，**只在移动端生效**。系统会根据设备屏幕宽度自动计算缩放比例，并允许用户手动调整。所有字体大小都通过统一的配置管理，确保在不同设备上的一致性体验。

### 核心特性

- 🎯 **移动端专属**：仅在小屏幕设备（`isSmallViewport()`）上启用
- 📐 **自动缩放**：默认根据屏幕宽度（基准 375px）计算缩放比例（0.8 ~ 1.2）
- 🎨 **多种集成方式**：支持 antd-style、内联样式、CSS 变量三种使用方式
- 🔧 **可配置**：通过 JSON 配置文件统一管理字体大小规范

## 核心逻辑

整个系统分为三层架构：

- **UI 层**: `src/pages/settings/features/FontSizeChanger/index.tsx` - 提供可视化的字体缩放大小调节界面
- **注入层**: `src/opensource/providers/ThemeProvider/Theme.provider.tsx` - 将字体配置注入到主题系统中
- **逻辑层**: `src/opensource/providers/ThemeProvider/font.ts` - 定义字体缩放的核心计算逻辑

### 工作流程

```
用户配置 fontScale
    ↓
ThemeProvider 监听 fontScale 变化
    ↓
调用 genFontUsages(fontScale) 生成字体配置
    ↓
注入到 antd-style token 系统
    ↓
组件通过多种方式使用字体配置
```

## 怎么使用

### 1. antd-style (推荐)

在使用 `createStyles` 的组件中，通过 `token.magicFontUsages` 访问字体配置：

```typescript
import { createStyles } from "antd-style"

const useStyles = createStyles(({ token }) => ({
  title: {
    fontSize: token.magicFontUsages.response.text16px,
    fontWeight: 600,
  },
  content: {
    fontSize: token.magicFontUsages.response.text14px,
    lineHeight: 1.5,
  },
  smallText: {
    fontSize: token.magicFontUsages.response.text12px,
    color: token.colorTextSecondary,
  },
}))

function MyComponent() {
  const { styles } = useStyles()
  
  return (
    <div>
      <h1 className={styles.title}>标题</h1>
      <p className={styles.content}>内容</p>
      <span className={styles.smallText}>备注</span>
    </div>
  )
}
```

**可用的字体大小配置**：
- `text10px`、`text12px`、`text14px`、`text16px`、`text18px`
- `text20px`、`text24px`、`text28px`、`text32px`、`text40px`

### 2. 内联样式

当需要动态计算或在内联样式中使用时，可以通过 `useFontScale()` hook 获取当前缩放比例(尽量少用，会带来额外的计算)：

```typescript
import { useFontScale } from "@/opensource/models/config/hooks"

function MyComponent() {
  const { fontScale } = useFontScale()
  
  return (
    <div 
      style={{ 
        fontSize: `${14 * fontScale}px`,
        padding: `${8 * fontScale}px`,
      }}
    >
      动态缩放的文本
    </div>
  )
}
```

**适用场景**：
- 需要动态计算字体大小
- 第三方组件不支持 antd-style
- 需要根据 fontScale 调整其他样式（如间距、尺寸等）

### 3. 第三方包/CSS 变量

对于不支持 React 上下文的第三方库或需要在 CSS 中使用的场景，系统会自动将缩放比例挂载到 document 的 CSS 变量上：

```typescript
// 方式 A: 在 React 组件中获取
import { useFontScale } from "@/opensource/models/config/hooks"

function MyComponent() {
  const { fontScale } = useFontScale()
  
  // 传递给第三方组件
  return <ThirdPartyComponent fontSize={14 * fontScale} />
}
```

```css
/* 方式 B: 在纯 CSS 中使用 */
.my-element {
  /* CSS 变量名: --scale-radio */
  font-size: calc(14px * var(--scale-radio, 1));
  padding: calc(8px * var(--scale-radio, 1));
}
```

**注意事项**：
- CSS 变量 `--scale-radio` 仅在移动端（`isSmallViewport()`）时设置
- 在桌面端该变量可能不存在，建议提供默认值（如 `var(--scale-radio, 1)`）

## 怎么扩展

### 添加新的字体大小规格

1. **修改配置文件**：编辑 `src/opensource/providers/ThemeProvider/fontSchema.json`

```json
{
  "response": {
    "text10px": "10px",
    "text12px": "12px",
    // ... 现有配置
    "text48px": "48px"  // 新增大标题
  }
}
```

2. **更新类型定义**：在 `src/opensource/providers/ThemeProvider/types.ts` 中添加对应类型

```typescript
export interface FontUsages {
  response: {
    text10px: string
    text12px: string
    // ... 现有类型
    text48px: string  // 新增类型
  }
}
```

3. **使用新配置**：在组件中直接使用

```typescript
const useStyles = createStyles(({ token }) => ({
  heroTitle: {
    fontSize: token.magicFontUsages.response.text48px,
  },
}))
```

### 调整缩放范围

如需修改默认缩放比例的范围，可编辑 `src/opensource/providers/ThemeProvider/font.ts`：

```typescript
export const DefaultFontScale = (() => {
  const min = 0.8  // 最小缩放：修改此值调整最小字体
  const max = 1.2  // 最大缩放：修改此值调整最大字体
  const value = window.innerWidth / 375  // 基准宽度：可调整为其他值
  
  return Math.round(Math.min(Math.max(value, min), max) * 100) / 100
})()
```

## 参考文件

- `src/opensource/providers/ThemeProvider/fontSchema.json`: 字体大小配置表
- `src/opensource/providers/ThemeProvider/types.ts`: TypeScript 类型定义
- `src/opensource/providers/ThemeProvider/font.ts`: 字体缩放逻辑
- `src/opensource/models/config/hooks/index.ts`: `useFontScale` hook 实现
