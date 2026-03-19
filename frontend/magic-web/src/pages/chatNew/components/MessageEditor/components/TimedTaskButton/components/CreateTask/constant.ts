import i18next, { TFunction } from "i18next"
import { resolveToString } from "@dtyq/es6-template-strings"

export const DEFAULT_TOPIC_VALUE = "DEFAULT_TOPIC"

export const defaultTopicOptions = [
	{
		label: i18next.t("chat.topic.newTopic"),
		value: DEFAULT_TOPIC_VALUE,
	},
]

export const enum WeekUnits {
	SUNDAY = 0,
	MONDAY = 1,
	TUESDAY = 2,
	WEDNESDAY = 3,
	THURSDAY = 4,
	FRIDAY = 5,
	SATURDAY = 6,
}

export enum Units {
	DAY = "day",
	WEEK = "week",
	MONTH = "month",
	YEAR = "year",
}

export enum RepeatTypeMap {
	NO_REPEAT = "no_repeat",
	DAILY_REPEAT = "daily_repeat",
	WEEKLY_REPEAT = "weekly_repeat",
	MONTHLY_REPEAT = "monthly_repeat",
	WEEKDAY_REPEAT = "weekday_repeat",
	CUSTOM_REPEAT = "custom_repeat",
}

export const WEEK_OPTION = (t: TFunction) => [
	{ value: WeekUnits.MONDAY, label: t("format.weekDay.1", { ns: "common" }) },
	{ value: WeekUnits.TUESDAY, label: t("format.weekDay.2", { ns: "common" }) },
	{ value: WeekUnits.WEDNESDAY, label: t("format.weekDay.3", { ns: "common" }) },
	{ value: WeekUnits.THURSDAY, label: t("format.weekDay.4", { ns: "common" }) },
	{ value: WeekUnits.FRIDAY, label: t("format.weekDay.5", { ns: "common" }) },
	{ value: WeekUnits.SATURDAY, label: t("format.weekDay.6", { ns: "common" }) },
	{ value: WeekUnits.SUNDAY, label: t("format.weekDay.7", { ns: "common" }) },
]

export const MONTH_OPTION = (t: TFunction) =>
	Array.from({ length: 31 }, (_, i) => ({
		value: i + 1,
		label: resolveToString(t("chat.timedTask.xDay", { ns: "interface" }), {
			num: i + 1,
		}),
	}))

export const YEAR_OPTION = (t: TFunction) =>
	Array.from({ length: 12 }, (_, i) => ({
		value: i + 1,
		label: resolveToString(t("chat.timedTask.xMonth", { ns: "interface" }), {
			num: i + 1,
		}),
	}))

// 每X类型
export const EVERY_OPTION = (t: TFunction) => [
	{
		label: t("calendar.newEvent.repeatOptions.day", { ns: "interface" }),
		value: Units.DAY,
	},
	{
		label: t("calendar.newEvent.repeatOptions.week", { ns: "interface" }),
		value: Units.WEEK,
	},
	{
		label: t("calendar.newEvent.repeatOptions.month", { ns: "interface" }),
		value: Units.MONTH,
	},
	{
		label: t("calendar.newEvent.repeatOptions.year", { ns: "interface" }),
		value: Units.YEAR,
	},
]

export const REPEAT_TYPE_OPTION = (t: TFunction) => {
	return [
		{
			id: RepeatTypeMap.NO_REPEAT,
			label: t("chat.timedTask.noRepeat", { ns: "interface" }),
		},
		{
			id: RepeatTypeMap.DAILY_REPEAT,
			label: t("chat.timedTask.dailyRepeat", { ns: "interface" }),
		},
		{
			id: RepeatTypeMap.WEEKLY_REPEAT,
			label: t("chat.timedTask.weeklyRepeat", { ns: "interface" }),
		},
		{
			id: RepeatTypeMap.MONTHLY_REPEAT,
			label: t("chat.timedTask.monthlyRepeat", { ns: "interface" }),
		},
		{
			id: RepeatTypeMap.WEEKDAY_REPEAT,
			label: t("chat.timedTask.weekdayRepeat", { ns: "interface" }),
		},
		{
			id: RepeatTypeMap.CUSTOM_REPEAT,
			label: t("chat.timedTask.customRepeat", { ns: "interface" }),
		},
	]
}

export const REPEAT_TYPE_DESC = (t: TFunction) => ({
	[RepeatTypeMap.NO_REPEAT]: t("chat.timedTask.noRepeat", { ns: "interface" }),
	[RepeatTypeMap.DAILY_REPEAT]: t("calendar.newEvent.repeatOptions.daily", {
		ns: "interface",
	}),
	[RepeatTypeMap.WEEKLY_REPEAT]: i18next.t("calendar.newEvent.repeatOptions.weekly", {
		ns: "interface",
	}),
	[RepeatTypeMap.MONTHLY_REPEAT]: i18next.t("calendar.newEvent.repeatOptions.monthly", {
		ns: "interface",
	}),
	[RepeatTypeMap.WEEKDAY_REPEAT]: i18next.t("chat.timedTask.weekdayRepeat", { ns: "interface" }),
	[RepeatTypeMap.CUSTOM_REPEAT]: i18next.t("calendar.newEvent.repeatOptions.every", {
		ns: "interface",
	}),
})

export const UNITS_DESC = (t: TFunction) => ({
	[Units.DAY]: t("calendar.newEvent.repeatOptions.day", { ns: "interface" }),
	[Units.WEEK]: t("calendar.newEvent.repeatOptions.week", { ns: "interface" }),
	[Units.MONTH]: t("calendar.newEvent.repeatOptions.month", { ns: "interface" }),
	[Units.YEAR]: t("calendar.newEvent.repeatOptions.year", { ns: "interface" }),
})

export const DEFAULT_VALUE = {
	interval: 1,
	unit: null,
	values: [],
	deadline: null,
}

export const DEFAULT_TASK_DATA = {
	name: "",
	day: "",
	time: "",
	agent_id: "",
	type: RepeatTypeMap.NO_REPEAT,
	value: DEFAULT_VALUE,
}
