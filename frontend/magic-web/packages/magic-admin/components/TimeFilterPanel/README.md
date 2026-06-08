# TimeFilterPanel 组件

## 简介

`TimeFilterPanel` 是一个有状态时间筛选组件，提供紧凑触发器和弹层式面板，适合日志、监控、报表等需要高频切换时间范围的页面。

## 特性

- 支持相对时间、绝对时间、历史记录三种面板
- 内置快捷时间、标准范围、按月查询、自定义相对时间
- 支持“整点时间”对齐
- 使用 `localStorage` 持久化历史记录
- 组件级本地多语言，文案位于 `locales/index.ts`

## 使用方式

```tsx
import { TimeFilterPanel, type TimeRangeValue } from "@admin-components"

function Example() {
	return (
		<TimeFilterPanel
			onChange={(value: TimeRangeValue) => {
				console.log(value.startDate, value.endDate, value.label)
			}}
		/>
	)
}
```

## Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `defaultPresetKey` | `TimePresetKey` | 无 | 可选，传入时在挂载后自动应用对应预设 |
| `onChange` | `(value: TimeRangeValue) => void` | - | 时间范围变更回调 |

## 输出结构

```ts
interface TimeRangeValue {
	startDate: string
	endDate: string
	label: string
	tab: "relative" | "absolute" | "history"
	mode: "relative" | "absolute" | "monthly" | "custom"
}
```

## 多语言

- 组件通过 `useAdminComponents().getLocale("TimeFilterPanel")` 读取文案
- 本地文案统一维护在 `TimeFilterPanel/locales/index.ts`
- 全局组件语言聚合在 `components/locales/index.ts` 注册

## 测试

- `utils.test.ts`：覆盖时间范围计算、整点对齐、历史记录读写
- `locales.test.ts`：覆盖组件 locale 注册
