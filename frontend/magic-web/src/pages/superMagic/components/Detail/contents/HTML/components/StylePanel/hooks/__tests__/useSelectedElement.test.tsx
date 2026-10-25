import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useSelectedElement } from "../useSelectedElement"

const mockStore = vi.hoisted(() => ({
	selectedElement: {
		selector: "img.hero",
		tagName: "img",
		isImageElement: true,
		intrinsicWidth: 800,
		intrinsicHeight: 400,
		intrinsicAspectRatio: 2,
		computedStyles: {
			width: "200px",
			height: "100px",
		},
	},
	selectedElements: [],
	textSelection: null,
	isSelectionMode: false,
	getSelectedSelectors: vi.fn(() => ["img.hero"]),
	setSelectionMode: vi.fn(),
	clearSelection: vi.fn(),
	selectElement: vi.fn(),
}))

vi.mock("../../../../iframe-bridge/contexts/StylePanelContext", () => ({
	useStylePanelStore: () => mockStore,
}))

describe("useSelectedElement", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockStore.selectedElement = {
			selector: "img.hero",
			tagName: "img",
			isImageElement: true,
			intrinsicWidth: 800,
			intrinsicHeight: 400,
			intrinsicAspectRatio: 2,
			computedStyles: {
				width: "200px",
				height: "100px",
			},
		}
		mockStore.getSelectedSelectors.mockReturnValue(["img.hero"])
	})

	it("should preserve image metadata after batch size updates refresh computed styles", async () => {
		const editorRef = {
			current: {
				setBatchStyles: vi.fn().mockResolvedValue(undefined),
				getElementComputedStyles: vi.fn().mockResolvedValue({
					width: "240px",
					height: "120px",
				}),
			},
		}

		const { result } = renderHook(() => useSelectedElement(editorRef as any))

		await act(async () => {
			await result.current.updateBatchStyles({
				width: "240px",
				height: "120px",
			})
		})

		expect(mockStore.selectElement).toHaveBeenCalledWith(
			expect.objectContaining({
				selector: "img.hero",
				tagName: "img",
				isImageElement: true,
				intrinsicWidth: 800,
				intrinsicHeight: 400,
				intrinsicAspectRatio: 2,
				inlineStyles: {
					width: "240px",
					height: "120px",
				},
				computedStyles: expect.objectContaining({
					width: "240px",
					height: "120px",
				}),
			}),
		)
	})

	it("does not restore the old selection after an asynchronous link update", async () => {
		let finish: (() => void) | undefined
		const updateElementAttributes = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					finish = resolve
				}),
		)
		const { result } = renderHook(() =>
			useSelectedElement({ current: { updateElementAttributes } } as never),
		)
		await act(async () => {
			const pending = result.current.updateAttributes({ dataMagicHref: "slide-2.html" })
			mockStore.selectedElement = { ...mockStore.selectedElement, selector: "img.other" }
			finish?.()
			await pending
		})
		expect(updateElementAttributes).toHaveBeenCalledWith("img.hero", {
			dataMagicHref: "slide-2.html",
		})
		expect(mockStore.selectElement).not.toHaveBeenCalled()
	})
})
