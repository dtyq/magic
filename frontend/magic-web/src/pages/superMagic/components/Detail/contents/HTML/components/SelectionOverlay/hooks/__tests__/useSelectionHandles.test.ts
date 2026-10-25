import { act, renderHook } from "@testing-library/react"
import type { RefObject } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { HTMLEditorV2Ref } from "../../../../iframe-bridge/types/props"
import { useSelectionHandles } from "../useSelectionHandles"
import type { SelectedInfo } from "../../types"

describe("useSelectionHandles", () => {
	let mockEditorRef: {
		current: {
			deleteElement: ReturnType<typeof vi.fn>
			duplicateElement: ReturnType<typeof vi.fn>
			beginBatchOperation: ReturnType<typeof vi.fn>
			endBatchOperation: ReturnType<typeof vi.fn>
			cancelBatchOperation: ReturnType<typeof vi.fn>
			applyStylesTemporary: ReturnType<typeof vi.fn>
			refreshSelectedElement: ReturnType<typeof vi.fn>
		}
	}

	const selectedInfo: SelectedInfo = {
		selector: "div.shortcut-target",
		rect: {
			top: 10,
			left: 20,
			width: 120,
			height: 80,
		},
		computedStyles: {
			width: "120px",
			height: "80px",
		},
	}

	beforeEach(() => {
		mockEditorRef = {
			current: {
				deleteElement: vi.fn().mockResolvedValue(undefined),
				duplicateElement: vi.fn().mockResolvedValue(undefined),
				beginBatchOperation: vi.fn().mockResolvedValue(undefined),
				endBatchOperation: vi.fn().mockResolvedValue(undefined),
				cancelBatchOperation: vi.fn().mockResolvedValue(undefined),
				applyStylesTemporary: vi.fn().mockResolvedValue(undefined),
				refreshSelectedElement: vi.fn().mockResolvedValue(undefined),
			},
		}
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	/**
	 * Renders the hook with stable no-op setters so operation callbacks can be tested directly.
	 */
	function renderSelectionHandles(info: SelectedInfo | null = selectedInfo) {
		return renderHook(() =>
			useSelectionHandles({
				editorRef: mockEditorRef as unknown as RefObject<HTMLEditorV2Ref>,
				isPptRender: false,
				scaleRatio: 1,
				selectedInfo: info,
				iframeRef: { current: null },
				setSelectedInfoList: vi.fn(),
				setHoveredRect: vi.fn(),
				setIsSelectionMode: vi.fn(),
				gapAxesLinked: false,
				onPreviewStyles: vi.fn(),
			}),
		)
	}

	it("executes delete through the editor ref", async () => {
		const { result } = renderSelectionHandles()

		await act(async () => {
			await result.current.executeDelete()
		})

		expect(mockEditorRef.current.deleteElement).toHaveBeenCalledWith("div.shortcut-target")
	})

	it("executes duplicate through the editor ref", async () => {
		const { result } = renderSelectionHandles()

		await act(async () => {
			await result.current.executeDuplicate()
		})

		expect(mockEditorRef.current.duplicateElement).toHaveBeenCalledWith("div.shortcut-target")
	})

	it("skips operations when no element is selected", async () => {
		const { result } = renderSelectionHandles(null)

		await act(async () => {
			await result.current.executeDelete()
			await result.current.executeDuplicate()
		})

		expect(mockEditorRef.current.deleteElement).not.toHaveBeenCalled()
		expect(mockEditorRef.current.duplicateElement).not.toHaveBeenCalled()
	})
})
