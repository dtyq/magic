import dayjs from "@/infrastructure/vendors/dayjs"
import { beforeEach, describe, expect, test, vi } from "vitest"

import {
	getMobileSettingsPointsPurchaseState,
	getMobileSettingsPointsSheetTitleKey,
	getPointsRecordGroupKey,
	getPointsRecordsHasMore,
	getPointsRecordsTotal,
	normalizePointsRecordRemark,
	normalizePointsRecords,
} from "../pointsRecords"

const pointsStoreMock = vi.hoisted(() => ({
	organizationPointsInfo: null as object | null,
	organizationPoints: 0,
	organizationSubscriptionInfo: null as {
		is_paid_plan?: boolean
		is_recharge_points?: boolean
	} | null,
}))

vi.mock("@/models/user", () => ({
	userStore: {
		user: pointsStoreMock,
	},
}))

const TIMEZONE = "Asia/Shanghai"

beforeEach(() => {
	pointsStoreMock.organizationPointsInfo = null
	pointsStoreMock.organizationPoints = 0
	pointsStoreMock.organizationSubscriptionInfo = null
})

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

describe("normalizePointsRecordRemark", () => {
	test("returns empty string for nullish and blank values", () => {
		expect(normalizePointsRecordRemark(null)).toBe("")
		expect(normalizePointsRecordRemark(undefined)).toBe("")
		expect(normalizePointsRecordRemark("   ")).toBe("")
	})

	test("returns trimmed remark text", () => {
		expect(normalizePointsRecordRemark("  活动赠送  ")).toBe("活动赠送")
	})
})

describe("normalizePointsRecords", () => {
	test("maps description and remark independently", () => {
		const [record] = normalizePointsRecords(
			[
				{
					id: "1",
					amount: "10",
					description: "模型调用",
					remark: "测试备注",
					updated_at: "05-20 19:45",
				},
			],
			"积分变更",
		)

		expect(record?.description).toBe("模型调用")
		expect(record?.remark).toBe("测试备注")
	})

	test("keeps remark empty when historical data has no remark", () => {
		const [record] = normalizePointsRecords(
			[
				{
					id: "2",
					amount: "-5",
					description: "话题消耗",
					updated_at: "05-20 19:45",
				},
			],
			"积分变更",
		)

		expect(record?.remark).toBe("")
	})
})

describe("getMobileSettingsPointsPurchaseState", () => {
	test("首次无缓存时保留空值而不是显示零积分", () => {
		expect(getMobileSettingsPointsPurchaseState().points).toBeNull()
	})

	test("有缓存时返回积分和现有购买权限", () => {
		pointsStoreMock.organizationPointsInfo = { source: "synthetic-cache" }
		pointsStoreMock.organizationPoints = 420
		pointsStoreMock.organizationSubscriptionInfo = {
			is_paid_plan: true,
			is_recharge_points: true,
		}

		expect(getMobileSettingsPointsPurchaseState()).toEqual({
			points: 420,
			isPaidPlan: true,
			canRecharge: true,
		})
	})
})

describe("getMobileSettingsPointsSheetTitleKey", () => {
	test("普通部署继续使用购买积分标题", () => {
		expect(
			getMobileSettingsPointsSheetTitleKey({ privateDeploy: false, role: "teamAdmin" }),
		).toBe("bonusPointsModal.purchasePoints")
	})

	test("组织部署使用只读积分标题", () => {
		expect(
			getMobileSettingsPointsSheetTitleKey({ privateDeploy: true, role: "teamAdmin" }),
		).toBe("setting.teamPoints")
		expect(
			getMobileSettingsPointsSheetTitleKey({ privateDeploy: true, role: "personal" }),
		).toBe("bonusPointsModal.bonusPoints")
	})
})
