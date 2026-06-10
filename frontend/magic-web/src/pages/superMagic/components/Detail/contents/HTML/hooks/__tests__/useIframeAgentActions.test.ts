import { renderHook, act } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { PubSubEvents } from "@/utils/pubsub"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import { useIframeAgentActions } from "../useIframeAgentActions"

const mocks = vi.hoisted(() => ({
	publish: vi.fn(),
	createTopic: vi.fn(),
	setSelectedTopic: vi.fn(),
}))

vi.mock("ahooks", () => ({
	useMemoizedFn: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}))

vi.mock("@/utils/pubsub", () => ({
	default: {
		publish: mocks.publish,
	},
	PubSubEvents: {
		Send_Message_by_Content: "send-message-by-content",
	},
}))

vi.mock("@/pages/superMagic/pages/Workspace/types", () => ({
	AgentType: {
		Official: 1,
		Custom: 2,
		Public: 3,
	},
}))

vi.mock("@/services/superMagic/SuperMagicModeService", () => ({
	default: {
		_modeList: [
			{
				agent: { type: 1 },
				mode: { identifier: TopicMode.General, name: "General" },
			},
		],
	},
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		createTopic: mocks.createTopic,
	},
}))

vi.mock("@/pages/superMagic/stores/core", () => ({
	projectStore: {
		selectedProject: { id: "project-1" },
	},
	topicStore: {
		setSelectedTopic: mocks.setSelectedTopic,
	},
}))

vi.mock("@/services/superMagic/topicModel", () => ({
	superMagicTopicModelService: {
		saveModel: vi.fn(),
	},
}))

describe("useIframeAgentActions", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.createTopic.mockResolvedValue({ id: "topic-1" })
	})

	it("does not publish a General topicMode when agentId is omitted", async () => {
		const { result } = renderHook(() => useIframeAgentActions())

		await act(async () => {
			await result.current.createTopicAndSend({ message: "hello" })
		})

		expect(mocks.publish).toHaveBeenCalledWith(
			PubSubEvents.Send_Message_by_Content,
			expect.not.objectContaining({
				topicMode: TopicMode.General,
			}),
		)
	})
})
