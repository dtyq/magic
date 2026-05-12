import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useResizeHandles } from "../useResizeHandles"
import type { SelectedInfo } from "../../types"

describe("useResizeHandles", () => {
	let mockEditorRef: {
		current: {
			beginBatchOperation: ReturnType<typeof vi.fn>
			endBatchOperation: ReturnType<typeof vi.fn>
			cancelBatchOperation: ReturnType<typeof vi.fn>
			applyStylesTemporary: ReturnType<typeof vi.fn>
			refreshSelectedElement: ReturnType<typeof vi.fn>
		}
	}
	let mockSetHoveredRect: ReturnType<typeof vi.fn>
	let mockSetIsSelectionMode: ReturnType<typeof vi.fn>

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
		mockSetHoveredRect = vi.fn()
		mockSetIsSelectionMode = vi.fn()

		vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
			callback(0)
			return 1
		})
		vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {})
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	/**
	 * Build a pointer-like event for jsdom so hook tests can exercise document listeners.
	 */
	function createPointerLikeEvent(
		type: string,
		init: {
			clientX: number
			clientY: number
			buttons?: number
			shiftKey?: boolean
		},
	) {
		const event = new Event(type, {
			bubbles: true,
			cancelable: true,
		})

		Object.defineProperties(event, {
			clientX: { configurable: true, value: init.clientX },
			clientY: { configurable: true, value: init.clientY },
			buttons: { configurable: true, value: init.buttons ?? 0 },
			shiftKey: { configurable: true, value: init.shiftKey ?? false },
			preventDefault: { configurable: true, value: vi.fn() },
		})

		return event
	}

	it("should keep image intrinsic ratio when shift-resizing from the bottom-right handle", async () => {
		const selectedInfo: SelectedInfo = {
			selector: "img.hero",
			rect: {
				top: 0,
				left: 0,
				width: 200,
				height: 100,
			},
			computedStyles: {
				width: "200px",
				height: "100px",
			},
			isImageElement: true,
			intrinsicWidth: 800,
			intrinsicHeight: 400,
			intrinsicAspectRatio: 2,
		}

		const selectedInfoUpdates: SelectedInfo[] = []
		const trackingSetSelectedInfo = vi.fn(
			(updater: (prev: SelectedInfo | null) => SelectedInfo) => {
				const nextValue = updater(selectedInfo)
				selectedInfoUpdates.push(nextValue)
			},
		)

		const { result } = renderHook(() =>
			useResizeHandles({
				editorRef: mockEditorRef as any,
				isPptRender: false,
				scaleRatio: 1,
				selectedInfo,
				setSelectedInfo: trackingSetSelectedInfo as any,
				setHoveredRect: mockSetHoveredRect as any,
				setIsSelectionMode: mockSetIsSelectionMode as any,
			}),
		)

		const bottomRightHandle = result.current.resizeHandles.find(
			(handle) => handle.id === "bottom-right",
		)
		expect(bottomRightHandle).toBeDefined()

		const pointerTarget = {
			setPointerCapture: vi.fn(),
			releasePointerCapture: vi.fn(),
		}

		await act(async () => {
			await result.current.onHandleMouseDown(
				{
					clientX: 100,
					clientY: 100,
					pointerId: 1,
					currentTarget: pointerTarget,
					preventDefault: vi.fn(),
					stopPropagation: vi.fn(),
				} as any,
				bottomRightHandle!,
			)
		})

		await act(async () => {
			document.dispatchEvent(
				createPointerLikeEvent("pointermove", {
					clientX: 140,
					clientY: 110,
					buttons: 1,
					shiftKey: true,
				}),
			)
		})

		const latestUpdate = selectedInfoUpdates.at(-1)
		expect(latestUpdate?.rect.width).toBe(240)
		expect(latestUpdate?.rect.height).toBe(120)

		await act(async () => {
			document.dispatchEvent(
				createPointerLikeEvent("pointerup", {
					clientX: 140,
					clientY: 110,
				}),
			)
		})
	})
})
