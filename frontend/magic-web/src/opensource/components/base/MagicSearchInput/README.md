# MagicSearchInput 魔法搜索输入框组件

`MagicSearchInput` 是一个基于 Ant Design Input.Search 组件的增强版搜索输入框，提供了更美观的样式和更好的用户体验。

## 属性

| 属性名         | 类型 | 默认值 | 说明                                    |
| -------------- | ---- | ------ | --------------------------------------- |
| ...SearchProps | -    | -      | 支持所有 Ant Design Input.Search 的属性 |

## 基础用法

```tsx
import { MagicSearchInput } from '@/components/base/MagicSearchInput';

// 基础用法
<MagicSearchInput placeholder="请输入搜索内容" />

// 带默认值
<MagicSearchInput defaultValue="默认搜索内容" />

// 监听搜索事件
<MagicSearchInput
  placeholder="输入后按回车搜索"
  onSearch={(value) => console.log('搜索内容:', value)}
/>

// 监听输入变化
<MagicSearchInput
  placeholder="输入时实时搜索"
  onChange={(e) => console.log('当前输入:', e.target.value)}
/>

// 禁用状态
<MagicSearchInput disabled placeholder="禁用状态" />

// 加载状态
<MagicSearchInput loading placeholder="加载中..." />

// 自定义样式
<MagicSearchInput
  placeholder="自定义样式"
  style={{ width: 300 }}
/>
```

## 特点

1. **优化的样式**：圆角更大，背景色更柔和，整体更美观
2. **内置搜索图标**：使用 MagicIcon 组件作为搜索图标，视觉效果更统一
3. **简洁设计**：隐藏了默认的搜索按钮，使用回车键触发搜索
4. **无边框聚焦**：聚焦时不显示边框和阴影，保持界面简洁

## 何时使用

-   需要在页面上添加搜索功能时
-   需要用户输入关键词进行筛选或查询时
-   需要一个美观的搜索输入框时
-   需要实时响应用户输入进行搜索时

MagicSearchInput 组件让你的搜索输入框更加美观和用户友好，同时保持了 Ant Design Input.Search 的所有功能特性。
