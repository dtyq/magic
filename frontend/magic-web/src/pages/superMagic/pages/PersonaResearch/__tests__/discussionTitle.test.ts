import { describe, expect, it } from "vitest"
import { discussionTitle } from "../services/discussionTitle"

const rounds = [
	{ speaker: "moderator", text: " 上次  下楼洗衣\n是什么时候？" },
	{ speaker: "p_a", text: "上个月" },
] as Parameters<typeof discussionTitle>[0]["rounds"]

describe("discussionTitle", () => {
	it("prefers the saved topic", () => {
		expect(discussionTitle({ topic: " 为什么下楼洗 ", rounds })).toEqual({
			text: "为什么下楼洗",
			isFirstQuestion: false,
		})
	})

	it("falls back to the first question, flattened", () => {
		expect(discussionTitle({ rounds })).toEqual({
			text: "上次 下楼洗衣 是什么时候？",
			isFirstQuestion: true,
		})
	})

	it("returns null with neither", () => {
		expect(discussionTitle({ rounds: [] })).toBeNull()
	})
})
