import { describe, expect, test } from "vitest"

import {
	formatPointsRecordAmount,
	getPointsRecordDetailMetaRows,
	getPointsRecordDirection,
	getPointsRecordListTime,
	getPointsRecordListTitle,
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

	test("getPointsRecordDetailMetaRows includes label recordId and time", () => {
		const item: PointsRecordItem = {
			id: "rec-1",
			amount: -10,
			label: "话题 ID: 1",
			description: "模型调用",
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
})
