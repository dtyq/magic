# ButtonGroup 组件

## 简介

ButtonGroup 是一个常用的按钮组组件，用于展示"取消"和"保存"两个操作按钮，支持国际化。它基于 Ant Design 的 Flex 组件和自定义的 MagicButton 组件实现。

## 特性

- 简洁的按钮布局
- 支持国际化
- 响应式设计
- 性能优化
- 自定义按钮文本
- 灵活的按钮样式

## 使用方式

```tsx
import ButtonGroup from '@/components/business/ButtonGroup'

// 基本使用
<ButtonGroup
  onCancel={() => {
    console.log('取消操作')
  }}
  onSave={() => {
    console.log('保存操作')
  }}
/>

// 自定义按钮文本
<ButtonGroup
  okText="确认"
  cancelText="返回"
  onCancel={() => {}}
  onSave={() => {}}
/>
```

## Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| okText | `string` | `t("button.save")` | 确定按钮文本，默认使用国际化配置 |
| cancelText | `string` | `t("button.cancel")` | 取消按钮文本，默认使用国际化配置 |
| onCancel | `() => void` | - | 取消按钮点击回调 |
| onSave | `() => void` | - | 保存按钮点击回调 |

## 样式

- 按钮间距：10px
- 按钮组右对齐
- 取消按钮使用默认样式
- 保存按钮使用主色调样式
- 按钮组使用 Flex 布局
- 按钮文本支持自定义

## 依赖

- antd
- react-i18next
- react
- @/components/base/MagicButton

## 注意事项

1. 组件使用了 `memo` 进行性能优化
2. 按钮文本默认通过国际化配置获取，支持自定义覆盖
3. 按钮样式继承自 MagicButton 组件
4. 组件内部使用 Flex 布局确保按钮对齐
5. 确保在使用前正确配置国际化文件

## 国际化配置

需要在国际化文件中配置以下键值：

```json
{
  "button": {
    "save": "保存",
    "cancel": "取消"
  }
}
```

## UI图

![ButtonGroup 组件效果图](./button-group-demo.png)
