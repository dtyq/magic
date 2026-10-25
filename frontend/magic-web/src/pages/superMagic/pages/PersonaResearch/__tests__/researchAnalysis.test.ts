import { describe, expect, it } from "vitest"
import {
	chooseDimensionChart,
	computeInferredRatio,
	normalizeDecisionWeights,
	resolveTranscriptQuality,
	splitInferredSegments,
} from "../services/researchAnalysis"

describe("splitInferredSegments", () => {
	it("marks the clause before (inferred) and hides the marker", () => {
		expect(
			splitInferredSegments("我们有 12 家店。去年关了 2 家 (inferred)，主要是租金。"),
		).toEqual([
			{ text: "我们有 12 家店。", inferred: false },
			{ text: "去年关了 2 家", inferred: true },
			{ text: "，主要是租金。", inferred: false },
		])
	})

	it("returns the text unchanged without markers", () => {
		expect(splitInferredSegments("没有推测")).toEqual([{ text: "没有推测", inferred: false }])
	})
})

describe("computeInferredRatio", () => {
	it("counts respondent sentences only", () => {
		const ratio = computeInferredRatio([
			{ role: "moderator", text: "问题一。问题二 (inferred)。" },
			{ role: "persona", text: "第一句。第二句 (inferred)。第三句。第四句 (inferred)。" },
		])
		expect(ratio).toBe(0.5)
	})

	it("prefers the interviewer's ratio and flags high inference", () => {
		const result = resolveTranscriptQuality({
			rounds: [{ role: "persona", text: "全是真的。" }],
			quality: { inferred_ratio: 0.45 },
		})
		expect(result.inferredRatio).toBe(0.45)
		expect(result.isHighInferred).toBe(true)
	})
})

describe("normalizeDecisionWeights", () => {
	it("keeps qualitative lists", () => {
		expect(
			normalizeDecisionWeights([
				{ factor: "价格", level: "high" },
				{ factor: "x", level: "bad" },
			]),
		).toEqual([{ factor: "价格", level: "high" }])
	})

	it("ranks legacy numeric weights into levels without decimals", () => {
		expect(normalizeDecisionWeights({ 关系: 0.2, 价格: 0.5, 品牌: 0.1 })).toEqual([
			{ factor: "价格", level: "high" },
			{ factor: "关系", level: "medium" },
			{ factor: "品牌", level: "low" },
		])
	})
})

describe("chooseDimensionChart", () => {
	it("uses radar only for 5–8 dimensions and 2–3 segments", () => {
		expect(chooseDimensionChart(6, 2)).toBe("radar")
		expect(chooseDimensionChart(4, 2)).toBe("bar")
		expect(chooseDimensionChart(6, 4)).toBe("bar")
		expect(chooseDimensionChart(9, 3)).toBe("bar")
	})
})
