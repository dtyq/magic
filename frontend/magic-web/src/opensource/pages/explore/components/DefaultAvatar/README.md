# DefaultAvatar 组件

## 概述

`DefaultAvatar` 是一个用于显示不同流程类型默认头像的公共组件，从 `PromptCard` 组件中抽离出来，提供了统一的默认头像显示逻辑。

## 功能特性

- 支持多种流程类型的默认头像
- 可自定义尺寸和样式
- 基于 `FlowRouteType` 自动选择对应的头像
- 支持所有标准的 `img` 元素属性

## 支持的流程类型

| 类型 | 对应头像 |
|------|----------|
| `FlowRouteType.Sub` | 子流程头像 |
| `FlowRouteType.Tools` | 工具集头像 |
| `FlowRouteType.VectorKnowledge` | 知识库头像 |
| `FlowRouteType.Mcp` | MCP 头像 |
| 默认 | Agent 头像 |

## 使用方法

### 基础用法

```tsx
import { DefaultAvatar } from "@/opensource/pages/explore/components"
import { FlowRouteType } from "@/types/flow"

function MyComponent() {
  return (
    <DefaultAvatar 
      type={FlowRouteType.Tools} 
      size={50} 
    />
  )
}
```

### 自定义样式

```tsx
import { DefaultAvatar } from "@/opensource/pages/explore/components"
import { FlowRouteType } from "@/types/flow"

function MyComponent() {
  return (
    <DefaultAvatar 
      type={FlowRouteType.VectorKnowledge}
      size={60}
      className="custom-avatar"
      style={{ borderRadius: 12 }}
    />
  )
}
```

### 在列表中使用

```tsx
import { DefaultAvatar } from "@/opensource/pages/explore/components"
import { FlowRouteType } from "@/types/flow"

const flowTypes = [
  FlowRouteType.Sub,
  FlowRouteType.Tools,
  FlowRouteType.VectorKnowledge,
  FlowRouteType.Mcp
]

function FlowTypeList() {
  return (
    <div>
      {flowTypes.map(type => (
        <DefaultAvatar 
          key={type}
          type={type} 
          size={40}
        />
      ))}
    </div>
  )
}
```

## API

### Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `type` | `FlowRouteType` | - | 流程类型，决定显示哪个默认头像 |
| `size` | `number` | `50` | 头像尺寸（像素） |
| `className` | `string` | - | 自定义 CSS 类名 |
| `...props` | `ImgHTMLAttributes` | - | 其他 img 元素属性 |

### 类型定义

```typescript
interface DefaultAvatarProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'> {
  type?: FlowRouteType
  className?: string
  size?: number
}
```

## 样式

组件使用 `antd-style` 创建样式，支持：

- 响应式尺寸
- 圆角边框（8px）
- 对象适配（cover）
- 防止收缩

## 注意事项

1. 组件会自动处理 `alt` 属性，无需手动设置
2. `src` 属性由组件内部根据 `type` 自动确定
3. 如果不传入 `type` 或传入未知类型，将显示默认的 Agent 头像
4. 组件已使用 `memo` 优化，避免不必要的重渲染

## 迁移指南

如果你之前在其他组件中有类似的默认头像逻辑，可以按以下步骤迁移：

1. 移除原有的头像导入和 switch 逻辑
2. 导入 `DefaultAvatar` 组件
3. 替换原有的头像渲染逻辑

### 迁移前

```tsx
import defaultFlowAvatar from "@/opensource/assets/logos/flow-avatar.png"
import defaultToolAvatar from "@/opensource/assets/logos/tool-avatar.png"
// ... 其他导入

const defaultAvatar = useMemo(() => {
  switch (type) {
    case FlowRouteType.Sub:
      return <img src={defaultFlowAvatar} className={styles.defaultAvatar} alt="" />
    // ... 其他 case
  }
}, [type, styles])
```

### 迁移后

```tsx
import { DefaultAvatar } from "@/opensource/pages/explore/components"

// 直接使用
<DefaultAvatar type={type} className={styles.defaultAvatar} size={50} />
``` 