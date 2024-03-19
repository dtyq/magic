import { defaultExpressionValue } from "@/MagicExpressionWidget/constant"
import i18next from "i18next"
import { Expression } from "./types/expression"

export const ConditionKey = "condition"

export const RightOperandsKey = "right_operands"

export const posSeparator = "-"

// 条件编辑组件的条件映射
export const enum RELATION_LOGICS_MAP {
	AND = "AND",
	OR = "OR",
}

// 条件编辑组件单个项组件类型
export const enum RELATION_COMP_TYPE {
	COMPARE = "compare",
	OPERATION = "operation",
}

// 特殊条件值（右边控件不需要展示）
export const SpecialConditionValues = ["empty", "not_empty", "valuable", "no_valuable"]

// 条件编辑组件的条件枚举（暂时写死）
export const CONDITION_OPTIONS = [
	{
		label: i18next.t("common.equals", { ns: "magicFlow" }),
		value: "equals",
	},
	{
		label: i18next.t("common.notEquals", { ns: "magicFlow" }),
		value: "no_equals",
	},
	{
		label: i18next.t("common.contains", { ns: "magicFlow" }),
		value: "contains",
	},
	{
		label: i18next.t("common.notContains", { ns: "magicFlow" }),
		value: "no_contains",
	},
	{
		label: i18next.t("common.greaterThen", { ns: "magicFlow" }),
		value: "gt",
	},
	{
		label: i18next.t("common.lessThen", { ns: "magicFlow" }),
		value: "lt",
	},
	{
		label: i18next.t("common.greaterOrEqualsTo", { ns: "magicFlow" }),
		value: "gte",
	},
	{
		label: i18next.t("common.lessOrEqualsTo", { ns: "magicFlow" }),
		value: "lte",
	},
	{
		label: i18next.t("common.noValue", { ns: "magicFlow" }),
		value: "empty",
	},
	{
		label: i18next.t("common.hasValue", { ns: "magicFlow" }),
		value: "not_empty",
	},
	{
		label: i18next.t("common.empty", { ns: "magicFlow" }),
		value: "valuable",
	},
	{
		label: i18next.t("common.notEmpty", { ns: "magicFlow" }),
		value: "no_valuable",
	},
]

// 默认的条件表达式项（新增时用）
export const DEFAULT_CONDITION_FIELD: Expression.CompareNode = {
	type: RELATION_COMP_TYPE.COMPARE,
	right_operands: defaultExpressionValue,
	left_operands: defaultExpressionValue,
	condition: "equals",
}

// 转换后的条件表达式项（转换时用）
export const DEFAULT_CONVERT_FIELD: Expression.OperationNode = {
	type: RELATION_COMP_TYPE.OPERATION,
	operands: defaultExpressionValue,
}

// 默认的条件表达式值
export const DEFAULT_CONDITION_DATA: Expression.LogicNode = {
	ops: RELATION_LOGICS_MAP.AND,
	children: [
		{
			type: RELATION_COMP_TYPE.COMPARE,
			left_operands: defaultExpressionValue,
			condition: "equals",
			right_operands: defaultExpressionValue,
		},
	],
}
