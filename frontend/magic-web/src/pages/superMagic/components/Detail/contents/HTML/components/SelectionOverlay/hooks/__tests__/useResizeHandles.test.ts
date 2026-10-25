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

	async function dragResize(options: {
		selectedInfo: SelectedInfo
		handleId: string
		startX?: number
		startY?: number
		moveX: number
		moveY: number
		shiftKey?: boolean
	}) {
		const selectedInfoUpdates: SelectedInfo[] = []
		const trackingSetSelectedInfo = vi.fn(
			(updater: (prev: SelectedInfo | null) => SelectedInfo) => {
				const nextValue = updater(options.selectedInfo)
				selectedInfoUpdates.push(nextValue)
			},
		)

		const { result } = renderHook(() =>
			useResizeHandles({
				editorRef: mockEditorRef as any,
				isPptRender: false,
				scaleRatio: 1,
				selectedInfo: options.selectedInfo,
				setSelectedInfo: trackingSetSelectedInfo as any,
				setHoveredRect: mockSetHoveredRect as any,
				setIsSelectionMode: mockSetIsSelectionMode as any,
			}),
		)

		const handle = result.current.resizeHandles.find((item) => item.id === options.handleId)
		expect(handle).toBeDefined()

		const pointerTarget = {
			setPointerCapture: vi.fn(),
			releasePointerCapture: vi.fn(),
		}

		await act(async () => {
			await result.current.onHandleMouseDown(
				{
					clientX: options.startX ?? 100,
					clientY: options.startY ?? 100,
					pointerId: 1,
					currentTarget: pointerTarget,
					preventDefault: vi.fn(),
					stopPropagation: vi.fn(),
				} as any,
				handle!,
			)
		})

		await act(async () => {
			document.dispatchEvent(
				createPointerLikeEvent("pointermove", {
					clientX: options.moveX,
					clientY: options.moveY,
					buttons: 1,
					shiftKey: options.shiftKey,
				}),
			)
		})

		await act(async () => {
			document.dispatchEvent(
				createPointerLikeEvent("pointerup", {
					clientX: options.moveX,
					clientY: options.moveY,
				}),
			)
		})

		return selectedInfoUpdates
	}

	it("should write width and height only when resizing a non-flex element", async () => {
		const selectedInfo: SelectedInfo = {
			selector: "div.card",
			rect: {
				top: 0,
				left: 0,
				width: 200,
				height: 100,
			},
			computedStyles: {
				width: "200px",
				height: "100px",
				parentDisplay: "block",
			},
		}

		await dragResize({
			selectedInfo,
			handleId: "bottom-right",
			moveX: 140,
			moveY: 130,
		})

		expect(mockEditorRef.current.applyStylesTemporary).toHaveBeenLastCalledWith("div.card", {
			width: "240px",
			height: "130px",
		})
		expect(mockEditorRef.current.endBatchOperation).toHaveBeenLastCalledWith("div.card", {
			width: "240px",
			height: "130px",
		})
	})

	it("should fix flex row main-axis size when resizing a flex: 1 child horizontally", async () => {
		const selectedInfo: SelectedInfo = {
			selector: "main.content",
			rect: {
				top: 0,
				left: 0,
				width: 320,
				height: 180,
			},
			computedStyles: {
				width: "320px",
				height: "180px",
				parentDisplay: "flex",
				parentFlexDirection: "row",
				flexGrow: "1",
				flexShrink: "1",
				flexBasis: "0%",
			},
		}

		await dragResize({
			selectedInfo,
			handleId: "right",
			moveX: 150,
			moveY: 100,
		})

		const expectedStyles = {
			width: "370px",
			height: "180px",
			flexBasis: "370px",
			flexGrow: "0",
			flexShrink: "0",
			minWidth: "0px",
		}

		expect(mockEditorRef.current.applyStylesTemporary).toHaveBeenLastCalledWith(
			"main.content",
			expectedStyles,
		)
		expect(mockEditorRef.current.endBatchOperation).toHaveBeenLastCalledWith(
			"main.content",
			expectedStyles,
		)
	})

	it("should fix flex column main-axis size when resizing a flex child vertically", async () => {
		const selectedInfo: SelectedInfo = {
			selector: "section.panel",
			rect: {
				top: 0,
				left: 0,
				width: 240,
				height: 160,
			},
			computedStyles: {
				width: "240px",
				height: "160px",
				parentDisplay: "flex",
				parentFlexDirection: "column",
				flexGrow: "1",
				flexShrink: "1",
				flexBasis: "0%",
			},
		}

		await dragResize({
			selectedInfo,
			handleId: "bottom",
			moveX: 100,
			moveY: 145,
		})

		const expectedStyles = {
			width: "240px",
			height: "205px",
			flexBasis: "205px",
			flexGrow: "0",
			flexShrink: "0",
			minHeight: "0px",
		}

		expect(mockEditorRef.current.applyStylesTemporary).toHaveBeenLastCalledWith(
			"section.panel",
			expectedStyles,
		)
		expect(mockEditorRef.current.endBatchOperation).toHaveBeenLastCalledWith(
			"section.panel",
			expectedStyles,
		)
	})

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

		const selectedInfoUpdates = await dragResize({
			selectedInfo,
			handleId: "bottom-right",
			moveX: 140,
			moveY: 110,
			shiftKey: true,
		})

		const latestUpdate = selectedInfoUpdates.at(-1)
		expect(latestUpdate?.rect.width).toBe(240)
		expect(latestUpdate?.rect.height).toBe(120)
	})

	it("reports preview size while dragging a resize handle", async () => {
		const onPreviewSize = vi.fn()
		const selectedInfo: SelectedInfo = {
			selector: "div.card",
			rect: {
				top: 0,
				left: 0,
				width: 200,
				height: 100,
			},
			computedStyles: {
				width: "200px",
				height: "100px",
				parentDisplay: "block",
			},
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
				onPreviewSize,
			}),
		)

		const handle = result.current.resizeHandles.find((item) => item.id === "bottom-right")
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
				handle!,
			)
		})

		await act(async () => {
			document.dispatchEvent(
				createPointerLikeEvent("pointermove", {
					clientX: 140,
					clientY: 130,
					buttons: 1,
				}),
			)
		})

		expect(onPreviewSize).toHaveBeenCalledWith({ width: "240px", height: "130px" })
	})
})
