# VerticalLine 垂直分隔线

一个简单的 SVG 垂直分隔线组件，宽度固定为 1px，支持自定义高度和颜色。

## 功能特点

- 📏 **灵活高度**：支持数字（px）或任意 CSS 单位的字符串
- 🎨 **自定义颜色**：支持任何 CSS 颜色值或使用 `currentColor` 继承父元素颜色
- 💎 **轻量级**：使用原生 SVG，无额外依赖
- 🔧 **TypeScript**：完整的类型定义
- 🎯 **灵活定位**：使用 `flexShrink: 0` 防止在 flex 布局中被压缩

## 基础用法

```tsx
import VerticalLine from "@/opensource/components/base/VerticalLine"

// 默认高度 24px
<VerticalLine />

// 自定义高度（数字会被转换为 px）
<VerticalLine height={32} />

// 使用百分比高度
<VerticalLine height="100%" />

// 自定义颜色
<VerticalLine height={24} color="#666666" />

// 使用 currentColor 继承父元素颜色
<div className="text-muted-foreground">
  <VerticalLine height={24} />
</div>

// 配合 Tailwind CSS
<VerticalLine height={24} className="text-border" />

// 设置透明度
<VerticalLine height={24} opacity={0.5} />
```

## 在 Flex 布局中使用

```tsx
<div className="flex items-center gap-2">
  <span>左侧内容</span>
  <VerticalLine height={20} className="text-muted-foreground" />
  <span>右侧内容</span>
</div>
```

## API

### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| height | 高度，数字会被转换为 px | `number \| string` | `24` |
| color | 颜色值 | `string` | `"currentColor"` |
| className | 额外的类名 | `string` | `""` |
| opacity | 不透明度 | `number` | `1` |

## 最佳实践

### 与 Tailwind 配合

推荐使用 `className` 配合 Tailwind 的颜色类来控制颜色：

```tsx
// 使用 border 颜色
<VerticalLine height={24} className="text-border" />

// 使用 muted-foreground 颜色
<VerticalLine height={24} className="text-muted-foreground" />

// 使用主题色
<VerticalLine height={24} className="text-primary" />
```

### 在导航栏中

```tsx
<div className="flex items-center h-[40px]">
  <Button>按钮1</Button>
  <VerticalLine height={20} className="mx-2 text-border" />
  <Button>按钮2</Button>
</div>
```

### 在卡片头部

```tsx
<div className="flex items-center h-[32px]">
  <Avatar />
  <VerticalLine height={24} className="mx-3 text-muted-foreground" />
  <span className="text-sm">用户名</span>
</div>
```
