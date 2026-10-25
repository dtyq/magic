import dayjs from "dayjs"
import type { Config } from "@/models/config/types"

import duration from "dayjs/plugin/duration"
import weekday from "dayjs/plugin/weekday"
import localeData from "dayjs/plugin/localeData"
import weekOfYear from "dayjs/plugin/weekOfYear"
import isoWeek from "dayjs/plugin/isoWeek"
import isBetween from "dayjs/plugin/isBetween"
import isSameOrBefore from "dayjs/plugin/isSameOrBefore"
import isSameOrAfter from "dayjs/plugin/isSameOrAfter"
import minMax from "dayjs/plugin/minMax"
import timezone from "dayjs/plugin/timezone"
import updateLocale from "dayjs/plugin/updateLocale"
import utc from "dayjs/plugin/utc"
import relativeTime from "dayjs/plugin/relativeTime"

import "dayjs/locale/zh-cn"
import "dayjs/locale/en"

dayjs.extend(duration)
dayjs.extend(weekday)
dayjs.extend(localeData)
dayjs.extend(weekOfYear)
dayjs.extend(isoWeek)
dayjs.extend(isBetween)
dayjs.extend(isSameOrBefore)
dayjs.extend(isSameOrAfter)
dayjs.extend(minMax)
dayjs.extend(timezone)
dayjs.extend(updateLocale)
dayjs.extend(utc)
dayjs.extend(relativeTime)

// 订阅全局语言，周的起始日
export function switchLanguage(lang: Config.LanguageValue) {
	const languagesMap: Record<Config.LanguageValue, string> = {
		en_US: "en",
		zh_CN: "zh-cn",
		auto: "en",
	}
	dayjs.updateLocale(languagesMap?.[lang] || languagesMap.zh_CN, {
		weekStart: 0,
	})
}

export default dayjs
export type { Dayjs } from "dayjs"
