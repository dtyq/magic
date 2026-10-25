import { describe, expect, it, vi } from "vitest"
import { runTaskEndCleanup } from "../taskEndCleanup"

describe("runTaskEndCleanup", () => {
	it("resets runtime state when persistence diagnostics fail", async () => {
		const resetStore = vi.fn()
		const reportError = vi.fn()

		await runTaskEndCleanup({
			stopRecordingServices: vi.fn(),
			stopSessionUploads: vi.fn(),
			stopStatusReporter: vi.fn(),
			stopRecordStatusChecker: vi.fn(),
			releaseWakeLock: vi.fn(),
			removeVisibilityChangeListener: vi.fn(),
			removeBeforeUnloadListener: vi.fn(),
			releaseRecordingLock: vi.fn(),
			preserveSession: vi.fn().mockRejectedValue(new Error("IndexedDB unavailable")),
			resetStore,
			reportError,
		})

		expect(resetStore).toHaveBeenCalledOnce()
		expect(reportError).toHaveBeenCalledWith(
			"preserve_session",
			expect.objectContaining({ message: "IndexedDB unavailable" }),
		)
	})

	it("continues mandatory cleanup after an earlier step fails", async () => {
		const calls: string[] = []

		await runTaskEndCleanup({
			stopRecordingServices: vi.fn().mockImplementation(() => {
				calls.push("stop")
				throw new Error("stop failed")
			}),
			stopSessionUploads: vi.fn().mockImplementation(() => calls.push("uploads")),
			stopStatusReporter: vi.fn().mockImplementation(() => calls.push("reporter")),
			stopRecordStatusChecker: vi.fn().mockImplementation(() => calls.push("checker")),
			releaseWakeLock: vi.fn().mockImplementation(() => calls.push("wake-lock")),
			removeVisibilityChangeListener: vi
				.fn()
				.mockImplementation(() => calls.push("visibility")),
			removeBeforeUnloadListener: vi.fn().mockImplementation(() => calls.push("unload")),
			releaseRecordingLock: vi.fn().mockImplementation(() => calls.push("lock")),
			preserveSession: vi.fn().mockImplementation(() => calls.push("preserve")),
			resetStore: vi.fn().mockImplementation(() => calls.push("reset")),
		})

		expect(calls).toEqual([
			"stop",
			"uploads",
			"reporter",
			"checker",
			"wake-lock",
			"visibility",
			"unload",
			"lock",
			"preserve",
			"reset",
		])
	})
})
