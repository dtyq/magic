import { beforeEach, describe, expect, it } from "vitest"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import {
	getConversationTopicModeOverride,
	registerConversationTopicModeOverride,
	resetConversationTopicModeOverridesForTests,
} from "../conversationTopicModeOverride"

describe("conversationTopicModeOverride", () => {
	beforeEach(() => {
		resetConversationTopicModeOverridesForTests()
	})

	it("returns the registered mode until the last registration is released", () => {
		const first = registerConversationTopicModeOverride("topic-1", TopicMode.MagiClaw)
		const second = registerConversationTopicModeOverride("topic-1", TopicMode.MagiClaw)

		expect(getConversationTopicModeOverride("topic-1")).toBe(TopicMode.MagiClaw)
		first()
		expect(getConversationTopicModeOverride("topic-1")).toBe(TopicMode.MagiClaw)
		second()
		expect(getConversationTopicModeOverride("topic-1")).toBeUndefined()
	})
})
