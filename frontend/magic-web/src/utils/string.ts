import dayjs from "@/lib/dayjs"
import { t } from "i18next"
import { isNumber } from "lodash-es"
import { configStore } from "@/models/config"
import { getCurrentLang } from "./locale"

// 每一段最多15位  如果有2段第一段从0 开始，第二段从str.length 开始
const getMidNum = (str: string, start: number, len: number) => {
	if (start + len > 0) {
		return +str.substr(start < 0 ? 0 : start, start < 0 ? start + len : len)
	}
	return 0
}

/**
 * 比较两个大整数的大小，返回－1，0，1  a<b返回-1
 * @param {String} a
 * @param {String} b
 * @returns {number}
 */
export const bigNumCompare = (a: string, b: string): number => {
	let back = 0
	// 取最大值分15份，向上取整
	const max = Math.ceil(Math.max(a.length, b.length) / 15)
	// 分成多少段,从左边开始
	for (let i = max; i > 0; i -= 1) {
		const num1 = getMidNum(a, a.length - i * 15, 15)
		const num2 = getMidNum(b, b.length - i * 15, 15)
		// 15位数字相减
		const cur = num1 - num2
		if (cur < 0) {
			back = -1
			break
		} else if (cur > 0) {
			back = 1
			break
		}
	}
	return back
}

/**
 * 默认时间格式化
 * @param time 时间
 * @returns 时间字符串
 */
export const defaultTimeFormat = (() => {
	const currentDay = dayjs().format("YYYY-MM-DD")
	const currentYear = dayjs().format("YYYY")

	return (time: number | Date | dayjs.Dayjs | null | undefined) => {
		if (!time) {
			return ""
		}
		if (isNumber(time)) {
			time *= 1000
		}

		const day = dayjs(time)
		const year = day.format("YYYY")
		const d = day.format("YYYY-MM-DD")

		if (d === currentDay) {
			return day.format(t("format.time", { ns: "common" }))
		}
		if (year === currentYear) {
			return day.format(t("format.date", { ns: "common" }))
		}

		return day.format(t("format.dateWithYear", { ns: "common" }))
	}
})()

/**
 * 格式化时间
 * @param time 时间
 * @param format 格式
 * @returns 时间字符串
 */
export const formatTime = (
	time: number | Date | dayjs.Dayjs | null | undefined | string,
	format?: string,
): string => {
	if (typeof time === "string") {
		time = dayjs(time)
	}
	if (!format) {
		return defaultTimeFormat(time)
	}
	if (!time) {
		return ""
	}
	if (isNumber(time)) {
		time *= 1000
	}
	const day = dayjs(time)
	return day.format(format)
}

/**
 * 格式化相对时间
 * @param time 时间
 * @returns 时间字符串
 */
export const formatRelativeTime = (lang?: string) => {
	const currentDay = dayjs().format("YYYY-MM-DD")

	return (time: number | Date | dayjs.Dayjs | null | undefined) => {
		if (!time) return ""

		if (isNumber(time)) {
			time *= 1000
		} else if (typeof time === "string") {
			time = dayjs(time)
		}

		const current = dayjs()
		const day = dayjs(time)
		const d = day.format("YYYY-MM-DD")

		// 同一天
		if (d === currentDay) {
			return day.format(t("format.time", { ns: "common" }))
		}

		// 相差小于24小时
		if (current.diff(day, "hour") < 24) {
			return day.format(t("format.yesterday", { ns: "common" }))
		}

		dayjs.locale(
			(lang ?? getCurrentLang(configStore.i18n.displayLanguage))
				.toLocaleLowerCase()
				.replace("_", "-"),
		)

		return day.fromNow()
	}
}

/**
 * 校验json
 * @param data 数据
 * @returns 是否合法
 */
export function isValidJson(data: string): false | object {
	try {
		return JSON.parse(data)
	} catch (error) {
		return false
	}
}
/**
 * 格式化文件大小
 * @param size
 * @returns
 */

export function formatFileSize(size?: number) {
	if (!isNumber(size)) return t("common.unknown", { ns: "interface" })

	// 使用十进制单位（SI标准）与操作系统保持一致
	const kb = size / 1000
	const mb = kb / 1000
	const gb = mb / 1000

	if (gb >= 1) {
		return `${gb.toFixed(2)} GB`
	}
	if (mb >= 1) {
		return `${mb.toFixed(2)} MB`
	}
	if (kb >= 1) {
		return `${kb.toFixed(2)} KB`
	}

	return `${size} B`
}

/**
 * 判断是否是markdown
 * @param text
 * @returns
 */
export function isMarkdown(text: string): boolean {
	// code-ish
	const fences = text.match(/^```/gm)
	if (fences && fences.length > 1) return true

	// link-ish
	if (text.match(/\[[^]+\]\(https?:\/\/\S+\)/gm)) return true
	if (text.match(/\[[^]+\]\(\/\S+\)/gm)) return true

	// heading-ish
	if (text.match(/^#{1,6}\s+\S+/gm)) return true

	// list-ish
	const listItems = text.match(/^[\d-*].?\s\S+/gm)
	if (listItems && listItems.length > 1) return true

	return false
}

/**
 * 尝试解析json
 * @param data
 * @param fallbackData
 * @returns
 */
export const jsonParse = <V>(data: string, fallbackData: V): V => {
	try {
		return JSON.parse(data) as V
	} catch (error) {
		return fallbackData
	}
}
