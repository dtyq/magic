import { describe, expect, it } from "vitest"
import {
	getPersonaChat,
	getPersonaChatArguments,
	getStudyPersonas,
	getStudyPersonasArguments,
	getStudyProgress,
} from "../parse"

describe("getStudyProgress", () => {
	it("always returns the six phases in order, filling missing ones as pending", () => {
		const data = getStudyProgress({
			type: "study_progress",
			data: {
				phase: "desk_research",
				phases: [
					{ key: "plan", status: "done" },
					{ key: "clarify", status: "done" },
					{ key: "desk_research", status: "running" },
					{ key: "unknown", status: "done" },
				],
			},
		})

		expect(data?.phase).toBe("desk_research")
		expect(data?.phases.map((p) => `${p.key}:${p.status}`)).toEqual([
			"clarify:done",
			"plan:done",
			"desk_research:running",
			"interview:pending",
			"report:pending",
			"validation:pending",
		])
	})

	it("returns null for legacy markdown details", () => {
		expect(getStudyProgress({ type: "md", data: { content: "# Study progress" } })).toBeNull()
	})
})

describe("getPersonaChat", () => {
	it("keeps answers and failures of a partly failed focus group", () => {
		const data = getPersonaChat({
			type: "persona_chat",
			data: {
				question: "Would you pay 299?",
				round_number: 2,
				round_limit: 5,
				answers: [
					{
						persona_id: "p_zhang",
						name: "Zhang",
						text: "Probably not.",
						gender: "女",
						age: "32",
					},
					{ persona_id: "p_broken", name: "Broken", text: "" },
				],
				failed: [{ persona_id: "p_li", name: "Li", reason: "Service unavailable" }],
				error: "",
			},
		})

		expect(data?.round_number).toBe(2)
		expect(data?.answers).toEqual([
			{
				persona_id: "p_zhang",
				name: "Zhang",
				text: "Probably not.",
				gender: "女",
				age: "32",
			},
		])
		expect(data?.failed[0]).toMatchObject({
			name: "Li",
			reason: "Service unavailable",
			gender: "",
		})
	})

	it("reads the question and personas from arguments while running", () => {
		const pending = getPersonaChatArguments(
			JSON.stringify({
				question: "Why?",
				persona_paths: ["personas/p_zhang_1a2b.json"],
				transcript_path: "studies/s/interviews/p_zhang_1a2b.json",
				round_number: 3,
			}),
		)

		expect(pending).toEqual({
			question: "Why?",
			round_number: 3,
			personas: [{ persona_id: "p_zhang_1a2b", name: "" }],
		})
		expect(getPersonaChatArguments('{"question": "Wh')).toBeNull()
	})
})

describe("getStudyPersonas", () => {
	it("derives counts when they are missing", () => {
		const data = getStudyPersonas({
			type: "study_personas",
			data: {
				panel_name: "Panel",
				personas: [
					{ persona_id: "p_a", name: "A", segment: "Owners", reused: true },
					{ persona_id: "p_b", name: "B", segment: "Owners", reused: false },
				],
			},
		})

		expect(data).toMatchObject({ new_count: 1, reused_count: 1 })
	})

	it("lists pending personas from arguments with stable keys", () => {
		expect(
			getStudyPersonasArguments(
				JSON.stringify({ personas: [{ id: "p_old" }, { name: "New one" }] }),
			),
		).toEqual([
			{ persona_id: "p_old", name: "p_old" },
			{ persona_id: "pending-1", name: "New one" },
		])
	})
})
