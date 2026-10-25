import dayjs from "@admin/infrastructure/vendors/dayjs"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
	CommonAbsolutePresetKey,
	HistoryMode,
	RelativeUnit,
	TimeFilterPrecision,
	TimeFilterTab,
	TimePresetKey,
} from "./types"
import {
	alignTimeByUnit,
	buildCustomRelativeRange,
	createHistoryEntry,
	formatTimeRangeDisplay,
	getCommonAbsolutePresetRanges,
	getHistoryStorageKey,
	getRangeByPreset,
	loadHistory,
	normalizeRangeForApply,
	normalizeRelativeUnits,
	QUICK_PRESET_OPTIONS_BY_UNIT,
	saveHistory,
	TIME_FILTER_HISTORY_STORAGE_KEY,
} from "./utils"

describe("TimeFilterPanel utils", () => {
	afterEach(() => {
		localStorage.clear()
		vi.restoreAllMocks()
	})

	it("aligns hour-based presets to the hour when rounding is enabled", () => {
		const now = dayjs("2026-06-08 18:13:26")
		const [start, end] = getRangeByPreset(TimePresetKey.last_3_hours, now, true)

		expect(end.format("YYYY-MM-DD HH:mm:ss")).toBe("2026-06-08 18:00:00")
		expect(start.format("YYYY-MM-DD HH:mm:ss")).toBe("2026-06-08 15:00:00")
	})

	it("aligns minute-based presets to the minute when rounding is enabled", () => {
		const now = dayjs("2026-06-08 18:13:26")
		const [start, end] = getRangeByPreset(TimePresetKey.last_10_minutes, now, true)

		expect(end.format("YYYY-MM-DD HH:mm:ss")).toBe("2026-06-08 18:13:00")
		expect(start.format("YYYY-MM-DD HH:mm:ss")).toBe("2026-06-08 18:03:00")
	})

	it("builds custom relative range from count and unit", () => {
		const now = dayjs("2026-06-08 18:13:26")
		const [start, end] = buildCustomRelativeRange({
			now,
			value: 16,
			unit: RelativeUnit.minute,
			alignToUnit: false,
		})

		expect(end.format("YYYY-MM-DD HH:mm:ss")).toBe("2026-06-08 18:13:26")
		expect(start.format("YYYY-MM-DD HH:mm:ss")).toBe("2026-06-08 17:57:26")
	})

	it("builds custom relative ranges with second precision", () => {
		const now = dayjs("2026-06-08 18:13:26")
		const [start, end] = buildCustomRelativeRange({
			now,
			value: 15,
			unit: RelativeUnit.second,
			alignToUnit: false,
		})

		expect(end.format("YYYY-MM-DD HH:mm:ss")).toBe("2026-06-08 18:13:26")
		expect(start.format("YYYY-MM-DD HH:mm:ss")).toBe("2026-06-08 18:13:11")
	})

	it("builds second-level preset ranges", () => {
		const now = dayjs("2026-06-08 18:13:26")
		const [start, end] = getRangeByPreset(TimePresetKey.last_15_seconds, now)

		expect(end.format("YYYY-MM-DD HH:mm:ss")).toBe("2026-06-08 18:13:26")
		expect(start.format("YYYY-MM-DD HH:mm:ss")).toBe("2026-06-08 18:13:11")
	})

	it("builds extended second, minute, and hour preset ranges", () => {
		const now = dayjs("2026-06-08 18:13:26")
		const [secondStart] = getRangeByPreset(TimePresetKey.last_45_seconds, now)
		const [minuteStart] = getRangeByPreset(TimePresetKey.last_45_minutes, now)
		const [hourStart] = getRangeByPreset(TimePresetKey.last_48_hours, now)

		expect(secondStart.format("YYYY-MM-DD HH:mm:ss")).toBe("2026-06-08 18:12:41")
		expect(minuteStart.format("YYYY-MM-DD HH:mm:ss")).toBe("2026-06-08 17:28:26")
		expect(hourStart.format("YYYY-MM-DD HH:mm:ss")).toBe("2026-06-06 18:13:26")
	})

	it("normalizes supported relative units and keeps legacy precision compatible", () => {
		expect(normalizeRelativeUnits()).toEqual([
			RelativeUnit.minute,
			RelativeUnit.hour,
			RelativeUnit.day,
		])
		expect(normalizeRelativeUnits(TimeFilterPrecision.day)).toEqual([RelativeUnit.day])
		expect(
			normalizeRelativeUnits([RelativeUnit.day, RelativeUnit.second, RelativeUnit.second]),
		).toEqual([RelativeUnit.second, RelativeUnit.day])
	})

	it("provides quick presets only for the selected unit", () => {
		expect(QUICK_PRESET_OPTIONS_BY_UNIT[RelativeUnit.second].map((item) => item.key)).toEqual([
			TimePresetKey.last_1_second,
			TimePresetKey.last_5_seconds,
			TimePresetKey.last_10_seconds,
			TimePresetKey.last_15_seconds,
			TimePresetKey.last_30_seconds,
			TimePresetKey.last_45_seconds,
		])
		expect(QUICK_PRESET_OPTIONS_BY_UNIT[RelativeUnit.minute].map((item) => item.key)).toEqual([
			TimePresetKey.last_1_minute,
			TimePresetKey.last_5_minutes,
			TimePresetKey.last_10_minutes,
			TimePresetKey.last_15_minutes,
			TimePresetKey.last_30_minutes,
			TimePresetKey.last_45_minutes,
		])
		expect(QUICK_PRESET_OPTIONS_BY_UNIT[RelativeUnit.hour].map((item) => item.key)).toEqual([
			TimePresetKey.last_1_hour,
			TimePresetKey.last_3_hours,
			TimePresetKey.last_6_hours,
			TimePresetKey.last_12_hours,
			TimePresetKey.last_24_hours,
			TimePresetKey.last_48_hours,
		])
		expect(QUICK_PRESET_OPTIONS_BY_UNIT[RelativeUnit.day]).toHaveLength(11)
	})

	it("saves history using the versioned localStorage key", () => {
		const entry = createHistoryEntry({
			label: "近3小时",
			startDate: "2026-06-08 15:00:00",
			endDate: "2026-06-08 18:00:00",
			tab: TimeFilterTab.relative,
			mode: HistoryMode.relative,
		})

		saveHistory([entry])

		expect(JSON.parse(localStorage.getItem(TIME_FILTER_HISTORY_STORAGE_KEY) || "[]")).toEqual([
			entry,
		])
	})

	it("isolates history for custom precision combinations", () => {
		expect(getHistoryStorageKey(TimeFilterPrecision.dateTime)).toBe(
			TIME_FILTER_HISTORY_STORAGE_KEY,
		)
		expect(getHistoryStorageKey(TimeFilterPrecision.day)).toBe(
			`${TIME_FILTER_HISTORY_STORAGE_KEY}:day`,
		)
		expect(
			getHistoryStorageKey([
				RelativeUnit.second,
				RelativeUnit.minute,
				RelativeUnit.hour,
				RelativeUnit.day,
			]),
		).toBe(`${TIME_FILTER_HISTORY_STORAGE_KEY}:second-minute-hour-day`)
	})

	it("returns an empty list when stored history is invalid", () => {
		localStorage.setItem(TIME_FILTER_HISTORY_STORAGE_KEY, "{invalid}")

		expect(loadHistory()).toEqual([])
	})

	it("alignTimeByUnit snaps correctly by hour", () => {
		const aligned = alignTimeByUnit(dayjs("2026-06-08 18:13:26"), RelativeUnit.hour)
		expect(aligned.format("YYYY-MM-DD HH:mm:ss")).toBe("2026-06-08 18:00:00")
	})

	it("builds common absolute presets for the range picker", () => {
		const presets = getCommonAbsolutePresetRanges(dayjs("2026-06-08 18:13:26"))

		expect(presets.map((item) => item.key)).toEqual([
			CommonAbsolutePresetKey.last_3_days,
			CommonAbsolutePresetKey.last_7_days,
			CommonAbsolutePresetKey.last_14_days,
			CommonAbsolutePresetKey.last_21_days,
			CommonAbsolutePresetKey.last_30_days,
			CommonAbsolutePresetKey.last_60_days,
			CommonAbsolutePresetKey.last_90_days,
			CommonAbsolutePresetKey.last_180_days,
		])
		expect(presets[0].value[0].format("YYYY-MM-DD HH:mm:ss")).toBe("2026-06-06 00:00:00")
		expect(presets[0].value[1].format("YYYY-MM-DD HH:mm:ss")).toBe("2026-06-08 23:59:59")
	})

	it("normalizes absolute selections to whole days and displays dates only", () => {
		const [start, end] = normalizeRangeForApply(
			dayjs("2026-06-05 18:13:26"),
			dayjs("2026-06-08 07:05:03"),
			TimeFilterTab.absolute,
			[RelativeUnit.second, RelativeUnit.minute],
		)

		expect(start.format("YYYY-MM-DD HH:mm:ss")).toBe("2026-06-05 00:00:00")
		expect(end.format("YYYY-MM-DD HH:mm:ss")).toBe("2026-06-08 23:59:59")
		expect(
			formatTimeRangeDisplay(
				{
					startDate: start.format("YYYY-MM-DD HH:mm:ss"),
					endDate: end.format("YYYY-MM-DD HH:mm:ss"),
					tab: TimeFilterTab.absolute,
				},
				[RelativeUnit.second, RelativeUnit.minute],
			),
		).toBe("2026-06-05 ~ 2026-06-08")
	})

	it("builds day-level ranges when precision is day", () => {
		const now = dayjs("2026-06-08 18:13:26")
		const [start, end] = getRangeByPreset(
			TimePresetKey.last_7_days,
			now,
			false,
			TimeFilterPrecision.day,
		)

		expect(start.format("YYYY-MM-DD HH:mm:ss")).toBe("2026-06-02 00:00:00")
		expect(end.format("YYYY-MM-DD HH:mm:ss")).toBe("2026-06-08 23:59:59")
	})

	it("builds long day-level ranges as natural days", () => {
		const now = dayjs("2026-06-08 18:13:26")
		const [start, end] = getRangeByPreset(
			TimePresetKey.last_365_days,
			now,
			false,
			TimeFilterPrecision.day,
		)

		expect(start.format("YYYY-MM-DD HH:mm:ss")).toBe("2025-06-09 00:00:00")
		expect(end.format("YYYY-MM-DD HH:mm:ss")).toBe("2026-06-08 23:59:59")
	})

	it("keeps absolute presets day-based regardless of relative precision", () => {
		const presets = getCommonAbsolutePresetRanges(dayjs("2026-06-08 18:13:26"))

		expect(presets[0].value[0].format("YYYY-MM-DD HH:mm:ss")).toBe("2026-06-06 00:00:00")
		expect(presets[0].value[1].format("YYYY-MM-DD HH:mm:ss")).toBe("2026-06-08 23:59:59")
	})
})
