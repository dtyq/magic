import { describe, expect, it } from "vitest"
import type {
	CanvasConnection,
	FrameElement,
	LayerElement,
	RectangleElement,
} from "@/components/CanvasDesign/runtime/document/types"
import type { DesignData } from "../../types"
import { mergeDesignDataByElement } from "../designDataElementMerge"

function rect(id: string, options: Partial<RectangleElement> = {}): RectangleElement {
	const contentId = `${id}-content-1`
	return {
		id,
		type: "rectangle",
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		zIndex: 1,
		activeContentId: contentId,
		mainContentId: contentId,
		contents: [{ contentId }],
		...options,
	}
}

function frame(
	id: string,
	children: LayerElement[] = [],
	options: Partial<FrameElement> = {},
): FrameElement {
	const contentId = `${id}-content-1`
	return {
		id,
		type: "frame",
		x: 0,
		y: 0,
		width: 300,
		height: 200,
		zIndex: 1,
		children,
		activeContentId: contentId,
		mainContentId: contentId,
		contents: [{ contentId }],
		...options,
	}
}

function connection(
	id: string,
	sourceElementId = "source",
	targetElementId = "target",
): CanvasConnection {
	return { id, sourceElementId, targetElementId }
}

function design(
	elements: LayerElement[],
	options: Partial<DesignData> & { connections?: CanvasConnection[] } = {},
): DesignData {
	const { connections, ...restOptions } = options
	return {
		type: "design",
		name: "design",
		version: "2.0.0",
		canvas: { elements, ...(connections ? { connections } : {}) },
		...restOptions,
	}
}

function childIds(element: LayerElement): string[] {
	return "children" in element && Array.isArray(element.children)
		? element.children.map((child) => child.id)
		: []
}

describe("mergeDesignDataByElement", () => {
	it("merges different top-level element updates", () => {
		const baseData = design([rect("remote-element"), rect("local-element")])
		const remoteData = design([rect("remote-element", { x: 100 }), rect("local-element")])
		const localData = design([rect("remote-element"), rect("local-element", { y: 200 })])

		const result = mergeDesignDataByElement({ baseData, localData, remoteData })

		expect(result.ok).toBe(true)
		if (!result.ok) return
		expect(result.localChangedElementIds).toEqual(["local-element"])
		expect(result.remoteChangedElementIds).toEqual(["remote-element"])
		expect(result.mergedData.canvas?.elements).toEqual([
			expect.objectContaining({ id: "remote-element", x: 100, y: 0 }),
			expect.objectContaining({ id: "local-element", x: 0, y: 200 }),
		])
	})

	it("merges different nested child updates in the same frame", () => {
		const baseData = design([frame("frame", [rect("remote-child"), rect("local-child")])])
		const remoteData = design([
			frame("frame", [rect("remote-child", { x: 100 }), rect("local-child")]),
		])
		const localData = design([
			frame("frame", [rect("remote-child"), rect("local-child", { y: 200 })]),
		])

		const result = mergeDesignDataByElement({ baseData, localData, remoteData })

		expect(result.ok).toBe(true)
		if (!result.ok) return
		const mergedFrame = result.mergedData.canvas?.elements?.[0]
		expect(childIds(mergedFrame as LayerElement)).toEqual(["remote-child", "local-child"])
		expect((mergedFrame as LayerElement & { children: LayerElement[] }).children).toEqual([
			expect.objectContaining({ id: "remote-child", x: 100, y: 0 }),
			expect.objectContaining({ id: "local-child", x: 0, y: 200 }),
		])
	})

	it("preserves remote child changes when local changes the container itself", () => {
		const baseData = design([frame("frame", [rect("child")], { x: 0 })])
		const remoteData = design([frame("frame", [rect("child", { x: 100 })], { x: 0 })])
		const localData = design([frame("frame", [rect("child")], { x: 300 })])

		const result = mergeDesignDataByElement({ baseData, localData, remoteData })

		expect(result.ok).toBe(true)
		if (!result.ok) return
		const mergedFrame = result.mergedData.canvas?.elements?.[0] as LayerElement & {
			children: LayerElement[]
		}
		expect(mergedFrame).toEqual(expect.objectContaining({ id: "frame", x: 300 }))
		expect(mergedFrame.children[0]).toEqual(expect.objectContaining({ id: "child", x: 100 }))
	})

	it("merges a local add with a remote update on a different element", () => {
		const baseData = design([rect("remote-element")])
		const remoteData = design([rect("remote-element", { x: 100 })])
		const localData = design([rect("remote-element"), rect("local-new", { zIndex: 2 })])

		const result = mergeDesignDataByElement({ baseData, localData, remoteData })

		expect(result.ok).toBe(true)
		if (!result.ok) return
		expect(result.localChangedElementIds).toEqual(["local-new"])
		expect(result.remoteChangedElementIds).toEqual(["remote-element"])
		expect(result.mergedData.canvas?.elements?.map((element) => element.id)).toEqual([
			"remote-element",
			"local-new",
		])
		expect(result.mergedData.canvas?.elements?.[0]).toEqual(
			expect.objectContaining({ id: "remote-element", x: 100 }),
		)
	})

	it("merges different field updates on the same element", () => {
		const baseData = design([rect("same")])
		const remoteData = design([rect("same", { x: 100 })])
		const localData = design([rect("same", { y: 200 })])

		const result = mergeDesignDataByElement({ baseData, localData, remoteData })

		expect(result.ok).toBe(true)
		if (!result.ok) return
		expect(result.mergedData.canvas?.elements).toEqual([
			expect.objectContaining({ id: "same", x: 100, y: 200 }),
		])
	})

	it("reports a conflict when both sides update the same field", () => {
		const baseData = design([rect("same")])
		const remoteData = design([rect("same", { x: 100 })])
		const localData = design([rect("same", { x: 200 })])

		const result = mergeDesignDataByElement({ baseData, localData, remoteData })

		expect(result).toEqual(
			expect.objectContaining({
				ok: false,
				isElementLevelConflict: true,
				reason: "same-element-changed",
				conflictElementIds: ["same"],
			}),
		)
		if (result.ok || !result.isElementLevelConflict) return
		expect(result.elementConflicts).toEqual([
			expect.objectContaining({
				elementId: "same",
				reason: "same-element-changed",
				baseElement: expect.objectContaining({ id: "same", x: 0, y: 0 }),
				localElement: expect.objectContaining({ id: "same", x: 200, y: 0 }),
				remoteElement: expect.objectContaining({ id: "same", x: 100, y: 0 }),
			}),
		])
		expect(result.mergedData.canvas?.elements).toEqual([
			expect.objectContaining({ id: "same", x: 100, y: 0 }),
		])
	})

	it("keeps non-conflicting local element changes when the same element conflicts", () => {
		const baseData = design([rect("same"), rect("local-element")])
		const remoteData = design([rect("same", { x: 100 }), rect("local-element")])
		const localData = design([rect("same", { x: 200 }), rect("local-element", { y: 300 })])

		const result = mergeDesignDataByElement({ baseData, localData, remoteData })

		expect(result).toEqual(
			expect.objectContaining({
				ok: false,
				isElementLevelConflict: true,
				reason: "same-element-changed",
				conflictElementIds: ["same"],
			}),
		)
		if (result.ok || !result.isElementLevelConflict) return
		expect(result.mergedData.canvas?.elements).toEqual([
			expect.objectContaining({ id: "same", x: 100, y: 0 }),
			expect.objectContaining({ id: "local-element", x: 0, y: 300 }),
		])
	})

	it("reports a conflict when one side deletes an element the other side updates", () => {
		const baseData = design([rect("target")])
		const remoteData = design([])
		const localData = design([rect("target", { y: 200 })])

		const result = mergeDesignDataByElement({ baseData, localData, remoteData })

		expect(result).toEqual(
			expect.objectContaining({
				ok: false,
				isElementLevelConflict: true,
				reason: "delete-update-conflict",
				conflictElementIds: ["target"],
			}),
		)
		if (result.ok || !result.isElementLevelConflict) return
		expect(result.elementConflicts).toEqual([
			expect.objectContaining({
				elementId: "target",
				reason: "delete-update-conflict",
				localElement: expect.objectContaining({ id: "target", y: 200 }),
				remoteElement: null,
			}),
		])
	})

	it("merges pure additions under the same parent", () => {
		const baseData = design([frame("frame", [])])
		const remoteData = design([frame("frame", [rect("remote-new")])])
		const localData = design([frame("frame", [rect("local-new")])])

		const result = mergeDesignDataByElement({ baseData, localData, remoteData })

		expect(result.ok).toBe(true)
		if (!result.ok) return
		const mergedFrame = result.mergedData.canvas?.elements?.[0] as LayerElement
		expect(childIds(mergedFrame).sort()).toEqual(["local-new", "remote-new"])
	})

	it("reports a conflict when parent structure changes include a move", () => {
		const baseData = design([frame("frame", [rect("child")])])
		const remoteData = design([frame("frame", [rect("child"), rect("remote-new")])])
		const localData = design([frame("frame", []), rect("child")])

		const result = mergeDesignDataByElement({ baseData, localData, remoteData })

		expect(result).toEqual(
			expect.objectContaining({
				ok: false,
				isElementLevelConflict: true,
				reason: "parent-structure-conflict",
				conflictElementIds: ["child", "remote-new"],
			}),
		)
		if (result.ok || !result.isElementLevelConflict) return
		expect(result.elementConflicts).toEqual([
			expect.objectContaining({
				elementId: "child",
				reason: "parent-structure-conflict",
				localParentId: null,
				remoteParentId: "frame",
			}),
			expect.objectContaining({
				elementId: "remote-new",
				reason: "parent-structure-conflict",
				localElement: null,
				remoteElement: expect.objectContaining({ id: "remote-new" }),
			}),
		])
	})

	it("keeps document-level meta conflicts conservative", () => {
		const baseData = design([rect("same")], { name: "base" })
		const remoteData = design([rect("same", { x: 100 })], { name: "remote" })
		const localData = design([rect("same", { y: 200 })], { name: "local" })

		const result = mergeDesignDataByElement({ baseData, localData, remoteData })

		expect(result).toEqual(
			expect.objectContaining({
				ok: false,
				reason: "document-level-change",
				conflictElementIds: [],
				localChangedElementIds: ["same"],
				remoteChangedElementIds: ["same"],
			}),
		)
	})

	it("reports duplicate element ids as a conflict", () => {
		const baseData = design([rect("a")])
		const remoteData = design([rect("a")])
		const localData = design([rect("a"), rect("a", { x: 10 })])

		const result = mergeDesignDataByElement({ baseData, localData, remoteData })

		expect(result).toEqual(
			expect.objectContaining({
				ok: false,
				reason: "duplicate-element-id",
				conflictElementIds: ["a"],
			}),
		)
	})

	it("reports duplicate connection ids as a connection-level conflict", () => {
		const elements = [rect("source"), rect("target"), rect("other")]
		const baseData = design(elements)
		const remoteData = design(elements)
		const localData = design(elements, {
			connections: [
				connection("edge", "source", "target"),
				connection("edge", "target", "other"),
			],
		})

		const result = mergeDesignDataByElement({ baseData, localData, remoteData })

		expect(result).toEqual(
			expect.objectContaining({
				ok: false,
				isConnectionLevelConflict: true,
				reason: "duplicate-connection-id",
				connectionConflictIds: ["edge"],
				connectionConflicts: [
					expect.objectContaining({
						connectionId: "edge",
						reason: "duplicate-connection-id",
					}),
				],
			}),
		)
	})
})
