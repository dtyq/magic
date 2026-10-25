import { describe, expect, it } from "vitest"
import type { CanvasDocument, LayerElement } from "../types"
import { applyCanvasDocumentPatch, tryApplyCanvasDocumentPatch } from "../patch"

function rect(id: string, zIndex = 1): LayerElement {
	return {
		id,
		type: "rectangle",
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		zIndex,
		activeContentId: `${id}-content`,
		mainContentId: `${id}-content`,
		contents: [{ contentId: `${id}-content` }],
	}
}

function frame(id: string, children: LayerElement[] = []): LayerElement {
	return {
		id,
		type: "frame",
		x: 0,
		y: 0,
		width: 300,
		height: 200,
		activeContentId: `${id}-content`,
		mainContentId: `${id}-content`,
		contents: [{ contentId: `${id}-content` }],
		children,
	}
}

describe("applyCanvasDocumentPatch", () => {
	it("updates nested elements without changing sibling order", () => {
		const canvas: CanvasDocument = {
			elements: [frame("frame-1", [rect("child-1"), rect("child-2")])],
		}

		const next = applyCanvasDocumentPatch(canvas, {
			upserts: [{ element: { ...rect("child-1"), x: 88 }, parentId: "frame-1" }],
			deletedElementIds: [],
			changedElementIds: ["child-1"],
		})

		const nextFrame = next.elements?.[0] as LayerElement & { children: LayerElement[] }
		expect(nextFrame.children.map((element) => element.id)).toEqual(["child-1", "child-2"])
		expect(nextFrame.children[0]).toEqual(expect.objectContaining({ id: "child-1", x: 88 }))
	})

	it("moves elements across parents without leaving duplicates", () => {
		const canvas: CanvasDocument = {
			elements: [frame("frame-a", [rect("child-1")]), frame("frame-b", [])],
		}

		const next = applyCanvasDocumentPatch(canvas, {
			upserts: [{ element: rect("child-1"), parentId: "frame-b" }],
			deletedElementIds: [],
			changedElementIds: ["child-1"],
		})

		const [frameA, frameB] = next.elements as Array<LayerElement & { children: LayerElement[] }>
		expect(frameA.children).toEqual([])
		expect(frameB.children.map((element) => element.id)).toEqual(["child-1"])
	})

	it("falls back to the root when a parent is missing in non-strict mode", () => {
		const canvas: CanvasDocument = {
			elements: [rect("existing")],
		}

		const next = applyCanvasDocumentPatch(canvas, {
			upserts: [{ element: rect("child-1"), parentId: "missing-parent" }],
			deletedElementIds: [],
			changedElementIds: ["child-1"],
		})

		expect(next.elements?.map((element) => element.id)).toEqual(["existing", "child-1"])
	})

	it("fails instead of changing hierarchy when a parent is missing in strict mode", () => {
		const canvas: CanvasDocument = {
			elements: [rect("existing")],
		}

		const result = tryApplyCanvasDocumentPatch(
			canvas,
			{
				upserts: [{ element: rect("child-1"), parentId: "missing-parent" }],
				deletedElementIds: [],
				changedElementIds: ["child-1"],
			},
			{ strictParent: true },
		)

		expect(result).toEqual(
			expect.objectContaining({
				ok: false,
				reason: "missing-parent",
				elementId: "child-1",
				parentId: "missing-parent",
			}),
		)
		expect(result.canvas.elements?.map((element) => element.id)).toEqual(["existing"])
	})

	it("applies connection upserts and deletes", () => {
		const canvas: CanvasDocument = {
			elements: [rect("source"), rect("target"), rect("other")],
			connections: [{ id: "old", sourceElementId: "source", targetElementId: "target" }],
		}

		const next = applyCanvasDocumentPatch(canvas, {
			upserts: [],
			deletedElementIds: [],
			changedElementIds: [],
			connectionUpserts: [{ id: "new", sourceElementId: "target", targetElementId: "other" }],
			deletedConnectionIds: ["old"],
			changedConnectionIds: ["old", "new"],
		})

		expect(next.connections).toEqual([
			{ id: "new", sourceElementId: "target", targetElementId: "other" },
		])
	})

	it("preserves existing connections when a patch has no connection fields", () => {
		const canvas: CanvasDocument = {
			elements: [rect("source"), rect("target")],
			connections: [{ id: "edge", sourceElementId: "source", targetElementId: "target" }],
		}

		const next = applyCanvasDocumentPatch(canvas, {
			upserts: [{ element: { ...rect("source"), x: 12 }, parentId: null }],
			deletedElementIds: [],
			changedElementIds: ["source"],
		})

		expect(next.connections).toEqual([
			{ id: "edge", sourceElementId: "source", targetElementId: "target" },
		])
	})

	it("cleans connections attached to deleted or missing elements", () => {
		const canvas: CanvasDocument = {
			elements: [rect("source"), rect("target")],
			connections: [
				{ id: "deleted", sourceElementId: "source", targetElementId: "target" },
				{ id: "missing", sourceElementId: "source", targetElementId: "missing" },
				{ id: "self", sourceElementId: "source", targetElementId: "source" },
			],
		}

		const next = applyCanvasDocumentPatch(canvas, {
			upserts: [],
			deletedElementIds: ["target"],
			changedElementIds: ["target"],
		})

		expect(next.connections).toBeUndefined()
	})
})
