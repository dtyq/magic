import { describe, expect, it } from "vitest"
import { routeResearchFile } from "../services/researchFileRouting"

describe("routeResearchFile", () => {
	it("routes library persona files to the persona dialog", () => {
		expect(routeResearchFile("personas/p_chen_1a2b.json")).toEqual({
			kind: "persona",
			personaId: "p_chen_1a2b",
		})
		expect(routeResearchFile("/personas/p_chen_1a2b.json")).toEqual({
			kind: "persona",
			personaId: "p_chen_1a2b",
		})
	})

	it("does not treat nested personas paths as persona files", () => {
		expect(routeResearchFile("personas/archive/p_x.json")).toEqual({ kind: "preview" })
	})

	it("routes interview files to that persona's interview", () => {
		expect(routeResearchFile("studies/a-1/interviews/p_chenlan_431d.json")).toEqual({
			kind: "interview",
			personaId: "p_chenlan_431d",
		})
		expect(routeResearchFile("interviews/p_chenlan_431d.json")).toEqual({
			kind: "interview",
			personaId: "p_chenlan_431d",
		})
	})

	it("routes discussions, synthesis and validation results to their tabs", () => {
		expect(routeResearchFile("studies/a-1/discussions/d1.json")).toEqual({
			kind: "tab",
			tab: "discussions",
		})
		expect(routeResearchFile("studies/a-1/synthesis.json")).toEqual({
			kind: "tab",
			tab: "analysis",
		})
		expect(routeResearchFile("studies/a-1/validation-results.json")).toEqual({
			kind: "tab",
			tab: "validation",
		})
	})

	it("keeps readable and unknown files on the generic preview", () => {
		for (const path of [
			"studies/a-1/report.html",
			"studies/a-1/plan.md",
			"studies/a-1/desk-research.md",
			"studies/a-1/validation-questionnaire.md",
			"studies/a-1/study.json",
			"notes.png",
			"",
		]) {
			expect(routeResearchFile(path)).toEqual({ kind: "preview" })
		}
		expect(routeResearchFile(undefined)).toEqual({ kind: "preview" })
	})

	it("ignores query and hash from link navigation", () => {
		expect(routeResearchFile("interviews/p_a.json#line-3")).toEqual({
			kind: "interview",
			personaId: "p_a",
		})
	})
})
