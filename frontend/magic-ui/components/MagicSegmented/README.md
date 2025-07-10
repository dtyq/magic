# MagicSegmented 组件

MagicSegmented 是一个基于 Ant Design Segmented 的增强分段控制器组件，提供了更美观的样式和交互效果。

## 功能特性

-   **圆角设计**：默认提供圆形边角样式，更现代美观
-   **自定义样式**：适配暗色模式，提供统一的视觉体验
-   **简单易用**：保持与 Ant Design Segmented 相同的 API
-   **完全兼容**：支持所有 Ant Design Segmented 的属性和功能

## 安装

```bash
# 已包含在 @dtyq/magic-ui 中，无需单独安装
```

## 基本用法

```tsx
import { MagicSegmented } from "@dtyq/magic-ui"

const App = () => {
	return <MagicSegmented options={["每日", "每周", "每月"]} defaultValue="每日" />
}
```

## 处理选项变化

```tsx
import { MagicSegmented } from "@dtyq/magic-ui"
import { useState } from "react"

const App = () => {
	const [value, setValue] = useState("每日")

	const handleChange = (newValue) => {
		setValue(newValue)
		console.log("当前选中:", newValue)
	}

	return (
		<MagicSegmented options={["每日", "每周", "每月"]} value={value} onChange={handleChange} />
	)
}
```

## 对象类型选项

```tsx
import { MagicSegmented } from "@dtyq/magic-ui"

const App = () => {
	return (
		<MagicSegmented
			options={[
				{ label: "选项一", value: "option1" },
				{ label: "选项二", value: "option2" },
				{ label: "选项三", value: "option3" },
			]}
			defaultValue="option1"
		/>
	)
}
```

## 带图标的选项

```tsx
import { MagicSegmented } from "@dtyq/magic-ui"
import { AppstoreOutlined, BarsOutlined } from "@ant-design/icons"

const App = () => {
	return (
		<MagicSegmented
			options={[
				{
					value: "list",
					icon: <BarsOutlined />,
					label: "列表",
				},
				{
					value: "grid",
					icon: <AppstoreOutlined />,
					label: "网格",
				},
			]}
		/>
	)
}
```

## 非圆角设计

```tsx
import { MagicSegmented } from "@dtyq/magic-ui"

const App = () => {
	return <MagicSegmented options={["选项一", "选项二", "选项三"]} circle={false} />
}
```

## 禁用状态

```tsx
import { MagicSegmented } from "@dtyq/magic-ui"

const App = () => {
	return <MagicSegmented options={["选项一", "选项二", "选项三"]} disabled={true} />
}
```

## 属性说明

MagicSegmented 组件继承了 Ant Design Segmented 组件的所有属性，并添加了以下属性：

| 属性名称 | 类型    | 默认值 | 描述             |
| -------- | ------- | ------ | ---------------- |
| circle   | boolean | true   | 是否使用圆角设计 |

继承的主要属性包括：

| 属性名称     | 类型                                                                                                               | 默认值   | 描述                      |
| ------------ | ------------------------------------------------------------------------------------------------------------------ | -------- | ------------------------- |
| options      | string[] \| number[] \| Array<{ label: ReactNode; value: string \| number; icon?: ReactNode; disabled?: boolean }> | []       | 配置每一个 Segmented Item |
| defaultValue | string \| number                                                                                                   | -        | 默认选中的值              |
| value        | string \| number                                                                                                   | -        | 当前选中的值              |
| onChange     | (value: string \| number) => void                                                                                  | -        | 选项变化时的回调函数      |
| disabled     | boolean                                                                                                            | false    | 是否禁用                  |
| block        | boolean                                                                                                            | false    | 将宽度调整为父元素宽度    |
| size         | 'large' \| 'middle' \| 'small'                                                                                     | 'middle' | 控件大小                  |

更多属性请参考 [Ant Design Segmented 文档](https://ant.design/components/segmented-cn/)。

## 注意事项

1. MagicSegmented 默认使用圆角设计，可以通过 `circle` 属性设置为方角
2. 该组件在暗黑模式下有特殊的样式优化，无需额外配置
3. 当需要与其他组件配合使用时，推荐使用对象类型的选项，便于管理状态
