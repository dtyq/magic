import dayjs from "@/lib/dayjs"
import { describe, expect, test } from "vitest"

import {
	getPointsRecordGroupKey,
	getPointsRecordsHasMore,
	getPointsRecordsTotal,
} from "../pointsRecords"

const TIMEZONE = "Asia/Shanghai"

/** 构造指定日历天偏移的 ISO 时间戳，便于验证分组边界。 */
function buildTimestamp(daysAgo: number) {
	return dayjs().tz(TIMEZONE).subtract(daysAgo, "day").hour(12).minute(0).second(0).toISOString()
}

describe("getPointsRecordGroupKey", () => {
	test("classifies today yesterday thisWeek and earlier by calendar day", () => {
		expect(getPointsRecordGroupKey(buildTimestamp(0), TIMEZONE)).toBe("today")
		expect(getPointsRecordGroupKey(buildTimestamp(1), TIMEZONE)).toBe("yesterday")
		expect(getPointsRecordGroupKey(buildTimestamp(7), TIMEZONE)).toBe("thisWeek")
		expect(getPointsRecordGroupKey(buildTimestamp(8), TIMEZONE)).toBe("earlier")
	})

	test("returns earlier for invalid timestamp", () => {
		expect(getPointsRecordGroupKey("", TIMEZONE)).toBe("earlier")
	})
})

describe("getPointsRecordsTotal", () => {
	test("reads total from WithPage response", () => {
		expect(
			getPointsRecordsTotal({
				page: 1,
				page_size: 20,
				list: [],
				total: 45,
			}),
		).toBe(45)
	})

	test("returns null when total is missing", () => {
		expect(getPointsRecordsTotal({ list: [] })).toBeNull()
		expect(getPointsRecordsTotal(undefined)).toBeNull()
	})
})

describe("getPointsRecordsHasMore", () => {
	test("uses total when available", () => {
		expect(getPointsRecordsHasMore(1, 20, 20, 45)).toBe(true)
		expect(getPointsRecordsHasMore(2, 20, 5, 45)).toBe(true)
		expect(getPointsRecordsHasMore(3, 20, 0, 40)).toBe(false)
	})

	test("falls back to list length when total is null", () => {
		expect(getPointsRecordsHasMore(1, 20, 20, null)).toBe(true)
		expect(getPointsRecordsHasMore(1, 20, 15, null)).toBe(false)
	})
})
