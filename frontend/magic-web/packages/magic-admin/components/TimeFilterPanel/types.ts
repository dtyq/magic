import type { Dayjs } from "dayjs"

export enum TimeFilterTab {
	relative = "relative",
	absolute = "absolute",
	history = "history",
}
export enum HistoryMode {
	relative = "relative",
	absolute = "absolute",
	monthly = "monthly",
	custom = "custom",
}
export enum RelativeUnit {
	second = "second",
	minute = "minute",
	hour = "hour",
	day = "day",
}
export enum RelativeMode {
	preset = "preset",
	custom = "custom",
	monthly = "monthly",
}

export enum TimePresetKey {
	last_1_minute = "last_1_minute",
	last_5_minutes = "last_5_minutes",
	last_10_minutes = "last_10_minutes",
	last_15_minutes = "last_15_minutes",
	last_30_minutes = "last_30_minutes",
	last_1_hour = "last_1_hour",
	last_3_hours = "last_3_hours",
	last_6_hours = "last_6_hours",
	last_12_hours = "last_12_hours",
	last_24_hours = "last_24_hours",
	last_1_day = "last_1_day",
	today = "today",
	yesterday = "yesterday",
	day_before_yesterday = "day_before_yesterday",
	last_3_days = "last_3_days",
	last_7_days = "last_7_days",
	last_30_days = "last_30_days",
	last_90_days = "last_90_days",
	this_week = "this_week",
	last_week = "last_week",
	this_month = "this_month",
	last_month = "last_month",
	this_year = "this_year",
}

export enum CommonAbsolutePresetKey {
	last_3_days = "last_3_days",
	last_7_days = "last_7_days",
	last_14_days = "last_14_days",
	last_21_days = "last_21_days",
	last_30_days = "last_30_days",
	last_90_days = "last_90_days",
}

export interface TimeRangeValue {
	/* 开始时间 */
	startDate: string
	/* 结束时间 */
	endDate: string
	/* 标签 */
	label: string
	/* tab 类型 */
	tab: TimeFilterTab
	/* 模式 */
	mode: HistoryMode
}

export interface TimeFilterHistoryItem extends TimeRangeValue {
	id: string
	createdAt: string
}

export interface TimePresetOption {
	key: TimePresetKey
	labelKey: string
}

export interface BuildCustomRelativeRangeArgs {
	now?: Dayjs
	value: number
	unit: RelativeUnit
	alignToUnit: boolean
}

export interface CommonAbsolutePresetRange {
	key: CommonAbsolutePresetKey
	value: [Dayjs, Dayjs]
}

export type TimeFilterLocale = {
	monthFormat: string
	customRelativeLabel: string
	preset: Record<string, string>
	unit: {
		day: string
		hour: string
		minute: string
	}
}
