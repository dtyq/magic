import dayjs, { type Dayjs } from "@admin/infrastructure/vendors/dayjs"
import type {
	BuildCustomRelativeRangeArgs,
	CommonAbsolutePresetRange,
	TimeFilterHistoryItem,
	TimeFilterLocale,
	TimeFilterPrecisionValue,
	TimePresetOption,
	TimeRangeValue,
} from "./types"
import {
	CommonAbsolutePresetKey,
	HistoryMode,
	RelativeUnit,
	TimeFilterTab,
	TimeFilterPrecision as TimeFilterPrecisionEnum,
	TimePresetKey,
} from "./types"

export const DATE_TIME_FORMAT = "YYYY-MM-DD HH:mm:ss"
export const DATE_FORMAT = "YYYY-MM-DD"
export const MONTH_KEY_FORMAT = "YYYY-MM"
export const TIME_FILTER_HISTORY_STORAGE_KEY = "magic_admin_time_filter_history:v1"
export const MAX_HISTORY_SIZE = 10

export const DEFAULT_RELATIVE_UNITS: readonly RelativeUnit[] = [
	RelativeUnit.minute,
	RelativeUnit.hour,
	RelativeUnit.day,
]

const RELATIVE_UNIT_ORDER: readonly RelativeUnit[] = [
	RelativeUnit.second,
	RelativeUnit.minute,
	RelativeUnit.hour,
	RelativeUnit.day,
]

export const QUICK_PRESET_OPTIONS_BY_UNIT: Record<RelativeUnit, TimePresetOption[]> = {
	[RelativeUnit.second]: [
		{ key: TimePresetKey.last_1_second, labelKey: "last1Second" },
		{ key: TimePresetKey.last_5_seconds, labelKey: "last5Seconds" },
		{ key: TimePresetKey.last_10_seconds, labelKey: "last10Seconds" },
		{ key: TimePresetKey.last_15_seconds, labelKey: "last15Seconds" },
		{ key: TimePresetKey.last_30_seconds, labelKey: "last30Seconds" },
		{ key: TimePresetKey.last_45_seconds, labelKey: "last45Seconds" },
	],
	[RelativeUnit.minute]: [
		{ key: TimePresetKey.last_1_minute, labelKey: "last1Minute" },
		{ key: TimePresetKey.last_5_minutes, labelKey: "last5Minutes" },
		{ key: TimePresetKey.last_10_minutes, labelKey: "last10Minutes" },
		{ key: TimePresetKey.last_15_minutes, labelKey: "last15Minutes" },
		{ key: TimePresetKey.last_30_minutes, labelKey: "last30Minutes" },
		{ key: TimePresetKey.last_45_minutes, labelKey: "last45Minutes" },
	],
	[RelativeUnit.hour]: [
		{ key: TimePresetKey.last_1_hour, labelKey: "last1Hour" },
		{ key: TimePresetKey.last_3_hours, labelKey: "last3Hours" },
		{ key: TimePresetKey.last_6_hours, labelKey: "last6Hours" },
		{ key: TimePresetKey.last_12_hours, labelKey: "last12Hours" },
		{ key: TimePresetKey.last_24_hours, labelKey: "last24Hours" },
		{ key: TimePresetKey.last_48_hours, labelKey: "last48Hours" },
	],
	[RelativeUnit.day]: [
		{ key: TimePresetKey.last_1_day, labelKey: "last1Day" },
		{ key: TimePresetKey.last_3_days, labelKey: "last3Days" },
		{ key: TimePresetKey.last_7_days, labelKey: "last7Days" },
		{ key: TimePresetKey.last_14_days, labelKey: "last14Days" },
		{ key: TimePresetKey.last_21_days, labelKey: "last21Days" },
		{ key: TimePresetKey.last_30_days, labelKey: "last30Days" },
		{ key: TimePresetKey.last_60_days, labelKey: "last60Days" },
		{ key: TimePresetKey.last_90_days, labelKey: "last90Days" },
		{ key: TimePresetKey.last_120_days, labelKey: "last120Days" },
		{ key: TimePresetKey.last_180_days, labelKey: "last180Days" },
		{ key: TimePresetKey.last_365_days, labelKey: "last365Days" },
	],
}

export const STANDARD_PRESET_OPTIONS: TimePresetOption[] = [
	{ key: TimePresetKey.today, labelKey: "today" },
	{ key: TimePresetKey.yesterday, labelKey: "yesterday" },
	{ key: TimePresetKey.day_before_yesterday, labelKey: "dayBeforeYesterday" },
	{ key: TimePresetKey.this_week, labelKey: "thisWeek" },
	{ key: TimePresetKey.last_week, labelKey: "lastWeek" },
	{ key: TimePresetKey.this_month, labelKey: "thisMonth" },
	{ key: TimePresetKey.last_month, labelKey: "lastMonth" },
	{ key: TimePresetKey.this_year, labelKey: "thisYear" },
]

export function alignTimeByUnit(time: Dayjs, unit: RelativeUnit) {
	if (unit === RelativeUnit.second) return time.startOf("second")
	if (unit === RelativeUnit.minute) return time.startOf("minute")
	if (unit === RelativeUnit.hour) return time.startOf("hour")

	return time.startOf("day")
}

export function normalizeRelativeUnits(
	precision: TimeFilterPrecisionValue = TimeFilterPrecisionEnum.dateTime,
): RelativeUnit[] {
	if (precision === TimeFilterPrecisionEnum.day) return [RelativeUnit.day]
	if (!Array.isArray(precision)) return [...DEFAULT_RELATIVE_UNITS]

	const enabledUnits = new Set(precision)
	const normalizedUnits = RELATIVE_UNIT_ORDER.filter((unit) => enabledUnits.has(unit))

	// 空数组没有可操作的时间单位，回退默认值以保持组件可用。
	return normalizedUnits.length ? normalizedUnits : [...DEFAULT_RELATIVE_UNITS]
}

export function isDayOnlyPrecision(
	precision: TimeFilterPrecisionValue = TimeFilterPrecisionEnum.dateTime,
) {
	const units = normalizeRelativeUnits(precision)
	return units.length === 1 && units[0] === RelativeUnit.day
}

export function getHistoryStorageKey(
	precision: TimeFilterPrecisionValue = TimeFilterPrecisionEnum.dateTime,
) {
	const units = normalizeRelativeUnits(precision)
	if (isDayOnlyPrecision(units)) return `${TIME_FILTER_HISTORY_STORAGE_KEY}:day`
	if (
		units.length === DEFAULT_RELATIVE_UNITS.length &&
		units.every((unit, index) => unit === DEFAULT_RELATIVE_UNITS[index])
	) {
		return TIME_FILTER_HISTORY_STORAGE_KEY
	}

	return `${TIME_FILTER_HISTORY_STORAGE_KEY}:${units.join("-")}`
}

function getStartOfWeek(now: Dayjs) {
	const day = now.day()
	const diff = day === 0 ? 6 : day - 1

	return now.subtract(diff, "day").startOf("day")
}

export function getPresetUnit(preset: TimePresetKey): RelativeUnit {
	if (
		preset === TimePresetKey.last_1_second ||
		preset === TimePresetKey.last_5_seconds ||
		preset === TimePresetKey.last_10_seconds ||
		preset === TimePresetKey.last_15_seconds ||
		preset === TimePresetKey.last_30_seconds ||
		preset === TimePresetKey.last_45_seconds
	)
		return RelativeUnit.second

	if (
		preset === TimePresetKey.last_1_minute ||
		preset === TimePresetKey.last_5_minutes ||
		preset === TimePresetKey.last_10_minutes ||
		preset === TimePresetKey.last_15_minutes ||
		preset === TimePresetKey.last_30_minutes ||
		preset === TimePresetKey.last_45_minutes
	)
		return RelativeUnit.minute

	if (
		preset === TimePresetKey.last_1_hour ||
		preset === TimePresetKey.last_3_hours ||
		preset === TimePresetKey.last_6_hours ||
		preset === TimePresetKey.last_12_hours ||
		preset === TimePresetKey.last_24_hours ||
		preset === TimePresetKey.last_48_hours
	)
		return RelativeUnit.hour

	return RelativeUnit.day
}

function getDayRangeByPreset(preset: TimePresetKey, now = dayjs()): [Dayjs, Dayjs] {
	const end = now.endOf("day")

	if (
		preset === TimePresetKey.last_1_second ||
		preset === TimePresetKey.last_5_seconds ||
		preset === TimePresetKey.last_10_seconds ||
		preset === TimePresetKey.last_15_seconds ||
		preset === TimePresetKey.last_30_seconds ||
		preset === TimePresetKey.last_45_seconds ||
		preset === TimePresetKey.last_1_minute ||
		preset === TimePresetKey.last_5_minutes ||
		preset === TimePresetKey.last_10_minutes ||
		preset === TimePresetKey.last_15_minutes ||
		preset === TimePresetKey.last_30_minutes ||
		preset === TimePresetKey.last_45_minutes ||
		preset === TimePresetKey.last_1_hour ||
		preset === TimePresetKey.last_3_hours ||
		preset === TimePresetKey.last_6_hours ||
		preset === TimePresetKey.last_12_hours ||
		preset === TimePresetKey.last_24_hours ||
		preset === TimePresetKey.last_48_hours ||
		preset === TimePresetKey.last_1_day
	) {
		return [now.startOf("day"), end]
	}

	if (preset === TimePresetKey.today) return [now.startOf("day"), end]

	if (preset === TimePresetKey.yesterday) {
		const yesterday = now.subtract(1, "day")
		return [yesterday.startOf("day"), yesterday.endOf("day")]
	}

	if (preset === TimePresetKey.day_before_yesterday) {
		const dayBeforeYesterday = now.subtract(2, "day")
		return [dayBeforeYesterday.startOf("day"), dayBeforeYesterday.endOf("day")]
	}

	if (preset === TimePresetKey.last_3_days) return [now.subtract(2, "day").startOf("day"), end]
	if (preset === TimePresetKey.last_7_days) return [now.subtract(6, "day").startOf("day"), end]
	if (preset === TimePresetKey.last_14_days) return [now.subtract(13, "day").startOf("day"), end]
	if (preset === TimePresetKey.last_21_days) return [now.subtract(20, "day").startOf("day"), end]
	if (preset === TimePresetKey.last_30_days) return [now.subtract(29, "day").startOf("day"), end]
	if (preset === TimePresetKey.last_60_days) return [now.subtract(59, "day").startOf("day"), end]
	if (preset === TimePresetKey.last_90_days) return [now.subtract(89, "day").startOf("day"), end]
	if (preset === TimePresetKey.last_120_days)
		return [now.subtract(119, "day").startOf("day"), end]
	if (preset === TimePresetKey.last_180_days)
		return [now.subtract(179, "day").startOf("day"), end]
	if (preset === TimePresetKey.last_365_days)
		return [now.subtract(364, "day").startOf("day"), end]

	if (preset === TimePresetKey.this_week) return [getStartOfWeek(now), end]
	if (preset === TimePresetKey.last_week) {
		const thisWeekStart = getStartOfWeek(now)
		const lastWeekStart = thisWeekStart.subtract(7, "day")
		return [lastWeekStart, thisWeekStart.subtract(1, "day").endOf("day")]
	}
	if (preset === TimePresetKey.this_month) return [now.startOf("month"), end]
	if (preset === TimePresetKey.last_month) {
		const lastMonth = now.subtract(1, "month")
		return [lastMonth.startOf("month"), lastMonth.endOf("month")]
	}
	if (preset === TimePresetKey.this_year) return [now.startOf("year"), end]

	return [now.subtract(89, "day").startOf("day"), end]
}

export function getRangeByPreset(
	preset: TimePresetKey,
	now = dayjs(),
	alignToUnit = false,
	precision: TimeFilterPrecisionValue = TimeFilterPrecisionEnum.dateTime,
): [Dayjs, Dayjs] {
	if (isDayOnlyPrecision(precision)) {
		return getDayRangeByPreset(preset, now)
	}

	const end = alignToUnit ? alignTimeByUnit(now, getPresetUnit(preset)) : now

	if (preset === TimePresetKey.last_1_second) return [end.subtract(1, "second"), end]
	if (preset === TimePresetKey.last_5_seconds) return [end.subtract(5, "second"), end]
	if (preset === TimePresetKey.last_10_seconds) return [end.subtract(10, "second"), end]
	if (preset === TimePresetKey.last_15_seconds) return [end.subtract(15, "second"), end]
	if (preset === TimePresetKey.last_30_seconds) return [end.subtract(30, "second"), end]
	if (preset === TimePresetKey.last_45_seconds) return [end.subtract(45, "second"), end]
	if (preset === TimePresetKey.last_1_minute) return [end.subtract(1, "minute"), end]
	if (preset === TimePresetKey.last_5_minutes) return [end.subtract(5, "minute"), end]
	if (preset === TimePresetKey.last_10_minutes) return [end.subtract(10, "minute"), end]
	if (preset === TimePresetKey.last_15_minutes) return [end.subtract(15, "minute"), end]
	if (preset === TimePresetKey.last_30_minutes) return [end.subtract(30, "minute"), end]
	if (preset === TimePresetKey.last_45_minutes) return [end.subtract(45, "minute"), end]
	if (preset === TimePresetKey.last_1_hour) return [end.subtract(1, "hour"), end]
	if (preset === TimePresetKey.last_3_hours) return [end.subtract(3, "hour"), end]
	if (preset === TimePresetKey.last_6_hours) return [end.subtract(6, "hour"), end]
	if (preset === TimePresetKey.last_12_hours) return [end.subtract(12, "hour"), end]
	if (preset === TimePresetKey.last_24_hours) return [end.subtract(24, "hour"), end]
	if (preset === TimePresetKey.last_48_hours) return [end.subtract(48, "hour"), end]
	if (preset === TimePresetKey.last_1_day) return [end.subtract(1, "day"), end]
	if (preset === TimePresetKey.today) return [now.startOf("day"), now]
	if (preset === TimePresetKey.yesterday) {
		const yesterday = now.subtract(1, "day")
		return [yesterday.startOf("day"), yesterday.endOf("day")]
	}
	if (preset === TimePresetKey.day_before_yesterday) {
		const dayBeforeYesterday = now.subtract(2, "day")
		return [dayBeforeYesterday.startOf("day"), dayBeforeYesterday.endOf("day")]
	}
	if (preset === TimePresetKey.last_3_days) return [end.subtract(3, "day"), end]
	if (preset === TimePresetKey.last_7_days) return [end.subtract(7, "day"), end]
	if (preset === TimePresetKey.last_14_days) return [end.subtract(14, "day"), end]
	if (preset === TimePresetKey.last_21_days) return [end.subtract(21, "day"), end]
	if (preset === TimePresetKey.last_30_days) return [end.subtract(30, "day"), end]
	if (preset === TimePresetKey.last_60_days) return [end.subtract(60, "day"), end]
	if (preset === TimePresetKey.last_90_days) return [end.subtract(90, "day"), end]
	if (preset === TimePresetKey.last_120_days) return [end.subtract(120, "day"), end]
	if (preset === TimePresetKey.last_180_days) return [end.subtract(180, "day"), end]
	if (preset === TimePresetKey.last_365_days) return [end.subtract(365, "day"), end]
	if (preset === TimePresetKey.this_week) return [getStartOfWeek(now), now]
	if (preset === TimePresetKey.last_week) {
		const thisWeekStart = getStartOfWeek(now)
		const lastWeekStart = thisWeekStart.subtract(7, "day")
		return [lastWeekStart, thisWeekStart.subtract(1, "second")]
	}
	if (preset === TimePresetKey.this_month) return [now.startOf("month"), now]
	if (preset === TimePresetKey.last_month) {
		const lastMonth = now.subtract(1, "month")
		return [lastMonth.startOf("month"), lastMonth.endOf("month")]
	}
	if (preset === TimePresetKey.this_year) return [now.startOf("year"), now]

	return [now.subtract(90, "day"), now]
}

export function buildCustomRelativeRange({
	now = dayjs(),
	value,
	unit,
	alignToUnit,
	precision = TimeFilterPrecisionEnum.dateTime,
}: BuildCustomRelativeRangeArgs): [Dayjs, Dayjs] {
	const safeValue = Number.isFinite(value) ? Math.max(1, value) : 1
	if (isDayOnlyPrecision(precision)) {
		return [now.subtract(safeValue - 1, "day").startOf("day"), now.endOf("day")]
	}

	const end = alignToUnit ? alignTimeByUnit(now, unit) : now

	return [end.subtract(safeValue, unit), end]
}

export function getMonthRange(monthKey: string, now = dayjs()): [Dayjs, Dayjs] {
	const month = dayjs(`${monthKey}-01 00:00:00`)
	const isCurrentMonth = month.format(MONTH_KEY_FORMAT) === now.format(MONTH_KEY_FORMAT)

	return [month.startOf("month"), isCurrentMonth ? now : month.endOf("month")]
}

export function getRecentMonthKeys(now = dayjs(), count = 12) {
	return Array.from({ length: count }, (_, index) =>
		now.subtract(index, "month").format(MONTH_KEY_FORMAT),
	)
}

export function getCommonAbsolutePresetRanges(now = dayjs()): CommonAbsolutePresetRange[] {
	return [
		{
			key: CommonAbsolutePresetKey.last_3_days,
			value: [now.subtract(2, "day").startOf("day"), now.endOf("day")],
		},
		{
			key: CommonAbsolutePresetKey.last_7_days,
			value: [now.subtract(6, "day").startOf("day"), now.endOf("day")],
		},
		{
			key: CommonAbsolutePresetKey.last_14_days,
			value: [now.subtract(13, "day").startOf("day"), now.endOf("day")],
		},
		{
			key: CommonAbsolutePresetKey.last_21_days,
			value: [now.subtract(20, "day").startOf("day"), now.endOf("day")],
		},
		{
			key: CommonAbsolutePresetKey.last_30_days,
			value: [now.subtract(29, "day").startOf("day"), now.endOf("day")],
		},
		{
			key: CommonAbsolutePresetKey.last_60_days,
			value: [now.subtract(59, "day").startOf("day"), now.endOf("day")],
		},
		{
			key: CommonAbsolutePresetKey.last_90_days,
			value: [now.subtract(89, "day").startOf("day"), now.endOf("day")],
		},
		{
			key: CommonAbsolutePresetKey.last_180_days,
			value: [now.subtract(179, "day").startOf("day"), now.endOf("day")],
		},
	]
}

export function formatMonthLabel(monthKey: string, locale: TimeFilterLocale) {
	return dayjs(`${monthKey}-01`).format(locale.monthFormat)
}

export function createHistoryEntry(
	input: Omit<TimeFilterHistoryItem, "id" | "createdAt">,
): TimeFilterHistoryItem {
	return {
		...input,
		id: `${input.mode}_${input.startDate}_${input.endDate}`,
		createdAt: dayjs().format(DATE_TIME_FORMAT),
	}
}

export function formatTimeRangeDisplay(
	value: Pick<TimeRangeValue, "startDate" | "endDate"> &
		Partial<Pick<TimeRangeValue, "tab" | "mode">>,
	precision: TimeFilterPrecisionValue = TimeFilterPrecisionEnum.dateTime,
) {
	const isAbsolute = value.tab === TimeFilterTab.absolute || value.mode === HistoryMode.absolute
	const format = isAbsolute || isDayOnlyPrecision(precision) ? DATE_FORMAT : DATE_TIME_FORMAT
	return `${dayjs(value.startDate).format(format)} ~ ${dayjs(value.endDate).format(format)}`
}

export function normalizeRangeForApply(
	start: Dayjs,
	end: Dayjs,
	tab: TimeFilterTab,
	precision: TimeFilterPrecisionValue = TimeFilterPrecisionEnum.dateTime,
): [Dayjs, Dayjs] {
	if (tab === TimeFilterTab.absolute || isDayOnlyPrecision(precision)) {
		return [start.startOf("day"), end.endOf("day")]
	}

	return [start, end]
}

export function getRangeValueFormat(
	tab: TimeFilterTab,
	precision: TimeFilterPrecisionValue = TimeFilterPrecisionEnum.dateTime,
) {
	if (tab === TimeFilterTab.absolute) return DATE_TIME_FORMAT
	return isDayOnlyPrecision(precision) ? DATE_FORMAT : DATE_TIME_FORMAT
}

export function loadHistory(
	storageKey: string = TIME_FILTER_HISTORY_STORAGE_KEY,
): TimeFilterHistoryItem[] {
	try {
		const stored = localStorage.getItem(storageKey)
		if (!stored) return []

		const parsed = JSON.parse(stored)
		return Array.isArray(parsed) ? parsed : []
	} catch {
		return []
	}
}

export function saveHistory(
	history: TimeFilterHistoryItem[],
	storageKey: string = TIME_FILTER_HISTORY_STORAGE_KEY,
) {
	try {
		localStorage.setItem(storageKey, JSON.stringify(history.slice(0, MAX_HISTORY_SIZE)))
	} catch {
		// ignore storage failures
	}
}

export function upsertHistory(
	entry: TimeFilterHistoryItem,
	storageKey = TIME_FILTER_HISTORY_STORAGE_KEY,
) {
	const nextHistory = [entry, ...loadHistory(storageKey).filter((item) => item.id !== entry.id)]
	saveHistory(nextHistory, storageKey)
	return nextHistory.slice(0, MAX_HISTORY_SIZE)
}

export function removeHistory(id: string, storageKey = TIME_FILTER_HISTORY_STORAGE_KEY) {
	const nextHistory = loadHistory(storageKey).filter((item) => item.id !== id)
	saveHistory(nextHistory, storageKey)
	return nextHistory
}

export function getPresetLabel(locale: { preset: Record<string, string> }, key: string) {
	return locale.preset[key as keyof typeof locale.preset] || locale.preset.last24Hours
}

export function getPresetOptionLabel(locale: TimeFilterLocale, option: TimePresetOption) {
	return getPresetLabel(locale, option.labelKey)
}

export function getAbsolutePresetLabel(locale: TimeFilterLocale, key: CommonAbsolutePresetKey) {
	if (key === CommonAbsolutePresetKey.last_3_days) return locale.preset.last3Days
	if (key === CommonAbsolutePresetKey.last_7_days) return locale.preset.last7Days
	if (key === CommonAbsolutePresetKey.last_14_days) return locale.preset.last14Days
	if (key === CommonAbsolutePresetKey.last_21_days) return locale.preset.last21Days
	if (key === CommonAbsolutePresetKey.last_30_days) return locale.preset.last30Days
	if (key === CommonAbsolutePresetKey.last_60_days) return locale.preset.last60Days
	if (key === CommonAbsolutePresetKey.last_180_days) return locale.preset.last180Days
	return locale.preset.last90Days
}

export function formatTemplate(template: string, values: Record<string, string>) {
	return Object.entries(values).reduce(
		(result, [key, value]) => result.split(`{${key}}`).join(value),
		template,
	)
}

export function getUnitLabel(locale: TimeFilterLocale, unit: RelativeUnit) {
	if (unit === RelativeUnit.day) return locale.unit.day
	if (unit === RelativeUnit.hour) return locale.unit.hour
	if (unit === RelativeUnit.second) return locale.unit.second
	return locale.unit.minute
}

/** 获取同步后的时间筛选值 */
export function getSyncedTimeFilterValue(
	lastValue: TimeFilterHistoryItem | TimeRangeValue | null,
	startDate?: string,
	endDate?: string,
): TimeRangeValue | null {
	if (!startDate || !endDate) return null

	const isExactMatch = lastValue?.startDate === startDate && lastValue.endDate === endDate
	const isPresetMatch = lastValue?.presetKey && lastValue.startDate === startDate

	if (isExactMatch || isPresetMatch) {
		return {
			...lastValue,
			startDate,
			endDate,
		}
	}

	return {
		startDate,
		endDate,
		label: `${startDate} ~ ${endDate}`,
		tab: TimeFilterTab.absolute,
		mode: HistoryMode.absolute,
	}
}
