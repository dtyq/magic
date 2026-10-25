import { beforeEach, describe, expect, it, vi } from "vitest"
import {
	StreamRecoveryCoordinator,
	type StreamRecoveryOwnerRegistration,
} from "../streamRecoveryCoordinator"

interface Deferred<T> {
	promise: Promise<T>
	resolve: (value: T) => void
	reject: (reason?: unknown) => void
}

function createDeferred<T>(): Deferred<T> {
	let resolve!: (value: T) => void
	let reject!: (reason?: unknown) => void
	const promise = new Promise<T>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise
		reject = rejectPromise
	})
	return { promise, resolve, reject }
}

function createStoreHarness() {
	let recoveryListener:
		| ((payload: { topicId: string; correlationId: string }) => void)
		| undefined
	let nextGeneration = 7
	const store = {
		registerOnStreamRecoveryRequested: vi.fn(
			(listener: (payload: { topicId: string; correlationId: string }) => void) => {
				recoveryListener = listener
				return vi.fn()
			},
		),
		beginTopicSync: vi.fn(() => nextGeneration++),
		isTopicSyncCurrent: vi.fn(() => true),
		completeTopicSync: vi.fn(() => true),
		cancelTopicSync: vi.fn(),
		getLatestMessageSeqId: vi.fn(() => "seq-200"),
		resolveStreamRecoveryRequest: vi.fn((payload) => payload),
		markToolResponseRecoveryScheduled: vi.fn(),
		markToolResponseRecoveryInFlight: vi.fn(),
		markToolResponseRecoveryAwaitingResponse: vi.fn(),
		markToolResponseRecoveryDormant: vi.fn(),
	}

	return {
		store,
		emitRecoveryRequest(payload: { topicId: string; correlationId: string }) {
			recoveryListener?.(payload)
		},
	}
}

function createOwner(
	overrides: Partial<StreamRecoveryOwnerRegistration> = {},
): StreamRecoveryOwnerRegistration {
	return {
		ownerToken: Symbol("owner"),
		topicId: "topic-1",
		conversationId: "conversation-1",
		getTaskStatus: () => "finished",
		recover: vi.fn().mockResolvedValue({ didPullSucceed: true }),
		...overrides,
	}
}

describe("StreamRecoveryCoordinator", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("registers one Store listener and deduplicates in-flight recovery per topic", async () => {
		const harness = createStoreHarness()
		const coordinator = new StreamRecoveryCoordinator(harness.store)
		const deferred = createDeferred<{ didPullSucceed: boolean }>()
		const firstOwner = createOwner({ recover: vi.fn() })
		const activeOwner = createOwner({ recover: vi.fn(() => deferred.promise) })

		coordinator.registerOwner(firstOwner)
		coordinator.registerOwner(activeOwner)

		expect(harness.store.registerOnStreamRecoveryRequested).toHaveBeenCalledTimes(1)

		harness.emitRecoveryRequest({ topicId: "topic-1", correlationId: "correlation-1" })
		harness.emitRecoveryRequest({ topicId: "topic-1", correlationId: "correlation-2" })

		// beginTopicSync must happen synchronously before the recovery callback can await HTTP.
		expect(harness.store.beginTopicSync).toHaveBeenCalledWith("topic-1")
		expect(harness.store.beginTopicSync).toHaveBeenCalledTimes(1)
		expect(firstOwner.recover).not.toHaveBeenCalled()
		expect(activeOwner.recover).toHaveBeenCalledTimes(1)
		expect(activeOwner.recover).toHaveBeenCalledWith({
			topicId: "topic-1",
			conversationId: "conversation-1",
			correlationId: "correlation-1",
			syncGeneration: 7,
		})

		deferred.resolve({ didPullSucceed: true })
		await deferred.promise
		await Promise.resolve()

		expect(harness.store.completeTopicSync).toHaveBeenCalledWith("topic-1", 7, {
			succeeded: true,
			taskStatus: "finished",
			latestSeqId: "seq-200",
			lifecycleEventPolicy: "silent",
			trigger: "recovery",
		})
		expect(harness.store.cancelTopicSync).not.toHaveBeenCalled()
	})

	it("keeps hidden recovery scheduled and starts it only after foreground resume", async () => {
		const harness = createStoreHarness()
		const coordinator = new StreamRecoveryCoordinator(harness.store)
		let canRecover = false
		const owner = createOwner({
			canRecover: () => canRecover,
		})
		coordinator.registerOwner(owner)

		coordinator.requestRecovery({
			topicId: "topic-1",
			correlationId: "hidden-watchdog",
			reason: "stream_watchdog",
		})

		expect(coordinator.getTopicRecoveryStatus("topic-1")).toMatchObject({
			hasScheduled: true,
			hasInFlight: false,
			reason: "stream_watchdog",
		})
		expect(harness.store.beginTopicSync).not.toHaveBeenCalled()
		expect(owner.recover).not.toHaveBeenCalled()

		canRecover = true
		coordinator.resumeTopicRecovery("topic-1")
		await Promise.resolve()

		expect(harness.store.beginTopicSync).toHaveBeenCalledTimes(1)
		expect(owner.recover).toHaveBeenCalledTimes(1)
	})

	it("clears a queued recovery when a foreground sync covers its watermark", () => {
		const harness = createStoreHarness()
		const coordinator = new StreamRecoveryCoordinator(harness.store)
		coordinator.requestRecovery({
			topicId: "topic-1",
			conversationId: "conversation-1",
			correlationId: "foreground-watermark",
			reason: "persistent_message",
			requiredSeqId: "100",
		})

		expect(coordinator.getTopicRecoveryStatus("topic-1")).toMatchObject({
			hasScheduled: true,
			hasInFlight: false,
		})

		coordinator.acknowledgeTopicSync("topic-1", "100")

		expect(coordinator.getTopicRecoveryStatus("topic-1")).toEqual({
			hasScheduled: false,
			hasInFlight: false,
			reason: undefined,
		})
	})

	it("reports HTTP failure to Store without retrying in the coordinator", async () => {
		const harness = createStoreHarness()
		const coordinator = new StreamRecoveryCoordinator(harness.store)
		const owner = createOwner({
			recover: vi.fn().mockResolvedValue({ didPullSucceed: false }),
		})
		coordinator.registerOwner(owner)

		harness.emitRecoveryRequest({ topicId: "topic-1", correlationId: "correlation-1" })
		await Promise.resolve()
		await Promise.resolve()

		expect(owner.recover).toHaveBeenCalledTimes(1)
		expect(harness.store.completeTopicSync).toHaveBeenCalledWith("topic-1", 7, {
			succeeded: false,
			taskStatus: "finished",
			lifecycleEventPolicy: "silent",
			trigger: "recovery",
		})
		expect(harness.store.beginTopicSync).toHaveBeenCalledTimes(1)
		expect(harness.store.cancelTopicSync).not.toHaveBeenCalled()
	})

	it("merges tool recovery triggers, prevents concurrent HTTP, and reruns after in-flight notification", async () => {
		vi.useFakeTimers()
		const harness = createStoreHarness()
		harness.store.resolveStreamRecoveryRequest = vi.fn((payload) => payload)
		const coordinator = new StreamRecoveryCoordinator(harness.store, {
			debounceMs: 50,
			retryDelaysMs: [100],
		})
		const deferred = createDeferred<{ didPullSucceed: boolean }>()
		const owner = createOwner({ recover: vi.fn(() => deferred.promise) })
		coordinator.registerOwner(owner)

		coordinator.requestRecovery({
			topicId: "topic-1",
			correlationId: "corr-a",
			reason: "tool_response",
			anchorAppMessageId: "assistant-a",
			anchorSeqId: "100",
		})
		coordinator.requestRecovery({
			topicId: "topic-1",
			correlationId: "corr-b",
			reason: "tool_response",
			anchorAppMessageId: "assistant-b",
			anchorSeqId: "101",
		})
		expect(owner.recover).not.toHaveBeenCalled()
		expect(harness.store.markToolResponseRecoveryScheduled).toHaveBeenCalledWith("topic-1")

		vi.advanceTimersByTime(50)
		await Promise.resolve()
		expect(owner.recover).toHaveBeenCalledTimes(1)
		expect(harness.store.markToolResponseRecoveryInFlight).toHaveBeenCalledWith("topic-1")

		coordinator.requestRecovery({
			topicId: "topic-1",
			correlationId: "corr-c",
			reason: "tool_response",
			anchorAppMessageId: "assistant-c",
			anchorSeqId: "102",
		})
		expect(owner.recover).toHaveBeenCalledTimes(1)

		deferred.resolve({ didPullSucceed: true })
		await Promise.resolve()
		await Promise.resolve()
		// The second notification raised rerunNeeded while the first request was in flight;
		// it is rechecked immediately before any retry backoff is applied.
		expect(harness.store.completeTopicSync).toHaveBeenCalledTimes(2)
		expect(harness.store.markToolResponseRecoveryAwaitingResponse).toHaveBeenCalledWith(
			"topic-1",
		)

		vi.advanceTimersByTime(100)
		await Promise.resolve()
		expect(owner.recover).toHaveBeenCalledTimes(2)
		vi.useRealTimers()
	})

	it("cancels the generation when its owner unregisters before HTTP completes", async () => {
		const harness = createStoreHarness()
		const coordinator = new StreamRecoveryCoordinator(harness.store)
		const deferred = createDeferred<{ didPullSucceed: boolean }>()
		const owner = createOwner({ recover: vi.fn(() => deferred.promise) })
		const unregister = coordinator.registerOwner(owner)

		harness.emitRecoveryRequest({ topicId: "topic-1", correlationId: "correlation-1" })
		unregister()

		expect(harness.store.cancelTopicSync).toHaveBeenCalledWith("topic-1", 7)

		deferred.resolve({ didPullSucceed: true })
		await deferred.promise
		await Promise.resolve()

		expect(harness.store.completeTopicSync).not.toHaveBeenCalled()
	})

	it("keeps the earliest Tool anchor when a WS notification has only a watermark", async () => {
		vi.useFakeTimers()
		const harness = createStoreHarness()
		const coordinator = new StreamRecoveryCoordinator(harness.store, { debounceMs: 50 })
		const owner = createOwner()
		coordinator.registerOwner(owner)

		coordinator.requestRecovery({
			topicId: "topic-1",
			correlationId: "tool-correlation",
			reason: "tool_response",
			anchorAppMessageId: "assistant-a",
			anchorSeqId: "100",
		})
		coordinator.requestRecovery({
			topicId: "topic-1",
			correlationId: "ws:200",
			reason: "persistent_message",
			requiredSeqId: "200",
		})

		vi.advanceTimersByTime(50)
		await Promise.resolve()
		await Promise.resolve()

		expect(owner.recover).toHaveBeenCalledWith(
			expect.objectContaining({
				reason: "persistent_message",
				requiredSeqId: "200",
				anchorAppMessageId: "assistant-a",
				anchorSeqId: "100",
			}),
		)
		expect(harness.store.completeTopicSync).toHaveBeenCalledWith(
			"topic-1",
			7,
			expect.objectContaining({
				lifecycleEventPolicy: "live",
				trigger: "websocket",
			}),
		)
		vi.useRealTimers()
	})

	it("debounces checkpoint rollback recovery, keeps the latest action context, and retries a failed snapshot", async () => {
		vi.useFakeTimers()
		const harness = createStoreHarness()
		const coordinator = new StreamRecoveryCoordinator(harness.store, {
			debounceMs: 50,
			retryDelaysMs: [100],
		})
		const owner = createOwner({
			recover: vi
				.fn()
				.mockResolvedValueOnce({ didPullSucceed: false })
				.mockResolvedValueOnce({ didPullSucceed: true }),
		})
		coordinator.registerOwner(owner)

		coordinator.requestRecovery({
			topicId: "topic-1",
			correlationId: "checkpoint:event-1",
			reason: "checkpoint_rollback",
			checkpointRollback: { eventId: "event-1", action: "start" },
		})
		coordinator.requestRecovery({
			topicId: "topic-1",
			correlationId: "checkpoint:event-2",
			reason: "checkpoint_rollback",
			checkpointRollback: { eventId: "event-2", action: "undo" },
		})

		vi.advanceTimersByTime(50)
		await Promise.resolve()
		await Promise.resolve()

		expect(owner.recover).toHaveBeenCalledTimes(1)
		expect(owner.recover).toHaveBeenCalledWith(
			expect.objectContaining({
				reason: "checkpoint_rollback",
				correlationId: "checkpoint:event-2",
				checkpointRollback: { eventId: "event-2", action: "undo" },
			}),
		)

		vi.advanceTimersByTime(100)
		await Promise.resolve()
		await Promise.resolve()

		expect(owner.recover).toHaveBeenCalledTimes(2)
		vi.useRealTimers()
	})

	it("keeps checkpoint full-recovery priority when a persistent-message watermark coalesces", async () => {
		vi.useFakeTimers()
		const harness = createStoreHarness()
		const coordinator = new StreamRecoveryCoordinator(harness.store, { debounceMs: 50 })
		const owner = createOwner()
		coordinator.registerOwner(owner)

		coordinator.requestRecovery({
			topicId: "topic-1",
			correlationId: "checkpoint:event-1",
			reason: "checkpoint_rollback",
			checkpointRollback: { eventId: "event-1", action: "commit" },
		})
		coordinator.requestRecovery({
			topicId: "topic-1",
			correlationId: "ws:200",
			reason: "persistent_message",
			requiredSeqId: "200",
		})

		vi.advanceTimersByTime(50)
		await Promise.resolve()
		await Promise.resolve()

		expect(owner.recover).toHaveBeenCalledWith(
			expect.objectContaining({
				reason: "checkpoint_rollback",
				correlationId: "checkpoint:event-1",
				checkpointRollback: { eventId: "event-1", action: "commit" },
				requiredSeqId: "200",
			}),
		)
		vi.useRealTimers()
	})

	it("continues bounded Tool recovery when a successful WS pull still has no role=tool", async () => {
		vi.useFakeTimers()
		const harness = createStoreHarness()
		let toolRecoveryChecks = 0
		harness.store.resolveStreamRecoveryRequest = vi.fn((payload) => {
			if (payload.reason !== "tool_response") return payload
			toolRecoveryChecks += 1
			return toolRecoveryChecks <= 2
				? {
						topicId: "topic-1",
						correlationId: "tool-correlation",
						reason: "tool_response" as const,
						anchorAppMessageId: "assistant-a",
						anchorSeqId: "100",
					}
				: undefined
		})
		const coordinator = new StreamRecoveryCoordinator(harness.store, {
			debounceMs: 50,
			retryDelaysMs: [100],
		})
		const owner = createOwner()
		coordinator.registerOwner(owner)

		coordinator.requestRecovery({
			topicId: "topic-1",
			correlationId: "ws:200",
			reason: "persistent_message",
			requiredSeqId: "200",
		})
		vi.advanceTimersByTime(50)
		await Promise.resolve()
		await Promise.resolve()

		expect(owner.recover).toHaveBeenCalledTimes(1)
		expect(harness.store.markToolResponseRecoveryAwaitingResponse).toHaveBeenCalledWith(
			"topic-1",
		)

		vi.advanceTimersByTime(100)
		await Promise.resolve()
		await Promise.resolve()

		expect(owner.recover).toHaveBeenCalledTimes(2)
		expect(owner.recover).toHaveBeenLastCalledWith(
			expect.objectContaining({
				reason: "tool_response",
				requiredSeqId: "200",
				anchorAppMessageId: "assistant-a",
				anchorSeqId: "100",
			}),
		)
		vi.useRealTimers()
	})

	it("cancels an in-flight owner when a newer owner registers for the same topic", async () => {
		const harness = createStoreHarness()
		const coordinator = new StreamRecoveryCoordinator(harness.store)
		const deferred = createDeferred<{ didPullSucceed: boolean }>()
		const previousOwner = createOwner({ recover: vi.fn(() => deferred.promise) })
		const currentOwner = createOwner()
		coordinator.registerOwner(previousOwner)

		harness.emitRecoveryRequest({ topicId: "topic-1", correlationId: "correlation-1" })
		coordinator.registerOwner(currentOwner)

		expect(harness.store.cancelTopicSync).toHaveBeenCalledWith("topic-1", 7)

		deferred.resolve({ didPullSucceed: true })
		await deferred.promise
		await Promise.resolve()
		expect(harness.store.completeTopicSync).not.toHaveBeenCalled()

		harness.emitRecoveryRequest({ topicId: "topic-1", correlationId: "correlation-2" })
		await Promise.resolve()
		await Promise.resolve()

		expect(currentOwner.recover).toHaveBeenCalledWith(
			expect.objectContaining({ correlationId: "correlation-2", syncGeneration: 8 }),
		)
	})

	it("cancels the generation when recovery post-processing throws", async () => {
		const harness = createStoreHarness()
		const coordinator = new StreamRecoveryCoordinator(harness.store)
		const owner = createOwner({
			recover: vi.fn().mockRejectedValue(new Error("initialize failed")),
		})
		coordinator.registerOwner(owner)

		harness.emitRecoveryRequest({ topicId: "topic-1", correlationId: "correlation-1" })
		await Promise.resolve()
		await Promise.resolve()

		expect(harness.store.cancelTopicSync).toHaveBeenCalledWith("topic-1", 7)
		expect(harness.store.completeTopicSync).not.toHaveBeenCalled()
	})
})
