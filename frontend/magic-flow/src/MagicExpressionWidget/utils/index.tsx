import { EXPRESSION_ITEM, EXPRESSION_VALUE, LabelTypeMap } from "../types"
import { COLOR_DATA, COLOR_DATA_TEXT_COLOR } from "./colors"

/**
 * 获取单个field的类型
 */
export const getItemType = (typeString = "") => {
	const types = Object.values(LabelTypeMap)
	return types.find((type) => typeString.includes(type))
}

/**
 * 过滤空值
 */
export const filterNullValue = (resultValue = [] as EXPRESSION_ITEM[]) => {
	return resultValue
		.map((item) => {
			// @ts-ignore
			if (item && item.type.includes(LabelTypeMap.LabelText))
				// @ts-ignore
				item.value = item.value.replaceAll(/\u200B/g, "")
			return item
		})
		.filter((item) => item)
		.filter(
			(item) =>
				// @ts-ignore
				![LabelTypeMap.LabelText].includes(getItemType(item.type) as LabelTypeMap) ||
				item.value,
		)
}

// 将<转&lt 将>转^gt，避免浏览器识别为html
export const transferSpecialSign = (str: string) => {
	return str.replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

export default function hash(str = "", length = 0) {
	if (!str) str = ""
	const H = 37
	let total = 0
	for (let i = 0; i < str.length; i += 1) {
		total += H * total + str.charCodeAt(i)
	}
	total %= length
	if (total < 0) {
		total += length
	}

	return total
}

export const getColor = (name: string) => {
	let i = hash(name, COLOR_DATA.length)
	return {
		backgroundColor: COLOR_DATA[i],
		textColor: COLOR_DATA_TEXT_COLOR[COLOR_DATA[i]],
	}
}

/** 过滤掉空值 */
export const filterEmptyValues = (values: EXPRESSION_VALUE[]) => {
	return values?.filter?.((v) => {
		const normalType = [LabelTypeMap.LabelNode, LabelTypeMap.LabelText, LabelTypeMap.LabelFunc]
		const isNormalType = normalType.includes(v?.type)
		if (isNormalType) {
			return v?.value && v?.value !== "\n"
		}
		return v
	})
}

// 将CSS尺寸值转换为纯数字
export const parseSizeToNumber = (size: string | number): number => {
	if (typeof size === "number") return size

	// 如果是像素值，直接去掉px后缀并转为数字
	if (size.endsWith("px")) {
		return parseInt(size, 10)
	}

	// 如果是视口高度(vh)，计算为对应的像素值
	if (size.endsWith("vh")) {
		const vh = parseInt(size, 10)
		// 使用window.innerHeight获取视口高度
		const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 600
		return Math.floor((vh / 100) * viewportHeight)
	}

	// 如果没有单位或使用其他单位，尝试直接解析为数字
	const parsed = parseInt(size.toString(), 10)
	return isNaN(parsed) ? 600 : parsed // 默认值600px
}
