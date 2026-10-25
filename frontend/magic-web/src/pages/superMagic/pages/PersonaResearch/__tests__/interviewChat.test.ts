import { describe, expect, it } from "vitest"
import {
	hasInterviewChatReply,
	interviewChatPrompt,
	interviewChatContent,
	isInterviewChatMessage,
} from "../services/interviewChat"
import { parseInterviewFile } from "../services/researchFiles"

describe("interview chat contract", () => {
	it("preserves user origin and request identity through the real file parser", () => {
		const parsed = parseInterviewFile(
			JSON.stringify({
				schema_version: 1,
				persona_id: "p1",
				status: "done",
				insights_outdated: true,
				rounds: [
					{ role: "moderator", text: "Why?", source: "user", request_id: "r1" },
					{ role: "persona", text: "Because…", request_id: "r1" },
				],
			}),
		)
		expect(parsed.ok).toBe(true)
		if (!parsed.ok) return
		const file = parsed.data
		expect(file.insights_outdated).toBe(true)
		expect(file.rounds[0].source).toBe("user")
		expect(hasInterviewChatReply(file, "r1")).toBe(true)
		expect(hasInterviewChatReply(file, "r2")).toBe(false)
		// A question alone must not remove the waiting state or manufacture an answer.
		expect(hasInterviewChatReply({ ...file, rounds: file.rounds.slice(0, 1) }, "r1")).toBe(
			false,
		)
	})
	it("keeps the user's exact question and resolvable file identities in the agent request", () => {
		const request = {
			id: "r1",
			topicId: "t1",
			personaId: "p1",
			personaPath: "personas/p1.json",
			transcriptPath: "studies/s1/interviews/p1.json",
			question: "你说的‘贵’，具体是指什么？\n可以举例吗？",
		}
		const prompt = interviewChatPrompt(request)
		expect(JSON.parse(prompt.split("\n\n")[1])).toEqual(request)
		expect(prompt).toContain("follow_up_request_id")
		expect(prompt).toContain("Do not run automatic interview questions")
		const content = interviewChatContent(request, "测试人设")
		const mention = content.content?.[0].content?.[0]
		expect(mention?.attrs?.data.label).toBe("测试人设")
		expect(mention?.attrs?.data.text).toBe(prompt)
		expect(mention?.attrs?.label).toBe(prompt)
		expect(content.content?.[0].content?.[1].text).toBe(` ${request.question}`)
		expect(isInterviewChatMessage({ content: JSON.stringify(content) }, request.id)).toBe(true)
		expect(isInterviewChatMessage({ content: "An assistant mentions r1" }, request.id)).toBe(
			false,
		)
		expect(isInterviewChatMessage({ content: JSON.stringify(content) }, "r2")).toBe(false)
	})
})
