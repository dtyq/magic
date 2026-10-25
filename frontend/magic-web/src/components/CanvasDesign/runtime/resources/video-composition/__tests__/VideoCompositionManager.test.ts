import { describe, expect, it, vi } from "vitest"
import type { Canvas } from "../../../core/Canvas"
import { EventEmitter } from "../../../core/EventEmitter"
import { ElementTypeEnum, type LayerElement } from "../../../document/types"
import { VideoElement } from "../../../elements/video/VideoElement"
import { VideoCompositionManager } from "../VideoCompositionManager"

function createVideo(id: string): LayerElement {
	return {
		id,
		type: ElementTypeEnum.Video,
		width: 320,
		height: 180,
		contents: [{ contentId: `${id}-content`, src: `./videos/${id}.mp4` }],
		activeContentId: `${id}-content`,
		mainContentId: `${id}-content`,
	} as LayerElement
}

function createEditor(id = "editor"): LayerElement {
	return {
		id,
		type: ElementTypeEnum.VideoEdit,
		width: 640,
		height: 360,
		contents: [{ contentId: `${id}-content`, videoSequence: ["video-1"] }],
		activeContentId: `${id}-content`,
		mainContentId: `${id}-content`,
	} as LayerElement
}

function createAudio(id: string): LayerElement {
	return {
		id,
		type: ElementTypeEnum.Audio,
		contents: [{ contentId: `${id}-content`, src: `./audios/${id}.mp3` }],
		activeContentId: `${id}-content`,
		mainContentId: `${id}-content`,
	} as LayerElement
}

function createCanvas(
	elements: LayerElement[],
	resultInstance?: VideoElement,
	videoMetadata?: { videoWidth: number; videoHeight: number },
) {
	const eventEmitter = new EventEmitter()
	const elementMap = new Map(elements.map((element) => [element.id, element]))
	const inputElements = elements.filter(
		(element) =>
			element.type === ElementTypeEnum.Video || element.type === ElementTypeEnum.Audio,
	)
	const canvas = {
		eventEmitter,
		t: (_key: string, fallback: string) => fallback,
		elementManager: {
			getElementData: vi.fn((id: string) => elementMap.get(id)),
			getAllElementIds: vi.fn(() => Array.from(elementMap.keys())),
			getNextZIndexInLevel: vi.fn(() => 1),
			hasElement: vi.fn((id: string) => elementMap.has(id)),
			isElementVisibleInDataTree: vi.fn((id: string) => elementMap.has(id)),
			getElementInstance: vi.fn(() => resultInstance),
			createTemporaryElement: vi.fn((element: LayerElement) =>
				elementMap.set(element.id, element),
			),
			delete: vi.fn((id: string) => elementMap.delete(id)),
		},
		connectionManager: {
			getUpstreamConnections: vi.fn((id: string) =>
				id === "editor"
					? inputElements.map((element) => ({
							id: `${element.id}-connection`,
							sourceElementId: element.id,
							targetElementId: id,
						}))
					: [],
			),
			connectRuntimeElements: vi.fn(() => ({
				status: "created",
				connectionId: "runtime-1",
			})),
			removeConnections: vi.fn(),
			promoteRuntimeConnection: vi.fn(),
		},
		geometryCacheManager: { getElementBounds: vi.fn(() => null) },
		historyManager: { runTransaction: vi.fn() },
		videoResourceManager: {
			getCachedMetadata: vi.fn(() =>
				videoMetadata ? { duration: 1, ...videoMetadata } : null,
			),
		},
	} as unknown as Canvas
	return canvas
}

describe("VideoCompositionManager", () => {
	it("keeps a stable idle snapshot and reports missing inputs", async () => {
		const canvas = createCanvas([createEditor()])
		const manager = new VideoCompositionManager({ canvas })

		expect(manager.getSnapshot("editor")).toEqual({
			status: "idle",
			progress: 0,
			issues: [],
		})
		expect(await manager.start("editor")).toBe(false)
		expect(manager.getSnapshot("editor").issues[0]?.code).toBe("missing-video")
		manager.destroy()
	})

	it("submits a self-contained composition request in persisted sequence order", async () => {
		const editor = createEditor()
		editor.contents[0] = {
			...editor.contents[0],
			videoSequence: ["video-2", "video-1"],
			audioSequence: ["audio-1"],
		}
		const resultInstance = Object.create(VideoElement.prototype) as VideoElement
		resultInstance.generateVideo = vi.fn(async () => true)
		const canvas = createCanvas(
			[editor, createVideo("video-1"), createVideo("video-2"), createAudio("audio-1")],
			resultInstance,
		)
		const manager = new VideoCompositionManager({ canvas })

		expect(await manager.start("editor")).toBe(true)
		expect(resultInstance.generateVideo).toHaveBeenCalledWith(
			expect.objectContaining({
				generation_type: "canvas_composition",
				composition: {
					videos: [{ path: "./videos/video-2.mp4" }, { path: "./videos/video-1.mp4" }],
					audios: [{ path: "./audios/audio-1.mp3" }],
				},
			}),
			expect.objectContaining({
				failurePolicy: "remove-placeholder",
				keepTemporaryUntilComplete: true,
			}),
		)
		manager.destroy()
	})

	it("submits without waiting for a canvas save hook", async () => {
		const resultInstance = Object.create(VideoElement.prototype) as VideoElement
		resultInstance.generateVideo = vi.fn(async () => true)
		const canvas = createCanvas([createEditor(), createVideo("video-1")], resultInstance)
		const manager = new VideoCompositionManager({ canvas })

		expect(await manager.start("editor")).toBe(true)
		expect(canvas.elementManager.createTemporaryElement).toHaveBeenCalledOnce()
		expect(manager.getSnapshot("editor")).toMatchObject({
			status: "processing",
			resultElementId: expect.any(String),
		})
		manager.destroy()
	})

	it("creates the result placeholder with the first video's real aspect ratio", async () => {
		const editor = createEditor()
		const source = createVideo("video-1")
		const resultInstance = Object.create(VideoElement.prototype) as VideoElement
		resultInstance.generateVideo = vi.fn(async () => true)
		const canvas = createCanvas([editor, source], resultInstance, {
			videoWidth: 1080,
			videoHeight: 1920,
		})
		const manager = new VideoCompositionManager({ canvas })

		expect(await manager.start("editor")).toBe(true)
		const result = vi.mocked(canvas.elementManager.createTemporaryElement).mock.calls[0]?.[0]

		expect(result).toBeDefined()
		expect(result?.width).toBe(320)
		expect(result?.height).toBe(569)
		expect((result?.width ?? 0) / (result?.height ?? 1)).toBeCloseTo(1080 / 1920, 3)
		manager.destroy()
	})
})
