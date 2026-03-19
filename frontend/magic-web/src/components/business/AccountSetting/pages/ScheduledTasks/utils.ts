import type { TFunction } from "i18next"
import dayjs from "@/lib/dayjs"
import { ScheduledTask } from "@/types/scheduledTask"
import { DEFAULT_TIME, WEEKDAY_LABELS } from "./constants"
import { Weekday, type ScheduleConfig, type ScheduleFormValues } from "./types"

export function formatMultipleSchedules(schedules: ScheduleConfig, t: TFunction): string {
	if (!schedules) return t("accountPanel.timedTasks.noPlan")
	return formatScheduleConfig(schedules, t)
}

export function formatScheduleConfig(config: ScheduleConfig, t: TFunction): string {
	switch (config.type) {
		case ScheduledTask.ScheduleType.Once:
			return `${dayjs(config.day).format("YYYY/MM/DD")} ${config.time}`
		case ScheduledTask.ScheduleType.Daily:
			return t("accountPanel.timedTasks.dailyJson", { time: config.time })
		case ScheduledTask.ScheduleType.Weekly:
			return t("accountPanel.timedTasks.weeklyJson", {
				weekday: WEEKDAY_LABELS[config.day as Weekday],
				time: config.time,
			})
		case ScheduledTask.ScheduleType.Monthly:
			return t("accountPanel.timedTasks.monthlyJson", {
				day: config.day,
				time: config.time,
			})
		default:
			return ""
	}
}

export function configToFormValues(config: ScheduleConfig): ScheduleFormValues {
	const baseValues: ScheduleFormValues = {
		scheduleType: config.type,
		day: "",
	}

	switch (config.type) {
		case ScheduledTask.ScheduleType.Daily:
			return {
				...baseValues,
				time: config.time,
			}
		case ScheduledTask.ScheduleType.Once:
		case ScheduledTask.ScheduleType.Weekly:
		case ScheduledTask.ScheduleType.Monthly:
			return {
				...baseValues,
				day: config.day,
				time: config.time,
			}
		default:
			return baseValues
	}
}

export function formValuesToConfig(values: ScheduleFormValues): ScheduleConfig | null {
	const time = values.time || DEFAULT_TIME

	switch (values.scheduleType) {
		case ScheduledTask.ScheduleType.Once:
			if (!values.day) return null
			return {
				type: ScheduledTask.ScheduleType.Once,
				day: dayjs(values.day).format("YYYY-MM-DD"),
				time,
			}
		case ScheduledTask.ScheduleType.Daily:
			return {
				type: ScheduledTask.ScheduleType.Daily,
				time,
			}
		case ScheduledTask.ScheduleType.Weekly:
			if (values.day === undefined) return null
			return {
				type: ScheduledTask.ScheduleType.Weekly,
				day: values.day as Weekday,
				time,
			}
		case ScheduledTask.ScheduleType.Monthly:
			if (!values.day) return null
			return {
				type: ScheduledTask.ScheduleType.Monthly,
				day: values.day,
				time,
			}
		default:
			return null
	}
}

export function validateScheduleConfig(config: ScheduleConfig): boolean {
	if (!config) return false
	if (!config.time || !/^\d{2}:\d{2}$/.test(config.time)) return false

	switch (config.type) {
		case ScheduledTask.ScheduleType.Once: {
			if (!config.day || !/^\d{4}-\d{2}-\d{2}$/.test(config.day)) return false
			const targetDate = dayjs(config.day, "YYYY-MM-DD")
			if (!targetDate.isValid() || targetDate.isBefore(dayjs(), "day")) return false
			return true
		}
		case ScheduledTask.ScheduleType.Daily:
			return true
		case ScheduledTask.ScheduleType.Weekly:
			return Number(config.day) >= 0 && Number(config.day) <= 6
		case ScheduledTask.ScheduleType.Monthly:
			return Number(config.day) >= 1 && Number(config.day) <= 31
		default:
			return false
	}
}

export function getNextRunTime(config: ScheduleConfig): dayjs.Dayjs {
	const now = dayjs()
	let nextRun: dayjs.Dayjs

	switch (config.type) {
		case ScheduledTask.ScheduleType.Once:
			nextRun = dayjs(`${config.day} ${config.time}`, "YYYY/MM/DD HH:mm")
			break
		case ScheduledTask.ScheduleType.Daily:
			nextRun = dayjs(`${now.format("YYYY/MM/DD")} ${config.time}`, "YYYY/MM/DD HH:mm")
			if (nextRun.isBefore(now)) nextRun = nextRun.add(1, "day")
			break
		case ScheduledTask.ScheduleType.Weekly:
			nextRun = now
				.day(Number(config.day))
				.hour(parseInt(config.time.split(":")[0]))
				.minute(parseInt(config.time.split(":")[1]))
			if (nextRun.isBefore(now)) nextRun = nextRun.add(1, "week")
			break
		case ScheduledTask.ScheduleType.Monthly:
			nextRun = now
				.date(Number(config.day))
				.hour(parseInt(config.time.split(":")[0]))
				.minute(parseInt(config.time.split(":")[1]))
			if (nextRun.isBefore(now)) nextRun = nextRun.add(1, "month")
			break
		default:
			return dayjs()
	}

	return nextRun
}
