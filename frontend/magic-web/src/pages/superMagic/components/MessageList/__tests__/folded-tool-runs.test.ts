import { describe, expect, it } from "vitest"
import { buildFoldedToolRuns } from "../folded-tool-runs"
import type { SuperMagicMessageItem } from "../type"

const INVALID = "访谈参数不正确，AI 会修正后重试"

function call(id: string, name = "persona_chat", question = `Q${id}`): SuperMagicMessageItem {
	return {
		type: "text",
		role: "assistant",
		content: "",
		tool_calls: [
			{
				id,
				type: "function",
				function: { name, label: name, arguments: JSON.stringify({ question }) },
			},
		],
	} as SuperMagicMessageItem
}

function result(
	id: string,
	{
		status = "error",
		error = INVALID,
		answers = 0,
	}: { status?: string; error?: string; answers?: number } = {},
): SuperMagicMessageItem {
	return {
		type: "text",
		role: "tool",
		tool: {
			id,
			name: "persona_chat",
			status,
			detail: {
				type: "persona_chat",
				data: {
					question: "",
					answers: Array.from({ length: answers }, () => ({})),
					failed: [],
					error,
				},
			},
		},
	} as SuperMagicMessageItem
}

const thinking = {
	type: "text",
	role: "assistant",
	content: "",
	reasoning_content: "…",
} as SuperMagicMessageItem

describe("buildFoldedToolRuns", () => {
	it("folds adjacent same-reason failures into the first, hiding the rest and thinking between", () => {
		const messages = [
			call("a"),
			result("a"),
			thinking,
			call("b"),
			result("b"),
			call("c"),
			result("c"),
		]
		const runs = buildFoldedToolRuns(messages)
		expect([...runs.hiddenSourceIndices].sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5])
		expect(runs.attemptsByLeadId.get("a")?.map((item) => item.question)).toEqual([
			"Qa",
			"Qb",
			"Qc",
		])
	})

	it("ends a run at a success, another reason or visible text", () => {
		const success = [
			call("a"),
			result("a"),
			call("b"),
			result("b", { status: "success", error: "", answers: 2 }),
			call("c"),
			result("c"),
		]
		expect(buildFoldedToolRuns(success).attemptsByLeadId.size).toBe(0)
		const otherReason = [
			call("a"),
			result("a"),
			call("b"),
			result("b", { error: "档案读不到" }),
		]
		expect(buildFoldedToolRuns(otherReason).attemptsByLeadId.size).toBe(0)
		const said = {
			type: "text",
			role: "assistant",
			content: "我换个问法",
		} as SuperMagicMessageItem
		expect(
			buildFoldedToolRuns([call("a"), result("a"), said, call("b"), result("b")])
				.attemptsByLeadId.size,
		).toBe(0)
	})

	it("reads history messages that keep tool data under debug", () => {
		const history = (message: SuperMagicMessageItem) =>
			({
				type: "super_magic_message",
				role: message.role,
				content: null,
				tool_calls: null,
				debug: { ...message },
			}) as unknown as SuperMagicMessageItem
		const messages = [call("a"), result("a"), call("b"), result("b")].map(history)
		expect(buildFoldedToolRuns(messages).attemptsByLeadId.get("a")).toHaveLength(2)
	})

	it("leaves single failures and other tools alone", () => {
		expect(buildFoldedToolRuns([call("a"), result("a")]).hiddenSourceIndices.size).toBe(0)
		const other = [call("a", "web_search"), result("a"), call("b", "web_search"), result("b")]
		expect(buildFoldedToolRuns(other).hiddenSourceIndices.size).toBe(0)
	})
})
