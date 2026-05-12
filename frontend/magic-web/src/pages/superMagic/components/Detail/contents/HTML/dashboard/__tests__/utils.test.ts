import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { removeDashboardCardsFromJS, updateDashboardCardsInJS } from "../utils"

describe("dashboard utils", () => {
	it("should keep data.js valid when removing adjacent cards", () => {
		const jsContent = `const DASHBOARD_CARDS = [
		  {
		    id: "first",
		    type: "metric",
		    layout: { x: 0, y: 0, w: 6, h: 4 },
		    getCardData: async () => ({ value: 1 })
		  },
		  {
		    id: "second",
		    type: "metric",
		    layout: { x: 6, y: 0, w: 6, h: 4 },
		    getCardData: async () => ({ value: 2 })
		  },
		  {
		    id: "third",
		    type: "metric",
		    layout: { x: 12, y: 0, w: 6, h: 4 },
		    getCardData: async () => ({ value: 3 })
		  }
		]

		window.DASHBOARD_CARDS = DASHBOARD_CARDS
		`

		const updated = removeDashboardCardsFromJS(jsContent, ["first", "second"])

		expect(updated).not.toContain('id: "first"')
		expect(updated).not.toContain('id: "second"')
		expect(updated).toContain('id: "third"')
		expect(() => new Function(updated)).not.toThrow()
	})

	it("should keep sample data valid when removing the two X11 trend cards", () => {
		const jsContent = readFileSync(resolve(__dirname, "../样本数据.txt"), "utf8")

		const updated = removeDashboardCardsFromJS(jsContent, [
			"x11_monthly_trend_line",
			"x11_business_trend_area",
		])

		expect(updated).not.toContain('id: "x11_monthly_trend_line"')
		expect(updated).not.toContain('id: "x11_business_trend_area"')
		expect(() => new Function(updated)).not.toThrow()
	})

	it("should update title and layout for the X11 monthly trend card", () => {
		const jsContent = readFileSync(resolve(__dirname, "../样本数据.txt"), "utf8")

		const updated = updateDashboardCardsInJS(jsContent, [
			{
				id: "x11_monthly_trend_line",
				title: "已更新标题",
				layout: { x: 1, y: 19, w: 10, h: 9 },
			},
		])

		expect(updated).toContain('title: "已更新标题"')
		expect(updated).toContain("layout: { x: 1, y: 19, w: 10, h: 9 }")
		expect(() => new Function(updated)).not.toThrow()
	})

	it("should add and edit titleAlign without breaking syntax", () => {
		const jsContent = readFileSync(resolve(__dirname, "../样本数据.txt"), "utf8")

		const updated = updateDashboardCardsInJS(jsContent, [
			{
				id: "x11_monthly_trend_line",
				titleAlign: "right",
			},
			{
				id: "x11_business_composition_donut",
				titleAlign: "left",
			},
		])

		expect(updated).toMatch(
			/id:\s*"x11_monthly_trend_line"[\s\S]*?title:\s*"【X11项目】26年1-4月各月差旅平台费用走势（含同比）"\s*,\s*\n\s*titleAlign:\s*"right"/,
		)
		expect(updated).toMatch(
			/id:\s*"x11_business_composition_donut"[\s\S]*?titleAlign:\s*"left"/,
		)
		expect(() => new Function(updated)).not.toThrow()
	})

	it("should not rewrite nested table column titles when editing the card title", () => {
		const jsContent = `const DASHBOARD_CARDS = [
		  {
		    id: "table_card",
		    type: "table",
		    columns: [{ title: "列标题", dataIndex: "name" }],
		    getCardData: async () => ({ columns: [], data: [] })
		  }
		]

		window.DASHBOARD_CARDS = DASHBOARD_CARDS
		`

		const updated = updateDashboardCardsInJS(jsContent, [
			{
				id: "table_card",
				title: "卡片标题",
				titleAlign: "center",
			},
		])

		expect(updated).toMatch(/id:\s*"table_card"\s*,\s*\n\s*title:\s*"卡片标题"/)
		expect(updated).toMatch(/id:\s*"table_card"[\s\S]*?titleAlign:\s*"center"/)
		expect(updated).toContain('columns: [{ title: "列标题", dataIndex: "name" }]')
		expect(() => new Function(updated)).not.toThrow()
	})
})
