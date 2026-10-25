import { beforeEach, describe, expect, it, vi } from "vitest"
import service from "../class"

const mocks = vi.hoisted(() => ({
	getTopicList: vi.fn(),
	getConversation: vi.fn(),
	setLoading: vi.fn(),
	setTopicList: vi.fn(),
	switchTopic: vi.fn(),
	saveTopicsToDB: vi.fn(),
}))

vi.mock("@/apis", () => ({ ChatApi: { getTopicList: mocks.getTopicList } }))
vi.mock("@/infrastructure/logger", () => ({
	logger: { createLogger: () => ({ log: vi.fn(), warn: vi.fn() }) },
}))
vi.mock("@/stores/chatNew/helpers/conversation", () => ({ isAiConversation: () => true }))
vi.mock("@/models/chat/topic", () => ({
	default: class {
		id: string
		constructor(data: { id: string }) {
			this.id = data.id
		}
	},
}))
vi.mock("@/stores/chatNew/conversation", () => ({
	default: {
		currentConversation: { id: "conversation", receive_type: "ai" },
		getConversation: mocks.getConversation,
	},
}))
vi.mock("@/stores/chatNew/topic", () => ({
	default: { setLoading: mocks.setLoading, setTopicList: mocks.setTopicList },
}))
vi.mock("../../conversation/ConversationService", () => ({
	default: { switchTopic: mocks.switchTopic },
}))
vi.mock("../TopicCacheServices", () => ({ default: { setTopicCache: vi.fn() } }))
vi.mock("../TopicDBServices", () => ({
	default: { saveTopicsToDB: mocks.saveTopicsToDB },
}))
vi.mock("../../message/MessageService", () => ({ default: {} }))

describe("fetchTopicList", () => {
	beforeEach(() => {
		vi.resetAllMocks()
		service.lastConversationId = "conversation"
		mocks.getTopicList.mockResolvedValue([{ id: "topic" }])
		mocks.getConversation.mockReturnValue({ isAiConversation: true })
	})

	it("finishes a pending request when its conversation has been removed", async () => {
		let resolve!: (topics: { id: string }[]) => void
		mocks.getTopicList.mockReturnValue(
			new Promise<{ id: string }[]>((done) => {
				resolve = done
			}),
		)
		const pending = service.fetchTopicList()
		mocks.getConversation.mockReturnValue(undefined)
		resolve([{ id: "topic" }])

		await expect(pending).resolves.toEqual([{ id: "topic" }])
		expect(mocks.switchTopic).not.toHaveBeenCalled()
		expect(mocks.setLoading).toHaveBeenLastCalledWith(false)
	})

	it("still selects the first available topic for a live AI conversation", async () => {
		await service.fetchTopicList()
		expect(mocks.switchTopic).toHaveBeenCalledWith("conversation", "topic")
		expect(mocks.saveTopicsToDB).toHaveBeenCalledWith("conversation", [{ id: "topic" }])
	})

	it("keeps the current topic when it remains in the returned list", async () => {
		mocks.getConversation.mockReturnValue({ isAiConversation: true, current_topic_id: "topic" })
		await service.fetchTopicList()
		expect(mocks.switchTopic).not.toHaveBeenCalled()
	})

	it("preserves request failure and releases the loading state", async () => {
		const error = new Error("request failed")
		mocks.getTopicList.mockRejectedValue(error)
		await expect(service.fetchTopicList()).rejects.toBe(error)
		expect(mocks.setLoading).toHaveBeenLastCalledWith(false)
		expect(mocks.setTopicList).not.toHaveBeenCalled()
	})
})
