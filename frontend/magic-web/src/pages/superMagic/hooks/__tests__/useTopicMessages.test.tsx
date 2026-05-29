import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Topic } from "@/pages/superMagic/pages/Workspace/types"
import { useTopicMessages } from "../useTopicMessages"

const mockState = vi.hoisted(() => ({
	getMessagesByConversationIdMock: vi.fn(),
	superMagicStoreMock: {
		messages: new Map<string, unknown[]>(),
		buffer: new Map<string, { messages: unknown[] }>(),
		topicMeta: new Map<string, { isStream?: boolean; isStreamLoading?: boolean }>(),
		initializeMessages: vi.fn((topicId: string, items: unknown[]) => {
			mockState.superMagicStoreMock.messages.set(topicId, items)
		}),
		enqueueMessage: vi.fn(),
		setActiveTopicId: vi.fn(),
	},
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		getMessagesByConversationId: mockState.getMessagesByConversationIdMock,
	},
}))

vi.mock("@/pages/superMagic/stores", () => ({
	superMagicStore: mockState.superMagicStoreMock,
}))

vi.mock("@/utils/pubsub", () => ({
	default: {
		subscribe: vi.fn(),
		unsubscribe: vi.fn(),
	},
	PubSubEvents: {
		Super_Magic_New_Message_V2: "Super_Magic_New_Message_V2",
		Refresh_Topic_Messages: "Refresh_Topic_Messages",
	},
}))

describe("useTopicMessages", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockState.superMagicStoreMock.messages = new Map()
		mockState.superMagicStoreMock.buffer = new Map()
		mockState.superMagicStoreMock.topicMeta = new Map()
		mockState.getMessagesByConversationIdMock.mockImplementation(
			() => new Promise((_resolve) => undefined),
		)
	})

	it("resets initial readiness synchronously when refresh restores a topic", () => {
		const { result, rerender } = renderHook(
			({ selectedTopic }: { selectedTopic: Topic | null }) =>
				useTopicMessages({ selectedTopic }),
			{
				initialProps: {
					selectedTopic: null,
				},
			},
		)

		act(() => {
			rerender({
				selectedTopic: createTopic(),
			})
		})

		expect(result.current.isMessagesInitialLoading).toBe(true)
		expect(result.current.isSelectedTopicMessagesReady).toBe(false)
		expect(mockState.getMessagesByConversationIdMock).toHaveBeenCalledWith(
			expect.objectContaining({
				chat_topic_id: "chat-topic-1",
				conversation_id: "conversation-1",
				order: "desc",
			}),
		)
	})
})

function createTopic(overrides: Partial<Topic> = {}): Topic {
	return {
		id: "topic-1",
		topic_name: "Topic 1",
		chat_topic_id: "chat-topic-1",
		chat_conversation_id: "conversation-1",
		...overrides,
	} as Topic
}
