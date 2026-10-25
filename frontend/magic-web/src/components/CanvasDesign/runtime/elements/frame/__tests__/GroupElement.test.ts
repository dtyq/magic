import Konva from "konva"
import { describe, expect, it, vi } from "vitest"
import type { Canvas } from "../../../core/Canvas"
import { ElementFactory } from "../../core/ElementFactory"
import { ElementTypeEnum, type GroupElement } from "../../../document/types"

function createGroupData(): GroupElement {
	return {
		id: "group-1",
		type: ElementTypeEnum.Group,
		x: 10,
		y: 20,
		width: 240,
		height: 160,
		contents: [{ contentId: "group-1-content" }],
		activeContentId: "group-1-content",
		mainContentId: "group-1-content",
		children: [],
	}
}

function createCanvasMock(): Canvas {
	return {
		elementManager: {
			canDragElement: vi.fn(() => true),
			canListenElement: vi.fn(() => true),
		},
	} as unknown as Canvas
}

describe("GroupElement runtime factory", () => {
	it("materializes and renders a Group as a layout container", () => {
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
			clearRect: vi.fn(),
			fillRect: vi.fn(),
			getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([0, 0, 0, 0]) })),
		} as unknown as CanvasRenderingContext2D)
		const element = ElementFactory.create(createGroupData(), createCanvasMock())

		expect(element).not.toBeNull()
		const node = element?.render()
		expect(node).toBeInstanceOf(Konva.Group)
		expect((node as Konva.Group | null)?.findOne(".hit-area")).toBeTruthy()
		expect(node?.id()).toBe("group-1")
	})
})
