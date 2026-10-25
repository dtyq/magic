import type { TFunction } from "i18next"

import { ScheduledTask } from "@/types/scheduledTask"

/** Resolves the localized weekday label used by scheduled-task cards. */
function getWeekdayLabel(day: string | undefined, t: TFunction) {
	const weekday = Number(day)
	const translationDay = weekday === 0 ? 7 : weekday

	if (!Number.isInteger(translationDay) || translationDay < 1 || translationDay > 7) {
		return day || "-"
	}

	return t(`format.weekDay.${translationDay}`, { ns: "common" })
}

/** Formats one scheduled-task time configuration for compact card presentation. */
export function formatTaskSchedule(config: ScheduledTask.TimeConfig | undefined, t: TFunction) {
	if (!config) return t("scheduleTask.noSchedule")

	switch (config.type) {
		case ScheduledTask.ScheduleType.Daily:
			return t("scheduleTask.dailyAt", { time: config.time })
		case ScheduledTask.ScheduleType.Weekly:
			return t("scheduleTask.weeklyAt", {
				day: getWeekdayLabel(config.day, t),
				time: config.time,
			})
		case ScheduledTask.ScheduleType.Monthly:
			return t("scheduleTask.monthlyAt", { day: config.day, time: config.time })
		case ScheduledTask.ScheduleType.Once:
			return t("scheduleTask.onceAt", { day: config.day, time: config.time })
		default:
			return t("scheduleTask.noSchedule")
	}
}
