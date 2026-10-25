import { afterEach, describe, expect, it, vi } from "vitest"
import type { UploadQueueHealth } from "../ChunkUploader"
import { UploadQueueWatchdog } from "../uploadQueueWatchdog"

function createHealth(overrides: Partial<UploadQueueHealth> = {}): UploadQueueHealth {
	return {
		pending: 0,
		queuePending: 0,
		uploading: 0,
		completed: 0,
		failed: 0,
		totalTasks: 0,
		stalled: false,
		reason: "healthy",
		...overrides,
	}
}

describe("UploadQueueWatchdog", () => {
	afterEach(() => {
		vi.useRealTimers()
	})

	it("does not resume while the queue is healthy", async () => {
		vi.useFakeTimers()
		const inspect = vi.fn().mockResolvedValue(createHealth())
		const resume = vi.fn()
		const watchdog = new UploadQueueWatchdog({
			intervalMs: 15_000,
			inspect,
			resume,
		})

		watchdog.start()
		await vi.advanceTimersByTimeAsync(15_000)
		await vi.advanceTimersByTimeAsync(15_000)
		watchdog.stop()

		expect(inspect).toHaveBeenCalledTimes(2)
		expect(resume).not.toHaveBeenCalled()
	})

	it("resumes immediately for pending chunks that left the queue", async () => {
		vi.useFakeTimers()
		const health = createHealth({
			pending: 3,
			stalled: true,
			reason: "pending_not_queued",
		})
		const inspect = vi.fn().mockResolvedValue(health)
		const resume = vi.fn().mockResolvedValue(health)
		const onRecovered = vi.fn()
		const watchdog = new UploadQueueWatchdog({
			intervalMs: 15_000,
			inspect,
			resume,
			onRecovered,
		})

		watchdog.start()
		await vi.advanceTimersByTimeAsync(15_000)
		watchdog.stop()

		expect(resume).toHaveBeenCalledTimes(1)
		expect(onRecovered).toHaveBeenCalledWith(health)
	})

	it("resumes idle pending queues only after consecutive stalled ticks", async () => {
		vi.useFakeTimers()
		const health = createHealth({
			pending: 2,
			queuePending: 2,
			stalled: true,
			reason: "idle_with_pending",
		})
		const inspect = vi.fn().mockResolvedValue(health)
		const resume = vi.fn().mockResolvedValue(health)
		const watchdog = new UploadQueueWatchdog({
			intervalMs: 15_000,
			inspect,
			resume,
		})

		watchdog.start()
		await vi.advanceTimersByTimeAsync(15_000)
		expect(resume).not.toHaveBeenCalled()

		await vi.advanceTimersByTimeAsync(15_000)
		watchdog.stop()

		expect(resume).toHaveBeenCalledTimes(1)
	})

	it("does not start a second tick while a check is still running", async () => {
		vi.useFakeTimers()
		let finishInspect: ((health: UploadQueueHealth) => void) | undefined
		const inspect = vi.fn(
			() =>
				new Promise<UploadQueueHealth>((resolve) => {
					finishInspect = resolve
				}),
		)
		const resume = vi.fn()
		const watchdog = new UploadQueueWatchdog({
			intervalMs: 15_000,
			inspect,
			resume,
		})

		watchdog.start()
		await vi.advanceTimersByTimeAsync(15_000)
		await vi.advanceTimersByTimeAsync(15_000)
		expect(inspect).toHaveBeenCalledTimes(1)

		finishInspect?.(createHealth())
		await Promise.resolve()
		watchdog.stop()
		expect(resume).not.toHaveBeenCalled()
	})

	it("does not resume a stale in-flight tick after stop and start", async () => {
		vi.useFakeTimers()
		let finishInspect: ((health: UploadQueueHealth) => void) | undefined
		const inspect = vi.fn(
			() =>
				new Promise<UploadQueueHealth>((resolve) => {
					finishInspect = resolve
				}),
		)
		const resume = vi.fn()
		const onRecovered = vi.fn()
		const watchdog = new UploadQueueWatchdog({
			intervalMs: 15_000,
			inspect,
			resume,
			onRecovered,
		})

		watchdog.start()
		await vi.advanceTimersByTimeAsync(15_000)
		expect(inspect).toHaveBeenCalledTimes(1)

		watchdog.stop()
		watchdog.start()
		finishInspect?.(
			createHealth({
				pending: 2,
				stalled: true,
				reason: "pending_not_queued",
			}),
		)
		await Promise.resolve()
		await Promise.resolve()

		expect(resume).not.toHaveBeenCalled()
		expect(onRecovered).not.toHaveBeenCalled()
		watchdog.stop()
	})

	it("does not let a stale tick clear a newer tick inFlight lock", async () => {
		vi.useFakeTimers()
		const inspectResolvers: Array<(health: UploadQueueHealth) => void> = []
		const inspect = vi.fn(
			() =>
				new Promise<UploadQueueHealth>((resolve) => {
					inspectResolvers.push(resolve)
				}),
		)
		const resume = vi.fn().mockResolvedValue(undefined)
		const watchdog = new UploadQueueWatchdog({
			intervalMs: 15_000,
			inspect,
			resume,
		})

		watchdog.start()
		await vi.advanceTimersByTimeAsync(15_000)
		expect(inspect).toHaveBeenCalledTimes(1)

		watchdog.stop()
		watchdog.start()
		await vi.advanceTimersByTimeAsync(15_000)
		expect(inspect).toHaveBeenCalledTimes(2)

		inspectResolvers[0]?.(
			createHealth({
				pending: 2,
				stalled: true,
				reason: "pending_not_queued",
			}),
		)
		await Promise.resolve()
		await Promise.resolve()
		expect(resume).not.toHaveBeenCalled()

		await vi.advanceTimersByTimeAsync(15_000)
		expect(inspect).toHaveBeenCalledTimes(2)

		inspectResolvers[1]?.(
			createHealth({
				pending: 2,
				stalled: true,
				reason: "pending_not_queued",
			}),
		)
		await Promise.resolve()
		await Promise.resolve()
		expect(resume).toHaveBeenCalledTimes(1)
		watchdog.stop()
	})

	it("does not resume after stop even if a tick is in flight", async () => {
		vi.useFakeTimers()
		let finishInspect: ((health: UploadQueueHealth) => void) | undefined
		const inspect = vi.fn(
			() =>
				new Promise<UploadQueueHealth>((resolve) => {
					finishInspect = resolve
				}),
		)
		const resume = vi.fn()
		const watchdog = new UploadQueueWatchdog({
			intervalMs: 15_000,
			inspect,
			resume,
		})

		watchdog.start()
		await vi.advanceTimersByTimeAsync(15_000)
		watchdog.stop()
		finishInspect?.(
			createHealth({
				pending: 2,
				stalled: true,
				reason: "pending_not_queued",
			}),
		)
		await Promise.resolve()

		expect(resume).not.toHaveBeenCalled()
	})

	it("resumes a healthy in-flight upload when progress stays frozen", async () => {
		vi.useFakeTimers()
		const health = createHealth({
			pending: 2,
			uploading: 1,
			completed: 1,
			stalled: false,
			reason: "healthy",
		})
		const inspect = vi.fn().mockResolvedValue(health)
		const resume = vi.fn().mockResolvedValue(health)
		const watchdog = new UploadQueueWatchdog({
			intervalMs: 15_000,
			inspect,
			resume,
		})

		watchdog.start()
		await vi.advanceTimersByTimeAsync(15_000)
		await vi.advanceTimersByTimeAsync(15_000)
		expect(resume).not.toHaveBeenCalled()

		await vi.advanceTimersByTimeAsync(15_000)
		watchdog.stop()

		expect(resume).toHaveBeenCalledTimes(1)
	})

	it("stops scheduling checks after stop()", async () => {
		vi.useFakeTimers()
		const inspect = vi.fn().mockResolvedValue(createHealth())
		const watchdog = new UploadQueueWatchdog({
			intervalMs: 15_000,
			inspect,
			resume: vi.fn(),
		})

		watchdog.start()
		watchdog.stop()
		await vi.advanceTimersByTimeAsync(45_000)

		expect(inspect).not.toHaveBeenCalled()
	})
})
