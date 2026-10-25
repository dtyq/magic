import { renderHook, act } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useDesignStyleWindow } from "../useDesignStyleWindow"

const mockUserInfo = {
	organization_code: "org_123",
	user_id: "user_456",
}

vi.mock("@/models/user/hooks", () => ({
	useUserInfo: () => ({ userInfo: mockUserInfo }),
}))

describe("useDesignStyleWindow", () => {
	beforeEach(() => {
		localStorage.clear()
	})

	it("returns default window options with recommended sizing", () => {
		const { result } = renderHook(() => useDesignStyleWindow(true))

		expect(result.current.windowOptions.draggable).toBe(true)
		expect(result.current.windowOptions.resizable).toBe(true)
		expect(result.current.windowOptions.minSize).toEqual({ width: 720, height: 480 })
		expect(result.current.windowOptions.sizeStorageKey).toContain(
			"super_magic/design_style_dialog_size",
		)
		expect(result.current.windowOptions.sizeStorageKey).toContain("org_123/user_456")
		expect(result.current.windowOptions.defaultSize.width).toBeLessThanOrEqual(1080)
		expect(result.current.windowOptions.defaultSize.height).toBeLessThanOrEqual(820)
	})

	it("shows resize guide when not previously dismissed and dismisses on user action", () => {
		const { result } = renderHook(() => useDesignStyleWindow(true))

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

	it("restores recommended size by incrementing resetSizeKey and dismissing guide", () => {
		const { result } = renderHook(() => useDesignStyleWindow(true))

		const initialKey = result.current.windowOptions.resetSizeKey ?? 0

		act(() => {
			result.current.restoreRecommendedSize()
		})

		expect(result.current.windowOptions.resetSizeKey).toBe(initialKey + 1)
		expect(result.current.resizeGuideVisible).toBe(false)
	})

	it("dismisses guide on onResizeEnd callback", () => {
		const { result } = renderHook(() => useDesignStyleWindow(true))

		expect(result.current.resizeGuideVisible).toBe(true)

		act(() => {
			result.current.windowOptions.onResizeEnd?.({ width: 900, height: 600 })
		})

		expect(result.current.resizeGuideVisible).toBe(false)
	})
})
