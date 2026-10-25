import { describe, expect, it, vi } from "vitest"
import { Canvas } from "../Canvas"
import { ElementManager } from "../../elements/core/ElementManager"
import { AudioElement } from "../../elements/audio/AudioElement"
import { ImageElement } from "../../elements/image/ImageElement"
import { RectangleElement } from "../../elements/shape/RectangleElement"
import { StoryboardElement } from "../../elements/storyboard/StoryboardElement"
import { VideoElement } from "../../elements/video/VideoElement"
import { VideoEditElement } from "../../elements/video-edit/VideoEditElement"
import { ElementTypeEnum, type LayerElement } from "../../document/types"
import { exportCanvasDocument } from "../../document/exportDocument"

function createPreviewCanvas(element: LayerElement) {
	const previewContentIds = new Map<string, string>()
	const rerender = vi.fn()
	const emit = vi.fn()
	const canvas = Object.create(Canvas.prototype) as Canvas
	Object.assign(canvas, {
		previewContentIds,
		permissionManager: {
			can: vi.fn(
				(capability: string) =>
					capability === "interaction.switchContent" || capability === "document.read",
			),
		},
		elementManager: {
			getElementData: vi.fn(() => element),
			getElementInstance: vi.fn(() => ({ rerender })),
			updateAllElementsDraggable: vi.fn(),
		},
		eventEmitter: { emit },
	})
	return { canvas, previewContentIds, rerender, emit }
}

function createElementManagerUpdateHarness(element: ImageElement | VideoElement, canvas: Canvas) {
	const manager = Object.create(ElementManager.prototype) as Record<string, unknown>
	manager.elements = new Map([[element.getData().id, element]])
	manager.canvas = canvas
	manager.normalizeUpdates = vi.fn((_element: unknown, updates: unknown) => updates)
	manager.mergeElementData = vi.fn(
		(currentData: Record<string, unknown>, updates: Record<string, unknown>) => ({
			...currentData,
			...updates,
		}),
	)
	manager.buildElementNameChange = vi.fn(() => undefined)
	manager.invalidateGeometryForElement = vi.fn()
	manager.scheduleContentLayerDraw = vi.fn()
	manager.emitEvent = vi.fn()
	manager.emitElementChange = vi.fn()
	return manager as unknown as {
		doUpdate: (
			elementId: string,
			updates: Record<string, unknown>,
			options: Record<string, unknown>,
		) => void
	}
}

describe("Canvas Content preview isolation", () => {
	it.each([
		[ElementTypeEnum.Image, "image-content-2", "/images/preview.png"],
		[ElementTypeEnum.Video, "video-content-2", "/videos/preview.mp4"],
		[ElementTypeEnum.Audio, "audio-content-2", "/audios/preview.mp3"],
	])(
		"projects %s preview content without mutating document data",
		(type, previewContentId, previewSrc) => {
			const element = {
				id: `${type}-1`,
				type,
				activeContentId: `${type}-content-1`,
				mainContentId: `${type}-content-1`,
				contents: [
					{ contentId: `${type}-content-1`, src: `/media/${type}/document` },
					{ contentId: previewContentId, src: previewSrc },
				],
			} as unknown as LayerElement
			const original = JSON.stringify(element)
			const { canvas, rerender, emit } = createPreviewCanvas(element)

			expect(canvas.setPreviewContent(element.id, previewContentId)).toBe(true)
			expect(canvas.getEffectiveContentId(element.id)).toBe(previewContentId)
			expect(canvas.getEffectiveContent(element.id)).toMatchObject({
				contentId: previewContentId,
				src: previewSrc,
			})
			expect(canvas.getElementForContentView(element)).toMatchObject({
				activeContentId: previewContentId,
			})
			expect(JSON.stringify(element)).toBe(original)
			expect(exportCanvasDocument([element]).elements[0].activeContentId).toBe(
				`${type}-content-1`,
			)
			expect(rerender).toHaveBeenCalledWith()
			expect(emit).toHaveBeenCalledWith({
				type: "content:previewChanged",
				data: { elementId: element.id, contentId: previewContentId },
			})

			canvas.clearPreviewContent(element.id)
			expect(canvas.getEffectiveContentId(element.id)).toBe(`${type}-content-1`)
			expect(JSON.stringify(element)).toBe(original)
			expect(rerender).toHaveBeenCalledTimes(2)
		},
	)

	it("uses the incoming active Content while ElementManager still holds the previous snapshot", () => {
		const element = {
			id: "image-1",
			type: ElementTypeEnum.Image,
			activeContentId: "image-content-1",
			mainContentId: "image-content-1",
			contents: [
				{ contentId: "image-content-1", src: "/images/one.png" },
				{ contentId: "image-content-2", src: "/images/two.png" },
			],
		} as unknown as LayerElement
		const { canvas } = createPreviewCanvas(element)
		const nextElement = { ...element, activeContentId: "image-content-2" }

		expect(canvas.getElementForContentView(nextElement)).toBe(nextElement)
	})

	it.each([
		[ElementTypeEnum.Image, ImageElement.prototype],
		[ElementTypeEnum.Video, VideoElement.prototype],
	] as const)("rerenders %s when ElementManager switches active Content", (type, prototype) => {
		const element = Object.create(prototype) as ImageElement | VideoElement
		const data = {
			id: `${type}-1`,
			type,
			activeContentId: `${type}-content-1`,
			mainContentId: `${type}-content-1`,
			contents: [
				{ contentId: `${type}-content-1`, src: `/media/${type}/one` },
				{ contentId: `${type}-content-2`, src: `/media/${type}/two` },
			],
		}
		const { canvas } = createPreviewCanvas(data as unknown as LayerElement)
		const rerenderWhenTransformIdle = vi.fn()
		;(canvas as unknown as { markerManager: unknown }).markerManager = {
			handleImageContentChanged: vi.fn(),
		}
		Object.assign(element, {
			data,
			canvas,
			rerenderWhenTransformIdle,
			resetRuntimeStateForContentChange: vi.fn(),
			isPersistedCropConfigEqual: vi.fn(() => true),
			isGenerating: false,
		})

		const manager = createElementManagerUpdateHarness(element, canvas)
		manager.doUpdate(data.id, { activeContentId: `${type}-content-2` }, {})

		expect(element.getData().activeContentId).toBe(`${type}-content-2`)
		expect(rerenderWhenTransformIdle).toHaveBeenCalledOnce()
	})

	it("resolves incoming active Content snapshots across ElementManager update paths", () => {
		const getElementForContentView = vi.fn(<T extends LayerElement>(data: T) => data)
		const canvas = {
			getElementForContentView,
			getEffectiveContentId: vi.fn(() => {
				throw new Error("update paths must not read ElementManager effective Content")
			}),
		} as unknown as Canvas

		const audioData = {
			id: "audio-1",
			type: ElementTypeEnum.Audio,
			width: 100,
			height: 40,
			activeContentId: "audio-content-1",
			mainContentId: "audio-content-1",
			contents: [
				{ contentId: "audio-content-1", src: "/audio/one.mp3" },
				{ contentId: "audio-content-2", src: "/audio/two.mp3" },
			],
		} as never
		const audio = Object.create(AudioElement.prototype) as AudioElement
		const syncEffectiveContentSource = vi.fn()
		Object.assign(audio, { data: audioData, canvas, node: null, syncEffectiveContentSource })
		audio.update({ ...audioData, activeContentId: "audio-content-2" })
		expect(syncEffectiveContentSource).toHaveBeenCalledWith("/audio/two.mp3")

		const videoEditData = {
			id: "video-edit-1",
			type: ElementTypeEnum.VideoEdit,
			width: 100,
			height: 100,
			activeContentId: "video-edit-content-1",
			mainContentId: "video-edit-content-1",
			contents: [
				{
					contentId: "video-edit-content-1",
					videoSequence: ["video-1"],
					audioElementId: "audio-1",
				},
				{
					contentId: "video-edit-content-2",
					videoSequence: ["video-1"],
					audioElementId: "audio-2",
				},
			],
		} as never
		const videoEdit = Object.create(VideoEditElement.prototype) as VideoEditElement
		const bindAudioRuntime = vi.fn()
		Object.assign(videoEdit, {
			data: videoEditData,
			canvas,
			node: null,
			collectInputs: (content: { videoSequence?: string[]; audioElementId?: string }) => ({
				videoSequence: content?.videoSequence ?? [],
				audioElementId: content?.audioElementId,
			}),
			bindAudioRuntime,
			canLoadVideoPreviews: vi.fn(() => false),
		})
		videoEdit.update({ ...videoEditData, activeContentId: "video-edit-content-2" })
		expect(bindAudioRuntime).toHaveBeenCalledOnce()

		const storyboardData = {
			id: "storyboard-1",
			type: ElementTypeEnum.Storyboard,
			width: 100,
			height: 100,
			activeContentId: "storyboard-content-1",
			mainContentId: "storyboard-content-1",
			contents: [
				{
					contentId: "storyboard-content-1",
					generationConfig: { prompt: "one" },
					shots: [],
				},
				{
					contentId: "storyboard-content-2",
					generationConfig: { prompt: "two" },
					shots: [],
				},
			],
		} as never
		const storyboard = Object.create(StoryboardElement.prototype) as StoryboardElement
		Object.assign(storyboard, { data: storyboardData, canvas, node: null })
		expect(
			storyboard.update({ ...storyboardData, activeContentId: "storyboard-content-2" }),
		).toBe(true)

		const rectangleData = {
			id: "rectangle-1",
			type: ElementTypeEnum.Rectangle,
			width: 100,
			height: 100,
			activeContentId: "rectangle-content-1",
			mainContentId: "rectangle-content-1",
			contents: [
				{ contentId: "rectangle-content-1", fill: "red" },
				{ contentId: "rectangle-content-2", fill: "blue" },
			],
		} as never
		const rectangle = Object.create(RectangleElement.prototype) as RectangleElement
		Object.assign(rectangle, { data: rectangleData, canvas, node: null })
		const nextRectangleData = { ...rectangleData, activeContentId: "rectangle-content-2" }
		rectangle.update(nextRectangleData)
		expect(getElementForContentView).toHaveBeenLastCalledWith(nextRectangleData)
	})

	it("clears session preview when write access is restored", () => {
		let canWrite = false
		const element = {
			id: "image-1",
			type: ElementTypeEnum.Image,
			activeContentId: "content-1",
			mainContentId: "content-1",
			contents: [
				{ contentId: "content-1", src: "one.png" },
				{ contentId: "content-2", src: "two.png" },
			],
		} as unknown as LayerElement
		const { canvas, previewContentIds } = createPreviewCanvas(element)
		canvas.permissionManager = {
			can: vi.fn((capability: string) =>
				capability === "document.write" ? canWrite : capability === "document.read",
			),
			setAccessContext: vi.fn(() => true),
			getContext: vi.fn(() => ({ mode: "edit", capabilities: new Set(), can: () => true })),
		} as never
		Object.assign(canvas, {
			mediaPlaybackCoordinator: { pauseAll: vi.fn() },
			cropManager: { cancelCrop: vi.fn() },
			extendManager: { cancelExtend: vi.fn() },
			eraserManager: { cancelEraser: vi.fn() },
			mediaReplaceController: { cancel: vi.fn() },
			elementRenameManager: { cancelRename: vi.fn() },
			toolManager: { setActiveToolByType: vi.fn() },
			selectionManager: { deselectAll: vi.fn() },
		})
		previewContentIds.set(element.id, "content-2")
		canWrite = true

		Canvas.prototype.setAccessContext.call(canvas, { mode: "edit" })

		expect(previewContentIds).toEqual(new Map())
	})
})
