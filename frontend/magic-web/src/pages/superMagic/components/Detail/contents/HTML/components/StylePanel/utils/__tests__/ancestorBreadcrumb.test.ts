import { describe, expect, it } from "vitest"
import { buildAncestorCrumbs, formatBreadcrumbText } from "../ancestorBreadcrumb"

describe("formatBreadcrumbText", () => {
	it("collapses whitespace and truncates long copy", () => {
		expect(formatBreadcrumbText("  春季特惠  活动\n第二行  ")).toBe("春季特惠")
	})

	it("returns undefined for empty text", () => {
		expect(formatBreadcrumbText("   ")).toBeUndefined()
	})
})

describe("buildAncestorCrumbs", () => {
	it("shows two ancestors plus the current node", () => {
		const crumbs = buildAncestorCrumbs(
			{ selector: "h2.title", tagName: "h2", textContent: "春季特惠" },
			[
				{ selector: "article.card", tagName: "article", textContent: "卡片正文" },
				{ selector: "section.group", tagName: "section", textContent: "" },
			],
		)
		expect(crumbs.overflow).toBe(false)
		expect(crumbs.items.map((item) => item.selector)).toEqual([
			"section.group",
			"article.card",
			"h2.title",
		])
		expect(crumbs.items[2]).toMatchObject({
			isCurrent: true,
			text: "春季特惠",
		})
	})

	it("left-truncates deeper trees and exposes the hidden parent", () => {
		const crumbs = buildAncestorCrumbs(
			{ selector: "h2.title", tagName: "h2", textContent: "标题" },
			[
				{ selector: "article.card", tagName: "article" },
				{ selector: "section.group", tagName: "section" },
				{ selector: "main.page", tagName: "main" },
			],
		)
		expect(crumbs.overflow).toBe(true)
		expect(crumbs.hiddenAncestor?.selector).toBe("main.page")
		expect(crumbs.items.map((item) => item.selector)).toEqual([
			"section.group",
			"article.card",
			"h2.title",
		])
	})
})
