import { describe, expect, it } from "vitest"
import type { Topic } from "@/pages/superMagic/pages/Workspace/types"
import { topicNeedsChatDetailRestore } from "../projectPageComposerUtils"

function createMockTopic(overrides: Partial<Topic> = {}): Topic {
	return {
		id: "topic-mock-1",
		user_id: "user-mock-1",
		chat_topic_id: "chat-topic-mock-1",
		chat_conversation_id: "conversation-mock-1",
		topic_name: "Mock Topic",
		task_status: "waiting",
		task_mode: "chat",
		project_id: "project-mock-1",
		topic_mode: "general",
		updated_at: "2026-06-08T00:00:00.000Z",
		workspace_id: "workspace-mock-1",
		token_used: null,
		...overrides,
	} as Topic
}

describe("topicNeedsChatDetailRestore", () => {
	it("returns true when chat_topic_id is missing", () => {
		expect(
			topicNeedsChatDetailRestore(
				createMockTopic({ chat_topic_id: "" as unknown as string }),
			),
		).toBe(true)
	})

	it("returns false when chat mapping is complete", () => {
		expect(topicNeedsChatDetailRestore(createMockTopic())).toBe(false)
	})
})
