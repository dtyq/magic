import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { TaskStatus, type Topic } from "@/pages/superMagic/pages/Workspace/types"
import { useTopicMessages } from "../useTopicMessages"

const mockState = vi.hoisted(() => ({
	nextSyncGeneration: 1,
	getMessagesByConversationIdMock: vi.fn(),
	getTopicsStatusMock: vi.fn(),
	acknowledgeTopicSyncMock: vi.fn(),
	registerStreamRecoveryOwnerMock: vi.fn(),
	requestTopicRecoveryMock: vi.fn(),
	getTopicRecoveryStatusMock: vi.fn(() => ({
		hasScheduled: false,
		hasInFlight: false,
		reason: undefined,
	})),
	resumeTopicRecoveryMock: vi.fn(),
	recoveryOwner: undefined as
		| {
				conversationId: string
				recover: (context: Record<string, unknown>) => Promise<{ didPullSucceed: boolean }>
		  }
		| undefined,
	recoveryTimers: new Map<string, ReturnType<typeof setTimeout>>(),
	recoveryPayloads: new Map<string, Record<string, unknown>>(),
	pubsubHandlers: new Map<string, (data: any) => void>(),
	superMagicStoreMock: {
		messages: new Map<string, unknown[]>(),
		buffer: new Map<string, { messages: unknown[] }>(),
		topicMeta: new Map<
			string,
			{
				isStream?: boolean
				isStreamLoading?: boolean
				syncState?: "idle" | "syncing"
				syncGeneration?: number
			}
		>(),
		beginTopicSync: vi.fn((_topicId: string) => mockState.nextSyncGeneration++),
		isTopicSyncCurrent: vi.fn(() => true),
		completeTopicSync: vi.fn(
			(
				_topicId: string,
				_generation: number,
				_result: { succeeded: boolean; taskStatus?: string },
			) => true,
		),
		cancelTopicSync: vi.fn(),
		getLatestMessageSeqId: vi.fn(() => "assistant-seq-1"),
		initializeMessages: vi.fn(
			(topicId: string, items: unknown[], options?: Record<string, unknown>) => {
				mockState.superMagicStoreMock.messages.set(topicId, items)
				void options
			},
		),
		reconcileHttpMessageStatuses: vi.fn(),
		authorizeImStatusRestore: vi.fn(),
		enqueueMessage: vi.fn(),
		reconcileAuthoritativeMessages: vi.fn(
			(
				topicId: string,
				input: {
					statusItems: unknown[]
					membershipItems: unknown[]
					writeOptions: { mode?: string; syncGeneration?: number }
				},
			) => {
				if (input.writeOptions.mode === "incremental") {
					mockState.superMagicStoreMock.reconcileHttpMessageStatuses(
						topicId,
						input.statusItems,
					)
					input.membershipItems.forEach((item) =>
						mockState.superMagicStoreMock.enqueueMessage(topicId, item),
					)
					return
				}
				mockState.superMagicStoreMock.initializeMessages(topicId, input.membershipItems, {
					...input.writeOptions,
				})
			},
		),
		setActiveTopicId: vi.fn(),
		isTopicStreaming: vi.fn(() => false),
		hasPendingTopicExecution: vi.fn(() => false),
	},
	activeRevokedAnchor: undefined as { seq_id: string } | undefined,
	optimisticStatuses: new Map<string, string>(),
	clearActiveRevokedAnchor: vi.fn(),
	clearHiddenRevokedOptimisticMessageIds: vi.fn(),
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		getMessagesByConversationId: mockState.getMessagesByConversationIdMock,
		getTopicsStatus: mockState.getTopicsStatusMock,
	},
}))

vi.mock("@/pages/superMagic/stores/core/topic", async () => {
	const actual = await vi.importActual<typeof import("@/pages/superMagic/stores/core/topic")>(
		"@/pages/superMagic/stores/core/topic",
	)
	return {
		...actual,
		default: {
			mergeTopic: vi.fn(),
		},
	}
})

vi.mock("@/pages/superMagic/stores", () => ({
	superMagicStore: mockState.superMagicStoreMock,
}))

import defaultTopicStore from "@/pages/superMagic/stores/core/topic"

vi.mock("@/pages/superMagic/stores/optimisticMessageStore", () => ({
	optimisticMessageStore: {
		getActiveRevokedAnchor: () => mockState.activeRevokedAnchor,
		getStatus: (topicId?: string, appMessageId?: string) =>
			mockState.optimisticStatuses.get(`${topicId}:${appMessageId}`),
		clearActiveRevokedAnchor: mockState.clearActiveRevokedAnchor,
		clearHiddenRevokedOptimisticMessageIds: mockState.clearHiddenRevokedOptimisticMessageIds,
	},
}))

vi.mock("@/pages/superMagic/services/streamRecoveryCoordinator", () => ({
	acknowledgeTopicSync: mockState.acknowledgeTopicSyncMock,
	getTopicRecoveryStatus: mockState.getTopicRecoveryStatusMock,
	registerStreamRecoveryOwner: mockState.registerStreamRecoveryOwnerMock,
	requestTopicRecovery: mockState.requestTopicRecoveryMock,
	resumeTopicRecovery: mockState.resumeTopicRecoveryMock,
}))

vi.mock("@/utils/pubsub", () => ({
	default: {
		subscribe: vi.fn((event: string, callback: (data: any) => void) => {
			mockState.pubsubHandlers.set(event, callback)
		}),
		unsubscribe: vi.fn((event: string, callback?: (data: any) => void) => {
			if (!callback || mockState.pubsubHandlers.get(event) === callback) {
				mockState.pubsubHandlers.delete(event)
			}
		}),
	},
	PubSubEvents: {
		Super_Magic_New_Message_V2: "Super_Magic_New_Message_V2",
		Super_Magic_Checkpoint_Rollback: "Super_Magic_Checkpoint_Rollback",
		Refresh_Topic_Messages: "Refresh_Topic_Messages",
	},
}))

describe("useTopicMessages", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockState.getMessagesByConversationIdMock.mockReset()
		mockState.getTopicsStatusMock.mockReset()
		mockState.getTopicsStatusMock.mockResolvedValue({ list: [] })
		mockState.acknowledgeTopicSyncMock.mockReset()
		mockState.registerStreamRecoveryOwnerMock.mockReset()
		mockState.requestTopicRecoveryMock.mockReset()
		mockState.getTopicRecoveryStatusMock.mockReset()
		mockState.getTopicRecoveryStatusMock.mockReturnValue({
			hasScheduled: false,
			hasInFlight: false,
			reason: undefined,
		})
		mockState.resumeTopicRecoveryMock.mockReset()
		mockState.nextSyncGeneration = 1
		mockState.superMagicStoreMock.beginTopicSync.mockImplementation(
			() => mockState.nextSyncGeneration++,
		)
		mockState.superMagicStoreMock.isTopicSyncCurrent.mockReturnValue(true)
		mockState.superMagicStoreMock.completeTopicSync.mockReturnValue(true)
		mockState.superMagicStoreMock.messages = new Map()
		mockState.superMagicStoreMock.buffer = new Map()
		mockState.superMagicStoreMock.topicMeta = new Map()
		mockState.superMagicStoreMock.isTopicStreaming.mockReturnValue(false)
		mockState.superMagicStoreMock.hasPendingTopicExecution.mockReturnValue(false)
		mockState.superMagicStoreMock.authorizeImStatusRestore.mockReset()
		mockState.activeRevokedAnchor = undefined
		mockState.optimisticStatuses.clear()
		mockState.clearActiveRevokedAnchor.mockReset()
		mockState.clearHiddenRevokedOptimisticMessageIds.mockReset()
		vi.mocked(defaultTopicStore.mergeTopic).mockReset()
		mockState.pubsubHandlers.clear()
		mockState.recoveryOwner = undefined
		mockState.recoveryTimers.forEach((timer) => clearTimeout(timer))
		mockState.recoveryTimers.clear()
		mockState.recoveryPayloads.clear()
		mockState.registerStreamRecoveryOwnerMock.mockImplementation((registration) => {
			mockState.recoveryOwner = registration
			return vi.fn(() => {
				if (mockState.recoveryOwner === registration) mockState.recoveryOwner = undefined
			})
		})
		mockState.requestTopicRecoveryMock.mockImplementation((payload) => {
			const topicId = payload.topicId
			const current = mockState.recoveryPayloads.get(topicId) || {}
			const requiredSeqId = String(payload.requiredSeqId || current.requiredSeqId || "")
			const currentRequiredSeqId = String(current.requiredSeqId || "")
			mockState.recoveryPayloads.set(topicId, {
				...current,
				...payload,
				...(requiredSeqId &&
				(!currentRequiredSeqId || Number(requiredSeqId) > Number(currentRequiredSeqId))
					? { requiredSeqId }
					: currentRequiredSeqId
						? { requiredSeqId: currentRequiredSeqId }
						: {}),
			})
			if (mockState.recoveryTimers.has(topicId)) return
			const timer = setTimeout(async () => {
				mockState.recoveryTimers.delete(topicId)
				const recoveryOwner = mockState.recoveryOwner
				const recoveryPayload = mockState.recoveryPayloads.get(topicId)
				mockState.recoveryPayloads.delete(topicId)
				if (!recoveryOwner || !recoveryPayload) return
				const generation = mockState.superMagicStoreMock.beginTopicSync(topicId)
				const result = await recoveryOwner.recover({
					...recoveryPayload,
					conversationId: recoveryOwner.conversationId,
					syncGeneration: generation,
				})
				mockState.superMagicStoreMock.completeTopicSync(topicId, generation, {
					succeeded: result.didPullSucceed,
					taskStatus: undefined,
				})
			}, 200)
			mockState.recoveryTimers.set(topicId, timer)
		})
		mockState.getMessagesByConversationIdMock.mockImplementation(
			() => new Promise(() => undefined),
		)
	})

	afterEach(() => {
		vi.useRealTimers()
		Object.defineProperty(document, "visibilityState", {
			configurable: true,
			value: "visible",
		})
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

	it("establishes the activation sync barrier before exposing a Topic's stream projection", async () => {
		const initialItems = [createMessageEnvelope("initial-user", "100")]
		mockState.getMessagesByConversationIdMock.mockResolvedValueOnce({
			items: initialItems,
			has_more: false,
			page_token: "",
		})

		renderHook(() => useTopicMessages({ selectedTopic: createTopic() }))

		const beginOrder = mockState.superMagicStoreMock.beginTopicSync.mock.invocationCallOrder[0]
		const activeOrder =
			mockState.superMagicStoreMock.setActiveTopicId.mock.invocationCallOrder[0]
		expect(beginOrder).toBeLessThan(activeOrder)

		await act(async () => {
			await Promise.resolve()
			await Promise.resolve()
		})

		const generation = mockState.superMagicStoreMock.beginTopicSync.mock.results[0]?.value
		expect(mockState.superMagicStoreMock.initializeMessages).toHaveBeenCalledWith(
			"chat-topic-1",
			initialItems,
			expect.objectContaining({ mode: "replace", syncGeneration: generation }),
		)
		expect(mockState.superMagicStoreMock.completeTopicSync).toHaveBeenCalledWith(
			"chat-topic-1",
			generation,
			expect.objectContaining({ succeeded: true }),
		)
	})

	it("shares the same in-flight first page across multiple topic owners", async () => {
		let resolveRequest!: (value: {
			items: unknown[]
			has_more: boolean
			page_token: string
		}) => void
		const pendingRequest = new Promise<{
			items: unknown[]
			has_more: boolean
			page_token: string
		}>((resolve) => {
			resolveRequest = resolve
		})
		mockState.getMessagesByConversationIdMock.mockReturnValue(pendingRequest)

		const first = renderHook(() => useTopicMessages({ selectedTopic: createTopic() }))
		const second = renderHook(() => useTopicMessages({ selectedTopic: createTopic() }))

		expect(mockState.getMessagesByConversationIdMock).toHaveBeenCalledTimes(1)
		await act(async () => {
			resolveRequest({ items: [], has_more: false, page_token: "" })
			await pendingRequest
			await Promise.resolve()
		})

		first.unmount()
		second.unmount()
	})

	it("uses one recent page as the finished resident-poll barrier without replacing history", async () => {
		vi.useFakeTimers()
		const initialResponse = { items: [], has_more: false, page_token: "" }
		const pollingResponse = {
			items: [createMessageEnvelope("newer", "2"), createMessageEnvelope("older", "1")],
			has_more: false,
			page_token: "",
		}
		mockState.getMessagesByConversationIdMock.mockResolvedValueOnce(initialResponse)

		const { rerender } = renderHook(
			({ selectedTopic }: { selectedTopic: Topic }) => useTopicMessages({ selectedTopic }),
			{
				initialProps: {
					selectedTopic: createTopic({ task_status: TaskStatus.RUNNING }),
				},
			},
		)

		await act(async () => {
			await Promise.resolve()
			await Promise.resolve()
		})
		expect(mockState.getMessagesByConversationIdMock).toHaveBeenCalledTimes(1)
		mockState.getMessagesByConversationIdMock.mockClear()
		mockState.superMagicStoreMock.beginTopicSync.mockClear()
		mockState.superMagicStoreMock.completeTopicSync.mockClear()
		mockState.superMagicStoreMock.cancelTopicSync.mockClear()
		mockState.superMagicStoreMock.initializeMessages.mockClear()
		mockState.superMagicStoreMock.enqueueMessage.mockClear()
		let resolvePollingRequest: ((value: typeof pollingResponse) => void) | undefined
		mockState.getMessagesByConversationIdMock.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					resolvePollingRequest = resolve
				}),
		)

		rerender({
			selectedTopic: createTopic({ task_status: TaskStatus.FINISHED }),
		})
		// Topic 状态变化本身不是 HTTP 完成屏障；必须等待本轮轮询成功后再通知 Store。
		expect(mockState.superMagicStoreMock.beginTopicSync).not.toHaveBeenCalled()
		expect(mockState.superMagicStoreMock.completeTopicSync).not.toHaveBeenCalled()
		await act(async () => {
			await vi.advanceTimersByTimeAsync(20_000)
		})

		expect(mockState.getMessagesByConversationIdMock).toHaveBeenLastCalledWith(
			expect.objectContaining({
				chat_topic_id: "chat-topic-1",
				conversation_id: "conversation-1",
				limit: 20,
				order: "desc",
				page_token: "",
			}),
		)
		expect(mockState.superMagicStoreMock.beginTopicSync).toHaveBeenCalledTimes(1)
		expect(mockState.superMagicStoreMock.beginTopicSync).toHaveBeenCalledWith("chat-topic-1")
		const pollingGeneration =
			mockState.superMagicStoreMock.beginTopicSync.mock.results[0]?.value
		expect(pollingGeneration).toEqual(expect.any(Number))
		// 请求成功前不能把 topic 状态本身误当成完成屏障。
		expect(mockState.superMagicStoreMock.completeTopicSync).not.toHaveBeenCalled()
		await act(async () => {
			await vi.advanceTimersByTimeAsync(20_000)
		})
		expect(mockState.getMessagesByConversationIdMock).toHaveBeenCalledTimes(1)
		expect(mockState.superMagicStoreMock.beginTopicSync).toHaveBeenCalledTimes(1)

		await act(async () => {
			resolvePollingRequest?.(pollingResponse)
			await Promise.resolve()
			await Promise.resolve()
		})
		// has_more=false only ends this pagination window. Without a common anchor the
		// resident poll may merge the Final, but it cannot delete older local membership.
		expect(mockState.getMessagesByConversationIdMock).toHaveBeenCalledTimes(1)
		expect(mockState.superMagicStoreMock.initializeMessages).toHaveBeenCalledWith(
			"chat-topic-1",
			pollingResponse.items,
			{
				assistantSnapshotPolicy: "progress_snapshot",
				canonicalCommitContext: {
					lifecycleEventPolicy: "silent",
					source: "http",
					trigger: "polling",
				},
				eventPolicy: "live_arrival",
				mode: "merge",
				toolProjectionPolicy: "preserve_live",
			},
		)
		expect(mockState.superMagicStoreMock.enqueueMessage).not.toHaveBeenCalled()

		expect(mockState.superMagicStoreMock.completeTopicSync).toHaveBeenCalledWith(
			"chat-topic-1",
			pollingGeneration,
			expect.objectContaining({
				succeeded: true,
				taskStatus: TaskStatus.FINISHED,
			}),
		)
	})

	it("keeps finished polling retryable when the recent incremental request fails", async () => {
		vi.useFakeTimers()
		const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
		mockState.getMessagesByConversationIdMock.mockResolvedValueOnce({
			items: [],
			has_more: false,
			page_token: "",
		})
		const { rerender } = renderHook(
			({ selectedTopic }: { selectedTopic: Topic }) => useTopicMessages({ selectedTopic }),
			{
				initialProps: {
					selectedTopic: createTopic({ task_status: TaskStatus.RUNNING }),
				},
			},
		)
		await act(async () => {
			await Promise.resolve()
			await Promise.resolve()
		})

		mockState.getMessagesByConversationIdMock.mockReset()
		mockState.getMessagesByConversationIdMock.mockRejectedValueOnce(
			new Error("finished polling failed"),
		)
		mockState.superMagicStoreMock.beginTopicSync.mockClear()
		mockState.superMagicStoreMock.initializeMessages.mockClear()
		mockState.superMagicStoreMock.enqueueMessage.mockClear()
		mockState.superMagicStoreMock.completeTopicSync.mockClear()

		rerender({ selectedTopic: createTopic({ task_status: TaskStatus.FINISHED }) })
		await act(async () => {
			await vi.advanceTimersByTimeAsync(20_000)
			await Promise.resolve()
			await Promise.resolve()
		})

		const generation = mockState.superMagicStoreMock.beginTopicSync.mock.results[0]?.value
		expect(mockState.getMessagesByConversationIdMock).toHaveBeenCalledTimes(1)
		expect(mockState.superMagicStoreMock.initializeMessages).not.toHaveBeenCalled()
		expect(mockState.superMagicStoreMock.enqueueMessage).not.toHaveBeenCalled()
		expect(mockState.superMagicStoreMock.completeTopicSync).toHaveBeenCalledWith(
			"chat-topic-1",
			generation,
			expect.objectContaining({ succeeded: false, taskStatus: TaskStatus.FINISHED }),
		)

		mockState.getMessagesByConversationIdMock.mockResolvedValueOnce({
			items: [],
			has_more: false,
			page_token: "",
		})
		await act(async () => {
			await vi.advanceTimersByTimeAsync(20_000)
			await Promise.resolve()
		})
		expect(mockState.getMessagesByConversationIdMock).toHaveBeenCalledTimes(2)
		expect(consoleErrorSpy).toHaveBeenCalled()
		consoleErrorSpy.mockRestore()
	})

	it("does not start finished polling while a new local execution is pending", async () => {
		vi.useFakeTimers()
		mockState.getMessagesByConversationIdMock.mockResolvedValueOnce({
			items: [],
			has_more: false,
			page_token: "",
		})

		const { rerender } = renderHook(
			({ selectedTopic }: { selectedTopic: Topic }) => useTopicMessages({ selectedTopic }),
			{
				initialProps: {
					selectedTopic: createTopic({ task_status: TaskStatus.RUNNING }),
				},
			},
		)

		await act(async () => {
			await Promise.resolve()
			await Promise.resolve()
		})

		mockState.getMessagesByConversationIdMock.mockClear()
		mockState.superMagicStoreMock.beginTopicSync.mockClear()
		mockState.superMagicStoreMock.completeTopicSync.mockClear()
		mockState.superMagicStoreMock.hasPendingTopicExecution.mockReturnValue(true)

		rerender({ selectedTopic: createTopic({ task_status: TaskStatus.FINISHED }) })

		await act(async () => {
			await vi.advanceTimersByTimeAsync(20_000)
		})

		expect(mockState.getMessagesByConversationIdMock).not.toHaveBeenCalled()
		expect(mockState.superMagicStoreMock.beginTopicSync).not.toHaveBeenCalled()
		expect(mockState.superMagicStoreMock.completeTopicSync).not.toHaveBeenCalled()
	})

	it("P1 contract: continues bounded polling pages until the local anchor is reached", async () => {
		const { poll } = await prepareFinishedPollingAnchorContract()
		const firstPageItems = [
			createMessageEnvelope("newest-4", "4"),
			createMessageEnvelope("newest-3", "3"),
		]
		const secondPageItems = [
			createMessageEnvelope("newest-2", "2"),
			createMessageEnvelope("local-anchor", "1"),
			createMessageEnvelope("older-than-anchor", "0"),
		]
		mockState.getMessagesByConversationIdMock
			.mockResolvedValueOnce({
				items: firstPageItems,
				has_more: true,
				page_token: "page-2",
			})
			.mockResolvedValueOnce({
				items: secondPageItems,
				has_more: true,
				page_token: "page-3",
			})

		await poll()

		expect(mockState.getMessagesByConversationIdMock).toHaveBeenCalledTimes(2)
		expect(mockState.getMessagesByConversationIdMock).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({ limit: 20, page_token: "page-2" }),
		)
		expect(mockState.superMagicStoreMock.enqueueMessage).not.toHaveBeenCalled()
		expect(mockState.superMagicStoreMock.initializeMessages).toHaveBeenCalledTimes(1)
		expect(mockState.superMagicStoreMock.initializeMessages).toHaveBeenCalledWith(
			"chat-topic-1",
			[...firstPageItems, secondPageItems[0], secondPageItems[1]],
			{
				assistantSnapshotPolicy: "progress_snapshot",
				mode: "replace_tail",
				anchorSuperMessageId: "local-anchor",
				canonicalCommitContext: {
					lifecycleEventPolicy: "silent",
					source: "http",
					trigger: "polling",
				},
				eventPolicy: "live_arrival",
				preserveStreamSuperMessageIds: [],
				toolProjectionPolicy: "preserve_live",
			},
		)
		expect(mockState.superMagicStoreMock.completeTopicSync).toHaveBeenCalledWith(
			"chat-topic-1",
			expect.any(Number),
			expect.objectContaining({ succeeded: true, taskStatus: TaskStatus.FINISHED }),
		)
	})

	it("P1 contract: commits no partial delta when a later anchor page fails", async () => {
		const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
		const { existingMessages, poll } = await prepareFinishedPollingAnchorContract()
		mockState.getMessagesByConversationIdMock
			.mockResolvedValueOnce({
				items: [createMessageEnvelope("partial-new", "2")],
				has_more: true,
				page_token: "page-2",
			})
			.mockRejectedValueOnce(new Error("anchor continuation failed"))

		await poll()

		expect(mockState.getMessagesByConversationIdMock).toHaveBeenCalledTimes(2)
		expect(mockState.superMagicStoreMock.enqueueMessage).not.toHaveBeenCalled()
		expect(mockState.superMagicStoreMock.initializeMessages).not.toHaveBeenCalled()
		expect(mockState.superMagicStoreMock.messages.get("chat-topic-1")).toBe(existingMessages)
		expect(mockState.superMagicStoreMock.completeTopicSync).toHaveBeenCalledWith(
			"chat-topic-1",
			expect.any(Number),
			expect.objectContaining({ succeeded: false, taskStatus: TaskStatus.FINISHED }),
		)
		expect(consoleErrorSpy).toHaveBeenCalled()
		consoleErrorSpy.mockRestore()
	})

	it("P1 contract: stops at the polling page budget when the anchor is still missing", async () => {
		const { existingMessages, poll } = await prepareFinishedPollingAnchorContract()
		mockState.getMessagesByConversationIdMock
			.mockResolvedValueOnce({
				items: [createMessageEnvelope("page-1-new", "4")],
				has_more: true,
				page_token: "page-2",
			})
			.mockResolvedValueOnce({
				items: [createMessageEnvelope("page-2-new", "3")],
				has_more: true,
				page_token: "page-3",
			})
			.mockResolvedValueOnce({
				items: [createMessageEnvelope("page-3-new", "2")],
				has_more: true,
				page_token: "page-4",
			})

		await poll()

		// Three recent pages form the bounded P1 safety budget; page-4 belongs to explicit recovery.
		expect(mockState.getMessagesByConversationIdMock).toHaveBeenCalledTimes(3)
		expect(mockState.superMagicStoreMock.enqueueMessage).not.toHaveBeenCalled()
		expect(mockState.superMagicStoreMock.initializeMessages).not.toHaveBeenCalled()
		expect(mockState.superMagicStoreMock.messages.get("chat-topic-1")).toBe(existingMessages)
		expect(mockState.superMagicStoreMock.completeTopicSync).toHaveBeenCalledWith(
			"chat-topic-1",
			expect.any(Number),
			expect.objectContaining({ succeeded: false, taskStatus: TaskStatus.FINISHED }),
		)
	})

	it.each([
		{
			label: "the server omits the next page token",
			responses: [
				{
					items: [createMessageEnvelope("missing-token-new", "2")],
					has_more: true,
					page_token: "",
				},
			],
			expectedRequestCount: 1,
		},
		{
			label: "the server repeats an already visited page token",
			responses: [
				{
					items: [createMessageEnvelope("repeated-token-new-2", "3")],
					has_more: true,
					page_token: "page-2",
				},
				{
					items: [createMessageEnvelope("repeated-token-new-1", "2")],
					has_more: true,
					page_token: "page-2",
				},
			],
			expectedRequestCount: 2,
		},
	])(
		"P1 contract: preserves the current list when $label",
		async ({ responses, expectedRequestCount }) => {
			const { existingMessages, poll } = await prepareFinishedPollingAnchorContract()
			responses.forEach((response) => {
				mockState.getMessagesByConversationIdMock.mockResolvedValueOnce(response)
			})

			await poll()

			expect(mockState.getMessagesByConversationIdMock).toHaveBeenCalledTimes(
				expectedRequestCount,
			)
			expect(mockState.superMagicStoreMock.enqueueMessage).not.toHaveBeenCalled()
			expect(mockState.superMagicStoreMock.initializeMessages).not.toHaveBeenCalled()
			expect(mockState.superMagicStoreMock.messages.get("chat-topic-1")).toBe(
				existingMessages,
			)
			expect(mockState.superMagicStoreMock.completeTopicSync).toHaveBeenCalledWith(
				"chat-topic-1",
				expect.any(Number),
				expect.objectContaining({ succeeded: false, taskStatus: TaskStatus.FINISHED }),
			)
		},
	)

	it("ignores a late finished polling response after the same topic resumes running", async () => {
		vi.useFakeTimers()
		const emptyPollingResponse = {
			items: [],
			has_more: false,
			page_token: "",
		}
		mockState.getMessagesByConversationIdMock.mockResolvedValueOnce(emptyPollingResponse)

		const { rerender } = renderHook(
			({ selectedTopic }: { selectedTopic: Topic }) => useTopicMessages({ selectedTopic }),
			{
				initialProps: {
					selectedTopic: createTopic({ task_status: TaskStatus.RUNNING }),
				},
			},
		)

		await act(async () => {
			await Promise.resolve()
			await Promise.resolve()
		})
		mockState.getMessagesByConversationIdMock.mockClear()
		mockState.superMagicStoreMock.beginTopicSync.mockClear()
		mockState.superMagicStoreMock.completeTopicSync.mockClear()
		mockState.superMagicStoreMock.cancelTopicSync.mockClear()
		let resolvePollingRequest: ((value: typeof emptyPollingResponse) => void) | undefined
		mockState.getMessagesByConversationIdMock.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					resolvePollingRequest = resolve
				}),
		)

		rerender({
			selectedTopic: createTopic({ task_status: TaskStatus.FINISHED }),
		})
		await act(async () => {
			await vi.advanceTimersByTimeAsync(20_000)
		})

		const pollingGeneration =
			mockState.superMagicStoreMock.beginTopicSync.mock.results[0]?.value
		expect(pollingGeneration).toEqual(expect.any(Number))
		expect(mockState.superMagicStoreMock.completeTopicSync).not.toHaveBeenCalled()

		rerender({
			selectedTopic: createTopic({ task_status: TaskStatus.RUNNING }),
		})
		expect(mockState.superMagicStoreMock.cancelTopicSync).toHaveBeenCalledWith(
			"chat-topic-1",
			pollingGeneration,
		)

		await act(async () => {
			resolvePollingRequest?.(emptyPollingResponse)
			await Promise.resolve()
		})

		expect(mockState.superMagicStoreMock.completeTopicSync).not.toHaveBeenCalled()
	})

	it("does not start a finished polling generation while another topic sync is active", async () => {
		vi.useFakeTimers()
		const emptyPollingResponse = {
			items: [],
			has_more: false,
			page_token: "",
		}
		mockState.getMessagesByConversationIdMock.mockResolvedValueOnce(emptyPollingResponse)

		const { rerender } = renderHook(
			({ selectedTopic }: { selectedTopic: Topic }) => useTopicMessages({ selectedTopic }),
			{
				initialProps: {
					selectedTopic: createTopic({ task_status: TaskStatus.RUNNING }),
				},
			},
		)

		await act(async () => {
			await Promise.resolve()
			await Promise.resolve()
		})
		mockState.getMessagesByConversationIdMock.mockClear()
		mockState.superMagicStoreMock.beginTopicSync.mockClear()
		mockState.superMagicStoreMock.completeTopicSync.mockClear()
		mockState.superMagicStoreMock.topicMeta.set("other-chat-topic", {
			syncState: "syncing",
			syncGeneration: 99,
		})

		rerender({
			selectedTopic: createTopic({ task_status: TaskStatus.FINISHED }),
		})
		await act(async () => {
			await vi.advanceTimersByTimeAsync(20_000)
		})

		expect(mockState.getMessagesByConversationIdMock).not.toHaveBeenCalled()
		expect(mockState.superMagicStoreMock.beginTopicSync).not.toHaveBeenCalled()
		expect(mockState.superMagicStoreMock.completeTopicSync).not.toHaveBeenCalled()
	})

	it("does not let stale syncing metadata block the current finished polling", async () => {
		vi.useFakeTimers()
		const emptyPollingResponse = {
			items: [],
			has_more: false,
			page_token: "",
		}
		mockState.getMessagesByConversationIdMock.mockResolvedValueOnce(emptyPollingResponse)

		const { rerender } = renderHook(
			({ selectedTopic }: { selectedTopic: Topic }) => useTopicMessages({ selectedTopic }),
			{
				initialProps: {
					selectedTopic: createTopic({ task_status: TaskStatus.RUNNING }),
				},
			},
		)

		await act(async () => {
			await Promise.resolve()
			await Promise.resolve()
		})
		mockState.getMessagesByConversationIdMock.mockClear()
		mockState.superMagicStoreMock.beginTopicSync.mockClear()
		mockState.superMagicStoreMock.completeTopicSync.mockClear()
		mockState.superMagicStoreMock.topicMeta.set("stale-chat-topic", {
			syncState: "syncing",
			syncGeneration: 88,
		})
		mockState.superMagicStoreMock.isTopicSyncCurrent.mockImplementation(
			(topicId: string) => topicId !== "stale-chat-topic",
		)
		mockState.getMessagesByConversationIdMock.mockImplementationOnce(
			() => new Promise(() => undefined),
		)

		rerender({
			selectedTopic: createTopic({ task_status: TaskStatus.FINISHED }),
		})
		await act(async () => {
			await vi.advanceTimersByTimeAsync(20_000)
		})

		expect(mockState.getMessagesByConversationIdMock).toHaveBeenCalledTimes(1)
		expect(mockState.superMagicStoreMock.beginTopicSync).toHaveBeenCalledWith("chat-topic-1")
		expect(mockState.superMagicStoreMock.completeTopicSync).not.toHaveBeenCalled()
	})

	it("cancels the polling generation when authoritative membership processing throws", async () => {
		vi.useFakeTimers()
		const emptyPollingResponse = {
			items: [],
			has_more: false,
			page_token: "",
		}
		mockState.getMessagesByConversationIdMock.mockResolvedValueOnce(emptyPollingResponse)

		const { rerender } = renderHook(
			({ selectedTopic }: { selectedTopic: Topic }) => useTopicMessages({ selectedTopic }),
			{
				initialProps: {
					selectedTopic: createTopic({ task_status: TaskStatus.RUNNING }),
				},
			},
		)

		await act(async () => {
			await Promise.resolve()
			await Promise.resolve()
		})
		mockState.superMagicStoreMock.beginTopicSync.mockClear()
		mockState.superMagicStoreMock.completeTopicSync.mockClear()
		mockState.superMagicStoreMock.cancelTopicSync.mockClear()
		mockState.getMessagesByConversationIdMock.mockResolvedValueOnce({
			items: [createMessageEnvelope("incremental-throws", "2")],
			has_more: false,
			page_token: "",
		})
		mockState.superMagicStoreMock.initializeMessages.mockImplementationOnce(() => {
			throw new Error("authoritative membership processing failed")
		})

		rerender({
			selectedTopic: createTopic({ task_status: TaskStatus.FINISHED }),
		})
		await act(async () => {
			await vi.advanceTimersByTimeAsync(20_000)
			await Promise.resolve()
		})

		const pollingGeneration =
			mockState.superMagicStoreMock.beginTopicSync.mock.results[0]?.value
		expect(pollingGeneration).toEqual(expect.any(Number))
		expect(mockState.superMagicStoreMock.cancelTopicSync).toHaveBeenCalledWith(
			"chat-topic-1",
			pollingGeneration,
		)
		expect(mockState.superMagicStoreMock.completeTopicSync).not.toHaveBeenCalled()
	})

	it("loads older history with merge semantics instead of replacing the current topic", async () => {
		const topic = createTopic()
		const olderItems = [
			{
				seq: {
					seq_id: "1",
					message: {
						app_message_id: "older-message",
						type: "text",
						text: { content: "older" },
					},
				},
			},
		]
		mockState.getMessagesByConversationIdMock
			.mockResolvedValueOnce({ items: [], has_more: true, page_token: "older-page" })
			.mockResolvedValueOnce({ items: olderItems, has_more: false, page_token: "" })

		const { result } = renderHook(() => useTopicMessages({ selectedTopic: topic }))
		await act(async () => {
			await Promise.resolve()
			await Promise.resolve()
		})
		mockState.superMagicStoreMock.initializeMessages.mockClear()

		await act(async () => {
			result.current.handlePullMoreMessage(topic)
			await Promise.resolve()
			await Promise.resolve()
		})

		expect(mockState.getMessagesByConversationIdMock).toHaveBeenLastCalledWith(
			expect.objectContaining({ page_token: "older-page" }),
		)
		expect(mockState.superMagicStoreMock.initializeMessages).toHaveBeenCalledWith(
			"chat-topic-1",
			olderItems,
			{
				assistantSnapshotPolicy: "canonical_final",
				mode: "merge",
				syncGeneration: undefined,
				toolProjectionPolicy: "historical_terminal",
			},
		)
	})

	it("keeps history pagination single-flight for repeated top-threshold notifications", async () => {
		const topic = createTopic()
		mockState.getMessagesByConversationIdMock.mockResolvedValueOnce({
			items: [],
			has_more: true,
			page_token: "older-page",
		})
		const { result } = renderHook(() => useTopicMessages({ selectedTopic: topic }))
		await act(async () => {
			await Promise.resolve()
			await Promise.resolve()
		})

		let resolveHistoryRequest: ((value: any) => void) | undefined
		mockState.getMessagesByConversationIdMock.mockReset()
		mockState.getMessagesByConversationIdMock.mockImplementation(
			() =>
				new Promise((resolve) => {
					resolveHistoryRequest = resolve
				}),
		)

		act(() => {
			result.current.handlePullMoreMessage(topic)
			result.current.handlePullMoreMessage(topic)
		})

		expect(mockState.getMessagesByConversationIdMock).toHaveBeenCalledTimes(1)

		await act(async () => {
			resolveHistoryRequest?.({ items: [], has_more: false, page_token: "" })
			await Promise.resolve()
		})
	})

	it("stops history pagination after the server reports no more messages", async () => {
		const topic = createTopic()
		mockState.getMessagesByConversationIdMock.mockResolvedValueOnce({
			items: [],
			has_more: true,
			page_token: "older-page",
		})
		const { result } = renderHook(() => useTopicMessages({ selectedTopic: topic }))
		await act(async () => {
			await Promise.resolve()
			await Promise.resolve()
		})

		mockState.getMessagesByConversationIdMock.mockReset()
		mockState.getMessagesByConversationIdMock.mockResolvedValue({
			items: [],
			has_more: false,
			page_token: "",
		})
		await act(async () => {
			result.current.handlePullMoreMessage(topic)
			await Promise.resolve()
			await Promise.resolve()
		})
		act(() => {
			result.current.handlePullMoreMessage(topic)
		})

		expect(mockState.getMessagesByConversationIdMock).toHaveBeenCalledTimes(1)
	})

	it("merges a non-empty WS reconciliation when HTTP cannot prove a common anchor", async () => {
		vi.useFakeTimers()
		const newerEnvelope = createMessageEnvelope("newer", "2")
		const olderEnvelope = createMessageEnvelope("older", "1")
		mockState.getMessagesByConversationIdMock.mockResolvedValue({
			items: [newerEnvelope, olderEnvelope],
			has_more: false,
			page_token: "",
		})
		renderHook(() => useTopicMessages({ selectedTopic: createTopic() }))
		await act(async () => {
			await Promise.resolve()
			await Promise.resolve()
		})
		mockState.getMessagesByConversationIdMock.mockClear()
		mockState.superMagicStoreMock.initializeMessages.mockClear()

		act(() => {
			const handleNewMessage = mockState.pubsubHandlers.get("Super_Magic_New_Message_V2")
			handleNewMessage?.({
				conversation_id: "conversation-1",
				message: { topic_id: "chat-topic-1" },
			})
			handleNewMessage?.({
				conversation_id: "conversation-1",
				message: { topic_id: "chat-topic-1" },
			})
		})
		await act(async () => {
			await vi.advanceTimersByTimeAsync(300)
		})

		expect(mockState.getMessagesByConversationIdMock).toHaveBeenCalledTimes(1)
		expect(mockState.getMessagesByConversationIdMock).toHaveBeenCalledWith(
			expect.objectContaining({ limit: 10, chat_topic_id: "chat-topic-1" }),
		)
		expect(mockState.superMagicStoreMock.initializeMessages).toHaveBeenCalledWith(
			"chat-topic-1",
			[newerEnvelope, olderEnvelope],
			{
				assistantSnapshotPolicy: "canonical_final",
				canonicalCommitContext: {
					lifecycleEventPolicy: "live",
					source: "http",
					trigger: "websocket",
				},
				eventPolicy: "live_arrival",
				mode: "merge",
				syncGeneration: expect.any(Number),
				toolProjectionPolicy: "preserve_live",
			},
		)
		expect(mockState.superMagicStoreMock.reconcileHttpMessageStatuses).not.toHaveBeenCalled()
		expect(mockState.superMagicStoreMock.enqueueMessage).not.toHaveBeenCalled()
	})

	it("reconciles a matching checkpoint rollback through a complete HTTP snapshot without using the event id as a message watermark", async () => {
		vi.useFakeTimers()
		mockState.getMessagesByConversationIdMock.mockResolvedValueOnce({
			items: [],
			has_more: false,
			page_token: "",
		})
		renderHook(() => useTopicMessages({ selectedTopic: createTopic() }))
		await act(async () => {
			await Promise.resolve()
			await Promise.resolve()
		})

		const restoredMessage = createUserMessageEnvelope("restored-user", "10", "read")
		mockState.getMessagesByConversationIdMock.mockReset()
		mockState.getMessagesByConversationIdMock.mockResolvedValueOnce({
			items: [restoredMessage],
			has_more: false,
			page_token: "",
			snapshot_complete: true,
		})
		mockState.superMagicStoreMock.initializeMessages.mockClear()

		act(() => {
			mockState.pubsubHandlers.get("Super_Magic_Checkpoint_Rollback")?.({
				seq_id: "rollback-domain-event-900",
				conversation_id: "conversation-1",
				message: {
					type: "super_magic_checkpoint_rollback",
					action: "undo",
					project_id: "project-1",
					topic_id: "topic-1",
					chat_topic_id: "chat-topic-1",
					target_seq_id: "10",
					affected_seq_ids: ["10"],
					affected_count: 1,
					truncated: false,
					refresh_required: true,
					timestamp: "2026-08-04T12:00:00Z",
				},
			})
		})

		expect(mockState.requestTopicRecoveryMock).toHaveBeenCalledWith({
			topicId: "chat-topic-1",
			correlationId: "checkpoint:rollback-domain-event-900",
			reason: "checkpoint_rollback",
			checkpointRollback: {
				eventId: "rollback-domain-event-900",
				action: "undo",
			},
		})
		expect(mockState.requestTopicRecoveryMock.mock.calls[0]?.[0]).not.toHaveProperty(
			"requiredSeqId",
		)

		await act(async () => {
			await vi.advanceTimersByTimeAsync(300)
		})

		expect(mockState.getMessagesByConversationIdMock).toHaveBeenCalledWith(
			expect.objectContaining({
				chat_topic_id: "chat-topic-1",
				conversation_id: "conversation-1",
				limit: 100,
			}),
		)
		expect(mockState.superMagicStoreMock.authorizeImStatusRestore).toHaveBeenCalledWith(
			"chat-topic-1",
		)
		expect(
			mockState.superMagicStoreMock.authorizeImStatusRestore.mock.invocationCallOrder[0],
		).toBeLessThan(
			mockState.superMagicStoreMock.initializeMessages.mock.invocationCallOrder[0] ||
				Infinity,
		)
		expect(mockState.superMagicStoreMock.initializeMessages).toHaveBeenCalledWith(
			"chat-topic-1",
			[restoredMessage],
			{
				assistantSnapshotPolicy: "canonical_final",
				mode: "replace",
				syncGeneration: expect.any(Number),
				toolProjectionPolicy: "historical_terminal",
			},
		)
		vi.useRealTimers()
	})

	it("ignores checkpoint rollback notifications for another conversation or business topic", async () => {
		mockState.getMessagesByConversationIdMock.mockResolvedValueOnce({
			items: [],
			has_more: false,
			page_token: "",
		})
		renderHook(() => useTopicMessages({ selectedTopic: createTopic() }))
		await act(async () => {
			await Promise.resolve()
			await Promise.resolve()
		})

		const publishCheckpoint = (overrides: Record<string, unknown>) =>
			mockState.pubsubHandlers.get("Super_Magic_Checkpoint_Rollback")?.({
				seq_id: "rollback-domain-event-901",
				conversation_id: "conversation-1",
				message: {
					type: "super_magic_checkpoint_rollback",
					action: "commit",
					project_id: "project-1",
					topic_id: "topic-1",
					chat_topic_id: "chat-topic-1",
					refresh_required: true,
					...overrides,
				},
			})

		act(() => {
			publishCheckpoint({ topic_id: "another-topic" })
			publishCheckpoint({ chat_topic_id: "another-chat-topic" })
			mockState.pubsubHandlers.get("Super_Magic_Checkpoint_Rollback")?.({
				seq_id: "rollback-domain-event-902",
				conversation_id: "another-conversation",
				message: {
					type: "super_magic_checkpoint_rollback",
					action: "commit",
					project_id: "project-1",
					topic_id: "topic-1",
					chat_topic_id: "chat-topic-1",
					refresh_required: true,
				},
			})
		})

		expect(mockState.requestTopicRecoveryMock).not.toHaveBeenCalled()
	})

	it("does not commit an authoritative tail until HTTP reaches the highest debounced WS seq", async () => {
		vi.useFakeTimers()
		mockState.getMessagesByConversationIdMock.mockResolvedValueOnce({
			items: [],
			has_more: false,
			page_token: "",
		})
		renderHook(() => useTopicMessages({ selectedTopic: createTopic() }))
		await act(async () => {
			await Promise.resolve()
			await Promise.resolve()
		})

		const localAnchor = createMessageEnvelope("local-anchor", "1")
		mockState.superMagicStoreMock.messages.set("chat-topic-1", [
			{
				app_message_id: "local-anchor",
				super_message_id: "local-anchor",
				seq_id: "1",
			},
		])
		mockState.getMessagesByConversationIdMock.mockReset()
		mockState.getMessagesByConversationIdMock
			.mockResolvedValueOnce({
				items: [createMessageEnvelope("http-stale", "6"), localAnchor],
				has_more: true,
				page_token: "page-2",
			})
			.mockResolvedValueOnce({
				items: [createMessageEnvelope("http-caught-up", "7"), localAnchor],
				has_more: true,
				page_token: "page-2",
			})
		mockState.superMagicStoreMock.initializeMessages.mockClear()

		act(() => {
			const handleNewMessage = mockState.pubsubHandlers.get("Super_Magic_New_Message_V2")
			handleNewMessage?.({
				conversation_id: "conversation-1",
				seq_id: "5",
				message: { topic_id: "chat-topic-1" },
			})
			handleNewMessage?.({
				conversation_id: "conversation-1",
				seq_id: "7",
				message: { topic_id: "chat-topic-1" },
			})
		})
		await act(async () => {
			await vi.advanceTimersByTimeAsync(300)
		})

		expect(mockState.getMessagesByConversationIdMock).toHaveBeenCalledTimes(1)
		expect(mockState.superMagicStoreMock.initializeMessages).not.toHaveBeenCalled()

		act(() => {
			mockState.pubsubHandlers.get("Super_Magic_New_Message_V2")?.({
				conversation_id: "conversation-1",
				seq_id: "7",
				message: { topic_id: "chat-topic-1" },
			})
		})
		await act(async () => {
			await vi.advanceTimersByTimeAsync(300)
		})

		expect(mockState.superMagicStoreMock.initializeMessages).toHaveBeenCalledWith(
			"chat-topic-1",
			[createMessageEnvelope("http-caught-up", "7"), localAnchor],
			expect.objectContaining({
				mode: "replace_tail",
				anchorSuperMessageId: "local-anchor",
			}),
		)
	})

	it("clears a local revoke anchor that is absent inside the authoritative replaced tail", async () => {
		vi.useFakeTimers()
		mockState.getMessagesByConversationIdMock.mockResolvedValueOnce({
			items: [],
			has_more: false,
			page_token: "",
		})
		renderHook(() => useTopicMessages({ selectedTopic: createTopic() }))
		await act(async () => {
			await Promise.resolve()
			await Promise.resolve()
		})

		mockState.activeRevokedAnchor = { seq_id: "2" }
		mockState.superMagicStoreMock.messages.set("chat-topic-1", [
			{ app_message_id: "stable-prefix", super_message_id: "stable-prefix", seq_id: "1" },
			{ app_message_id: "revoked-user", super_message_id: "revoked-user", seq_id: "2" },
		])
		const stablePrefix = createUserMessageEnvelope("stable-prefix", "1", "read")
		mockState.getMessagesByConversationIdMock.mockReset()
		mockState.getMessagesByConversationIdMock.mockResolvedValueOnce({
			items: [createUserMessageEnvelope("message-b", "3", "read"), stablePrefix],
			has_more: true,
			page_token: "page-2",
		})

		act(() => {
			mockState.pubsubHandlers.get("Super_Magic_New_Message_V2")?.({
				conversation_id: "conversation-1",
				seq_id: "3",
				message: { topic_id: "chat-topic-1" },
			})
		})
		await act(async () => {
			await vi.advanceTimersByTimeAsync(300)
		})

		expect(mockState.clearActiveRevokedAnchor).toHaveBeenCalledWith("chat-topic-1")
		expect(mockState.clearHiddenRevokedOptimisticMessageIds).toHaveBeenCalledWith(
			"chat-topic-1",
		)
	})

	it("keeps a local revoke anchor absent from an unanchored terminal page", async () => {
		vi.useFakeTimers()
		mockState.getMessagesByConversationIdMock.mockResolvedValueOnce({
			items: [],
			has_more: false,
			page_token: "",
		})
		renderHook(() => useTopicMessages({ selectedTopic: createTopic() }))
		await act(async () => {
			await Promise.resolve()
			await Promise.resolve()
		})

		mockState.activeRevokedAnchor = { seq_id: "2" }
		mockState.superMagicStoreMock.messages.set("chat-topic-1", [
			{ app_message_id: "revoked-user", super_message_id: "revoked-user", seq_id: "2" },
		])
		mockState.getMessagesByConversationIdMock.mockReset()
		mockState.getMessagesByConversationIdMock.mockResolvedValueOnce({
			items: [createUserMessageEnvelope("message-b", "3", "read")],
			has_more: false,
			page_token: "",
		})

		act(() => {
			mockState.pubsubHandlers.get("Super_Magic_New_Message_V2")?.({
				conversation_id: "conversation-1",
				seq_id: "3",
				message: { topic_id: "chat-topic-1" },
			})
		})
		await act(async () => {
			await vi.advanceTimersByTimeAsync(300)
		})

		expect(mockState.clearActiveRevokedAnchor).not.toHaveBeenCalled()
		expect(mockState.clearHiddenRevokedOptimisticMessageIds).not.toHaveBeenCalled()
	})

	it("does not clear a local revoke anchor outside an incomplete authoritative tail", async () => {
		vi.useFakeTimers()
		mockState.getMessagesByConversationIdMock.mockResolvedValueOnce({
			items: [],
			has_more: false,
			page_token: "",
		})
		renderHook(() => useTopicMessages({ selectedTopic: createTopic() }))
		await act(async () => {
			await Promise.resolve()
			await Promise.resolve()
		})

		mockState.activeRevokedAnchor = { seq_id: "1" }
		mockState.superMagicStoreMock.messages.set("chat-topic-1", [
			{ app_message_id: "revoked-user", super_message_id: "revoked-user", seq_id: "1" },
			{ app_message_id: "stable-prefix", super_message_id: "stable-prefix", seq_id: "2" },
		])
		mockState.getMessagesByConversationIdMock.mockReset()
		mockState.getMessagesByConversationIdMock.mockResolvedValueOnce({
			items: [
				createUserMessageEnvelope("message-b", "3", "read"),
				createUserMessageEnvelope("stable-prefix", "2", "read"),
			],
			has_more: true,
			page_token: "page-2",
		})

		act(() => {
			mockState.pubsubHandlers.get("Super_Magic_New_Message_V2")?.({
				conversation_id: "conversation-1",
				seq_id: "3",
				message: { topic_id: "chat-topic-1" },
			})
		})
		await act(async () => {
			await vi.advanceTimersByTimeAsync(300)
		})

		expect(mockState.clearActiveRevokedAnchor).not.toHaveBeenCalled()
		expect(mockState.clearHiddenRevokedOptimisticMessageIds).not.toHaveBeenCalled()
	})

	it("clears the current-tab revoke anchor when a later HTTP reconciliation confirms remote restore", async () => {
		vi.useFakeTimers()
		mockState.getMessagesByConversationIdMock.mockResolvedValueOnce({
			items: [],
			has_more: false,
			page_token: "",
		})
		renderHook(() => useTopicMessages({ selectedTopic: createTopic() }))
		await act(async () => {
			await Promise.resolve()
			await Promise.resolve()
		})

		mockState.activeRevokedAnchor = { seq_id: "10" }
		mockState.getMessagesByConversationIdMock.mockReset()
		mockState.getMessagesByConversationIdMock.mockResolvedValueOnce({
			items: [createUserMessageEnvelope("restored-user", "10", "read")],
			has_more: false,
			page_token: "",
		})

		act(() => {
			mockState.pubsubHandlers.get("Super_Magic_New_Message_V2")?.({
				conversation_id: "conversation-1",
				message: { topic_id: "chat-topic-1" },
			})
		})
		await act(async () => {
			await vi.advanceTimersByTimeAsync(300)
		})

		expect(mockState.clearActiveRevokedAnchor).toHaveBeenCalledWith("chat-topic-1")
		expect(mockState.clearHiddenRevokedOptimisticMessageIds).toHaveBeenCalledWith(
			"chat-topic-1",
		)
	})

	it("does not clear the current-tab revoke anchor during its immediate local revoke refresh", async () => {
		mockState.getMessagesByConversationIdMock.mockResolvedValueOnce({
			items: [],
			has_more: false,
			page_token: "",
		})
		renderHook(() => useTopicMessages({ selectedTopic: createTopic() }))
		await act(async () => {
			await Promise.resolve()
			await Promise.resolve()
		})

		mockState.activeRevokedAnchor = { seq_id: "10" }
		mockState.getMessagesByConversationIdMock.mockReset()
		mockState.getMessagesByConversationIdMock.mockResolvedValueOnce({
			items: [createUserMessageEnvelope("local-revoke-user", "10", "read")],
			has_more: false,
			page_token: "",
		})

		await act(async () => {
			mockState.pubsubHandlers.get("Refresh_Topic_Messages")?.({})
			await Promise.resolve()
			await Promise.resolve()
		})

		expect(mockState.clearActiveRevokedAnchor).not.toHaveBeenCalled()
		expect(mockState.clearHiddenRevokedOptimisticMessageIds).not.toHaveBeenCalled()
	})

	it("commits revoke refresh as one unfiltered authoritative batch", async () => {
		mockState.getMessagesByConversationIdMock.mockResolvedValueOnce({
			items: [],
			has_more: false,
			page_token: "",
		})
		renderHook(() =>
			useTopicMessages({
				selectedTopic: createTopic({ task_status: TaskStatus.RUNNING }),
			}),
		)
		await act(async () => {
			await Promise.resolve()
			await Promise.resolve()
		})

		const revokedBatch = [
			createMessageEnvelope("historical-revoked", "1", "revoked"),
			createMessageEnvelope("normal", "2", "read"),
			createMessageEnvelope("active-revoked", "3", "revoked"),
		]
		mockState.getMessagesByConversationIdMock.mockReset()
		mockState.getMessagesByConversationIdMock.mockResolvedValueOnce({
			items: revokedBatch,
			has_more: false,
			page_token: "",
		})
		mockState.superMagicStoreMock.initializeMessages.mockClear()
		mockState.superMagicStoreMock.enqueueMessage.mockClear()

		await act(async () => {
			await mockState.pubsubHandlers.get("Refresh_Topic_Messages")?.()
			await Promise.resolve()
			await Promise.resolve()
		})

		expect(mockState.getMessagesByConversationIdMock).toHaveBeenCalledWith(
			expect.objectContaining({
				chat_topic_id: "chat-topic-1",
				limit: 500,
				order: "desc",
			}),
		)
		expect(mockState.superMagicStoreMock.initializeMessages).toHaveBeenCalledTimes(1)
		expect(mockState.superMagicStoreMock.initializeMessages).toHaveBeenCalledWith(
			"chat-topic-1",
			revokedBatch,
			{
				assistantSnapshotPolicy: "canonical_final",
				mode: "replace",
				syncGeneration: undefined,
				toolProjectionPolicy: "historical_terminal",
			},
		)
		expect(mockState.superMagicStoreMock.enqueueMessage).not.toHaveBeenCalled()
	})

	it("ignores persistent-message events for another topic", async () => {
		vi.useFakeTimers()
		mockState.getMessagesByConversationIdMock.mockResolvedValue({
			items: [],
			has_more: false,
			page_token: "",
		})
		renderHook(() => useTopicMessages({ selectedTopic: createTopic() }))
		await act(async () => {
			await Promise.resolve()
			await Promise.resolve()
		})
		mockState.getMessagesByConversationIdMock.mockClear()

		act(() => {
			mockState.pubsubHandlers.get("Super_Magic_New_Message_V2")?.({
				conversation_id: "conversation-1",
				message: { topic_id: "another-chat-topic" },
			})
		})
		await act(async () => {
			await vi.advanceTimersByTimeAsync(300)
		})

		expect(mockState.getMessagesByConversationIdMock).not.toHaveBeenCalled()
	})

	it("continues finished polling as a bounded HTTP fallback when WebSocket notifications are lost", async () => {
		vi.useFakeTimers()
		mockState.getMessagesByConversationIdMock.mockResolvedValue({
			items: [],
			has_more: false,
			page_token: "",
		})
		renderHook(() =>
			useTopicMessages({
				selectedTopic: createTopic({ task_status: TaskStatus.FINISHED }),
			}),
		)
		await act(async () => {
			await Promise.resolve()
			await Promise.resolve()
		})
		mockState.getMessagesByConversationIdMock.mockClear()

		await act(async () => {
			await vi.advanceTimersByTimeAsync(20_000)
			await Promise.resolve()
			await Promise.resolve()
		})
		expect(mockState.getMessagesByConversationIdMock).toHaveBeenCalledTimes(1)

		await act(async () => {
			await vi.advanceTimersByTimeAsync(40_000)
		})

		expect(mockState.getMessagesByConversationIdMock).toHaveBeenCalledTimes(3)
	})

	it("uses a lightweight HTTP reconciliation when a stable finished topic returns to foreground", async () => {
		mockState.getMessagesByConversationIdMock.mockResolvedValueOnce({
			items: [],
			has_more: false,
			page_token: "",
		})
		renderHook(() =>
			useTopicMessages({
				selectedTopic: createTopic({ task_status: TaskStatus.FINISHED }),
			}),
		)
		await act(async () => {
			await Promise.resolve()
			await Promise.resolve()
		})

		Object.defineProperty(document, "visibilityState", {
			configurable: true,
			value: "hidden",
		})
		document.dispatchEvent(new Event("visibilitychange"))
		mockState.getMessagesByConversationIdMock.mockReset()
		mockState.getMessagesByConversationIdMock.mockResolvedValueOnce({
			items: [],
			has_more: false,
			page_token: "",
		})
		mockState.superMagicStoreMock.beginTopicSync.mockClear()

		Object.defineProperty(document, "visibilityState", {
			configurable: true,
			value: "visible",
		})
		await act(async () => {
			document.dispatchEvent(new Event("visibilitychange"))
			await Promise.resolve()
			await Promise.resolve()
		})

		expect(mockState.getMessagesByConversationIdMock).toHaveBeenCalledWith(
			expect.objectContaining({
				chat_topic_id: "chat-topic-1",
				limit: 20,
				page_token: "",
				order: "desc",
			}),
		)
		expect(mockState.superMagicStoreMock.beginTopicSync).not.toHaveBeenCalled()
		expect(mockState.getTopicsStatusMock).not.toHaveBeenCalled()
	})

	it("syncs topic status after foreground reconciliation when local status is still running", async () => {
		mockState.getMessagesByConversationIdMock.mockResolvedValue({
			items: [],
			has_more: false,
			page_token: "",
		})
		mockState.getTopicsStatusMock.mockResolvedValue({
			list: [
				{
					id: "topic-1",
					status: "finished",
					has_unread: false,
				},
			],
		})
		renderHook(() =>
			useTopicMessages({ selectedTopic: createTopic({ task_status: TaskStatus.RUNNING }) }),
		)
		await act(async () => {
			await Promise.resolve()
			await Promise.resolve()
		})

		Object.defineProperty(document, "visibilityState", {
			configurable: true,
			value: "hidden",
		})
		document.dispatchEvent(new Event("visibilitychange"))
		mockState.getMessagesByConversationIdMock.mockClear()
		mockState.getTopicsStatusMock.mockClear()
		mockState.getMessagesByConversationIdMock.mockResolvedValueOnce({
			items: [],
			has_more: false,
			page_token: "",
		})

		Object.defineProperty(document, "visibilityState", {
			configurable: true,
			value: "visible",
		})
		await act(async () => {
			document.dispatchEvent(new Event("visibilitychange"))
			await Promise.resolve()
			await Promise.resolve()
		})

		expect(mockState.getTopicsStatusMock).toHaveBeenCalledWith({
			topic_ids: ["topic-1"],
		})
		expect(defaultTopicStore.mergeTopic).toHaveBeenCalledWith(
			"topic-1",
			expect.objectContaining({
				task_status: TaskStatus.FINISHED,
				status: TaskStatus.FINISHED,
			}),
		)
	})

	it("resumes a scheduled checkpoint recovery instead of starting foreground pagination", async () => {
		mockState.getMessagesByConversationIdMock.mockResolvedValueOnce({
			items: [],
			has_more: false,
			page_token: "",
		})
		renderHook(() =>
			useTopicMessages({ selectedTopic: createTopic({ task_status: TaskStatus.RUNNING }) }),
		)
		await act(async () => {
			await Promise.resolve()
			await Promise.resolve()
		})

		Object.defineProperty(document, "visibilityState", {
			configurable: true,
			value: "hidden",
		})
		document.dispatchEvent(new Event("visibilitychange"))
		mockState.getMessagesByConversationIdMock.mockClear()
		mockState.getTopicRecoveryStatusMock.mockReturnValue({
			hasScheduled: true,
			hasInFlight: false,
			reason: "checkpoint_rollback",
		})

		Object.defineProperty(document, "visibilityState", {
			configurable: true,
			value: "visible",
		})
		document.dispatchEvent(new Event("visibilitychange"))

		expect(mockState.resumeTopicRecoveryMock).toHaveBeenCalledWith("chat-topic-1")
		expect(mockState.getMessagesByConversationIdMock).not.toHaveBeenCalled()
	})

	it("rechecks ordinary pending recovery after foreground anchor reconciliation", async () => {
		mockState.getMessagesByConversationIdMock.mockResolvedValueOnce({
			items: [],
			has_more: false,
			page_token: "",
		})
		renderHook(() =>
			useTopicMessages({ selectedTopic: createTopic({ task_status: TaskStatus.RUNNING }) }),
		)
		await act(async () => {
			await Promise.resolve()
			await Promise.resolve()
		})
		mockState.superMagicStoreMock.messages.set("chat-topic-1", [
			{
				app_message_id: "foreground-anchor",
				super_message_id: "foreground-anchor",
				seq_id: "1",
			},
		])

		Object.defineProperty(document, "visibilityState", {
			configurable: true,
			value: "hidden",
		})
		document.dispatchEvent(new Event("visibilitychange"))
		mockState.getMessagesByConversationIdMock.mockReset()
		mockState.getMessagesByConversationIdMock.mockResolvedValueOnce({
			items: [createMessageEnvelope("foreground-anchor", "1")],
			has_more: true,
			page_token: "older",
		})
		mockState.getTopicRecoveryStatusMock.mockReturnValue({
			hasScheduled: true,
			hasInFlight: false,
			reason: "persistent_message",
		})

		Object.defineProperty(document, "visibilityState", {
			configurable: true,
			value: "visible",
		})
		await act(async () => {
			document.dispatchEvent(new Event("visibilitychange"))
			await Promise.resolve()
			await Promise.resolve()
			await Promise.resolve()
		})

		expect(mockState.getMessagesByConversationIdMock).toHaveBeenCalledTimes(1)
		expect(mockState.resumeTopicRecoveryMock).toHaveBeenCalledWith("chat-topic-1")
	})

	it("keeps ordinary watchdog recovery on a bounded progress tail instead of full recovery", async () => {
		mockState.getMessagesByConversationIdMock.mockResolvedValueOnce({
			items: [],
			has_more: false,
			page_token: "",
		})
		renderHook(() =>
			useTopicMessages({
				selectedTopic: createTopic({ task_status: TaskStatus.RUNNING }),
			}),
		)
		await act(async () => {
			await Promise.resolve()
			await Promise.resolve()
		})

		const registration = mockState.registerStreamRecoveryOwnerMock.mock.calls[0]?.[0] as {
			recover: (context: Record<string, unknown>) => Promise<{ didPullSucceed: boolean }>
		}
		mockState.getMessagesByConversationIdMock.mockReset()
		mockState.getMessagesByConversationIdMock.mockResolvedValueOnce({
			items: [createMessageEnvelope("watchdog-progress", "2")],
			has_more: false,
			page_token: "",
			snapshot_complete: true,
		})
		mockState.superMagicStoreMock.reconcileAuthoritativeMessages.mockClear()

		let recoveryResult: { didPullSucceed: boolean } | undefined
		await act(async () => {
			recoveryResult = await registration.recover({
				topicId: "chat-topic-1",
				conversationId: "conversation-1",
				correlationId: "watchdog-1",
				syncGeneration: 22,
				reason: "stream_watchdog",
			})
		})

		expect(recoveryResult).toEqual(expect.objectContaining({ didPullSucceed: true }))
		expect(mockState.getMessagesByConversationIdMock).toHaveBeenCalledTimes(1)
		expect(mockState.getMessagesByConversationIdMock).toHaveBeenCalledWith(
			expect.objectContaining({
				limit: 20,
				page_token: "",
			}),
		)
		expect(mockState.superMagicStoreMock.reconcileAuthoritativeMessages).toHaveBeenCalledWith(
			"chat-topic-1",
			expect.objectContaining({
				writeOptions: expect.objectContaining({
					assistantSnapshotPolicy: "progress_snapshot",
					mode: "merge",
					syncGeneration: 22,
				}),
			}),
		)
	})

	it("registers the active topic as the recovery owner and forwards its generation to replace", async () => {
		const emptySnapshot = { items: [], has_more: false, page_token: "" }
		mockState.getMessagesByConversationIdMock.mockResolvedValue(emptySnapshot)

		renderHook(() =>
			useTopicMessages({
				selectedTopic: createTopic({ task_status: TaskStatus.FINISHED }),
			}),
		)
		await act(async () => {
			await Promise.resolve()
			await Promise.resolve()
		})

		expect(mockState.registerStreamRecoveryOwnerMock).toHaveBeenCalledTimes(1)
		const registration = mockState.registerStreamRecoveryOwnerMock.mock.calls[0]?.[0] as {
			topicId: string
			conversationId: string
			getTaskStatus: () => string | undefined
			recover: (context: {
				topicId: string
				conversationId: string
				correlationId: string
				syncGeneration: number
			}) => Promise<{ didPullSucceed: boolean }>
		}
		expect(registration).toEqual(
			expect.objectContaining({
				topicId: "chat-topic-1",
				conversationId: "conversation-1",
			}),
		)
		expect(registration.getTaskStatus()).toBe(TaskStatus.FINISHED)

		mockState.getMessagesByConversationIdMock.mockClear()
		mockState.superMagicStoreMock.initializeMessages.mockClear()
		const firstPageItems = [createMessageEnvelope("newer", "2")]
		const secondPageItems = [createMessageEnvelope("older", "1")]
		mockState.getMessagesByConversationIdMock
			.mockResolvedValueOnce({ items: firstPageItems, has_more: true, page_token: "page-2" })
			.mockResolvedValueOnce({
				items: secondPageItems,
				has_more: false,
				page_token: "",
				snapshot_complete: true,
			})
		let recoveryResult: { didPullSucceed: boolean } | undefined
		await act(async () => {
			recoveryResult = await registration.recover({
				topicId: "chat-topic-1",
				conversationId: "conversation-1",
				correlationId: "correlation-1",
				syncGeneration: 23,
				reason: "checkpoint_rollback",
			})
		})

		expect(recoveryResult).toEqual(expect.objectContaining({ didPullSucceed: true }))
		expect(mockState.getMessagesByConversationIdMock).toHaveBeenCalledTimes(2)
		expect(mockState.getMessagesByConversationIdMock).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				chat_topic_id: "chat-topic-1",
				conversation_id: "conversation-1",
				limit: 100,
				page_token: "",
			}),
		)
		expect(mockState.getMessagesByConversationIdMock).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				chat_topic_id: "chat-topic-1",
				conversation_id: "conversation-1",
				limit: 100,
				page_token: "page-2",
			}),
		)
		expect(mockState.superMagicStoreMock.initializeMessages).toHaveBeenCalledWith(
			"chat-topic-1",
			[...firstPageItems, ...secondPageItems],
			{
				assistantSnapshotPolicy: "canonical_final",
				mode: "replace",
				syncGeneration: 23,
				toolProjectionPolicy: "historical_terminal",
			},
		)
	})

	it("does not replace when the terminal recovery page reports an incomplete snapshot", async () => {
		mockState.getMessagesByConversationIdMock.mockResolvedValueOnce({
			items: [],
			has_more: false,
			page_token: "",
		})
		renderHook(() => useTopicMessages({ selectedTopic: createTopic() }))
		await act(async () => {
			await Promise.resolve()
			await Promise.resolve()
		})
		const registration = mockState.registerStreamRecoveryOwnerMock.mock.calls[0]?.[0] as {
			recover: (context: {
				topicId: string
				conversationId: string
				correlationId: string
				syncGeneration: number
			}) => Promise<{ didPullSucceed: boolean }>
		}

		mockState.getMessagesByConversationIdMock.mockReset()
		mockState.getMessagesByConversationIdMock.mockResolvedValueOnce({
			items: [createMessageEnvelope("message-b", "2")],
			has_more: false,
			page_token: "",
			snapshot_complete: false,
		})
		mockState.superMagicStoreMock.initializeMessages.mockClear()

		let recoveryResult: { didPullSucceed: boolean } | undefined
		await act(async () => {
			recoveryResult = await registration.recover({
				topicId: "chat-topic-1",
				conversationId: "conversation-1",
				correlationId: "correlation-1",
				syncGeneration: 24,
				reason: "checkpoint_rollback",
				checkpointRollback: { eventId: "event-incomplete", action: "undo" },
			})
		})

		expect(recoveryResult).toEqual(expect.objectContaining({ didPullSucceed: false }))
		expect(mockState.superMagicStoreMock.authorizeImStatusRestore).not.toHaveBeenCalled()
		expect(mockState.superMagicStoreMock.initializeMessages).not.toHaveBeenCalled()
	})

	it("does not authorize an undo restore when the recovery generation is already stale", async () => {
		mockState.getMessagesByConversationIdMock.mockResolvedValueOnce({
			items: [],
			has_more: false,
			page_token: "",
		})
		renderHook(() => useTopicMessages({ selectedTopic: createTopic() }))
		await act(async () => {
			await Promise.resolve()
			await Promise.resolve()
		})
		const registration = mockState.registerStreamRecoveryOwnerMock.mock.calls[0]?.[0] as {
			recover: (context: Record<string, unknown>) => Promise<{ didPullSucceed: boolean }>
		}

		mockState.getMessagesByConversationIdMock.mockReset()
		mockState.getMessagesByConversationIdMock.mockResolvedValueOnce({
			items: [createUserMessageEnvelope("stale-restored-user", "10", "read")],
			has_more: false,
			page_token: "",
			snapshot_complete: true,
		})
		mockState.superMagicStoreMock.isTopicSyncCurrent.mockReturnValue(false)
		mockState.superMagicStoreMock.initializeMessages.mockClear()

		let recoveryResult: { didPullSucceed: boolean } | undefined
		await act(async () => {
			recoveryResult = await registration.recover({
				topicId: "chat-topic-1",
				conversationId: "conversation-1",
				correlationId: "checkpoint:stale-event",
				syncGeneration: 25,
				reason: "checkpoint_rollback",
				checkpointRollback: { eventId: "stale-event", action: "undo" },
			})
		})

		expect(recoveryResult).toEqual(expect.objectContaining({ didPullSucceed: false }))
		expect(mockState.superMagicStoreMock.authorizeImStatusRestore).not.toHaveBeenCalled()
		expect(mockState.superMagicStoreMock.initializeMessages).not.toHaveBeenCalled()
	})

	it("does not replace with a partial recovery snapshot when a later page fails", async () => {
		const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
		mockState.getMessagesByConversationIdMock.mockResolvedValue({
			items: [],
			has_more: false,
			page_token: "",
		})
		renderHook(() => useTopicMessages({ selectedTopic: createTopic() }))
		await act(async () => {
			await Promise.resolve()
			await Promise.resolve()
		})
		const registration = mockState.registerStreamRecoveryOwnerMock.mock.calls[0]?.[0] as {
			recover: (context: {
				topicId: string
				conversationId: string
				correlationId: string
				syncGeneration: number
			}) => Promise<{ didPullSucceed: boolean }>
		}

		mockState.getMessagesByConversationIdMock.mockReset()
		mockState.getMessagesByConversationIdMock
			.mockResolvedValueOnce({
				items: [createMessageEnvelope("partial", "2")],
				has_more: true,
				page_token: "page-2",
			})
			.mockRejectedValueOnce(new Error("second page failed"))
		mockState.superMagicStoreMock.initializeMessages.mockClear()

		let recoveryResult: { didPullSucceed: boolean } | undefined
		await act(async () => {
			recoveryResult = await registration.recover({
				topicId: "chat-topic-1",
				conversationId: "conversation-1",
				correlationId: "correlation-1",
				syncGeneration: 24,
				reason: "checkpoint_rollback",
			})
		})

		expect(recoveryResult).toEqual(expect.objectContaining({ didPullSucceed: false }))
		expect(mockState.superMagicStoreMock.initializeMessages).not.toHaveBeenCalled()
		expect(consoleErrorSpy).toHaveBeenCalled()
		consoleErrorSpy.mockRestore()
	})

	it("wraps foreground recovery in one generation and completes after the full snapshot commits", async () => {
		mockState.getMessagesByConversationIdMock.mockResolvedValueOnce({
			items: [],
			has_more: false,
			page_token: "",
		})
		renderHook(() =>
			useTopicMessages({
				selectedTopic: createTopic({ task_status: TaskStatus.RUNNING }),
			}),
		)
		await act(async () => {
			await Promise.resolve()
			await Promise.resolve()
		})

		mockState.superMagicStoreMock.messages.set("chat-topic-1", [
			{ app_message_id: "foreground-anchor" },
		])
		Object.defineProperty(document, "visibilityState", {
			configurable: true,
			value: "hidden",
		})
		document.dispatchEvent(new Event("visibilitychange"))

		const firstPageItems = [createMessageEnvelope("newer", "3")]
		const secondPageItems = [
			createMessageEnvelope("foreground-anchor", "2"),
			createMessageEnvelope("older", "1"),
		]
		mockState.getMessagesByConversationIdMock.mockReset()
		mockState.getMessagesByConversationIdMock
			.mockResolvedValueOnce({ items: firstPageItems, has_more: true, page_token: "page-2" })
			.mockResolvedValueOnce({ items: secondPageItems, has_more: false, page_token: "" })
		mockState.superMagicStoreMock.beginTopicSync.mockClear()
		mockState.superMagicStoreMock.initializeMessages.mockClear()
		mockState.superMagicStoreMock.completeTopicSync.mockClear()

		Object.defineProperty(document, "visibilityState", {
			configurable: true,
			value: "visible",
		})
		await act(async () => {
			document.dispatchEvent(new Event("visibilitychange"))
			expect(mockState.superMagicStoreMock.beginTopicSync).toHaveBeenCalledWith(
				"chat-topic-1",
			)
			await Promise.resolve()
			await Promise.resolve()
			await Promise.resolve()
		})

		const generation = mockState.superMagicStoreMock.beginTopicSync.mock.results[0]?.value
		expect(mockState.superMagicStoreMock.initializeMessages).toHaveBeenCalledTimes(1)
		expect(mockState.superMagicStoreMock.initializeMessages).toHaveBeenCalledWith(
			"chat-topic-1",
			[...firstPageItems, secondPageItems[0]],
			{
				assistantSnapshotPolicy: "progress_snapshot",
				mode: "replace_tail",
				anchorSuperMessageId: "foreground-anchor",
				preserveStreamSuperMessageIds: [],
				syncGeneration: generation,
				toolProjectionPolicy: "historical_terminal",
			},
		)
		expect(mockState.superMagicStoreMock.completeTopicSync).toHaveBeenCalledWith(
			"chat-topic-1",
			generation,
			expect.objectContaining({
				succeeded: true,
				taskStatus: TaskStatus.RUNNING,
				latestSeqId: "assistant-seq-1",
				renderStrategy: "foreground-instant",
			}),
		)
	})

	it("stops foreground recovery at a User anchor when HTTP omits super_message_id and changes seq_id", async () => {
		mockState.getMessagesByConversationIdMock.mockResolvedValueOnce({
			items: [],
			has_more: false,
			page_token: "",
		})
		renderHook(() =>
			useTopicMessages({
				selectedTopic: createTopic({ task_status: TaskStatus.RUNNING }),
			}),
		)
		await act(async () => {
			await Promise.resolve()
			await Promise.resolve()
		})

		mockState.superMagicStoreMock.messages.set("chat-topic-1", [
			{
				app_message_id: "foreground-user-anchor",
				role: "user",
				seq_id: "local-optimistic-seq",
			},
		])
		Object.defineProperty(document, "visibilityState", {
			configurable: true,
			value: "hidden",
		})
		document.dispatchEvent(new Event("visibilitychange"))

		const userAnchor = createUserMessageEnvelope(
			"foreground-user-anchor",
			"server-persisted-seq",
			"read",
		)
		mockState.getMessagesByConversationIdMock.mockReset()
		mockState.getMessagesByConversationIdMock.mockResolvedValueOnce({
			items: [userAnchor],
			has_more: true,
			page_token: "page-2-must-not-be-requested",
		})
		mockState.superMagicStoreMock.initializeMessages.mockClear()

		Object.defineProperty(document, "visibilityState", {
			configurable: true,
			value: "visible",
		})
		await act(async () => {
			document.dispatchEvent(new Event("visibilitychange"))
			await Promise.resolve()
			await Promise.resolve()
			await Promise.resolve()
		})

		expect(mockState.getMessagesByConversationIdMock).toHaveBeenCalledTimes(1)
		expect(mockState.superMagicStoreMock.initializeMessages).toHaveBeenCalledWith(
			"chat-topic-1",
			[userAnchor],
			expect.objectContaining({
				mode: "replace_tail",
				anchorSuperMessageId: "foreground-user-anchor",
			}),
		)
	})

	it("stops foreground recovery at the same Assistant super_message_id across revisions", async () => {
		mockState.getMessagesByConversationIdMock.mockResolvedValueOnce({
			items: [],
			has_more: false,
			page_token: "",
		})
		renderHook(() =>
			useTopicMessages({
				selectedTopic: createTopic({ task_status: TaskStatus.RUNNING }),
			}),
		)
		await act(async () => {
			await Promise.resolve()
			await Promise.resolve()
		})

		mockState.superMagicStoreMock.messages.set("chat-topic-1", [
			{
				app_message_id: "assistant-old-revision",
				role: "assistant",
				super_message_id: "assistant-logical-anchor",
				seq_id: "10",
			},
		])
		Object.defineProperty(document, "visibilityState", {
			configurable: true,
			value: "hidden",
		})
		document.dispatchEvent(new Event("visibilitychange"))

		const assistantRevision = createMessageEnvelope("assistant-new-revision", "20")
		assistantRevision.seq.message.super_magic_message.super_message_id =
			"assistant-logical-anchor"
		mockState.getMessagesByConversationIdMock.mockReset()
		mockState.getMessagesByConversationIdMock.mockResolvedValueOnce({
			items: [assistantRevision],
			has_more: true,
			page_token: "page-2-must-not-be-requested",
		})
		mockState.superMagicStoreMock.initializeMessages.mockClear()

		Object.defineProperty(document, "visibilityState", {
			configurable: true,
			value: "visible",
		})
		await act(async () => {
			document.dispatchEvent(new Event("visibilitychange"))
			await Promise.resolve()
			await Promise.resolve()
			await Promise.resolve()
		})

		expect(mockState.getMessagesByConversationIdMock).toHaveBeenCalledTimes(1)
		expect(mockState.superMagicStoreMock.initializeMessages).toHaveBeenCalledWith(
			"chat-topic-1",
			[assistantRevision],
			expect.objectContaining({
				mode: "replace_tail",
				anchorSuperMessageId: "assistant-logical-anchor",
			}),
		)
	})

	it("stops foreground recovery after two bounded pages when the durable anchor is not reached", async () => {
		mockState.getMessagesByConversationIdMock.mockResolvedValueOnce({
			items: [],
			has_more: false,
			page_token: "",
		})
		renderHook(() =>
			useTopicMessages({
				selectedTopic: createTopic({ task_status: TaskStatus.RUNNING }),
			}),
		)
		await act(async () => {
			await Promise.resolve()
			await Promise.resolve()
		})

		mockState.superMagicStoreMock.messages.set("chat-topic-1", [
			{
				app_message_id: "foreground-anchor",
				super_message_id: "foreground-anchor",
				seq_id: "2",
			},
		])
		Object.defineProperty(document, "visibilityState", {
			configurable: true,
			value: "hidden",
		})
		document.dispatchEvent(new Event("visibilitychange"))

		const pageItems = [
			[createMessageEnvelope("message-500", "500")],
			[createMessageEnvelope("message-400", "400")],
		]
		mockState.getMessagesByConversationIdMock.mockReset()
		pageItems.forEach((items, index) => {
			mockState.getMessagesByConversationIdMock.mockResolvedValueOnce({
				items,
				has_more: true,
				page_token: `page-${index + 2}`,
			})
		})
		mockState.superMagicStoreMock.initializeMessages.mockClear()

		Object.defineProperty(document, "visibilityState", {
			configurable: true,
			value: "visible",
		})
		await act(async () => {
			document.dispatchEvent(new Event("visibilitychange"))
			await Promise.resolve()
		})

		expect(mockState.getMessagesByConversationIdMock).toHaveBeenCalledTimes(2)
		expect(mockState.getMessagesByConversationIdMock).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({ limit: 200, page_token: "" }),
		)
		expect(mockState.getMessagesByConversationIdMock).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({ limit: 400, page_token: "page-2" }),
		)
		expect(mockState.superMagicStoreMock.initializeMessages).toHaveBeenCalledWith(
			"chat-topic-1",
			pageItems.flat(),
			expect.objectContaining({
				assistantSnapshotPolicy: "progress_snapshot",
				mode: "merge",
				toolProjectionPolicy: "preserve_live",
			}),
		)
	})

	it("matches a foreground anchor when the HTTP envelope omits type", async () => {
		mockState.getMessagesByConversationIdMock.mockResolvedValueOnce({
			items: [],
			has_more: false,
			page_token: "",
		})
		renderHook(() =>
			useTopicMessages({
				selectedTopic: createTopic({ task_status: TaskStatus.RUNNING }),
			}),
		)
		await act(async () => {
			await Promise.resolve()
			await Promise.resolve()
		})

		mockState.superMagicStoreMock.messages.set("chat-topic-1", [
			{
				app_message_id: "assistant-old-revision",
				role: "assistant",
				super_message_id: "assistant-logical-anchor",
				seq_id: "10",
			},
		])
		Object.defineProperty(document, "visibilityState", {
			configurable: true,
			value: "hidden",
		})
		document.dispatchEvent(new Event("visibilitychange"))

		const envelope = createMessageEnvelope("assistant-new-revision", "20")
		const message = envelope.seq.message as Record<string, unknown>
		message.general_agent_card = message.super_magic_message
		;(message.general_agent_card as Record<string, unknown>).super_message_id =
			"assistant-logical-anchor"
		delete message.type
		delete message.super_magic_message
		mockState.getMessagesByConversationIdMock.mockReset()
		mockState.getMessagesByConversationIdMock.mockResolvedValueOnce({
			items: [envelope],
			has_more: true,
			page_token: "page-2-must-not-be-requested",
		})
		mockState.superMagicStoreMock.initializeMessages.mockClear()

		Object.defineProperty(document, "visibilityState", {
			configurable: true,
			value: "visible",
		})
		await act(async () => {
			document.dispatchEvent(new Event("visibilitychange"))
			await Promise.resolve()
			await Promise.resolve()
			await Promise.resolve()
		})

		expect(mockState.getMessagesByConversationIdMock).toHaveBeenCalledTimes(1)
		expect(mockState.superMagicStoreMock.initializeMessages).toHaveBeenCalledWith(
			"chat-topic-1",
			[envelope],
			expect.objectContaining({
				mode: "replace_tail",
				anchorSuperMessageId: "assistant-logical-anchor",
			}),
		)
	})

	it("does not scan beyond the two-page foreground budget when the anchor is absent", async () => {
		mockState.getMessagesByConversationIdMock.mockResolvedValueOnce({
			items: [],
			has_more: false,
			page_token: "",
		})
		renderHook(() =>
			useTopicMessages({
				selectedTopic: createTopic({ task_status: TaskStatus.RUNNING }),
			}),
		)
		await act(async () => {
			await Promise.resolve()
			await Promise.resolve()
		})

		mockState.superMagicStoreMock.messages.set("chat-topic-1", [
			{
				app_message_id: "unreached-anchor",
				super_message_id: "unreached-anchor",
				seq_id: "1",
			},
		])
		Object.defineProperty(document, "visibilityState", {
			configurable: true,
			value: "hidden",
		})
		document.dispatchEvent(new Event("visibilitychange"))

		mockState.getMessagesByConversationIdMock.mockReset()
		mockState.getMessagesByConversationIdMock
			.mockResolvedValueOnce({
				items: [createMessageEnvelope("page-message-1", "10")],
				has_more: true,
				page_token: "page-2",
			})
			.mockResolvedValueOnce({
				items: [createMessageEnvelope("page-message-2", "9")],
				has_more: true,
				page_token: "page-3",
			})
		mockState.superMagicStoreMock.initializeMessages.mockClear()

		Object.defineProperty(document, "visibilityState", {
			configurable: true,
			value: "visible",
		})
		await act(async () => {
			document.dispatchEvent(new Event("visibilitychange"))
			for (let index = 0; index < 8; index += 1) await Promise.resolve()
		})

		expect(mockState.getMessagesByConversationIdMock).toHaveBeenCalledTimes(2)
		expect(mockState.superMagicStoreMock.initializeMessages).toHaveBeenCalledWith(
			"chat-topic-1",
			[expect.anything(), expect.anything()],
			expect.objectContaining({ mode: "merge" }),
		)
	})

	it("does not start resident polling while foreground recovery is in flight", async () => {
		vi.useFakeTimers()
		mockState.getMessagesByConversationIdMock.mockResolvedValueOnce({
			items: [],
			has_more: false,
			page_token: "",
		})
		renderHook(() =>
			useTopicMessages({
				selectedTopic: createTopic({ task_status: TaskStatus.RUNNING }),
			}),
		)
		await act(async () => {
			await Promise.resolve()
			await Promise.resolve()
		})

		mockState.superMagicStoreMock.messages.set("chat-topic-1", [
			{
				app_message_id: "foreground-anchor",
				super_message_id: "foreground-anchor",
				seq_id: "1",
			},
		])
		Object.defineProperty(document, "visibilityState", {
			configurable: true,
			value: "hidden",
		})
		document.dispatchEvent(new Event("visibilitychange"))

		let resolveForeground!: (value: {
			items: unknown[]
			has_more: boolean
			page_token: string
		}) => void
		const foregroundRequest = new Promise<{
			items: unknown[]
			has_more: boolean
			page_token: string
		}>((resolve) => {
			resolveForeground = resolve
		})
		mockState.getMessagesByConversationIdMock.mockReset()
		mockState.getMessagesByConversationIdMock.mockReturnValue(foregroundRequest)

		Object.defineProperty(document, "visibilityState", {
			configurable: true,
			value: "visible",
		})
		await act(async () => {
			document.dispatchEvent(new Event("visibilitychange"))
			await Promise.resolve()
		})

		await act(async () => {
			await vi.advanceTimersByTimeAsync(20_000)
		})
		expect(mockState.getMessagesByConversationIdMock).toHaveBeenCalledTimes(1)

		resolveForeground({
			items: [createMessageEnvelope("foreground-anchor", "1")],
			has_more: false,
			page_token: "",
		})
		await act(async () => {
			await Promise.resolve()
			await Promise.resolve()
		})
		vi.useRealTimers()
	})

	it.each([
		{
			label: "merges an incomplete terminal page",
			snapshotComplete: false,
			expectedMode: "merge",
			expectedToolProjectionPolicy: "preserve_live",
		},
		{
			label: "still merges a server-confirmed complete page",
			snapshotComplete: true,
			expectedMode: "merge",
			expectedToolProjectionPolicy: "preserve_live",
		},
	] as const)(
		"$label when foreground recovery has no durable anchor",
		async ({ snapshotComplete, expectedMode, expectedToolProjectionPolicy }) => {
			mockState.getMessagesByConversationIdMock.mockResolvedValueOnce({
				items: [],
				has_more: false,
				page_token: "",
			})
			renderHook(() =>
				useTopicMessages({
					selectedTopic: createTopic({ task_status: TaskStatus.RUNNING }),
				}),
			)
			await act(async () => {
				await Promise.resolve()
				await Promise.resolve()
			})

			Object.defineProperty(document, "visibilityState", {
				configurable: true,
				value: "hidden",
			})
			document.dispatchEvent(new Event("visibilitychange"))

			const foregroundItems = [createMessageEnvelope("foreground-only", "10")]
			mockState.getMessagesByConversationIdMock.mockReset()
			mockState.getMessagesByConversationIdMock.mockResolvedValueOnce({
				items: foregroundItems,
				has_more: false,
				page_token: "",
				snapshot_complete: snapshotComplete,
			})
			mockState.superMagicStoreMock.initializeMessages.mockClear()

			Object.defineProperty(document, "visibilityState", {
				configurable: true,
				value: "visible",
			})
			await act(async () => {
				document.dispatchEvent(new Event("visibilitychange"))
				await Promise.resolve()
				await Promise.resolve()
			})

			expect(mockState.superMagicStoreMock.initializeMessages).toHaveBeenCalledWith(
				"chat-topic-1",
				foregroundItems,
				expect.objectContaining({
					assistantSnapshotPolicy: "progress_snapshot",
					mode: expectedMode,
					toolProjectionPolicy: expectedToolProjectionPolicy,
				}),
			)
		},
	)

	it("bounds foreground recovery to three tail pages when no durable anchor exists", async () => {
		mockState.getMessagesByConversationIdMock.mockResolvedValueOnce({
			items: [],
			has_more: false,
			page_token: "",
		})
		renderHook(() =>
			useTopicMessages({ selectedTopic: createTopic({ task_status: TaskStatus.RUNNING }) }),
		)
		await act(async () => {
			await Promise.resolve()
			await Promise.resolve()
		})

		Object.defineProperty(document, "visibilityState", {
			configurable: true,
			value: "hidden",
		})
		document.dispatchEvent(new Event("visibilitychange"))

		const pages = [
			[createMessageEnvelope("tail-3", "300")],
			[createMessageEnvelope("tail-2", "200")],
			[createMessageEnvelope("tail-1", "100")],
		]
		mockState.getMessagesByConversationIdMock.mockReset()
		pages.forEach((items, index) => {
			mockState.getMessagesByConversationIdMock.mockResolvedValueOnce({
				items,
				has_more: true,
				page_token: `tail-page-${index + 2}`,
			})
		})
		mockState.superMagicStoreMock.initializeMessages.mockClear()

		Object.defineProperty(document, "visibilityState", {
			configurable: true,
			value: "visible",
		})
		await act(async () => {
			document.dispatchEvent(new Event("visibilitychange"))
			for (let index = 0; index < 8; index += 1) await Promise.resolve()
		})

		expect(mockState.getMessagesByConversationIdMock).toHaveBeenCalledTimes(3)
		expect(mockState.superMagicStoreMock.initializeMessages).toHaveBeenCalledWith(
			"chat-topic-1",
			pages.flat(),
			expect.objectContaining({ mode: "merge" }),
		)
	})

	it("fails foreground recovery without committing the first page when the second page fails", async () => {
		const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
		mockState.getMessagesByConversationIdMock.mockResolvedValueOnce({
			items: [],
			has_more: false,
			page_token: "",
		})
		renderHook(() =>
			useTopicMessages({
				selectedTopic: createTopic({ task_status: TaskStatus.RUNNING }),
			}),
		)
		await act(async () => {
			await Promise.resolve()
			await Promise.resolve()
		})

		mockState.superMagicStoreMock.messages.set("chat-topic-1", [
			{ app_message_id: "foreground-anchor" },
		])
		Object.defineProperty(document, "visibilityState", {
			configurable: true,
			value: "hidden",
		})
		document.dispatchEvent(new Event("visibilitychange"))

		mockState.getMessagesByConversationIdMock.mockReset()
		mockState.getMessagesByConversationIdMock
			.mockResolvedValueOnce({
				items: [createMessageEnvelope("partial", "2")],
				has_more: true,
				page_token: "page-2",
			})
			.mockRejectedValueOnce(new Error("foreground second page failed"))
		mockState.superMagicStoreMock.beginTopicSync.mockClear()
		mockState.superMagicStoreMock.initializeMessages.mockClear()
		mockState.superMagicStoreMock.completeTopicSync.mockClear()

		Object.defineProperty(document, "visibilityState", {
			configurable: true,
			value: "visible",
		})
		await act(async () => {
			document.dispatchEvent(new Event("visibilitychange"))
			await Promise.resolve()
			await Promise.resolve()
			await Promise.resolve()
		})

		const generation = mockState.superMagicStoreMock.beginTopicSync.mock.results[0]?.value
		expect(mockState.superMagicStoreMock.initializeMessages).not.toHaveBeenCalled()
		expect(mockState.superMagicStoreMock.completeTopicSync).toHaveBeenCalledWith(
			"chat-topic-1",
			generation,
			expect.objectContaining({
				succeeded: false,
				taskStatus: TaskStatus.RUNNING,
				renderStrategy: "foreground-instant",
			}),
		)
		expect(consoleErrorSpy).toHaveBeenCalled()
		consoleErrorSpy.mockRestore()
	})

	it.each([
		{
			label: "the first incomplete page has no continuation token",
			expectedMode: undefined,
			expectedSucceeded: false,
			responses: [
				{
					items: [createMessageEnvelope("partial", "2")],
					has_more: true,
					page_token: "",
				},
			],
		},
		{
			label: "the second page is still incomplete and has not reached the anchor",
			expectedMode: "merge",
			expectedSucceeded: true,
			responses: [
				{
					items: [createMessageEnvelope("partial-2", "3")],
					has_more: true,
					page_token: "page-2",
				},
				{
					items: [createMessageEnvelope("partial-1", "2")],
					has_more: true,
					page_token: "page-3",
				},
			],
		},
		{
			label: "the continuation token repeats before the anchor is reached",
			expectedMode: undefined,
			expectedSucceeded: false,
			responses: [
				{
					items: [createMessageEnvelope("partial-2", "3")],
					has_more: true,
					page_token: "page-2",
				},
				{
					items: [createMessageEnvelope("partial-1", "2")],
					has_more: true,
					page_token: "page-2",
				},
			],
		},
	])(
		"preserves safety semantics for incomplete foreground recovery when $label",
		async ({ responses, expectedMode, expectedSucceeded }) => {
			mockState.getMessagesByConversationIdMock.mockResolvedValueOnce({
				items: [],
				has_more: false,
				page_token: "",
			})
			renderHook(() =>
				useTopicMessages({
					selectedTopic: createTopic({ task_status: TaskStatus.RUNNING }),
				}),
			)
			await act(async () => {
				await Promise.resolve()
				await Promise.resolve()
			})

			mockState.superMagicStoreMock.messages.set("chat-topic-1", [
				{ app_message_id: "foreground-anchor" },
			])
			Object.defineProperty(document, "visibilityState", {
				configurable: true,
				value: "hidden",
			})
			document.dispatchEvent(new Event("visibilitychange"))

			mockState.getMessagesByConversationIdMock.mockReset()
			responses.forEach((response) => {
				mockState.getMessagesByConversationIdMock.mockResolvedValueOnce(response)
			})
			mockState.superMagicStoreMock.beginTopicSync.mockClear()
			mockState.superMagicStoreMock.initializeMessages.mockClear()
			mockState.superMagicStoreMock.completeTopicSync.mockClear()

			Object.defineProperty(document, "visibilityState", {
				configurable: true,
				value: "visible",
			})
			await act(async () => {
				document.dispatchEvent(new Event("visibilitychange"))
				await Promise.resolve()
				await Promise.resolve()
				await Promise.resolve()
			})

			const generation = mockState.superMagicStoreMock.beginTopicSync.mock.results[0]?.value
			if (expectedMode === "merge") {
				expect(mockState.superMagicStoreMock.initializeMessages).toHaveBeenCalledWith(
					"chat-topic-1",
					responses.flatMap((response) => response.items),
					expect.objectContaining({ mode: "merge" }),
				)
			} else {
				expect(mockState.superMagicStoreMock.initializeMessages).not.toHaveBeenCalled()
			}
			expect(mockState.superMagicStoreMock.completeTopicSync).toHaveBeenCalledWith(
				"chat-topic-1",
				generation,
				expect.objectContaining({
					succeeded: expectedSucceeded,
					taskStatus: TaskStatus.RUNNING,
					renderStrategy: "foreground-instant",
				}),
			)
		},
	)
})

async function prepareFinishedPollingAnchorContract(anchorAppMessageId = "local-anchor") {
	vi.useFakeTimers()
	mockState.getMessagesByConversationIdMock.mockResolvedValueOnce({
		items: [],
		has_more: false,
		page_token: "",
	})
	const { rerender } = renderHook(
		({ selectedTopic }: { selectedTopic: Topic }) => useTopicMessages({ selectedTopic }),
		{
			initialProps: {
				selectedTopic: createTopic({ task_status: TaskStatus.RUNNING }),
			},
		},
	)
	await act(async () => {
		await Promise.resolve()
		await Promise.resolve()
	})

	const existingMessages = [{ app_message_id: anchorAppMessageId }]
	mockState.superMagicStoreMock.messages.set("chat-topic-1", existingMessages)
	mockState.getMessagesByConversationIdMock.mockReset()
	mockState.superMagicStoreMock.beginTopicSync.mockClear()
	mockState.superMagicStoreMock.initializeMessages.mockClear()
	mockState.superMagicStoreMock.enqueueMessage.mockClear()
	mockState.superMagicStoreMock.completeTopicSync.mockClear()
	rerender({ selectedTopic: createTopic({ task_status: TaskStatus.FINISHED }) })

	return {
		existingMessages,
		poll: async () => {
			await act(async () => {
				await vi.advanceTimersByTimeAsync(20_000)
				await Promise.resolve()
				await Promise.resolve()
				await Promise.resolve()
			})
		},
	}
}

function createTopic(overrides: Partial<Topic> = {}): Topic {
	return {
		id: "topic-1",
		topic_name: "Topic 1",
		chat_topic_id: "chat-topic-1",
		chat_conversation_id: "conversation-1",
		...overrides,
	} as Topic
}

function createMessageEnvelope(appMessageId: string, seqId: string, status = "read") {
	const correlationId = `correlation-${appMessageId}`
	// WS 增量测试必须使用真实 Assistant 结构，避免 text fixture 掩盖类型过滤回归。
	return {
		type: "seq",
		seq: {
			magic_id: "magic-hook-test",
			seq_id: seqId,
			message_id: `server-${seqId}-${appMessageId}`,
			conversation_id: "conversation-1",
			message: {
				magic_message_id: `magic-${appMessageId}`,
				app_message_id: appMessageId,
				status,
				topic_id: "chat-topic-1",
				type: "super_magic_message",
				super_magic_message: {
					role: "assistant",
					topic_id: "chat-topic-1",
					message_id: `node-${appMessageId}`,
					super_message_id: appMessageId,
					correlation_id: correlationId,
					content: appMessageId,
					reasoning_content: null,
					tool_calls: [],
					status: "finished",
					send_timestamp: Number(seqId),
				},
			},
		},
	}
}

function createUserMessageEnvelope(appMessageId: string, seqId: string, status: string) {
	return {
		type: "seq",
		seq: {
			magic_id: "magic-hook-user-test",
			seq_id: seqId,
			message_id: `server-${seqId}-${appMessageId}`,
			conversation_id: "conversation-1",
			message: {
				magic_message_id: `magic-${appMessageId}`,
				app_message_id: appMessageId,
				status,
				topic_id: "chat-topic-1",
				type: "rich_text",
				rich_text: {
					role: "user",
					content: appMessageId,
				},
			},
		},
	}
}
