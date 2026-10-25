import { renderHook, act } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useProjectManagerWindow } from "../useProjectManagerWindow"

const mockUserInfo = {
	organization_code: "org_123",
	user_id: "user_456",
}

vi.mock("@/models/user/hooks", () => ({
	useUserInfo: () => ({ userInfo: mockUserInfo }),
}))

describe("useProjectManagerWindow", () => {
	beforeEach(() => {
		localStorage.clear()
	})

	it("returns default window options with recommended sizing", () => {
		const { result } = renderHook(() => useProjectManagerWindow(true))

		expect(result.current.windowOptions.draggable).toBe(true)
		expect(result.current.windowOptions.resizable).toBe(true)
		expect(result.current.windowOptions.minSize).toEqual({ width: 720, height: 480 })
		expect(result.current.windowOptions.sizeStorageKey).toContain(
			"super_magic/project_manager_size",
		)
		expect(result.current.windowOptions.sizeStorageKey).toContain("org_123/user_456")
		expect(result.current.windowOptions.defaultSize.width).toBeLessThanOrEqual(1120)
		expect(result.current.windowOptions.defaultSize.height).toBeLessThanOrEqual(840)
	})

	it("shows resize guide and dismisses on user action", () => {
		const { result } = renderHook(() => useProjectManagerWindow(true))

		expect(result.current.resizeGuideVisible).toBe(true)

		act(() => {
			result.current.dismissResizeGuide()
		})

		expect(result.current.resizeGuideVisible).toBe(false)
		const guideKey = result.current.windowOptions.sizeStorageKey?.replace(
			"_size",
			"_resize_guide",
		)
		expect(guideKey).toBeDefined()
		if (guideKey) {
			expect(localStorage.getItem(guideKey)).toBe("1")
		}
	})

	it("restores recommended size by incrementing resetSizeKey", () => {
		const { result } = renderHook(() => useProjectManagerWindow(true))

		const initialKey = result.current.windowOptions.resetSizeKey ?? 0

		act(() => {
			result.current.restoreRecommendedSize()
		})

		expect(result.current.windowOptions.resetSizeKey).toBe(initialKey + 1)
		expect(result.current.resizeGuideVisible).toBe(false)
	})
})
