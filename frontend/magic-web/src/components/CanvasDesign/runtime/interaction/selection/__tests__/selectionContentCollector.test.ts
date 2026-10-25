import { describe, expect, it, vi } from "vitest"
import { ElementTypeEnum, type LayerElement } from "../../../document/types"
import type { Canvas } from "../../../core/Canvas"
import { collectSelectionContentSnapshot } from "../selectionContentCollector"

function mediaElement(
	id: string,
	type:
		| typeof ElementTypeEnum.Image
		| typeof ElementTypeEnum.Video
		| typeof ElementTypeEnum.Audio,
	src = `/${id}.media`,
): LayerElement {
	return {
		id,
		type,
		x: 0,
		y: 0,
		width: 100,
		height: 80,
		activeContentId: `${id}-content`,
		mainContentId: `${id}-content`,
		contents: [{ contentId: `${id}-content`, src }],
	} as LayerElement
}

function createCanvas(elements: LayerElement[], roots: LayerElement[]): Canvas {
	const elementMap = new Map(elements.map((element) => [element.id, element]))
	return {
		elementManager: {
			getAllElements: vi.fn(() => roots),
			getElementData: vi.fn((id: string) => elementMap.get(id)),
			hasElement: vi.fn((id: string) => elementMap.has(id)),
			isElementVisibleInDataTree: vi.fn(() => true),
			canParticipateInDocumentRelations: vi.fn(() => true),
			getNodeAdapter: vi.fn(() => ({
				getElementsBounds: vi.fn(() => ({ x: 10, y: 20, width: 400, height: 200 })),
			})),
		},
		getEffectiveContent: vi.fn((id: string) => {
			const element = elementMap.get(id)
			if (!element || !("contents" in element) || !Array.isArray(element.contents))
				return undefined
			return (
				element.contents.find((content) => content.contentId === element.activeContentId) ??
				element.contents[0]
			)
		}),
		permissionManager: {
			canConnect: vi.fn(() => true),
		},
	} as unknown as Canvas
}

describe("collectSelectionContentSnapshot", () => {
	it("expands nested containers, deduplicates content, and preserves document order", () => {
		const video1 = mediaElement("video-1", ElementTypeEnum.Video)
		const video2 = mediaElement("video-2", ElementTypeEnum.Video)
		const audio = mediaElement("audio-1", ElementTypeEnum.Audio)
		const group = {
			id: "group-1",
			type: ElementTypeEnum.Group,
			children: [video2, video1, audio],
		} as LayerElement
		const frame = {
			id: "frame-1",
			type: ElementTypeEnum.Frame,
			children: [video1, group],
		} as LayerElement
		const video3 = mediaElement("video-3", ElementTypeEnum.Video)
		const canvas = createCanvas([frame, group, video1, video2, audio, video3], [frame, video3])

		const snapshot = collectSelectionContentSnapshot(canvas, ["video-3", "frame-1"])

		expect(snapshot.rootElementIds).toEqual(["frame-1", "video-3"])
		expect(snapshot.items.map((item) => item.elementId)).toEqual([
			"video-1",
			"video-2",
			"audio-1",
			"video-3",
		])
		expect(snapshot.imageSequence).toEqual([])
		expect(snapshot.videoSequence).toEqual(["video-1", "video-2", "video-3"])
		expect(snapshot.mainVideoSequence).toEqual(["video-1", "video-2", "video-3"])
		expect(snapshot.audioSequence).toEqual(["audio-1"])
		expect(snapshot.counts).toEqual({ image: 0, video: 3, audio: 1, text: 0 })
		expect(snapshot.boundingRect).toEqual({ x: 10, y: 20, width: 400, height: 200 })
	})

	it("excludes unavailable video content from the recipe sequence", () => {
		const available = mediaElement("video-1", ElementTypeEnum.Video)
		const unavailable = mediaElement("video-2", ElementTypeEnum.Video, "")
		const canvas = createCanvas([available, unavailable], [available, unavailable])

		const snapshot = collectSelectionContentSnapshot(canvas, ["video-1", "video-2"])

		expect(snapshot.videoSequence).toEqual(["video-1"])
		expect(snapshot.mainVideoSequence).toEqual(["video-1"])
		expect(snapshot.imageSequence).toEqual([])
		const unavailableItem = snapshot.items.find((item) => item.elementId === "video-2")
		expect(unavailableItem?.activeContent?.contentId).toBe("video-2-content")
		expect(unavailableItem?.ready).toBe(false)
		expect(snapshot.counts.video).toBe(2)
	})

	it("uses main content availability for video continuation independently of active content", () => {
		const video = {
			id: "video-versioned",
			type: ElementTypeEnum.Video,
			x: 0,
			y: 0,
			width: 100,
			height: 80,
			activeContentId: "active-content",
			mainContentId: "main-content",
			contents: [
				{ contentId: "active-content", src: "", status: "failed" },
				{ contentId: "main-content", src: "/main-video.mp4", status: "completed" },
			],
		} as LayerElement
		const canvas = createCanvas([video], [video])

		const snapshot = collectSelectionContentSnapshot(canvas, [video.id])

		expect(snapshot.videoSequence).toEqual([])
		expect(snapshot.mainVideoSequence).toEqual([video.id])
		expect(snapshot.items[0]).toMatchObject({
			activeContent: { contentId: "active-content" },
			mainContent: { contentId: "main-content" },
			ready: false,
			mainReady: true,
		})
	})

	it("protects against cyclic container references", () => {
		const video = mediaElement("video-1", ElementTypeEnum.Video)
		const groupA = {
			id: "group-a",
			type: ElementTypeEnum.Group,
			children: [] as LayerElement[],
		} as LayerElement
		const groupB = {
			id: "group-b",
			type: ElementTypeEnum.Group,
			children: [groupA, video],
		} as LayerElement
		;(groupA as LayerElement & { children: LayerElement[] }).children = [groupB]
		const canvas = createCanvas([groupA, groupB, video], [groupA])

		const snapshot = collectSelectionContentSnapshot(canvas, [groupA.id])

		expect(snapshot.items.map((item) => item.elementId)).toEqual([video.id])
		expect(snapshot.items[0]?.rootElementId).toBe(groupA.id)
		expect(snapshot.videoSequence).toEqual([video.id])
	})

	it("collects only visible images with usable downstream content", () => {
		const ready = mediaElement("image-ready", ElementTypeEnum.Image)
		const unavailable = mediaElement("image-unavailable", ElementTypeEnum.Image, "")
		const hidden = {
			...mediaElement("image-hidden", ElementTypeEnum.Image),
			visible: false,
		} as LayerElement
		const nestedHidden = mediaElement("image-nested-hidden", ElementTypeEnum.Image)
		const hiddenGroup = {
			id: "group-hidden",
			type: ElementTypeEnum.Group,
			visible: false,
			children: [nestedHidden],
		} as LayerElement
		const frame = {
			id: "frame-1",
			type: ElementTypeEnum.Frame,
			children: [unavailable, hidden, hiddenGroup, ready],
		} as LayerElement
		const canvas = createCanvas(
			[frame, hiddenGroup, unavailable, hidden, nestedHidden, ready],
			[frame],
		)

		const snapshot = collectSelectionContentSnapshot(canvas, [frame.id])

		expect(snapshot.items.map((item) => item.elementId)).toEqual([unavailable.id, ready.id])
		expect(snapshot.imageSequence).toEqual([ready.id])
		expect(snapshot.counts.image).toBe(2)
	})

	it("uses downstream content for storyboard availability while retaining active content", () => {
		const image = {
			id: "image-versioned",
			type: ElementTypeEnum.Image,
			x: 0,
			y: 0,
			width: 100,
			height: 80,
			activeContentId: "active-content",
			mainContentId: "main-content",
			contents: [
				{ contentId: "active-content", src: "" },
				{ contentId: "main-content", src: "/main-image.png", status: "processing" },
			],
		} as LayerElement
		const canvas = createCanvas([image], [image])

		const snapshot = collectSelectionContentSnapshot(canvas, [image.id])

		expect(snapshot.items[0]?.activeContent?.contentId).toBe("active-content")
		expect(snapshot.items[0]?.ready).toBe(false)
		expect(snapshot.imageSequence).toEqual([image.id])
	})
})
