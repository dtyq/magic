import { describe, expect, it } from "vitest"
import type { FrameElement, ImageElement, LayerElement } from "../../../document/types"
import type { BaseElement } from "../BaseElement"
import { CanvasDocumentIndex } from "../CanvasDocumentIndex"

function createElement(data: LayerElement): BaseElement {
	return {
		getData: () => data,
	} as unknown as BaseElement
}

function image(id: string, x = 0, y = 0): ImageElement {
	return {
		id,
		type: "image",
		x,
		y,
		activeContentId: `${id}-content`,
		mainContentId: `${id}-content`,
		contents: [{ contentId: `${id}-content` }],
	}
}

function frame(id: string, children: LayerElement[]): FrameElement {
	return {
		id,
		type: "frame",
		activeContentId: `${id}-content`,
		mainContentId: `${id}-content`,
		contents: [{ contentId: `${id}-content` }],
		children,
	}
}

describe("CanvasDocumentIndex", () => {
	it("indexes root elements and direct parents", () => {
		const child = image("child")
		const frameElement = frame("frame", [child])
		const root = image("root", 100, 100)
		const elements = new Map<string, BaseElement>([
			["frame", createElement(frameElement)],
			["child", createElement(child)],
			["root", createElement(root)],
		])
		const index = new CanvasDocumentIndex()

		expect(index.getRootElementIds(elements)).toEqual(["frame", "root"])
		expect(index.getParentId(elements, "child")).toBe("frame")
		expect(index.hasParent(elements, "child")).toBe(true)
		expect(index.hasParent(elements, "root")).toBe(false)
		expect(index.getChildIds(elements, "frame")).toEqual(["child"])
	})

	it("rebuilds after topology changes are marked dirty", () => {
		let child = image("child")
		let frameElement = frame("frame", [child])
		const elements = new Map<string, BaseElement>([
			["frame", createElement(frameElement)],
			["child", createElement(child)],
		])
		const index = new CanvasDocumentIndex()

		expect(index.getParentId(elements, "child")).toBe("frame")

		child = { ...child, x: 300 }
		frameElement = { ...frameElement, children: [] }
		elements.set("frame", createElement(frameElement))
		elements.set("child", createElement(child))
		index.markTopologyDirty()

		expect(index.getParentId(elements, "child")).toBeUndefined()
		expect(index.getRootElementIds(elements)).toEqual(["frame", "child"])
	})

	it("keeps topology revision stable for ordinary invalidation", () => {
		const index = new CanvasDocumentIndex()

		expect(index.getTopologyRevision()).toBe(0)
		index.markDirty()
		expect(index.getTopologyRevision()).toBe(0)

		index.markTopologyDirty()
		expect(index.getTopologyRevision()).toBe(1)
		index.markDirty()
		expect(index.getTopologyRevision()).toBe(1)

		index.clear()
		expect(index.getTopologyRevision()).toBe(2)
	})

	it("keeps first parent wins semantics and ignores missing child instances", () => {
		const sharedChild = image("shared")
		const firstFrame = frame("first-frame", [sharedChild, image("missing")])
		const secondFrame = frame("second-frame", [sharedChild])
		const elements = new Map<string, BaseElement>([
			["first-frame", createElement(firstFrame)],
			["second-frame", createElement(secondFrame)],
			["shared", createElement(sharedChild)],
		])
		const index = new CanvasDocumentIndex()

		expect(index.getParentId(elements, "shared")).toBe("first-frame")
		expect(index.getParentId(elements, "missing")).toBeUndefined()
		expect(index.getChildIds(elements, "first-frame")).toEqual(["shared"])
	})
})
