import { describe, expect, it } from "vitest"
import type { Canvas } from "../../../core/Canvas"
import { ElementTypeEnum, type ImageElement, type StoryboardElement } from "../../../document/types"
import { isStoryboardOutputFrame } from "../storyboardOutputFrame"

function createImage(id: string, src = `./images/${id}.png`): ImageElement {
	return {
		id,
		type: ElementTypeEnum.Image,
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		contents: [{ contentId: `${id}-content`, src, status: "completed" }],
		activeContentId: `${id}-content`,
		mainContentId: `${id}-content`,
	}
}

function createStoryboard(id: string, imageIds: string[]): StoryboardElement {
	return {
		id,
		type: ElementTypeEnum.Storyboard,
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		contents: [
			{
				contentId: `${id}-content`,
				shots: imageIds.map((imageId, index) => ({
					id: `${id}-shot-${index}`,
					description: `shot ${index}`,
					outputImageElementId: imageId,
				})),
			},
		],
		activeContentId: `${id}-content`,
		mainContentId: `${id}-content`,
	}
}

function createCanvas(options: {
	frameChildren: ReturnType<typeof createImage>[]
	storyboards: StoryboardElement[]
	connections?: Record<string, string[]>
}): Canvas {
	const elements = new Map<string, unknown>()
	const frame = {
		id: "output-frame",
		name: "renamed-output-frame",
		type: ElementTypeEnum.Frame,
		x: 500,
		y: 0,
		width: 200,
		height: 400,
		children: options.frameChildren,
	}
	elements.set(frame.id, frame)
	options.frameChildren.forEach((image) => elements.set(image.id, image))
	options.storyboards.forEach((storyboard) => elements.set(storyboard.id, storyboard))

	return {
		elementManager: {
			getAllElementIds: () => [...elements.keys()],
			getElementData: (elementId: string) => elements.get(elementId),
		},
		connectionManager: {
			getUpstreamConnections: (elementId: string) =>
				(options.connections?.[elementId] ?? []).map((sourceElementId, index) => ({
					id: `connection-${elementId}-${index}`,
					sourceElementId,
					targetElementId: elementId,
				})),
		},
	} as unknown as Canvas
}

describe("isStoryboardOutputFrame", () => {
	it("recognizes a renamed frame containing outputs from one storyboard", () => {
		const imageOne = createImage("image-1")
		const imageTwo = createImage("image-2")
		const storyboard = createStoryboard("storyboard-1", [imageOne.id, imageTwo.id])

		const canvas = createCanvas({
			frameChildren: [imageOne, imageTwo],
			storyboards: [storyboard],
			connections: {
				[imageOne.id]: [storyboard.id],
				[imageTwo.id]: [storyboard.id],
			},
		})

		expect(isStoryboardOutputFrame(canvas, "output-frame")).toBe(true)
	})

	it("rejects an ordinary image frame", () => {
		const image = createImage("image-1")
		const canvas = createCanvas({ frameChildren: [image], storyboards: [] })

		expect(isStoryboardOutputFrame(canvas, "output-frame")).toBe(false)
	})

	it("rejects mixed storyboard outputs", () => {
		const imageOne = createImage("image-1")
		const imageTwo = createImage("image-2")
		const storyboardOne = createStoryboard("storyboard-1", [imageOne.id])
		const storyboardTwo = createStoryboard("storyboard-2", [imageTwo.id])

		const canvas = createCanvas({
			frameChildren: [imageOne, imageTwo],
			storyboards: [storyboardOne, storyboardTwo],
			connections: {
				[imageOne.id]: [storyboardOne.id],
				[imageTwo.id]: [storyboardTwo.id],
			},
		})

		expect(isStoryboardOutputFrame(canvas, "output-frame")).toBe(false)
	})

	it("rejects missing output connections but keeps empty valid outputs identifiable", () => {
		const image = createImage("image-1")
		const storyboard = createStoryboard("storyboard-1", [image.id])
		const canvasWithoutConnection = createCanvas({
			frameChildren: [image],
			storyboards: [storyboard],
		})
		expect(isStoryboardOutputFrame(canvasWithoutConnection, "output-frame")).toBe(false)

		const emptyImage = createImage("empty-image", "")
		const canvasWithEmptyImage = createCanvas({
			frameChildren: [emptyImage],
			storyboards: [createStoryboard("storyboard-1", [emptyImage.id])],
			connections: { [emptyImage.id]: ["storyboard-1"] },
		})
		expect(isStoryboardOutputFrame(canvasWithEmptyImage, "output-frame")).toBe(true)

		const ordinaryEmptyFrame = createCanvas({ frameChildren: [emptyImage], storyboards: [] })
		expect(isStoryboardOutputFrame(ordinaryEmptyFrame, "output-frame")).toBe(false)
	})
})
