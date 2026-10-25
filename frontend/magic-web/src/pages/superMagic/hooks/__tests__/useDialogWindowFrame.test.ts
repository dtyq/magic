import { renderHook, act } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useDialogWindowFrame } from "../useDialogWindowFrame"

const mockUserInfo = {
	organization_code: "org_alpha",
	user_id: "user_beta",
}

vi.mock("@/models/user/hooks", () => ({
	useUserInfo: () => ({ userInfo: mockUserInfo }),
}))

describe("useDialogWindowFrame", () => {
	beforeEach(() => {
		localStorage.clear()
	})

	it("returns windowOptions with storage keys based on identity and prefix", () => {
		const { result } = renderHook(() =>
			useDialogWindowFrame(true, {
				storageKeyPrefix: "super_magic/test_panel",
				recommendedSize: { width: 1000, height: 700 },
				minSize: { width: 600, height: 400 },
			}),
		)

		expect(result.current.windowOptions.draggable).toBe(true)
		expect(result.current.windowOptions.resizable).toBe(true)
		expect(result.current.windowOptions.minSize).toEqual({ width: 600, height: 400 })
		expect(result.current.windowOptions.sizeStorageKey).toContain("super_magic/test_panel_size")
		expect(result.current.windowOptions.sizeStorageKey).toContain("org_alpha/user_beta")
		expect(result.current.windowOptions.defaultSize.width).toBeLessThanOrEqual(1000)
		expect(result.current.windowOptions.defaultSize.height).toBeLessThanOrEqual(700)
	})

	it("shows resize guide when not seen and dismisses correctly", () => {
		const { result } = renderHook(() =>
			useDialogWindowFrame(true, {
				storageKeyPrefix: "super_magic/test_panel",
			}),
		)

		expect(result.current.resizeGuideVisible).toBe(true)

		act(() => {
			result.current.dismissResizeGuide()
		})

		expect(result.current.resizeGuideVisible).toBe(false)
		const guideKey = result.current.windowOptions.sizeStorageKey?.replace(
			"test_panel_size",
			"test_panel_resize_guide",
		)
		if (guideKey) {
			expect(localStorage.getItem(guideKey)).toBe("1")
		}
	})

	it("increments resetSizeKey and dismisses guide on restoreRecommendedSize", () => {
		const { result } = renderHook(() =>
			useDialogWindowFrame(true, {
				storageKeyPrefix: "super_magic/test_panel",
			}),
		)

		const initialKey = result.current.windowOptions.resetSizeKey ?? 0

		act(() => {
			result.current.restoreRecommendedSize()
		})

		expect(result.current.windowOptions.resetSizeKey).toBe(initialKey + 1)
		expect(result.current.resizeGuideVisible).toBe(false)
	})
})
