import { beforeEach, describe, expect, it, vi } from "vitest"
import { renderHook } from "@testing-library/react"
import useCancelRecord from "../useCancelRecord"
import { CancelRecordDialogDismissedError } from "../internal/cancelRecordDialogError"

const showStopRecordingDialog = vi.fn()

vi.mock("@/services/recordSummary/serviceInstance", () => ({
	initializeService: () => ({}),
	getServiceInstance: () => ({}),
}))

vi.mock("@/stores/recordingSummary", () => ({
	default: {
		status: "recording",
		multiTabState: { activeTabData: { isRecording: false } },
	},
}))

vi.mock("../internal/useCancelRecordDialogs", () => ({
	useCancelRecordDialogs: () => ({
		showOtherTabRecordingDialog: vi.fn(),
		showStopRecordingDialog,
	}),
}))

describe("useCancelRecord", () => {
	beforeEach(() => {
		showStopRecordingDialog.mockReset()
	})

	it("keeps rejecting from cancelRecord so flow callers can abort", async () => {
		showStopRecordingDialog.mockRejectedValue(new CancelRecordDialogDismissedError())
		const { result } = renderHook(() => useCancelRecord())

		await expect(result.current.cancelRecord()).rejects.toBeInstanceOf(
			CancelRecordDialogDismissedError,
		)
	})

	it("swallows a dismissed dialog in cancelRecordFromUI", async () => {
		showStopRecordingDialog.mockRejectedValue(new CancelRecordDialogDismissedError())
		const { result } = renderHook(() => useCancelRecord())

		await expect(result.current.cancelRecordFromUI()).resolves.toBeUndefined()
	})

	it("still propagates real errors from cancelRecordFromUI", async () => {
		showStopRecordingDialog.mockRejectedValue(new Error("network failed"))
		const { result } = renderHook(() => useCancelRecord())

		await expect(result.current.cancelRecordFromUI()).rejects.toThrow("network failed")
	})
})
