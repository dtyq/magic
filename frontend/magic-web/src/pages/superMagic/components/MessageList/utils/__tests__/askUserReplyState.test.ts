import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/models/user", () => ({
	userStore: {
		user: {
			userInfo: {
				magic_id: "user-1",
				organization_code: "org-1",
			},
		},
	},
}))

import {
	buildAskUserReplyStateKey,
	claimAskUserReply,
	clearAskUserReply,
	isTerminalAskUserReplyError,
	isTerminalAskUserReplyState,
	markAskUserReply,
	readAskUserReplyState,
} from "../askUserReplyState"

describe("askUserReplyState", () => {
	beforeEach(() => {
		window.localStorage.clear()
	})

	it("scopes reply state by user, organization, topic, and tool call", () => {
		const key = buildAskUserReplyStateKey({
			topicId: "topic-1",
			toolCallId: "call-1",
		})

		expect(key).toContain("user-1/org-1/topic-1/call-1")
	})

	it("allows only the first claim for the same tool call", () => {
		const key = buildAskUserReplyStateKey({
			topicId: "topic-1",
			toolCallId: "call-1",
		})

		expect(claimAskUserReply(key)).toBe(true)
		expect(claimAskUserReply(key)).toBe(false)
		expect(readAskUserReplyState(key)?.status).toBe("sending")
	})

	it("persists terminal reply state across remounts", () => {
		const key = buildAskUserReplyStateKey({
			topicId: "topic-1",
			toolCallId: "call-1",
		})

		claimAskUserReply(key)
		markAskUserReply(key, "skipped")

		const restored = readAskUserReplyState(key)
		expect(restored?.status).toBe("skipped")
		expect(isTerminalAskUserReplyState(restored)).toBe(true)
		expect(claimAskUserReply(key)).toBe(false)
	})

	it("can clear a retryable in-flight claim", () => {
		const key = buildAskUserReplyStateKey({
			topicId: "topic-1",
			toolCallId: "call-1",
		})

		expect(claimAskUserReply(key)).toBe(true)
		clearAskUserReply(key)
		expect(claimAskUserReply(key)).toBe(true)
	})

	it.each([
		"问题不存在或已超时",
		{ message: "USER_TOOL_CALL_NOT_FOUND" },
		{ data: { error: "already_processed" } },
		{ error: { message: "question already processed" } },
	])("recognizes terminal backend errors: %o", (error) => {
		expect(isTerminalAskUserReplyError(error)).toBe(true)
	})

	it("does not classify retryable transport errors as terminal", () => {
		expect(isTerminalAskUserReplyError(new Error("发送超时，请求未得到响应"))).toBe(false)
	})
})
