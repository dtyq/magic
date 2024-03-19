import { FormItemType } from "@/MagicExpressionWidget/types"
import {
	Icon123,
	IconAbc,
	IconArrowsJoin2,
	IconBraces,
	IconBrackets,
	IconCalculator,
	IconCircle,
	IconJson,
	IconToggleLeftFilled,
} from "@tabler/icons-react"
import i18next from "i18next"
import _ from "lodash"
import React from "react"
import { StepOption } from "."

const getAllMethodMap: () => Record<FormItemType, StepOption[]> = () => ({
	[FormItemType.String]: [
		{
			value: "toNumber",
			label: i18next.t("expression.toNumber", { ns: "magicFlow" }),
			icon: <Icon123 />,
			type: FormItemType.Number,
		},
		{
			value: "toBoolean",
			label: i18next.t("expression.toBoolean", { ns: "magicFlow" }),
			icon: <IconToggleLeftFilled />,
			type: FormItemType.Boolean,
		},
		{
			value: "toArray",
			label: i18next.t("expression.toArray", { ns: "magicFlow" }),
			icon: <IconBrackets />,
			type: FormItemType.Array,
		},
		{
			value: "toObject",
			label: i18next.t("expression.toObject", { ns: "magicFlow" }),
			icon: <IconBraces />,
			type: FormItemType.Object,
		},
	],
	[FormItemType.Number]: [
		{
			value: "toString",
			label: i18next.t("expression.toString", { ns: "magicFlow" }),
			icon: <IconAbc />,
			type: FormItemType.String,
		},
		{
			value: "toBoolean",
			label: i18next.t("expression.toBoolean", { ns: "magicFlow" }),
			icon: <IconToggleLeftFilled />,
			type: FormItemType.Boolean,
		},
		{
			value: "toArray",
			label: i18next.t("expression.toArray", { ns: "magicFlow" }),
			icon: <IconBrackets />,
			type: FormItemType.Array,
		},
	],
	[FormItemType.Boolean]: [
		{
			value: "toString",
			label: i18next.t("expression.toString", { ns: "magicFlow" }),
			icon: <IconAbc />,
			type: FormItemType.String,
		},
		{
			value: "toNumber",
			label: i18next.t("expression.toNumber", { ns: "magicFlow" }),
			icon: <Icon123 />,
			type: FormItemType.Number,
		},
		{
			value: "toArray",
			label: i18next.t("expression.toArray", { ns: "magicFlow" }),
			icon: <IconBrackets />,
			type: FormItemType.Array,
		},
	],
	[FormItemType.Array]: [
		{
			value: "toString",
			label: i18next.t("expression.toString", { ns: "magicFlow" }),
			icon: <IconAbc />,
			type: FormItemType.String,
		},
		{
			value: "toArray",
			label: i18next.t("expression.toArray", { ns: "magicFlow" }),
			icon: <IconBrackets />,
			type: FormItemType.Array,
		},
		{
			value: "toJson",
			label: i18next.t("expression.toJSON", { ns: "magicFlow" }),
			icon: <IconJson />,
			type: FormItemType.String,
		},
		{
			value: "count",
			label: i18next.t("expression.count", { ns: "magicFlow" }),
			icon: <IconCalculator />,
			type: FormItemType.Number,
		},
		{
			value: "empty",
			label: i18next.t("expression.isEmpty", { ns: "magicFlow" }),
			icon: <IconCircle />,
			type: FormItemType.Boolean,
		},
		{
			value: "join",
			label: i18next.t("expression.join", { ns: "magicFlow" }),
			icon: <IconArrowsJoin2 />,
			type: FormItemType.String,
			withArguments: true,
			arguments: ",",
		},
	],
	[FormItemType.Object]: [
		{
			value: "toString",
			label: i18next.t("expression.toString", { ns: "magicFlow" }),
			icon: <IconAbc />,
			type: FormItemType.String,
		},
		{
			value: "toArray",
			label: i18next.t("expression.toArray", { ns: "magicFlow" }),
			icon: <IconBrackets />,
			type: FormItemType.Array,
		},
		{
			value: "toJson",
			label: i18next.t("expression.toJSON", { ns: "magicFlow" }),
			icon: <IconJson />,
			type: FormItemType.String,
		},
		{
			value: "empty",
			label: i18next.t("expression.isEmpty", { ns: "magicFlow" }),
			icon: <IconCircle />,
			type: FormItemType.Boolean,
		},
	],
	[FormItemType.Integer]: [],
})

/** 根据字段类型生成可以转换的函数 */
export const generateStepOptions = (type: string): StepOption[] => {
	return _.cloneDeep(getAllMethodMap()[type as FormItemType])
}

function getUniqueOptions(allMethodMap: Record<FormItemType, StepOption[]>): StepOption[] {
	const allOptions = Object.values(allMethodMap).flat()

	// Use a Map to deduplicate based on the "value" field
	const uniqueOptionsMap = new Map<string, StepOption>()

	allOptions.forEach((option) => {
		if (!uniqueOptionsMap.has(option.value)) {
			uniqueOptionsMap.set(option.value, option)
		}
	})

	return Array.from(uniqueOptionsMap.values())
}

export const allMethodOptions = getUniqueOptions(getAllMethodMap())

// 将列表转换为目标字符串 => join(',').toArray().toJson()
export function generateString(list: StepOption[]): string {
	return list
		.map((item) => {
			// 判断是否有 arguments 需要拼接
			if (item.arguments) {
				return `${item.value}('${item.arguments}')`
			}
			return `${item.value}()`
		})
		.join(".")
}

// 将目标字符串还原为原来的列表
export function reverseStringToList(input: string): StepOption[] {
	const functionRegex = /(\w+)\(([^)]*)\)/g // 匹配函数和参数
	const list: StepOption[] = []

	let match: RegExpExecArray | null

	while ((match = functionRegex.exec(input)) !== null) {
		const [fullMatch, value, args] = match
		list.push({
			value,
			arguments: args || undefined,
			label: `${i18next.t("expression.transformText", { ns: "magicFlow" })}: ${value}`, // 这里可以根据 value 映射回 label
			type: i18next.t("expression.transformType", { ns: "magicFlow" }), // 这里可以根据 value 映射回 type
		})
	}

	return list
}

// 根据join(',').toArray().toJson() 获取当前最新的类型
export function getCurrentTypeFromString(input: string): string | undefined {
	// 切割字符串并提取最后一个成员
	const parts = input.split(".") // 使用 . 切割
	const lastPart = parts[parts.length - 1] // 取最后一个成员

	// 正则匹配提取函数名称
	const valueMatch = lastPart.match(/(\w+)(\((.*)\))?/)
	if (valueMatch) {
		const value = valueMatch[1] // 提取函数名
		// 在列表中查找匹配的项
		const foundItem = allMethodOptions.find((item) => item.value === value)
		return foundItem ? foundItem.type : undefined // 返回对应的 type
	}
	return undefined // 如果没有匹配项，返回 undefined
}
