import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useGapHandles } from "../useGapHandles"
import type { GapAxis } from "../../utils/gapHandleLayout"
import { getGapHandleLayout } from "../../utils/gapHandleLayout"
import type { SelectedInfo } from "../../types"

describe("useGapHandles", () => {
	let mockEditorRef: {
		current: {
			beginBatchOperation: ReturnType<typeof vi.fn>
			endBatchOperation: ReturnType<typeof vi.fn>
			cancelBatchOperation: ReturnType<typeof vi.fn>
			applyStylesTemporary: ReturnType<typeof vi.fn>
			refreshSelectedElement: ReturnType<typeof vi.fn>
		}
	}

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

		vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
			callback(0)
			return 1
		})
		vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {})
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	function createFlexSelectedInfo(): SelectedInfo {
		return {
			selector: "div.flex-row",
			rect: {
				top: 0,
				left: 0,
				width: 220,
				height: 100,
			},
			childRects: [
				{ top: 10, left: 10, width: 80, height: 80 },
				{ top: 10, left: 110, width: 80, height: 80 },
			],
			computedStyles: {
				display: "flex",
				columnGap: "16px",
				rowGap: "16px",
			},
		}
	}

	/**
	 * Build a pointer-like event for jsdom so hook tests can exercise document listeners.
	 */
	function createPointerLikeEvent(
		type: string,
		init: {
			clientX: number
			clientY: number
			buttons?: number
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
			preventDefault: { configurable: true, value: vi.fn() },
		})

		return event
	}

	async function dragGap(options: {
		selectedInfo: SelectedInfo
		axis: GapAxis
		gapAxesLinked: boolean
		startX?: number
		startY?: number
		moveX: number
		moveY: number
		onPreviewStyles?: (styles: Partial<{ rowGap: string; columnGap: string }>) => void
		setSelectedInfo?: (updater: (prev: SelectedInfo | null) => SelectedInfo | null) => void
		skipPointerUp?: boolean
	}) {
		const onPreviewStyles = options.onPreviewStyles ?? vi.fn()
		const { result } = renderHook(() =>
			useGapHandles({
				editorRef: mockEditorRef as any,
				selectedInfo: options.selectedInfo,
				gapAxesLinked: options.gapAxesLinked,
				onPreviewStyles,
				setSelectedInfo: options.setSelectedInfo,
			}),
		)

		const pointerTarget = {
			setPointerCapture: vi.fn(),
			releasePointerCapture: vi.fn(),
		}

		await act(async () => {
			await result.current.onGapHandlePointerDown(
				{
					clientX: options.startX ?? 100,
					clientY: options.startY ?? 100,
					pointerId: 1,
					currentTarget: pointerTarget,
					preventDefault: vi.fn(),
					stopPropagation: vi.fn(),
				} as any,
				options.axis,
			)
		})

		await act(async () => {
			document.dispatchEvent(
				createPointerLikeEvent("pointermove", {
					clientX: options.moveX,
					clientY: options.moveY,
					buttons: 1,
				}),
			)
		})

		if (!options.skipPointerUp) {
			await act(async () => {
				document.dispatchEvent(
					createPointerLikeEvent("pointerup", {
						clientX: options.moveX,
						clientY: options.moveY,
					}),
				)
			})
		}

		return { result, onPreviewStyles }
	}

	it("writes columnGap only when a column drag is unlinked", async () => {
		await dragGap({
			selectedInfo: createFlexSelectedInfo(),
			axis: "column",
			gapAxesLinked: false,
			moveX: 120,
			moveY: 100,
		})

		expect(mockEditorRef.current.applyStylesTemporary).toHaveBeenCalledWith("div.flex-row", {
			columnGap: "36px",
		})
	})

	it("writes only the dragged axis from the canvas even when linked", async () => {
		await dragGap({
			selectedInfo: createFlexSelectedInfo(),
			axis: "column",
			gapAxesLinked: true,
			moveX: 120,
			moveY: 100,
		})

		expect(mockEditorRef.current.applyStylesTemporary).toHaveBeenCalledWith("div.flex-row", {
			columnGap: "36px",
		})
	})

	it("commits the drag when the window blurs", async () => {
		await dragGap({
			selectedInfo: createFlexSelectedInfo(),
			axis: "column",
			gapAxesLinked: false,
			moveX: 120,
			moveY: 100,
			skipPointerUp: true,
		})

		await act(async () => {
			window.dispatchEvent(new Event("blur"))
		})

		expect(mockEditorRef.current.endBatchOperation).toHaveBeenCalledTimes(1)
		expect(mockEditorRef.current.refreshSelectedElement).toHaveBeenCalledWith("div.flex-row")
	})

	it("calls endBatchOperation once on pointer up", async () => {
		await dragGap({
			selectedInfo: createFlexSelectedInfo(),
			axis: "column",
			gapAxesLinked: false,
			moveX: 120,
			moveY: 100,
		})

		expect(mockEditorRef.current.endBatchOperation).toHaveBeenCalledTimes(1)
		expect(mockEditorRef.current.refreshSelectedElement).toHaveBeenCalledWith("div.flex-row")
	})

	it("commits the already-applied gap without applying it again", async () => {
		await dragGap({
			selectedInfo: createFlexSelectedInfo(),
			axis: "column",
			gapAxesLinked: false,
			moveX: 120,
			moveY: 100,
		})

		expect(mockEditorRef.current.applyStylesTemporary).toHaveBeenCalledTimes(1)
		expect(mockEditorRef.current.endBatchOperation).toHaveBeenCalledTimes(1)
	})

	it("does not write stale layout after the drag ends", async () => {
		let resolvePreview: (value: {
			rect: SelectedInfo["rect"]
			childRects: NonNullable<SelectedInfo["childRects"]>
		}) => void = () => {}
		const previewResult = new Promise<{
			rect: SelectedInfo["rect"]
			childRects: NonNullable<SelectedInfo["childRects"]>
		}>((resolve) => {
			resolvePreview = resolve
		})
		mockEditorRef.current.applyStylesTemporary
			.mockReturnValueOnce(previewResult)
			.mockResolvedValue(undefined)

		const setSelectedInfo = vi.fn()
		const { result } = await dragGap({
			selectedInfo: createFlexSelectedInfo(),
			axis: "column",
			gapAxesLinked: false,
			moveX: 120,
			moveY: 100,
			setSelectedInfo,
		})
		const settledHandle = result.current.gapHandles[0]
		setSelectedInfo.mockClear()

		await act(async () => {
			resolvePreview({
				rect: { top: 0, left: 0, width: 220, height: 100 },
				childRects: [
					{ top: 10, left: 10, width: 70, height: 80 },
					{ top: 10, left: 140, width: 70, height: 80 },
				],
			})
		})

		expect(setSelectedInfo).not.toHaveBeenCalled()
		const handle = result.current.gapHandles[0]
		expect(handle.left + handle.width / 2).toBeCloseTo(
			settledHandle.left + settledHandle.width / 2,
		)
	})

	it("does not write a gap below 0", async () => {
		await dragGap({
			selectedInfo: createFlexSelectedInfo(),
			axis: "column",
			gapAxesLinked: false,
			moveX: 70,
			moveY: 100,
		})

		expect(mockEditorRef.current.applyStylesTemporary).toHaveBeenCalledWith("div.flex-row", {
			columnGap: "0px",
		})
	})

	it("sends the same px map to onPreviewStyles during move", async () => {
		const onPreviewStyles = vi.fn()

		await dragGap({
			selectedInfo: createFlexSelectedInfo(),
			axis: "column",
			gapAxesLinked: false,
			moveX: 120,
			moveY: 100,
			onPreviewStyles,
			skipPointerUp: true,
		})

		expect(onPreviewStyles).toHaveBeenCalledWith({ columnGap: "36px" })
	})

	it("labels idle ticks with the computed gap", () => {
		const { result } = renderHook(() =>
			useGapHandles({
				editorRef: mockEditorRef as never,
				selectedInfo: createFlexSelectedInfo(),
				gapAxesLinked: false,
				onPreviewStyles: vi.fn(),
			}),
		)
		expect(result.current.gapHandles[0].valueLabel).toBe("16px")
	})

	it("updates the value label while dragging", async () => {
		const { result } = await dragGap({
			selectedInfo: createFlexSelectedInfo(),
			axis: "column",
			gapAxesLinked: false,
			moveX: 120,
			moveY: 100,
			skipPointerUp: true,
		})
		expect(result.current.gapHandles[0].valueLabel).toBe("36px")
	})

	it("prefers measured child rects from applyStylesTemporary", async () => {
		mockEditorRef.current.applyStylesTemporary.mockResolvedValue({
			rect: { top: 0, left: 0, width: 220, height: 100 },
			childRects: [
				{ top: 10, left: 10, width: 70, height: 80 },
				{ top: 10, left: 140, width: 70, height: 80 },
			],
		})
		const { result } = await dragGap({
			selectedInfo: createFlexSelectedInfo(),
			axis: "column",
			gapAxesLinked: false,
			moveX: 120,
			moveY: 100,
			skipPointerUp: true,
		})
		const handle = result.current.gapHandles[0]
		expect(handle.left + handle.width / 2).toBeCloseTo(110)
		expect(handle.width).toBe(16)
	})

	function createGridSelectedInfo(): SelectedInfo {
		return {
			selector: "div.meta-grid",
			rect: { top: 100, left: 0, width: 220, height: 196 },
			childRects: [
				{ top: 100, left: 10, width: 80, height: 80 },
				{ top: 100, left: 110, width: 80, height: 80 },
				{ top: 196, left: 10, width: 80, height: 80 },
				{ top: 196, left: 110, width: 80, height: 80 },
			],
			computedStyles: {
				display: "grid",
				columnGap: "16px",
				rowGap: "16px",
			},
		}
	}

	it("does not push row ticks down when live layout is missing", async () => {
		const selectedInfo = createGridSelectedInfo()
		const start = getGapHandleLayout(
			selectedInfo.rect,
			selectedInfo.childRects ?? [],
			"grid",
		).find((frame) => frame.axis === "row")
		const { result } = await dragGap({
			selectedInfo,
			axis: "row",
			gapAxesLinked: false,
			moveX: 100,
			moveY: 140,
			skipPointerUp: true,
		})
		const next = result.current.gapHandles.find((frame) => frame.axis === "row")
		expect(start).toBeDefined()
		expect(next).toBeDefined()
		expect(next!.top + next!.height / 2).toBeCloseTo(start!.top + start!.height / 2)
	})

	it("follows an upward-growing row gutter from live layout", async () => {
		mockEditorRef.current.applyStylesTemporary.mockResolvedValue({
			rect: { top: 80, left: 0, width: 220, height: 216 },
			childRects: [
				{ top: 80, left: 10, width: 80, height: 80 },
				{ top: 80, left: 110, width: 80, height: 80 },
				{ top: 196, left: 10, width: 80, height: 80 },
				{ top: 196, left: 110, width: 80, height: 80 },
			],
		})
		const selectedInfo = createGridSelectedInfo()
		const start = getGapHandleLayout(
			selectedInfo.rect,
			selectedInfo.childRects ?? [],
			"grid",
		).find((frame) => frame.axis === "row")
		const { result } = await dragGap({
			selectedInfo,
			axis: "row",
			gapAxesLinked: false,
			moveX: 100,
			moveY: 140,
			skipPointerUp: true,
		})
		const next = result.current.gapHandles.find((frame) => frame.axis === "row")
		expect(start).toBeDefined()
		expect(next).toBeDefined()
		const startCenter = selectedInfo.rect.top + start!.top + start!.height / 2
		const nextCenter = 80 + next!.top + next!.height / 2
		expect(nextCenter).toBeLessThan(startCenter)
	})

	it("moves the column tick while dragging", async () => {
		mockEditorRef.current.applyStylesTemporary.mockResolvedValue({
			rect: { top: 0, left: 0, width: 240, height: 100 },
			childRects: [
				{ top: 10, left: 10, width: 80, height: 80 },
				{ top: 10, left: 130, width: 80, height: 80 },
			],
		})
		const { result } = await dragGap({
			selectedInfo: createFlexSelectedInfo(),
			axis: "column",
			gapAxesLinked: false,
			moveX: 120,
			moveY: 100,
			skipPointerUp: true,
		})
		const start = getGapHandleLayout(
			createFlexSelectedInfo().rect,
			createFlexSelectedInfo().childRects ?? [],
			"flex",
		)[0]
		const next = result.current.gapHandles[0]
		expect(next.left + next.width / 2).toBeGreaterThan(start.left + start.width / 2)
	})

	it("scales gutter frames into the PPT selection box", () => {
		const selectedInfo = createFlexSelectedInfo()
		const { result } = renderHook(() =>
			useGapHandles({
				editorRef: mockEditorRef as never,
				selectedInfo,
				gapAxesLinked: false,
				onPreviewStyles: vi.fn(),
				isPptRender: true,
				scaleRatio: 0.5,
			}),
		)
		const handle = result.current.gapHandles[0]
		expect(handle.left + handle.width).toBeLessThanOrEqual(selectedInfo.rect.width * 0.5)
		expect(handle.left).toBeLessThan(selectedInfo.rect.width * 0.5)
	})
})
