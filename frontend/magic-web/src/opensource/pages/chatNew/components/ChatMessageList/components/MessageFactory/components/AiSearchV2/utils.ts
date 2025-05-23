import type { AssociateQuestion } from "@/types/chat/conversation_message"
import duration from "dayjs/plugin/duration"
import dayjs from "dayjs"
import { t } from "i18next"
import { TimeLineDotStatus } from "./const"

export function getTimelineItemStatus(
	item: AssociateQuestion,
	index: number,
	array: AssociateQuestion[],
) {
	let status = TimeLineDotStatus.WAITING

	if (item.llm_response) {
		status = TimeLineDotStatus.SUCCESS
	} else if (index === 0) {
		status = TimeLineDotStatus.PENDING
	} else {
		const prev = array[index - 1]
		if (prev.llm_response) {
			status = TimeLineDotStatus.PENDING
		} else {
			status = TimeLineDotStatus.WAITING
		}
	}
	return status
}

dayjs.extend(duration)

/**
 * 格式化分钟数
 */
export function formatMinutes(minutes: number) {
	const dur = dayjs.duration(minutes, "minutes")

	if (dur.asDays() >= 1) {
		return `${dur.asDays().toFixed(1)}${t("common.day", { ns: "interface" })}`
	}

	if (dur.asHours() >= 1) {
		return `${dur.asHours().toFixed(1)}${t("common.hour", { ns: "interface" })}`
	}

	return `${Math.floor(dur.asMinutes())}${t("common.minute", { ns: "interface" })}`
}

/**
 * 提取源文本中的占位符
 * @param source 源文本
 * @param regex 正则表达式
 * @returns 占位符数组
 */
export function extractSourcePlaceholders(source: string, regex: RegExp): string[] {
	if (!source) return []

	const matches = Array.from(source.matchAll(regex))
	if (matches.length === 0) return [source]

	const result: string[] = []
	let lastIndex = 0

	matches.forEach((match) => {
		// 如果匹配项之前有文本，添加该文本
		if (match.index! > lastIndex) {
			result.push(source.slice(lastIndex, match.index))
		}
		// 添加匹配项
		result.push(match[0])
		lastIndex = match.index! + match[0].length
	})

	// 如果最后还有剩余文本，添加到结果中
	if (lastIndex < source.length) {
		result.push(source.slice(lastIndex))
	}

	return result
}
