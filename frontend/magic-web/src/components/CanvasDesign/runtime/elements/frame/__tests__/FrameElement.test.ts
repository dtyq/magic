import { describe, expect, it } from "vitest"
import type { Canvas } from "../../../core/Canvas"
import {
	ElementTypeEnum,
	type FrameElement as FrameElementData,
	type LayerElement,
} from "../../../document/types"
import { FrameElement } from "../FrameElement"

function createChild(id: string): LayerElement {
	return {
		id,
		type: ElementTypeEnum.Rectangle,
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		activeContentId: `${id}-content`,
		mainContentId: `${id}-content`,
		contents: [{ contentId: `${id}-content` }],
	}
}

function createFrameData(children?: LayerElement[]): FrameElementData {
	return {
		id: "frame-1",
		type: ElementTypeEnum.Frame,
		x: 0,
		y: 0,
		width: 300,
		height: 200,
		activeContentId: "frame-1-content",
		mainContentId: "frame-1-content",
		contents: [{ contentId: "frame-1-content" }],
		children,
	}
}

function createCanvasMock(): Canvas {
	return {
		elementManager: {
			getElementData: () => undefined,
		},
	} as unknown as Canvas
}

describe("FrameElement name label", () => {
	it("appends the direct child count without changing the editable name", () => {
		const element = new FrameElement(
			createFrameData([createChild("child-1"), createChild("child-2")]),
			createCanvasMock(),
		)

		expect(element.getNameLabelContent()).toEqual({
			primaryText: "画框",
			suffix: { text: " (2)", showBackground: false },
		})
		expect(element.getNameLabelText()).toBe("画框 (2)")
		expect(element.getData().name).toBeUndefined()
	})

	it("omits the count when the frame has no children", () => {
		for (const children of [undefined, []]) {
			const element = new FrameElement(createFrameData(children), createCanvasMock())

			expect(element.getNameLabelContent()).toEqual({ primaryText: "画框" })
			expect(element.getNameLabelText()).toBe("画框")
		}
	})
})
