import dayjs from "@/lib/dayjs"
import { describe, expect, test } from "vitest"

import { getPointsRecordGroupKey } from "../pointsRecords"

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
