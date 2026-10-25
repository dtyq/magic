import { describe, expect, it, vi } from "vitest"
import { runForceOverrideFinalization, runForceOverrideFlow } from "../recordingOverrideLifecycle"

describe("runForceOverrideFinalization", () => {
	it("uploads and summarizes the old session before completing it", async () => {
		const calls: string[] = []
		let resolveUploads!: () => void

		const finalization = runForceOverrideFinalization({
			stopRecordingServices: vi.fn(async () => {
				calls.push("stop")
			}),
			flushSessionUploads: vi.fn(
				() =>
					new Promise<void>((resolve) => {
						calls.push("flush-start")
						resolveUploads = () => {
							calls.push("flush-complete")
							resolve()
						}
					}),
			),
			summarizeSession: vi.fn(() => {
				calls.push("summarize")
			}),
			completeSession: vi.fn(() => {
				calls.push("complete")
			}),
		})

		await Promise.resolve()
		expect(calls).toEqual(["stop", "flush-start"])

		resolveUploads()
		await finalization

		expect(calls).toEqual(["stop", "flush-start", "flush-complete", "summarize", "complete"])
	})

	it("does not summarize or complete the session when upload draining fails", async () => {
		const summarizeSession = vi.fn()
		const completeSession = vi.fn()

		await expect(
			runForceOverrideFinalization({
				stopRecordingServices: vi.fn(),
				flushSessionUploads: vi.fn().mockRejectedValue(new Error("batch save failed")),
				summarizeSession,
				completeSession,
			}),
		).rejects.toThrow("batch save failed")

		expect(summarizeSession).not.toHaveBeenCalled()
		expect(completeSession).not.toHaveBeenCalled()
	})

	it("does not complete the old session when summary creation fails", async () => {
		const completeSession = vi.fn()

		await expect(
			runForceOverrideFinalization({
				stopRecordingServices: vi.fn(),
				flushSessionUploads: vi.fn(),
				summarizeSession: vi.fn().mockRejectedValue(new Error("summary failed")),
				completeSession,
			}),
		).rejects.toThrow("summary failed")

		expect(completeSession).not.toHaveBeenCalled()
	})

	it("completes the old session when summary says it is already summarizing or finished", async () => {
		const completeSession = vi.fn()

		await expect(
			runForceOverrideFinalization({
				stopRecordingServices: vi.fn(),
				flushSessionUploads: vi.fn(),
				summarizeSession: vi.fn().mockRejectedValue({ code: 43202 }),
				completeSession,
			}),
		).resolves.toBeUndefined()

		expect(completeSession).toHaveBeenCalledTimes(1)

		completeSession.mockClear()
		await expect(
			runForceOverrideFinalization({
				stopRecordingServices: vi.fn(),
				flushSessionUploads: vi.fn(),
				summarizeSession: vi.fn().mockRejectedValue({
					response: { data: { code: 43200 } },
				}),
				completeSession,
			}),
		).resolves.toBeUndefined()

		expect(completeSession).toHaveBeenCalledTimes(1)
	})
})

describe("runForceOverrideFlow", () => {
	it("releases the old session and continues when the user starts anyway", async () => {
		const prepare = vi.fn().mockResolvedValue(false)
		const forceRelease = vi.fn()

		await expect(
			runForceOverrideFlow({
				confirm: async () => true,
				confirmRetry: async () => "continue",
				prepare,
				forceRelease,
			}),
		).resolves.toBe(true)

		expect(prepare).toHaveBeenCalledTimes(1)
		expect(forceRelease).toHaveBeenCalledTimes(1)
	})

	it("retries prepare when the user asks to try again", async () => {
		const prepare = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true)

		await expect(
			runForceOverrideFlow({
				confirm: async () => true,
				confirmRetry: async () => "retry",
				prepare,
			}),
		).resolves.toBe(true)

		expect(prepare).toHaveBeenCalledTimes(2)
	})

	it("does not prepare when the first confirmation is declined", async () => {
		const prepare = vi.fn()
		const forceRelease = vi.fn()

		await expect(
			runForceOverrideFlow({
				confirm: async () => false,
				confirmRetry: async () => "continue",
				prepare,
				forceRelease,
			}),
		).resolves.toBe(false)

		expect(prepare).not.toHaveBeenCalled()
		expect(forceRelease).not.toHaveBeenCalled()
	})

	it("does not start a new recording when force-release fails", async () => {
		const prepare = vi.fn().mockResolvedValue(false)
		const forceRelease = vi.fn().mockResolvedValue(false)

		await expect(
			runForceOverrideFlow({
				confirm: async () => true,
				confirmRetry: async () => "continue",
				prepare,
				forceRelease,
			}),
		).resolves.toBe(false)

		expect(forceRelease).toHaveBeenCalledTimes(1)
	})

	it("does not release or continue when the retry dialog is cancelled", async () => {
		const prepare = vi.fn().mockResolvedValue(false)
		const forceRelease = vi.fn()

		await expect(
			runForceOverrideFlow({
				confirm: async () => true,
				confirmRetry: async () => "cancel",
				prepare,
				forceRelease,
			}),
		).resolves.toBe(false)

		expect(forceRelease).not.toHaveBeenCalled()
	})
})
