import dayjs from "@/lib/dayjs"
import i18next from "i18next"

export const WEEK_MAP: { [key: number]: string } = {
	0: i18next.t("format.weekDay.1", { ns: "common" }),
	1: i18next.t("format.weekDay.2", { ns: "common" }),
	2: i18next.t("format.weekDay.3", { ns: "common" }),
	3: i18next.t("format.weekDay.4", { ns: "common" }),
	4: i18next.t("format.weekDay.5", { ns: "common" }),
	5: i18next.t("format.weekDay.6", { ns: "common" }),
	6: i18next.t("format.weekDay.7", { ns: "common" }),
}

export enum CycleTypeMap {
	NO_REPEAT = "no_repeat",
	DAILY_REPEAT = "daily_repeat",
	WEEKLY_REPEAT = "weekly_repeat",
	MONTHLY_REPEAT = "monthly_repeat",
	ANNUALLY_REPEAT = "annually_repeat",
	WEEKDAY_REPEAT = "weekday_repeat",
	CUSTOM_REPEAT = "custom_repeat",
}

export const TIME_DATE_TYPE = [
	CycleTypeMap.NO_REPEAT,
	CycleTypeMap.ANNUALLY_REPEAT,
	CycleTypeMap.CUSTOM_REPEAT,
]

export enum Units {
	DAY = "day",
	WEEK = "week",
	MONTH = "month",
	YEAR = "year",
}

export const CYCLE_TYPE_OPTION = [
	{
		id: CycleTypeMap.NO_REPEAT,
		label: i18next.t("start.noRepeat", { ns: "flow" }),
	},
	{
		id: CycleTypeMap.DAILY_REPEAT,
		label: i18next.t("start.repeatDaily", { ns: "flow" }),
	},
	{
		id: CycleTypeMap.WEEKLY_REPEAT,
		label: i18next.t("start.repeatWeekly", { ns: "flow" }),
	},
	{
		id: CycleTypeMap.MONTHLY_REPEAT,
		label: i18next.t("start.repeatMonthly", { ns: "flow" }),
	},
	{
		id: CycleTypeMap.ANNUALLY_REPEAT,
		label: i18next.t("start.repeatYearly", { ns: "flow" }),
	},
	{
		id: CycleTypeMap.WEEKDAY_REPEAT,
		label: i18next.t("start.repeatWorkday", { ns: "flow" }),
	},
	{
		id: CycleTypeMap.CUSTOM_REPEAT,
		label: i18next.t("start.repeatCustom", { ns: "flow" }),
	},
]

export const getDefaultTimeTriggerParams = () => {
	return {
		type: CycleTypeMap.NO_REPEAT,
		day: dayjs().format("YYYY-MM-DD"),
		time: "00:00",
		value: {
			interval: null,
			unit: null,
			values: [],
			deadline: null,
		},
	}
}

export const UNIT_OPTIONS = [
	{
		id: Units.DAY,
		label: i18next.t("start.day", { ns: "flow" }),
	},
	{
		id: Units.WEEK,
		label: i18next.t("start.week", { ns: "flow" }),
	},
	{
		id: Units.MONTH,
		label: i18next.t("start.month", { ns: "flow" }),
	},
	{
		id: Units.YEAR,
		label: i18next.t("start.year", { ns: "flow" }),
	},
]
export default {}
