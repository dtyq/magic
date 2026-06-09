# StatusTag 组件

## 简介

StatusTag 是一个基于 Ant Design Tag 组件封装的状态标签组件。它提供了多种预设的状态样式，包括成功、错误、警告、处理中和默认状态，适用于展示各种状态信息。

## 特性

- 支持多种状态样式
- 自定义样式支持
- 性能优化
- 响应式设计
- 继承 Ant Design Tag 的所有功能

## 使用方式

```tsx
import StatusTag from '@/components/business/StatusTag'

// 基本使用
<StatusTag color="success">成功</StatusTag>
<StatusTag color="error">错误</StatusTag>
<StatusTag color="warning">警告</StatusTag>
<StatusTag color="processing">处理中</StatusTag>
<StatusTag color="default">默认</StatusTag>

// 自定义样式
<StatusTag color="success" className="custom-class">
  自定义样式
</StatusTag>
```

## Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| color | `'success' \| 'error' \| 'warning' \| 'processing' \| 'default'` | - | 标签颜色类型 |
| className | `string` | - | 自定义类名 |
| ...其他属性 | `TagProps` | - | 继承自 Ant Design Tag 组件的属性 |

## 样式

### 预设样式
- 成功状态：
  - 文字颜色：`token.magicColorUsages.success.default`
  - 背景色：`token.magicColorUsages.successLight.default`
- 错误状态：
  - 文字颜色：`token.magicColorUsages.danger.default`
  - 背景色：`token.magicColorUsages.dangerLight.default`
- 警告状态：
  - 文字颜色：`token.magicColorUsages.warning.default`
  - 背景色：`token.magicColorUsages.warningLight.default`
- 处理中状态：
  - 文字颜色：`token.magicColorUsages.primary.default`
  - 背景色：`token.magicColorUsages.primaryLight.default`
- 默认状态：
  - 文字颜色：`token.magicColorUsages.tertiary.default`
  - 背景色：`token.magicColorUsages.tertiaryLight.default`

## 依赖

- antd
- antd-style
- react

## 注意事项

1. 组件使用了 `memo` 进行性能优化
2. 样式基于 Ant Design 的主题系统
3. 支持自定义类名覆盖默认样式
4. 所有状态样式都使用主题色系统

## UI图

![StatusTag 组件效果图](./status-tag-demo.png)
