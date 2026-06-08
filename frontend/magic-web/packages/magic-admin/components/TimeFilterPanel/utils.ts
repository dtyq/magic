import dayjs, { type Dayjs } from "dayjs"
import type {
	BuildCustomRelativeRangeArgs,
	CommonAbsolutePresetRange,
	TimeFilterHistoryItem,
	TimePresetOption,
} from "./types"
import { CommonAbsolutePresetKey, RelativeUnit, TimePresetKey } from "./types"

export const DATE_TIME_FORMAT = "YYYY-MM-DD HH:mm:ss"
export const MONTH_KEY_FORMAT = "YYYY-MM"
export const TIME_FILTER_HISTORY_STORAGE_KEY = "magic_admin_time_filter_history:v1"
export const MAX_HISTORY_SIZE = 10

export const QUICK_PRESET_OPTIONS: TimePresetOption[] = [
	{ key: TimePresetKey.last_1_minute, labelKey: "last1Minute" },
	{ key: TimePresetKey.last_5_minutes, labelKey: "last5Minutes" },
	{ key: TimePresetKey.last_10_minutes, labelKey: "last10Minutes" },
	{ key: TimePresetKey.last_15_minutes, labelKey: "last15Minutes" },
	{ key: TimePresetKey.last_30_minutes, labelKey: "last30Minutes" },
	{ key: TimePresetKey.last_1_hour, labelKey: "last1Hour" },
	{ key: TimePresetKey.last_3_hours, labelKey: "last3Hours" },
	{ key: TimePresetKey.last_6_hours, labelKey: "last6Hours" },
	{ key: TimePresetKey.last_12_hours, labelKey: "last12Hours" },
	{ key: TimePresetKey.last_1_day, labelKey: "last1Day" },
	{ key: TimePresetKey.last_3_days, labelKey: "last3Days" },
	{ key: TimePresetKey.last_7_days, labelKey: "last7Days" },
	{ key: TimePresetKey.last_30_days, labelKey: "last30Days" },
	{ key: TimePresetKey.last_90_days, labelKey: "last90Days" },
]

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

function getStartOfWeek(now: Dayjs) {
	const day = now.day()
	const diff = day === 0 ? 6 : day - 1

	return now.subtract(diff, "day").startOf("day")
}

function getPresetUnit(preset: TimePresetKey): RelativeUnit {
	if (
		preset === TimePresetKey.last_1_minute ||
		preset === TimePresetKey.last_5_minutes ||
		preset === TimePresetKey.last_10_minutes ||
		preset === TimePresetKey.last_15_minutes ||
		preset === TimePresetKey.last_30_minutes
	)
		return RelativeUnit.minute

	if (
		preset === TimePresetKey.last_1_hour ||
		preset === TimePresetKey.last_3_hours ||
		preset === TimePresetKey.last_6_hours ||
		preset === TimePresetKey.last_12_hours
	)
		return RelativeUnit.hour

	return RelativeUnit.day
}

export function getRangeByPreset(
	preset: TimePresetKey,
	now = dayjs(),
	alignToUnit = false,
): [Dayjs, Dayjs] {
	const end = alignToUnit ? alignTimeByUnit(now, getPresetUnit(preset)) : now

	if (preset === TimePresetKey.last_1_minute) return [end.subtract(1, "minute"), end]
	if (preset === TimePresetKey.last_5_minutes) return [end.subtract(5, "minute"), end]
	if (preset === TimePresetKey.last_10_minutes) return [end.subtract(10, "minute"), end]
	if (preset === TimePresetKey.last_15_minutes) return [end.subtract(15, "minute"), end]
	if (preset === TimePresetKey.last_30_minutes) return [end.subtract(30, "minute"), end]
	if (preset === TimePresetKey.last_1_hour) return [end.subtract(1, "hour"), end]
	if (preset === TimePresetKey.last_3_hours) return [end.subtract(3, "hour"), end]
	if (preset === TimePresetKey.last_6_hours) return [end.subtract(6, "hour"), end]
	if (preset === TimePresetKey.last_12_hours) return [end.subtract(12, "hour"), end]
	if (preset === TimePresetKey.last_24_hours) return [end.subtract(24, "hour"), end]
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
	if (preset === TimePresetKey.last_30_days) return [end.subtract(30, "day"), end]
	if (preset === TimePresetKey.last_90_days) return [end.subtract(90, "day"), end]
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
}: BuildCustomRelativeRangeArgs): [Dayjs, Dayjs] {
	const safeValue = Number.isFinite(value) ? Math.max(1, value) : 1
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
			value: [now.subtract(3, "day"), now],
		},
		{
			key: CommonAbsolutePresetKey.last_7_days,
			value: [now.subtract(7, "day"), now],
		},
		{
			key: CommonAbsolutePresetKey.last_14_days,
			value: [now.subtract(14, "day"), now],
		},
		{
			key: CommonAbsolutePresetKey.last_21_days,
			value: [now.subtract(21, "day"), now],
		},
		{
			key: CommonAbsolutePresetKey.last_30_days,
			value: [now.subtract(30, "day"), now],
		},
		{
			key: CommonAbsolutePresetKey.last_90_days,
			value: [now.subtract(90, "day"), now],
		},
	]
}

export function formatMonthLabel(monthKey: string) {
	return dayjs(`${monthKey}-01`).format("YYYY年M月")
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

export function loadHistory(): TimeFilterHistoryItem[] {
	try {
		const stored = localStorage.getItem(TIME_FILTER_HISTORY_STORAGE_KEY)
		if (!stored) return []

		const parsed = JSON.parse(stored)
		return Array.isArray(parsed) ? parsed : []
	} catch {
		return []
	}
}

export function saveHistory(history: TimeFilterHistoryItem[]) {
	try {
		localStorage.setItem(
			TIME_FILTER_HISTORY_STORAGE_KEY,
			JSON.stringify(history.slice(0, MAX_HISTORY_SIZE)),
		)
	} catch {
		// ignore storage failures
	}
}

export function upsertHistory(entry: TimeFilterHistoryItem) {
	const nextHistory = [entry, ...loadHistory().filter((item) => item.id !== entry.id)]
	saveHistory(nextHistory)
	return nextHistory.slice(0, MAX_HISTORY_SIZE)
}

export function removeHistory(id: string) {
	const nextHistory = loadHistory().filter((item) => item.id !== id)
	saveHistory(nextHistory)
	return nextHistory
}
