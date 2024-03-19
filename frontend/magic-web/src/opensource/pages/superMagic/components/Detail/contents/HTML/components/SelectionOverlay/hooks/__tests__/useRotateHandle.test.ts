import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useRotateHandle } from "../useRotateHandle"
import type { SelectedInfo } from "../../types"

describe("useRotateHandle", () => {
	let mockEditorRef: any
	let mockSetSelectedInfo: any
	let mockSetHoveredRect: any
	let mockSetIsSelectionMode: any

	beforeEach(() => {
		mockEditorRef = {
			current: {
				beginBatchOperation: vi.fn().mockResolvedValue(undefined),
				endBatchOperation: vi.fn().mockResolvedValue(undefined),
				cancelBatchOperation: vi.fn().mockResolvedValue(undefined),
				applyStylesTemporary: vi.fn().mockResolvedValue(undefined),
				refreshSelectedElement: vi.fn().mockResolvedValue(undefined),
			},
		}
		mockSetSelectedInfo = vi.fn()
		mockSetHoveredRect = vi.fn()
		mockSetIsSelectionMode = vi.fn()

		// Mock requestAnimationFrame
		vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
			cb(0)
			return 0
		})
		vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {})
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("continuous rotation preservation", () => {
		it("should preserve continuous rotation after refresh (370deg -> not normalized to 10deg)", async () => {
			const initialSelectedInfo: SelectedInfo = {
				selector: "#test-element",
				rect: { top: 100, left: 100, width: 200, height: 100 },
				computedStyles: { transform: "none" },
				rotation: 0,
			}

			// Track all calls to setSelectedInfo
			const selectedInfoUpdates: SelectedInfo[] = []
			const trackingSetSelectedInfo = vi.fn((updater: any) => {
				if (typeof updater === "function") {
					const updated = updater(initialSelectedInfo)
					if (updated) selectedInfoUpdates.push(updated)
				}
			})

			const { result, rerender } = renderHook(
				(props) =>
					useRotateHandle({
						editorRef: mockEditorRef,
						isPptRender: false,
						scaleRatio: 1,
						selectedInfo: props.selectedInfo,
						setSelectedInfo: trackingSetSelectedInfo,
						setHoveredRect: mockSetHoveredRect,
						setIsSelectionMode: mockSetIsSelectionMode,
					}),
				{
					initialProps: { selectedInfo: initialSelectedInfo },
				},
			)

			// Initial rotation should be 0
			expect(result.current.rotation).toBe(0)

			// Simulate rotation completing with continuous value (370deg)
			// In real scenario, this happens after stopRotate updates selectedInfo
			// Note: In real browser, transform would be matrix form, not rotate(370deg)
			const rotatedSelectedInfo: SelectedInfo = {
				...initialSelectedInfo,
				rotation: 370, // Continuous rotation value saved by stopRotate
				computedStyles: {
					// Browser converts rotate(370deg) to matrix form (equivalent to rotate(10deg))
					transform: "matrix(0.98481, 0.17365, -0.17365, 0.98481, 0, 0)",
				},
			}

			await act(async () => {
				rerender({ selectedInfo: rotatedSelectedInfo })
			})

			// Should use the continuous rotation value
			expect(result.current.rotation).toBe(370)

			// Simulate refreshSelectedElement being called
			// iframe extracts rotation from matrix and normalizes it to -180~180
			const refreshedSelectedInfo: SelectedInfo = {
				...initialSelectedInfo,
				rotation: 10, // Normalized value from matrix extraction (370deg % 360 = 10deg)
				computedStyles: {
					transform: "matrix(0.98481, 0.17365, -0.17365, 0.98481, 0, 0)", // matrix form of rotate(10deg)
				},
			}

			// This simulates ELEMENT_SELECTED event after refreshSelectedElement
			await act(async () => {
				rerender({ selectedInfo: refreshedSelectedInfo })
			})

			// Should preserve the continuous rotation (370deg) instead of using normalized value (10deg)
			// This is the key fix - prevents rotation jumps on second rotation
			expect(result.current.rotation).toBe(370)

			// Verify that setSelectedInfo was called to update the rotation back to continuous value
			expect(trackingSetSelectedInfo).toHaveBeenCalled()
			// The last update should restore the continuous rotation
			const updates = selectedInfoUpdates.filter((info) => info.rotation === 370)
			expect(updates.length).toBeGreaterThan(0)
		})

		it("should reset rotation when selecting a different element", () => {
			const firstElement: SelectedInfo = {
				selector: "#element-1",
				rect: { top: 100, left: 100, width: 200, height: 100 },
				computedStyles: { transform: "rotate(370deg)" },
				rotation: 370,
			}

			const { result, rerender } = renderHook(
				(props) =>
					useRotateHandle({
						editorRef: mockEditorRef,
						isPptRender: false,
						scaleRatio: 1,
						selectedInfo: props.selectedInfo,
						setSelectedInfo: mockSetSelectedInfo,
						setHoveredRect: mockSetHoveredRect,
						setIsSelectionMode: mockSetIsSelectionMode,
					}),
				{
					initialProps: { selectedInfo: firstElement },
				},
			)

			// First element has 370deg rotation
			expect(result.current.rotation).toBe(370)

			// Select a different element
			const secondElement: SelectedInfo = {
				selector: "#element-2",
				rect: { top: 200, left: 200, width: 150, height: 150 },
				computedStyles: { transform: "rotate(45deg)" },
				rotation: 45,
			}

			rerender({ selectedInfo: secondElement })

			// Should use the new element's rotation, not preserve the old one
			expect(result.current.rotation).toBe(45)
		})

		it("should extract rotation from transform string when not provided", () => {
			const selectedInfo: SelectedInfo = {
				selector: "#test-element",
				rect: { top: 100, left: 100, width: 200, height: 100 },
				computedStyles: { transform: "rotate(90deg)" },
				// rotation not provided
			}

			const { result } = renderHook(() =>
				useRotateHandle({
					editorRef: mockEditorRef,
					isPptRender: false,
					scaleRatio: 1,
					selectedInfo,
					setSelectedInfo: mockSetSelectedInfo,
					setHoveredRect: mockSetHoveredRect,
					setIsSelectionMode: mockSetIsSelectionMode,
				}),
			)

			// Should extract 90deg from transform string
			expect(result.current.rotation).toBe(90)
		})

		it("should handle various rotation angle formats", () => {
			const testCases = [
				{ transform: "rotate(45deg)", expected: 45 },
				{ transform: "rotate(-90deg)", expected: -90 },
				{ transform: "rotate(1.5708rad)", expected: 90 }, // π/2 radians
				{ transform: "rotate(0.25turn)", expected: 90 }, // 1/4 turn
			]

			testCases.forEach(({ transform, expected }) => {
				const selectedInfo: SelectedInfo = {
					selector: "#test-element",
					rect: { top: 100, left: 100, width: 200, height: 100 },
					computedStyles: { transform },
				}

				const { result } = renderHook(() =>
					useRotateHandle({
						editorRef: mockEditorRef,
						isPptRender: false,
						scaleRatio: 1,
						selectedInfo,
						setSelectedInfo: mockSetSelectedInfo,
						setHoveredRect: mockSetHoveredRect,
						setIsSelectionMode: mockSetIsSelectionMode,
					}),
				)

				expect(result.current.rotation).toBeCloseTo(expected, 0)
			})
		})
	})
})
