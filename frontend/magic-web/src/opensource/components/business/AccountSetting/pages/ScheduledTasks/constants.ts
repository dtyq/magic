import i18n from "i18next"
import { Weekday, type ScheduleOption, type WeekdayOption, type DayOption } from "./types"
import { ScheduledTask } from "@/opensource/types/scheduledTask"

export const SCHEDULE_OPTIONS: ScheduleOption[] = [
	{
		label: i18n.t("accountPanel.timedTasks.noRepeat", { ns: "interface" }),
		value: ScheduledTask.ScheduleType.Once,
	},
	{
		label: i18n.t("accountPanel.timedTasks.daily", { ns: "interface" }),
		value: ScheduledTask.ScheduleType.Daily,
	},
	{
		label: i18n.t("accountPanel.timedTasks.weekly", { ns: "interface" }),
		value: ScheduledTask.ScheduleType.Weekly,
	},
	{
		label: i18n.t("accountPanel.timedTasks.monthly", { ns: "interface" }),
		value: ScheduledTask.ScheduleType.Monthly,
	},
]

export const WEEKDAY_OPTIONS: WeekdayOption[] = [
	{ label: i18n.t("format.weekDay.1", { ns: "common" }), value: Weekday.Monday },
	{ label: i18n.t("format.weekDay.2", { ns: "common" }), value: Weekday.Tuesday },
	{ label: i18n.t("format.weekDay.3", { ns: "common" }), value: Weekday.Wednesday },
	{ label: i18n.t("format.weekDay.4", { ns: "common" }), value: Weekday.Thursday },
	{ label: i18n.t("format.weekDay.5", { ns: "common" }), value: Weekday.Friday },
	{ label: i18n.t("format.weekDay.6", { ns: "common" }), value: Weekday.Saturday },
	{ label: i18n.t("format.weekDay.7", { ns: "common" }), value: Weekday.Sunday },
]

export const DAY_OPTIONS: DayOption[] = Array.from({ length: 31 }, (_, index) => ({
	label: (index + 1).toString(),
	value: (index + 1).toString(),
}))

export const WEEKDAY_LABELS: Record<Weekday, string> = {
	[Weekday.Sunday]: i18n.t("format.weekDay.7", { ns: "common" }),
	[Weekday.Monday]: i18n.t("format.weekDay.1", { ns: "common" }),
	[Weekday.Tuesday]: i18n.t("format.weekDay.2", { ns: "common" }),
	[Weekday.Wednesday]: i18n.t("format.weekDay.3", { ns: "common" }),
	[Weekday.Thursday]: i18n.t("format.weekDay.4", { ns: "common" }),
	[Weekday.Friday]: i18n.t("format.weekDay.5", { ns: "common" }),
	[Weekday.Saturday]: i18n.t("format.weekDay.6", { ns: "common" }),
}

export const WEEKDAY_VALUES: Record<string, Weekday> = {
	一: Weekday.Monday,
	二: Weekday.Tuesday,
	三: Weekday.Wednesday,
	四: Weekday.Thursday,
	五: Weekday.Friday,
	六: Weekday.Saturday,
	日: Weekday.Sunday,
}

export const DEFAULT_TIME = "09:00"
