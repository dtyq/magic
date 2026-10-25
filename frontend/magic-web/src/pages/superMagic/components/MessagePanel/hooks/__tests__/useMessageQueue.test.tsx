import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import useMessageQueue from "../useMessageQueue"

const mocks = vi.hoisted(() => ({
	getMessageQueueList: vi.fn(),
	addMessageToQueue: vi.fn(),
	subscribe: vi.fn(),
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		getMessageQueueList: mocks.getMessageQueueList,
		addMessageToQueue: mocks.addMessageToQueue,
	},
}))

vi.mock("react-i18next", async (importOriginal) => ({
	...(await importOriginal<typeof import("react-i18next")>()),
	useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("@/models/user", () => ({
	userStore: {
		user: {
			userInfo: { user_id: "user-1", organization_code: "org-1" },
		},
	},
}))

vi.mock("@/utils/storage", () => ({
	platformKey: (key: string) => key,
}))

vi.mock("@/utils/localstorage", () => ({
	default: {
		get: () => undefined,
		set: vi.fn(),
		remove: vi.fn(),
	},
}))

vi.mock("@/apis/clients/chatWebSocket", () => ({
	default: {
		isConnected: true,
		on: vi.fn(),
		off: vi.fn(),
	},
}))

vi.mock("@/utils/pubsub", () => ({
	default: {
		subscribe: mocks.subscribe,
		unsubscribe: vi.fn(),
	},
	PubSubEvents: {
		SuperMagicMessageQueueConsumed: "SuperMagicMessageQueueConsumed",
	},
}))

vi.mock("@/stores/recordingSummary", () => ({
	default: { isFloatPanelLoaded: false },
}))

vi.mock("@/services/recordSummary/NetworkMonitor", () => ({
	getNetworkMonitor: () => ({ isNetworkOffline: () => false }),
}))

vi.mock("../../MessageEditor/utils/mention", () => ({
	transformMentions: (items: unknown[]) => items,
}))

vi.mock("@/services/superMagic/DefaultAgentSelectionService", () => ({
	resolveAgentSelection: () => ({ topicPattern: "normal", agentCode: undefined }),
}))

vi.mock("@/components/business/MentionPanel/runtime/builtin/domains/micro-apps", () => ({}))
vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}))
vi.mock("@/components/base/MagicModal", () => ({
	default: { confirm: vi.fn(), info: vi.fn() },
}))
vi.mock("../../useQueueDraft", () => ({
	default: () => ({
		queueDraft: null,
		isQueueOperationPending: false,
		moveQueueItem: vi.fn(),
		finishEditQueueItem: vi.fn(),
		takeOutQueueItem: vi.fn(),
		retryQueueDraftRemoval: vi.fn(),
		onEditorReady: vi.fn(),
	}),
}))

describe("useMessageQueue", () => {
	beforeEach(() => {
		mocks.subscribe.mockClear()
		mocks.getMessageQueueList.mockReset()
		mocks.getMessageQueueList.mockResolvedValue({ list: [] })
		mocks.addMessageToQueue.mockReset()
		mocks.addMessageToQueue.mockResolvedValue({ queue_id: "server-queue-1" })
	})

	it("loads the server queue on topic initialization without waiting for message history loading", async () => {
		renderHook(() =>
			useMessageQueue({
				projectId: "project-1",
				topicId: "topic-1",
				isShowLoadingInit: false,
			}),
		)

		await waitFor(() => {
			expect(mocks.getMessageQueueList).toHaveBeenCalledWith({
				project_id: "project-1",
				topic_id: "topic-1",
			})
		})
	})

	it("keeps the post-enqueue queue when the initial request resolves late", async () => {
		let resolveInitialRequest: ((value: { list: [] }) => void) | undefined
		mocks.getMessageQueueList.mockReturnValueOnce(
			new Promise((resolve) => {
				resolveInitialRequest = resolve
			}),
		)
		mocks.getMessageQueueList.mockResolvedValueOnce({
			list: [
				{
					queue_id: "server-queue-1",
					message_content: JSON.stringify({ type: "doc", content: [] }),
					status: 0,
					created_at: "2026-09-18T00:00:00.000Z",
					sort_order: "1",
				},
			],
		})

		const { result } = renderHook(() =>
			useMessageQueue({
				projectId: "project-1",
				topicId: "topic-1",
				isShowLoadingInit: false,
			}),
		)

		await act(async () => {
			await result.current.addToQueue({
				content: { type: "doc", content: [] },
				mentionItems: [],
			})
		})

		await waitFor(() => expect(result.current.queue).toHaveLength(1))
		expect(result.current.queue[0]?.id).toBe("server-queue-1")

		await act(async () => {
			resolveInitialRequest?.({ list: [] })
		})

		expect(result.current.queue[0]?.id).toBe("server-queue-1")
	})
	it("discards a list response started before an external iframe enqueue update", async () => {
		let resolveInitial!: (value: unknown) => void
		mocks.getMessageQueueList.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					resolveInitial = resolve
				}),
		)
		mocks.getMessageQueueList.mockResolvedValue({
			list: [
				{
					queue_id: "new-item",
					message_content: JSON.stringify({ content: "{}" }),
					status: 0,
					created_at: "2026-09-28 00:00:01",
					sort_order: "2",
				},
			],
			total: 1,
		})
		const { result } = renderHook(() =>
			useMessageQueue({ projectId: "project-1", topicId: "topic-1" }),
		)
		const refresh = mocks.subscribe.mock.calls.find(
			([event]) => event === "SuperMagicMessageQueueConsumed",
		)?.[1]
		expect(refresh).toBeTypeOf("function")
		await act(async () => {
			refresh()
		})
		await act(async () => {
			resolveInitial({
				list: [
					{
						queue_id: "stale-item",
						message_content: JSON.stringify({ content: "{}" }),
						status: 0,
						created_at: "2026-09-28 00:00:00",
						sort_order: "1",
					},
				],
				total: 1,
			})
		})
		expect(result.current.queue.map((item) => item.id)).toEqual(["new-item"])
	})
})
