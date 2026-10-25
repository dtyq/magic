import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import useCheckBeforeNavigate from "../useCheckBeforeNavigate"

describe("useCheckBeforeNavigate", () => {
	it("confirms before navigating when the active slide has pending AI selections", async () => {
		const requestInspectorExit = vi.fn(async () => true)
		const { result } = renderHook(() =>
			useCheckBeforeNavigate({
				isAnySlideEditing: false,
				isInspectorPicking: () => true,
				requestInspectorExit,
				activeIndex: 0,
			}),
		)

		let navigationResult: boolean | undefined
		await act(async () => {
			navigationResult = await result.current.checkBeforeNavigate("next")
		})

		expect(requestInspectorExit).toHaveBeenCalledOnce()
		expect(navigationResult).toBe(true)
	})

	it("keeps navigation blocked when AI selection confirmation is cancelled", async () => {
		const requestInspectorExit = vi.fn(async () => false)
		const { result } = renderHook(() =>
			useCheckBeforeNavigate({
				isAnySlideEditing: false,
				isInspectorPicking: () => true,
				requestInspectorExit,
				activeIndex: 0,
			}),
		)

		let navigationResult: boolean | undefined
		await act(async () => {
			navigationResult = await result.current.checkBeforeNavigate("jump", 1)
		})

		expect(requestInspectorExit).toHaveBeenCalledOnce()
		expect(navigationResult).toBe(false)
		expect(result.current.showNavigationDialog).toBe(false)
	})

	it("does not request AI selection confirmation when the active slide is not picking", async () => {
		const requestInspectorExit = vi.fn(async () => true)
		const { result } = renderHook(() =>
			useCheckBeforeNavigate({
				isAnySlideEditing: false,
				isInspectorPicking: () => false,
				requestInspectorExit,
				activeIndex: 0,
			}),
		)

		let navigationResult: boolean | undefined
		await act(async () => {
			navigationResult = await result.current.checkBeforeNavigate("prev")
		})

		expect(requestInspectorExit).not.toHaveBeenCalled()
		expect(navigationResult).toBe(true)
	})
})
