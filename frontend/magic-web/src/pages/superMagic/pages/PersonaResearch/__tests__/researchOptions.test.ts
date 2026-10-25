import { describe, expect, it } from "vitest"
import {
	appendParagraph,
	interviewDepth,
	normalizeCustomMethod,
	parseResearchOptions,
	parseWholeNumber,
	researchSettingsLine,
} from "../services/researchOptions"

describe("researchSettingsLine", () => {
	it("sends depth preferences instead of a required round count", () => {
		for (const [rounds, depth] of [
			[5, "quick"],
			[12, "standard"],
			[20, "deep"],
		] as const) {
			expect(researchSettingsLine({ method: "auto", panelSize: "auto", rounds })).toBe(
				`【研究设置】访谈深度: ${depth}`,
			)
		}
		// Existing saved numeric settings select a depth without changing old study files.
		expect(interviewDepth(3)).toBe("quick")
		expect(interviewDepth(7)).toBe("standard")
		expect(parseResearchOptions({ rounds: 20 }).rounds).toBe(20)
	})
	it("omits auto items and uses the fixed prefix and labels", () => {
		expect(researchSettingsLine({ method: "concept_test", panelSize: 8, rounds: 5 })).toBe(
			"【研究设置】访谈人数: 8 · 访谈深度: quick · 研究方式: concept_test",
		)
		expect(researchSettingsLine({ method: "auto", panelSize: 6, rounds: "auto" })).toBe(
			"【研究设置】访谈人数: 6",
		)
	})

	it("sends a custom method with its description", () => {
		expect(
			researchSettingsLine({
				method: "custom",
				customMethod: "价格敏感度测试，用 Van Westendorp",
				panelSize: 9,
				rounds: "auto",
			}),
		).toBe("【研究设置】访谈人数: 9 · 研究方式: 自定义：价格敏感度测试，用 Van Westendorp")
	})

	it("returns null when nothing is fixed", () => {
		expect(
			researchSettingsLine({ method: "auto", panelSize: "auto", rounds: "auto" }),
		).toBeNull()
	})
})

describe("researchSettingsLine with a report template", () => {
	it("adds the chosen template and leaves the default out", () => {
		expect(
			researchSettingsLine(
				{ method: "auto", panelSize: "auto", rounds: "auto" },
				{ reportTemplatePath: "templates/brand.html" },
			),
		).toBe("【研究设置】报告模板: templates/brand.html")
		expect(researchSettingsLine({ method: "auto", panelSize: 6, rounds: "auto" }, {})).toBe(
			"【研究设置】访谈人数: 6",
		)
	})
})

describe("researchSettingsLine with chosen personas", () => {
	const paths = ["personas/p_a.json", "personas/p_b.json", "personas/p_c.json"]

	it("lists the persona files and keeps auto panel size out", () => {
		expect(
			researchSettingsLine(
				{ method: "auto", panelSize: "auto", rounds: "auto" },
				{ personaPaths: paths, reportTemplatePath: "templates/brand.html" },
			),
		).toBe(
			"【研究设置】指定人设: personas/p_a.json, personas/p_b.json, personas/p_c.json · 报告模板: templates/brand.html",
		)
	})

	it("raises a fixed panel size to the number of chosen personas", () => {
		expect(
			researchSettingsLine(
				{ method: "auto", panelSize: 2, rounds: "auto" },
				{ personaPaths: paths },
			),
		).toMatch(/^【研究设置】访谈人数: 3 · 指定人设: /)
		expect(
			researchSettingsLine(
				{ method: "auto", panelSize: 6, rounds: "auto" },
				{ personaPaths: paths },
			),
		).toMatch(/^【研究设置】访谈人数: 6 · /)
	})
})

describe("appendParagraph", () => {
	it("adds a paragraph after the existing content without mutating it", () => {
		const doc = {
			type: "doc",
			content: [{ type: "paragraph", content: [{ type: "text", text: "问题" }] }],
		}
		const next = appendParagraph(doc, "【研究设置】访谈人数: 8")
		expect(next.content).toHaveLength(2)
		expect(next.content?.[1]).toEqual({
			type: "paragraph",
			content: [{ type: "text", text: "【研究设置】访谈人数: 8" }],
		})
		expect(doc.content).toHaveLength(1)
	})

	it("creates a document when there is none", () => {
		expect(appendParagraph(undefined, "x").type).toBe("doc")
	})
})

describe("parseResearchOptions", () => {
	it("keeps values in range and resets the rest to auto", () => {
		expect(parseResearchOptions({ method: "concept_test", panelSize: 9, rounds: 5 })).toEqual({
			method: "concept_test",
			panelSize: 9,
			rounds: 5,
		})
		expect(parseResearchOptions({ method: "nope", panelSize: 13, rounds: 21 })).toEqual({
			method: "auto",
			panelSize: "auto",
			rounds: "auto",
		})
		expect(parseResearchOptions(null)).toEqual({
			method: "auto",
			panelSize: "auto",
			rounds: "auto",
		})
	})

	it("keeps a custom method only with a description", () => {
		expect(
			parseResearchOptions({ method: "custom", customMethod: "  卡片分类  ", rounds: 2 }),
		).toEqual({ method: "custom", customMethod: "卡片分类", panelSize: "auto", rounds: 2 })
		expect(parseResearchOptions({ method: "custom", customMethod: " " }).method).toBe("auto")
		expect(
			parseResearchOptions({ method: "concept_test", customMethod: "x" }),
		).not.toHaveProperty("customMethod")
	})
})

describe("parseWholeNumber", () => {
	const range = { min: 1, max: 7 }

	it("accepts whole numbers in range, typed or stored", () => {
		expect(parseWholeNumber("3", range)).toBe(3)
		expect(parseWholeNumber(7, range)).toBe(7)
	})

	it("rejects decimals, blanks and values out of range", () => {
		expect(parseWholeNumber("2.5", range)).toBeNull()
		expect(parseWholeNumber("", range)).toBeNull()
		expect(parseWholeNumber(0, range)).toBeNull()
		expect(parseWholeNumber(8, range)).toBeNull()
	})
})

describe("normalizeCustomMethod", () => {
	it("collapses spaces, caps the length and drops blanks", () => {
		expect(normalizeCustomMethod(" a \n b ")).toBe("a b")
		expect(normalizeCustomMethod("x".repeat(80))).toHaveLength(60)
		expect(normalizeCustomMethod("   ")).toBeNull()
	})
})
