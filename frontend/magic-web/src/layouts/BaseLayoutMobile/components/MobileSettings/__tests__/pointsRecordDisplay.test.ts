import { describe, expect, test } from "vitest"

import {
	formatPointsRecordAmount,
	getPointsRecordDetailMetaRows,
	getPointsRecordDirection,
	getPointsRecordListTime,
	getPointsRecordListTitle,
	getPointsRecordRemarkText,
} from "../pointsRecordDisplay"
import type { PointsRecordItem } from "../types"

describe("pointsRecordDisplay", () => {
	test("getPointsRecordListTitle prefers description", () => {
		expect(getPointsRecordListTitle("下载猫咪图片", "未命名话题")).toBe("下载猫咪图片")
	})

	test("getPointsRecordListTitle falls back to unnamed topic", () => {
		expect(getPointsRecordListTitle("  ", "未命名话题")).toBe("未命名话题")
	})

	test("formatPointsRecordAmount uses sign and absolute value", () => {
		expect(formatPointsRecordAmount(40)).toBe("+ 40")
		expect(formatPointsRecordAmount(-60)).toBe("- 60")
	})

	test("getPointsRecordListTime returns raw updated_at", () => {
		expect(getPointsRecordListTime("05-20 19:45")).toBe("05-20 19:45")
		expect(getPointsRecordListTime("")).toBe("--")
	})

	test("getPointsRecordDirection distinguishes income and expense", () => {
		expect(getPointsRecordDirection(1)).toBe("income")
		expect(getPointsRecordDirection(-1)).toBe("expense")
	})

	test("getPointsRecordRemarkText returns null for empty values", () => {
		expect(getPointsRecordRemarkText(undefined)).toBeNull()
		expect(getPointsRecordRemarkText(null)).toBeNull()
		expect(getPointsRecordRemarkText("")).toBeNull()
		expect(getPointsRecordRemarkText("   ")).toBeNull()
	})

	test("getPointsRecordRemarkText returns trimmed remark", () => {
		expect(getPointsRecordRemarkText("  管理员调整  ")).toBe("管理员调整")
	})

	test("getPointsRecordDetailMetaRows includes label recordId and time", () => {
		const item: PointsRecordItem = {
			id: "rec-1",
			amount: -10,
			label: "话题 ID: 1",
			description: "模型调用",
			remark: "",
			createdAt: "2026-05-20 10:00:00",
			updatedAt: "05-20 19:45",
		}

		const rows = getPointsRecordDetailMetaRows(item, {
			recordId: "记录 ID",
			time: "时间",
		})

		expect(rows.map((row) => row.key)).toEqual(["label", "recordId", "time"])
		expect(rows[0]?.text).toBe("话题 ID: 1")
		expect(rows[1]?.text).toBe("记录 ID: rec-1")
		expect(rows[2]?.text).toBe("时间: 05-20 19:45")
	})

	test("getPointsRecordDetailMetaRows includes remark when present", () => {
		const item: PointsRecordItem = {
			id: "rec-2",
			amount: 100,
			label: "",
			description: "充值",
			remark: "活动赠送",
			createdAt: "2026-05-20 10:00:00",
			updatedAt: "05-20 19:45",
		}

		const rows = getPointsRecordDetailMetaRows(item, {
			recordId: "记录 ID",
			time: "时间",
			remark: "备注",
		})

		expect(rows.map((row) => row.key)).toEqual(["remark", "recordId", "time"])
		expect(rows[0]?.text).toBe("备注: 活动赠送")
	})
})
