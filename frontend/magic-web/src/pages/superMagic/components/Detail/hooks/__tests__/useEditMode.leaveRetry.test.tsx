import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { joinFileEdit, leaveFileEdit, getFileEditCount } = vi.hoisted(() => ({
	joinFileEdit: vi.fn(),
	leaveFileEdit: vi.fn(),
	getFileEditCount: vi.fn(),
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: { joinFileEdit, leaveFileEdit, getFileEditCount },
}))
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock("@/components/base/MagicModal", () => ({ default: { confirm: vi.fn() } }))
vi.mock("@/components/base", () => ({ MagicDropdown: () => null }))
vi.mock("@/components/base/MagicToaster/utils", () => ({ default: { error: vi.fn() } }))

import useEditMode from "../useEditMode"

describe("useEditMode leave", () => {
	beforeEach(() => {
		vi.useFakeTimers()
		vi.spyOn(console, "error").mockImplementation(() => {})
		joinFileEdit.mockResolvedValue(undefined)
		leaveFileEdit.mockReset()
	})

	afterEach(() => {
		vi.useRealTimers()
		vi.restoreAllMocks()
	})

	it("retries a failed leave after the UI has already exited", async () => {
		leaveFileEdit.mockRejectedValueOnce(new Error("network")).mockResolvedValue(undefined)
		getFileEditCount.mockResolvedValue({ editing_user_count: 0 })
		const hook = renderHook(() => useEditMode({ fileId: "file-1" }))
		await act(async () => {
			hook.result.current.setIsEditMode(true)
			await vi.advanceTimersByTimeAsync(0)
		})
		expect(hook.result.current.isEditMode).toBe(true)

		await act(async () => {
			hook.result.current.setIsEditMode(false)
			await vi.advanceTimersByTimeAsync(0)
		})
		expect(hook.result.current.isEditMode).toBe(false)

		await act(async () => {
			await vi.advanceTimersByTimeAsync(1000)
		})
		expect(leaveFileEdit).toHaveBeenCalledTimes(2)

		await act(async () => {
			await hook.result.current.setIsEditMode(false)
		})
		expect(leaveFileEdit).toHaveBeenCalledTimes(2)
	})

	it("reports leave again on unmount when every retry failed", async () => {
		leaveFileEdit.mockRejectedValue(new Error("network"))
		getFileEditCount.mockResolvedValue({ editing_user_count: 0 })
		const hook = renderHook(() => useEditMode({ fileId: "file-1" }))
		await act(async () => {
			hook.result.current.setIsEditMode(true)
			await vi.advanceTimersByTimeAsync(0)
		})
		await act(async () => {
			hook.result.current.setIsEditMode(false)
			await vi.advanceTimersByTimeAsync(5000)
		})
		expect(leaveFileEdit).toHaveBeenCalledTimes(3)

		hook.unmount()
		expect(leaveFileEdit).toHaveBeenCalledTimes(4)
	})
})
