import { describe, expect, it } from "vitest"
import {
	hypothesisStanceGroups,
	leadQuote,
	quotedPersonaIds,
	sourceClaims,
	sourceRefs,
	splitSourceTokens,
} from "../services/hypothesisVoices"

describe("hypothesisStanceGroups", () => {
	it("returns null when no theme is linked to the hypothesis", () => {
		expect(
			hypothesisStanceGroups(
				{ id: "H1" },
				[{ hypothesis_ids: ["H2"], stance_by_persona: { a: "support" } }],
				["a"],
			),
		).toBeNull()
	})

	it("groups panel personas by their combined stance across linked themes", () => {
		const groups = hypothesisStanceGroups(
			{ id: "H1" },
			[
				{
					hypothesis_ids: ["H1"],
					stance_by_persona: { a: "support", b: "support", c: "oppose", d: "mixed" },
				},
				{
					hypothesis_ids: ["H1", "H3"],
					stance_by_persona: { b: "oppose", e: "not_mentioned" },
				},
			],
			["a", "b", "c", "d", "e", "f"],
		)
		expect(groups).toEqual([
			{ stance: "support", personaIds: ["a"] },
			{ stance: "partial", personaIds: ["b", "d"] },
			{ stance: "oppose", personaIds: ["c"] },
			{ stance: "none", personaIds: ["e", "f"] },
		])
	})

	it("falls back to personas named in themes when the panel is unknown", () => {
		expect(
			hypothesisStanceGroups(
				{ id: "H1" },
				[{ hypothesis_ids: ["H1"], stance_by_persona: { a: "support" } }],
				[],
			),
		).toEqual([{ stance: "support", personaIds: ["a"] }])
	})
})

describe("evidence helpers", () => {
	const hypothesis = {
		evidence_refs: [
			{ kind: "source" as const, ref: "S8" },
			{ kind: "quote" as const, persona_id: "a", text: "第一句", round_index: 1 },
			{ kind: "quote" as const, persona_id: "b", text: "第二句" },
			{ kind: "quote" as const, persona_id: "a", text: "第三句" },
			{ kind: "source" as const, ref: "S9" },
		],
	}

	it("lists quoted personas once, in citation order", () => {
		expect(quotedPersonaIds(hypothesis)).toEqual(["a", "b"])
	})

	it("picks the first quote as the lead quote", () => {
		expect(leadQuote({ id: "H1", ...hypothesis })?.text).toBe("第一句")
		expect(leadQuote({ id: "H9", evidence_refs: [] })).toBeNull()
	})

	it("collects structured source ids, then ids written in the reason", () => {
		expect(sourceRefs({ ...hypothesis, verdict_reason: "外部来源 [S9][S12] 一致" })).toEqual([
			"S8",
			"S9",
			"S12",
		])
	})

	it("falls back to a linked theme's quote when the hypothesis cites none", () => {
		expect(
			leadQuote({ id: "H2", evidence_refs: [] }, [
				{ hypothesis_ids: ["H1"], quote_refs: [{ persona_id: "x", text: "别的" }] },
				{ hypothesis_ids: ["H2"], quote_refs: [{ persona_id: "b", text: "主题原话" }] },
			]),
		).toEqual({ persona_id: "b", text: "主题原话" })
	})

	it("prefers a theme quote that reads as a full sentence over a short fragment", () => {
		expect(
			leadQuote({ id: "H1" }, [
				{
					hypothesis_ids: ["H1"],
					quote_refs: [
						{ persona_id: "a", text: "三千个差六千" },
						{
							persona_id: "b",
							text: "录是能录，录完谁给我整理？没人整理，那跟没录一样。",
						},
					],
				},
			])?.persona_id,
		).toBe("b")
	})

	it("prefers an unprompted quote, from the hypothesis or its themes", () => {
		expect(
			leadQuote({
				id: "H1",
				evidence_refs: [
					{
						kind: "quote",
						persona_id: "a",
						text: "被问到才这么说的一句话",
						prompted: true,
					},
					{ kind: "quote", persona_id: "b", text: "自己主动说出来的一句话" },
				],
			})?.persona_id,
		).toBe("b")
		expect(
			leadQuote({ id: "H1" }, [
				{
					hypothesis_ids: ["H1"],
					quote_refs: [
						{ persona_id: "a", text: "主持人提到之后才说的完整一句话", prompted: true },
						{ persona_id: "b", text: "没人提起时自己说出的完整一句话" },
					],
				},
			])?.persona_id,
		).toBe("b")
	})

	it("lists source claims with their coverage", () => {
		expect(
			sourceClaims({
				evidence_refs: [
					{ kind: "source", ref: "S1", claim: "多数用户因自动续费放弃", covers: "core" },
					{ kind: "source", ref: "S2" },
				],
			}),
		).toEqual([{ ref: "S1", claim: "多数用户因自动续费放弃", covers: "core" }])
	})

	it("splits inline source tokens out of the reason", () => {
		expect(splitSourceTokens("依据 [S8][S9]，无反对")).toEqual([
			{ text: "依据 " },
			{ source: "S8" },
			{ source: "S9" },
			{ text: "，无反对" },
		])
	})
})
