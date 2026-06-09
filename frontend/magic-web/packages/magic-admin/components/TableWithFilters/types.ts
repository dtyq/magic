import type { RadioGroupProps, RadioProps, TreeSelectProps } from "antd"
import type { MagicDatePickerProps, MagicDatePickerRangePickerProps } from "../MagicDatePicker"
import type { MagicDropdownButtonProps } from "../MagicDropdown"
import type { MagicInputProps } from "../MagicInput"
import type { MagicSelectProps } from "../MagicSelect"
import type { MagicButtonProps } from "../MagicButton"
import type { TimeFilterPanelProps } from "../TimeFilterPanel"

export type WithType<D, T> = D & {
	type: T
	field?: string
}

export enum SearchItemType {
	TEXT = "text",
	SELECT = "select",
	TREE_SELECT = "treeSelect",
	DATE_RANGE = "dateRange",
	DATE = "date",
	RADIO = "radio",
	RADIO_GROUP = "radioGroup",
	TIME_FILTER_PANEL = "timeFilterPanel",
}

/* 文本搜索 */
export type TextSearchItem = WithType<MagicInputProps, SearchItemType.TEXT>

/* 选择搜索 */
export type SelectSearchItem = WithType<MagicSelectProps, SearchItemType.SELECT>

/* 树选择搜索 */
export type TreeSelectSearchItem = WithType<TreeSelectProps, SearchItemType.TREE_SELECT>

/* 日期范围搜索 */
export type DateRangeSearchItem = WithType<
	MagicDatePickerRangePickerProps,
	SearchItemType.DATE_RANGE
>

/* 日期搜索 */
export type DateSearchItem = WithType<MagicDatePickerProps, SearchItemType.DATE>

/* 单选搜索 */
export type RadioSearchItem = WithType<RadioProps, SearchItemType.RADIO>

/* 单选组搜索 */
export type RadioGroupSearchItem = WithType<RadioGroupProps, SearchItemType.RADIO_GROUP>

/* 时间筛选面板搜索 */
export type TimeFilterPanelSearchItem = WithType<
	TimeFilterPanelProps,
	SearchItemType.TIME_FILTER_PANEL
>
export type CustomSearchItem = WithType<
	{
		component: React.ComponentType<any>
		props?: Record<string, any>
	},
	string
>

// 搜索组件类型定义
export type SearchItem =
	| TextSearchItem
	| SelectSearchItem
	| DateRangeSearchItem
	| DateSearchItem
	| RadioSearchItem
	| RadioGroupSearchItem
	| TimeFilterPanelSearchItem
	| CustomSearchItem
	| TreeSelectSearchItem

/* 按钮类型 */
export enum ButtonType {
	/* 普通按钮 */
	NORMAL = "normal",
	/* 下拉按钮 */
	DROPDOWN = "dropdown",
}

/* 普通按钮 */
export type NormalButton = MagicButtonProps & {
	text?: string
	description?: string
	buttonType?: ButtonType.NORMAL
}

/* 下拉按钮 */
export type DropdownButton = MagicDropdownButtonProps & {
	text?: string
	description?: string
	buttonType: ButtonType.DROPDOWN
}

/* 表格按钮 */
export type TableButton = NormalButton | DropdownButton
