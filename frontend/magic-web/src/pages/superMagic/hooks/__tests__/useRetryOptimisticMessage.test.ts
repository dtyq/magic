import { renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useRetryOptimisticMessage } from "../useRetryOptimisticMessage"

const mocks = vi.hoisted(() => ({
	getStatus: vi.fn(),
	reanchor: vi.fn(),
	remove: vi.fn(),
	getMessageNode: vi.fn(),
	removeUserMessage: vi.fn(),
	offline: false,
}))

vi.mock("@/pages/superMagic/stores/optimisticMessageStore", () => ({
	OptimisticMessage: { Status: { Failed: "failed" } },
	optimisticMessageStore: {
		getStatus: mocks.getStatus,
		reanchorDependentsBeforeMessageRemoval: mocks.reanchor,
		remove: mocks.remove,
	},
}))
vi.mock("@/pages/superMagic/stores", () => ({
	superMagicStore: {
		getMessageNode: mocks.getMessageNode,
		removeUserMessage: mocks.removeUserMessage,
	},
}))
vi.mock("@/services/recordSummary/NetworkMonitor", () => ({
	getNetworkMonitor: () => ({ isNetworkOffline: () => mocks.offline }),
}))

const message = { app_message_id: "m1", super_message_id: "s1" } as never
const node = { content: JSON.stringify({ type: "doc", content: [] }) }

describe("useRetryOptimisticMessage", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.offline = false
		mocks.getStatus.mockReturnValue("failed")
		mocks.getMessageNode.mockReturnValue(node)
	})

	it("re-sends a failed message and removes the old node", async () => {
		const send = vi.fn().mockResolvedValue(true)
		const onRetryStarted = vi.fn()
		const { result } = renderHook(() =>
			useRetryOptimisticMessage({
				chatTopicId: "t1",
				getSendMessage: () => send,
				onRetryStarted,
			}),
		)

		await result.current(message)

		expect(send).toHaveBeenCalledWith(expect.objectContaining({ value: expect.any(Object) }))
		expect(mocks.remove).toHaveBeenCalledWith({ chat_topic_id: "t1", app_message_id: "m1" })
		expect(mocks.removeUserMessage).toHaveBeenCalledWith("t1", "m1")
		expect(onRetryStarted).toHaveBeenCalled()
	})

	it("keeps the failed node when the send entry is unavailable or the network is offline", async () => {
		const { result } = renderHook(() =>
			useRetryOptimisticMessage({ chatTopicId: "t1", getSendMessage: () => undefined }),
		)
		await result.current(message)
		expect(mocks.remove).not.toHaveBeenCalled()

		mocks.offline = true
		const send = vi.fn()
		const offline = renderHook(() =>
			useRetryOptimisticMessage({ chatTopicId: "t1", getSendMessage: () => send }),
		)
		await offline.result.current(message)
		expect(send).not.toHaveBeenCalled()
	})
})
