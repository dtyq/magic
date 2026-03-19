import { renderHook, waitFor } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { useIsMobile } from "../useIsMobile"
import { interfaceStore } from "@/opensource/stores/interface"

// Mock ahooks useResponsive
vi.mock("ahooks", () => ({
	useResponsive: vi.fn(),
}))

import { useResponsive } from "ahooks"

describe("useIsMobile", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		// Reset the store state
		interfaceStore.setIsMobile(false)
	})

	it("should return true when screen is smaller than md breakpoint", async () => {
		// Mock md as false (mobile)
		vi.mocked(useResponsive).mockReturnValue({ md: false })

		const { result } = renderHook(() => useIsMobile())

		expect(result.current).toBe(true)

		// Wait for effect to run
		await waitFor(() => {
			expect(interfaceStore.isMobile).toBe(true)
		})
	})

	it("should return false when screen is larger than md breakpoint", async () => {
		// Mock md as true (desktop)
		vi.mocked(useResponsive).mockReturnValue({ md: true })

		const { result } = renderHook(() => useIsMobile())

		expect(result.current).toBe(false)

		// Wait for effect to run
		await waitFor(() => {
			expect(interfaceStore.isMobile).toBe(false)
		})
	})

	it("should update interfaceStore when breakpoint changes", async () => {
		// Start with desktop
		const mockUseResponsive = vi.mocked(useResponsive)
		mockUseResponsive.mockReturnValue({ md: true })

		const { rerender } = renderHook(() => useIsMobile())

		await waitFor(() => {
			expect(interfaceStore.isMobile).toBe(false)
		})

		// Change to mobile
		mockUseResponsive.mockReturnValue({ md: false })
		rerender()

		await waitFor(() => {
			expect(interfaceStore.isMobile).toBe(true)
		})
	})

	it("should not trigger MobX strict mode violations", async () => {
		// This test ensures the hook doesn't modify observables during render
		vi.mocked(useResponsive).mockReturnValue({ md: false })

		// If this throws, it means we're modifying observables during render
		expect(() => {
			renderHook(() => useIsMobile())
		}).not.toThrow()

		// Wait for effect to complete
		await waitFor(() => {
			expect(interfaceStore.isMobile).toBe(true)
		})
	})
})
