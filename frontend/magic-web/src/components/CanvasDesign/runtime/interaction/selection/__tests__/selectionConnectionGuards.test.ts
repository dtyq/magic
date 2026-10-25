import { describe, expect, it, vi } from "vitest"
import type { Canvas } from "../../../core/Canvas"
import { ElementTypeEnum, type LayerElement } from "../../../document/types"
import { canSelectionRootConnect } from "../selectionConnectionGuards"

function createElement(id: string, type: LayerElement["type"], connectable = true): LayerElement {
	return {
		id,
		type,
		x: 0,
		y: 0,
		width: 100,
		height: 80,
		interactionConfig: { connectable },
		children: [],
	} as LayerElement
}

function createCanvas(options: {
	element: LayerElement
	visible?: boolean
	canParticipate?: boolean
	permission?: boolean
}): Canvas {
	return {
		elementManager: {
			hasElement: vi.fn(() => true),
			isElementVisibleInDataTree: vi.fn(() => options.visible ?? true),
			getElementData: vi.fn(() => options.element),
			canParticipateInDocumentRelations: vi.fn(() => options.canParticipate ?? true),
		},
		permissionManager: {
			canConnect: vi.fn(() => options.permission ?? true),
		},
	} as unknown as Canvas
}

describe("canSelectionRootConnect", () => {
	it.each([
		["ordinary element", ElementTypeEnum.Video],
		["frame", ElementTypeEnum.Frame],
	] as const)("uses the normal connection permission for %s", (_, type) => {
		const element = createElement("root", type)
		const canvas = createCanvas({ element })

		expect(canSelectionRootConnect(canvas, element.id)).toBe(true)
		expect(canvas.permissionManager.canConnect).toHaveBeenCalledWith(element)
	})

	it("allows a visible Group to participate as a selection root", () => {
		const element = createElement("group", ElementTypeEnum.Group)
		const canvas = createCanvas({ element })

		expect(canSelectionRootConnect(canvas, element.id)).toBe(true)
		expect(canvas.permissionManager.canConnect).not.toHaveBeenCalled()
	})

	it("rejects hidden roots", () => {
		const element = createElement("hidden", ElementTypeEnum.Video)
		const canvas = createCanvas({ element, visible: false })

		expect(canSelectionRootConnect(canvas, element.id)).toBe(false)
	})

	it.each([
		[createElement("video", ElementTypeEnum.Video), false],
		[createElement("group", ElementTypeEnum.Group, false), true],
	] as const)("rejects an explicitly non-connectable %s root", (element, permission) => {
		const canvas = createCanvas({ element, permission })

		expect(canSelectionRootConnect(canvas, element.id)).toBe(false)
	})
})
