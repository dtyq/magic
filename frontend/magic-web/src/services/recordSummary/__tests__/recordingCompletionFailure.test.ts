import { describe, expect, it, vi } from "vitest"
import { handleRecordingCompletionFailure } from "../recordingCompletionFailure"

function actions(error: Error) {
	return {
		error,
		isCurrentSession: () => true,
		clearSummaryMessage: vi.fn(),
		terminateSession: vi.fn().mockResolvedValue(undefined),
		pauseSession: vi.fn(),
		onError: vi.fn(),
	}
}

describe("recording completion failure", () => {
	it("cleans up a deleted project before reporting failure and never pauses it", async () => {
		let finishCleanup!: () => void
		const steps = actions(
			Object.assign(new Error("missing project"), { response: { code: "51200" } }),
		)
		steps.terminateSession.mockImplementation(
			() =>
				new Promise((resolve) => {
					finishCleanup = resolve
				}),
		)
		const pending = handleRecordingCompletionFailure(steps)
		expect(steps.clearSummaryMessage).toHaveBeenCalledOnce()
		expect(steps.pauseSession).not.toHaveBeenCalled()
		expect(steps.onError).not.toHaveBeenCalled()
		finishCleanup()
		await pending
		expect(steps.onError).toHaveBeenCalledExactlyOnceWith(steps.error)
	})

	it("keeps network failures recoverable", async () => {
		const steps = actions(new Error("network unavailable"))
		await handleRecordingCompletionFailure(steps)
		expect(steps.pauseSession).toHaveBeenCalledOnce()
		expect(steps.terminateSession).not.toHaveBeenCalled()
	})

	it.each([51200, undefined])(
		"does not alter a replacement recording on a late error %s",
		async (code) => {
			const steps = {
				...actions(Object.assign(new Error("late response"), { code })),
				isCurrentSession: () => false,
			}
			await handleRecordingCompletionFailure(steps)
			expect(steps.clearSummaryMessage).not.toHaveBeenCalled()
			expect(steps.pauseSession).not.toHaveBeenCalled()
			expect(steps.terminateSession).not.toHaveBeenCalled()
		},
	)
})
