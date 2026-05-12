import {
	ArrowRightFromLine,
	CaseLower,
	CaseSensitive,
	CaseUpper,
	List,
	ListOrdered,
	Minus,
	Strikethrough,
	Underline,
} from "lucide-react"
import { TextAutoHeight } from "../../../ui/icons"

export const RICH_TEXT_DECORATION_OPTIONS = [
	{
		value: "none",
		icon: Minus,
		label: "无",
	},
	{
		value: "underline",
		icon: Underline,
		label: "下划线",
	},
	{
		value: "strikethrough",
		icon: Strikethrough,
		label: "中划线",
	},
] as const

export const RICH_TEXT_LIST_OPTIONS = [
	{
		value: "none",
		icon: Minus,
		label: "无",
	},
	{
		value: "bullet",
		icon: List,
		label: "无序列表",
	},
	{
		value: "ordered",
		icon: ListOrdered,
		label: "有序列表",
	},
] as const

export const RICH_TEXT_CASE_OPTIONS = [
	{
		value: "none",
		icon: Minus,
		label: "无",
	},
	{
		value: "sensitive",
		icon: CaseSensitive,
		label: "大小写敏感",
	},
	{
		value: "upper",
		icon: CaseUpper,
		label: "大写",
	},
	{
		value: "lower",
		icon: CaseLower,
		label: "小写",
	},
] as const

export const RICH_TEXT_WIDTH_OPTIONS = [
	{
		value: "fixed",
		icon: ArrowRightFromLine,
		label: "固定宽度",
	},
	{
		value: "auto",
		icon: TextAutoHeight,
		label: "自动宽度",
	},
] as const
