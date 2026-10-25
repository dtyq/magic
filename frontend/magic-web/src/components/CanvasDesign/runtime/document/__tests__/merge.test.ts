import { describe, expect, it } from "vitest"
import type {
	CanvasConnection,
	CanvasDocument,
	ImageElement,
	ImageElementContent,
	LayerElement,
} from "../types"
import { getElementContentFields } from "../elementContent"
import {
	mergeCanvasDocuments,
	refreshCanvasDocumentElementMergeConflictsFromRemote,
} from "../merge"
function normalizedElement(element: Record<string, unknown>): LayerElement {
	const { id, type, contents, activeContentId, mainContentId, ...rest } = element
	if (typeof id !== "string" || typeof type !== "string") {
		throw new Error("test element id/type is required")
	}
	const contentFields = getElementContentFields(type)
	const content = {
		contentId: `${id}-content-1`,
		...Object.fromEntries(
			contentFields
				.filter((field) => rest[field] !== undefined)
				.map((field) => [field, rest[field]]),
		),
	}
	for (const field of contentFields) delete rest[field]
	const nextContents = (contents as Array<Record<string, unknown>> | undefined) ?? [content]
	const pointer = (nextContents[0]?.contentId as string | undefined) ?? null
	return {
		...rest,
		id,
		type,
		contents: nextContents,
		activeContentId: (activeContentId as string | null | undefined) ?? pointer,
		mainContentId: (mainContentId as string | null | undefined) ?? pointer,
	} as unknown as LayerElement
}

function rect(id: string, props: Partial<LayerElement> = {}): LayerElement {
	return normalizedElement({
		id,
		type: "rectangle",
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		...props,
	})
}

function image(id: string, props: Partial<LayerElement> = {}): LayerElement {
	return normalizedElement({
		id,
		type: "image",
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		...props,
	})
}

function video(id: string, props: Partial<LayerElement> = {}): LayerElement {
	return normalizedElement({
		id,
		type: "video",
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		...props,
	})
}

function frame(id: string, children: LayerElement[] = [], props: Partial<LayerElement> = {}) {
	return normalizedElement({
		id,
		type: "frame",
		x: 0,
		y: 0,
		width: 300,
		height: 200,
		children,
		...props,
	})
}

function connection(
	id: string,
	sourceElementId = "source",
	targetElementId = "target",
): CanvasConnection {
	return { id, sourceElementId, targetElementId }
}

function canvas(elements: LayerElement[], connections?: CanvasConnection[]): CanvasDocument {
	return connections ? { elements, connections } : { elements }
}

function contentImage(
	contents: ImageElementContent[],
	activeContentId = contents[0]?.contentId,
	mainContentId = contents[0]?.contentId,
): ImageElement {
	return {
		id: "versioned-image",
		type: "image",
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		activeContentId: activeContentId as string,
		mainContentId: mainContentId as string,
		contents,
	}
}

describe("mergeCanvasDocuments", () => {
	it("conflicts when the same element id changes type", () => {
		const baseImage = contentImage([{ contentId: "c1", src: "./images/base.png" }])
		const localImage = contentImage([{ contentId: "c1", src: "./images/base.png" }])
		const remoteImage = video("versioned-image")

		const result = mergeCanvasDocuments({
			baseCanvas: canvas([baseImage]),
			localCanvas: canvas([localImage]),
			remoteCanvas: canvas([remoteImage]),
		})

		expect(result).toEqual(
			expect.objectContaining({
				ok: false,
				isElementLevelConflict: true,
				conflictElementIds: ["versioned-image"],
			}),
		)
	})

	it("merges independent Content additions while preserving creation order", () => {
		const base = contentImage([{ contentId: "c1", src: "./images/base.png" }])
		const local = contentImage([
			...base.contents,
			{ contentId: "local-c2", status: "processing" },
		])
		const remote = contentImage([
			...base.contents,
			{ contentId: "remote-c2", status: "failed" },
		])

		const result = mergeCanvasDocuments({
			baseCanvas: canvas([base]),
			localCanvas: canvas([local]),
			remoteCanvas: canvas([remote]),
		})

		expect(result.ok).toBe(true)
		if (!result.ok) return
		expect(
			(result.mergedCanvas.elements?.[0] as ImageElement).contents.map(
				(content) => content.contentId,
			),
		).toEqual(["c1", "local-c2", "remote-c2"])
	})

	it("enters the existing conflict flow when both sides edit one Content differently", () => {
		const base = contentImage([{ contentId: "c1", src: "./images/base.png" }])
		const local = contentImage([{ contentId: "c1", src: "./images/local.png" }])
		const remote = contentImage([{ contentId: "c1", src: "./images/remote.png" }])

		const result = mergeCanvasDocuments({
			baseCanvas: canvas([base]),
			localCanvas: canvas([local]),
			remoteCanvas: canvas([remote]),
		})

		expect(result).toEqual(
			expect.objectContaining({
				ok: false,
				isElementLevelConflict: true,
				reason: "same-element-changed",
				conflictElementIds: ["versioned-image"],
			}),
		)
	})

	it("conflicts when one side deletes a Content while the other edits it", () => {
		const base = contentImage([
			{ contentId: "c1", src: "./images/base.png" },
			{ contentId: "c2", src: "./images/two.png" },
		])
		const local = contentImage(base.contents.slice(0, 1))
		const remote = contentImage([
			base.contents[0],
			{ ...base.contents[1], crop: { x: 1, y: 1, width: 10, height: 10 } },
		])

		const result = mergeCanvasDocuments({
			baseCanvas: canvas([base]),
			localCanvas: canvas([local]),
			remoteCanvas: canvas([remote]),
		})

		expect(result).toEqual(
			expect.objectContaining({
				ok: false,
				isElementLevelConflict: true,
				conflictElementIds: ["versioned-image"],
			}),
		)
	})
	it("merges local and remote changes on different elements", () => {
		const baseCanvas = canvas([rect("local"), rect("remote")])
		const localCanvas = canvas([rect("local", { x: 10 }), rect("remote")])
		const remoteCanvas = canvas([rect("local"), rect("remote", { x: 20 })])

		const result = mergeCanvasDocuments({ baseCanvas, localCanvas, remoteCanvas })

		expect(result.ok).toBe(true)
		if (!result.ok) return
		const elementsById = new Map(
			result.mergedCanvas.elements?.map((element) => [element.id, element]),
		)
		expect(elementsById.get("local")).toEqual(expect.objectContaining({ id: "local", x: 10 }))
		expect(elementsById.get("remote")).toEqual(expect.objectContaining({ id: "remote", x: 20 }))
	})

	it("merges local layout fields with remote generation fields on the same element", () => {
		const baseCanvas = canvas([
			image("same", {
				status: "pending",
				src: "./images/base.png",
				generateImageRequest: { prompt: "base" },
			} as Partial<LayerElement>),
		])
		const localCanvas = canvas([
			image("same", {
				x: 10,
				y: 20,
				status: "pending",
				src: "./images/base.png",
				generateImageRequest: { prompt: "base" },
			} as Partial<LayerElement>),
		])
		const remoteCanvas = canvas([
			image("same", {
				status: "completed",
				src: "./images/result.png",
				imageGenerationTaskMeta: {
					type: "generate",
					file_path: "./images/result.png",
				},
				generateImageRequest: {
					prompt: "base",
					reference_images: ["./images/ref.png"],
				},
			} as Partial<LayerElement>),
		])

		const result = mergeCanvasDocuments({ baseCanvas, localCanvas, remoteCanvas })

		expect(result.ok).toBe(true)
		if (!result.ok) return
		const mergedImage = result.mergedCanvas.elements?.[0] as ImageElement
		expect(result.mergedCanvas.elements).toEqual([
			expect.objectContaining({
				id: "same",
				x: 10,
				y: 20,
				contents: [
					expect.objectContaining({
						status: "completed",
						src: "./images/result.png",
						imageGenerationTaskMeta: expect.objectContaining({
							file_path: "./images/result.png",
						}),
						generateImageRequest: expect.objectContaining({
							reference_images: ["./images/ref.png"],
						}),
					}),
				],
			}),
		])
		expect(mergedImage.contents[0]).toEqual(
			expect.objectContaining({ src: "./images/result.png", status: "completed" }),
		)
	})

	it("merges local layout fields with remote video generation request on the same element", () => {
		const baseCanvas = canvas([
			video("same", {
				status: "pending",
				src: "./videos/base.mp4",
				generateVideoRequest: { prompt: "base" },
			} as Partial<LayerElement>),
		])
		const localCanvas = canvas([
			video("same", {
				width: 160,
				height: 90,
				status: "pending",
				src: "./videos/base.mp4",
				generateVideoRequest: { prompt: "base" },
			} as Partial<LayerElement>),
		])
		const remoteCanvas = canvas([
			video("same", {
				status: "completed",
				src: "./videos/result.mp4",
				generateVideoRequest: {
					prompt: "base",
					video_id: "video-task-1",
					inputs: {
						reference_videos: [{ path: "./videos/ref.mp4" }],
					},
				},
			} as Partial<LayerElement>),
		])

		const result = mergeCanvasDocuments({ baseCanvas, localCanvas, remoteCanvas })

		expect(result.ok).toBe(true)
		if (!result.ok) return
		expect(result.mergedCanvas.elements).toEqual([
			expect.objectContaining({
				id: "same",
				width: 160,
				height: 90,
				contents: [
					expect.objectContaining({
						status: "completed",
						src: "./videos/result.mp4",
						generateVideoRequest: expect.objectContaining({
							video_id: "video-task-1",
							inputs: expect.objectContaining({
								reference_videos: [{ path: "./videos/ref.mp4" }],
							}),
						}),
					}),
				],
			}),
		])
	})

	it("returns an element-level conflict when both sides change the same field", () => {
		const baseCanvas = canvas([rect("same")])
		const localCanvas = canvas([rect("same", { x: 10 })])
		const remoteCanvas = canvas([rect("same", { x: 20 })])

		const result = mergeCanvasDocuments({ baseCanvas, localCanvas, remoteCanvas })

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
				baseElement: expect.objectContaining({ id: "same", x: 0 }),
				localElement: expect.objectContaining({ id: "same", x: 10 }),
				remoteElement: expect.objectContaining({ id: "same", x: 20 }),
				baseParentId: null,
				localParentId: null,
				remoteParentId: null,
			}),
		])
		expect(result.mergedCanvas?.elements).toEqual([
			expect.objectContaining({ id: "same", x: 20 }),
		])
	})

	it("reports duplicate element ids before attempting a merge", () => {
		const baseCanvas = canvas([rect("a")])
		const localCanvas = canvas([rect("a"), rect("a", { x: 10 })])
		const remoteCanvas = canvas([rect("a")])

		const result = mergeCanvasDocuments({ baseCanvas, localCanvas, remoteCanvas })

		expect(result).toEqual(
			expect.objectContaining({
				ok: false,
				reason: "duplicate-element-id",
				conflictElementIds: ["a"],
			}),
		)
	})

	it("returns an element-level conflict when one side deletes and the other updates", () => {
		const baseCanvas = canvas([rect("target"), rect("local")])
		const localCanvas = canvas([rect("target", { y: 10 }), rect("local", { y: 20 })])
		const remoteCanvas = canvas([rect("local")])

		const result = mergeCanvasDocuments({ baseCanvas, localCanvas, remoteCanvas })

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
				localElement: expect.objectContaining({ id: "target", y: 10 }),
				remoteElement: null,
			}),
		])
		expect(result.mergedCanvas?.elements).toEqual([
			expect.objectContaining({ id: "local", y: 20 }),
		])
	})

	it("merges pure additions under the same parent", () => {
		const baseCanvas = canvas([frame("frame", [])])
		const localCanvas = canvas([frame("frame", [rect("local-new")])])
		const remoteCanvas = canvas([frame("frame", [rect("remote-new")])])

		const result = mergeCanvasDocuments({ baseCanvas, localCanvas, remoteCanvas })

		expect(result.ok).toBe(true)
		if (!result.ok) return
		const mergedFrame = result.mergedCanvas?.elements?.[0] as LayerElement & {
			children?: LayerElement[]
		}
		expect(mergedFrame).toEqual(expect.objectContaining({ id: "frame" }))
		expect(mergedFrame.children?.map((child) => child.id).sort()).toEqual([
			"local-new",
			"remote-new",
		])
	})

	it("returns an element-level conflict when parent structure changes include a move", () => {
		const baseCanvas = canvas([frame("frame", [rect("child")])])
		const localCanvas = canvas([frame("frame", []), rect("child")])
		const remoteCanvas = canvas([frame("frame", [rect("child"), rect("remote-new")])])

		const result = mergeCanvasDocuments({ baseCanvas, localCanvas, remoteCanvas })

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

	it("refreshes conflict remote candidates from a newer remote canvas", () => {
		const result = refreshCanvasDocumentElementMergeConflictsFromRemote({
			elementConflicts: [
				{
					elementId: "same",
					reason: "same-element-changed",
					baseElement: rect("same"),
					localElement: rect("same", { y: 10 }),
					remoteElement: rect("same", { x: 20 }),
					baseParentId: null,
					localParentId: null,
					remoteParentId: null,
				},
			],
			remoteCanvas: canvas([rect("same", { x: 30 })]),
		})

		expect(result).toEqual([
			expect.objectContaining({
				elementId: "same",
				localElement: expect.objectContaining({ id: "same", y: 10 }),
				remoteElement: expect.objectContaining({ id: "same", x: 30 }),
				remoteParentId: null,
			}),
		])
	})

	it("merges local and remote connection additions", () => {
		const elements = [rect("source"), rect("target"), rect("other")]
		const baseCanvas = canvas(elements)
		const localCanvas = canvas(elements, [connection("local", "source", "target")])
		const remoteCanvas = canvas(elements, [connection("remote", "target", "other")])

		const result = mergeCanvasDocuments({ baseCanvas, localCanvas, remoteCanvas })

		expect(result.ok).toBe(true)
		if (!result.ok) return
		expect(result.mergedCanvas.connections?.map((item) => item.id).sort()).toEqual([
			"local",
			"remote",
		])
	})

	it("reports duplicate connection ids as a connection-level conflict", () => {
		const elements = [rect("source"), rect("target"), rect("other")]
		const baseCanvas = canvas(elements)
		const localCanvas = canvas(elements, [
			connection("edge", "source", "target"),
			connection("edge", "target", "other"),
		])
		const remoteCanvas = baseCanvas

		const result = mergeCanvasDocuments({ baseCanvas, localCanvas, remoteCanvas })

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

	it("applies local connection deletion and update over unchanged remote", () => {
		const elements = [rect("source"), rect("target"), rect("other")]
		const baseCanvas = canvas(elements, [
			connection("delete-me", "source", "target"),
			connection("update-me", "source", "target"),
		])
		const localCanvas = canvas(elements, [connection("update-me", "target", "other")])
		const remoteCanvas = baseCanvas

		const result = mergeCanvasDocuments({ baseCanvas, localCanvas, remoteCanvas })

		expect(result.ok).toBe(true)
		if (!result.ok) return
		expect(result.mergedCanvas.connections).toEqual([
			connection("update-me", "target", "other"),
		])
	})

	it("returns a connection conflict when both sides update the same connection differently", () => {
		const elements = [rect("source"), rect("target"), rect("other")]
		const baseCanvas = canvas(elements, [connection("edge", "source", "target")])
		const localCanvas = canvas(elements, [connection("edge", "target", "other")])
		const remoteCanvas = canvas(elements, [connection("edge", "other", "source")])

		const result = mergeCanvasDocuments({ baseCanvas, localCanvas, remoteCanvas })

		expect(result).toEqual(
			expect.objectContaining({
				ok: false,
				isConnectionLevelConflict: true,
				reason: "same-connection-changed",
				connectionConflictIds: ["edge"],
			}),
		)
	})

	it("returns a connection delete-update conflict", () => {
		const elements = [rect("source"), rect("target"), rect("other")]
		const baseCanvas = canvas(elements, [connection("edge", "source", "target")])
		const localCanvas = canvas(elements)
		const remoteCanvas = canvas(elements, [connection("edge", "target", "other")])

		const result = mergeCanvasDocuments({ baseCanvas, localCanvas, remoteCanvas })

		expect(result).toEqual(
			expect.objectContaining({
				ok: false,
				isConnectionLevelConflict: true,
				reason: "connection-delete-update-conflict",
				connectionConflictIds: ["edge"],
			}),
		)
	})

	it("removes connections whose endpoint is deleted by the element merge", () => {
		const baseCanvas = canvas(
			[rect("source"), rect("target")],
			[connection("edge", "source", "target")],
		)
		const localCanvas = canvas([rect("source")], [connection("edge", "source", "target")])
		const remoteCanvas = baseCanvas

		const result = mergeCanvasDocuments({ baseCanvas, localCanvas, remoteCanvas })

		expect(result.ok).toBe(true)
		if (!result.ok) return
		expect(result.mergedCanvas.connections).toBeUndefined()
	})
})
