import dayjs from "dayjs"
import { afterEach, describe, expect, it, vi } from "vitest"
import { CommonAbsolutePresetKey, HistoryMode, RelativeUnit, TimeFilterTab, TimePresetKey } from "./types"
import {
	alignTimeByUnit,
	buildCustomRelativeRange,
	createHistoryEntry,
	getCommonAbsolutePresetRanges,
	getRangeByPreset,
	loadHistory,
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
			CommonAbsolutePresetKey.last_90_days,
		])
		expect(presets[0].value[0].format("YYYY-MM-DD HH:mm:ss")).toBe("2026-06-05 18:13:26")
		expect(presets[0].value[1].format("YYYY-MM-DD HH:mm:ss")).toBe("2026-06-08 18:13:26")
	})
})
