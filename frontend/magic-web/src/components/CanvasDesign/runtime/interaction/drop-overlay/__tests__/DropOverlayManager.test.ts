import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { toast } from "sonner"
import {
	ElementTypeEnum,
	type AudioElement,
	type ImageElement,
	type LayerElement,
	type VideoElement,
} from "../../../document/types"
import type { Canvas } from "../../../core/Canvas"
import { DropOverlayManager } from "../DropOverlayManager"

vi.mock("sonner", () => ({
	toast: {
		loading: vi.fn(() => "drop-toast-id"),
		dismiss: vi.fn(),
		error: vi.fn(),
		warning: vi.fn(),
	},
}))

interface Deferred<T> {
	promise: Promise<T>
	resolve: (value: T) => void
	reject: (error: unknown) => void
}

function createDeferred<T>(): Deferred<T> {
	let resolve!: (value: T) => void
	let reject!: (error: unknown) => void
	const promise = new Promise<T>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise
		reject = rejectPromise
	})
	return { promise, resolve, reject }
}

function createDragEvent(type: string, dataTransfer?: Partial<DataTransfer>): DragEvent {
	const event = new Event(type, { bubbles: true, cancelable: true }) as DragEvent
	Object.defineProperty(event, "dataTransfer", {
		value: dataTransfer,
	})
	return event
}

function createDropHarness(options: {
	getFileInfo: ReturnType<typeof vi.fn>
	getAssetResource?: ReturnType<typeof vi.fn>
	imageDimensions?: { width: number; height: number }
	videoDimensions?: { width: number; height: number }
}) {
	const elements = new Map<string, LayerElement>()
	const historyManager = {
		disable: vi.fn(),
		enable: vi.fn(),
		recordHistoryImmediate: vi.fn(),
	}
	const selectionManager = {
		selectMultiple: vi.fn(),
	}
	const elementManager = {
		getElementsDict: vi.fn(() => Object.fromEntries(elements)),
		getMaxZIndexInLevel: vi.fn(() => 0),
		create: vi.fn((element: LayerElement) => {
			elements.set(element.id, element)
		}),
	}
	const imageResourceManager = {
		primeCache: vi.fn(),
		loadResource: vi.fn(),
	}
	const videoResourceManager = {
		primeCache: vi.fn(),
		loadResource: vi.fn(),
	}
	const audioResourceManager = {
		primeCache: vi.fn(),
	}
	const assetResourceManager = {
		getResource: options.getAssetResource ?? vi.fn(),
	}
	const overlayHost = document.createElement("div")
	const canvasContainer = document.createElement("div")
	overlayHost.appendChild(canvasContainer)
	const canvas = {
		permissionManager: { can: vi.fn(() => true) },
		container: canvasContainer,
		elementManager,
		historyManager,
		selectionManager,
		imageResourceManager,
		videoResourceManager,
		audioResourceManager,
		assetResourceManager,
		magicConfigManager: {
			config: {
				methods: {
					getFileInfo: options.getFileInfo,
				},
			},
		},
		t: vi.fn((_key: string, fallback: string) => fallback),
	}
	const manager = Object.create(DropOverlayManager.prototype) as unknown as {
		canvas: typeof canvas
		handleCustomDragData: (
			filePaths: string[],
			anchorPosition: { x: number; y: number },
		) => Promise<void>
		getImageDimensionsFromUrl: (path: string) => Promise<{ width: number; height: number }>
		getVideoDimensionsFromUrl: (src: string) => Promise<{ width: number; height: number }>
		getOverlayHostElement: () => HTMLElement
		createOverlayElement: (text: string, centerX: number, centerY: number) => HTMLDivElement
	}
	manager.canvas = canvas
	manager.getImageDimensionsFromUrl = vi.fn(
		async () => options.imageDimensions ?? { width: 400, height: 200 },
	)
	manager.getVideoDimensionsFromUrl = vi.fn(
		async () => options.videoDimensions ?? { width: 1920, height: 1080 },
	)

	return {
		manager,
		canvas,
		elements,
		historyManager,
		selectionManager,
		overlayHost,
	}
}

describe("DropOverlayManager custom attachment drops", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.spyOn(console, "log").mockImplementation(() => undefined)
		vi.spyOn(console, "warn").mockImplementation(() => undefined)
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("shows a loading toast and creates elements only after preload completes", async () => {
		const imageInfo = createDeferred<{ src: string; fileName: string }>()
		const videoInfo = createDeferred<{ src: string; fileName: string }>()
		const getFileInfo = vi.fn((path: string) =>
			path.endsWith(".mp4") ? videoInfo.promise : imageInfo.promise,
		)
		const harness = createDropHarness({ getFileInfo })

		const dropPromise = harness.manager.handleCustomDragData(
			["/outside/photo.png", "/outside/clip.mp4"],
			{ x: 100, y: 200 },
		)

		expect(harness.elements.size).toBe(0)
		expect(toast.loading).toHaveBeenCalledWith("正在加载媒体文件，请稍候...")
		expect(harness.historyManager.recordHistoryImmediate).not.toHaveBeenCalled()

		imageInfo.resolve({ src: "https://example.test/photo.png", fileName: "photo.png" })
		videoInfo.resolve({ src: "https://example.test/clip.mp4", fileName: "clip.mp4" })
		await dropPromise

		const elements = Array.from(harness.elements.values())
		expect(elements).toHaveLength(2)
		const imageElement = elements[0]
		const videoElement = elements[1]
		if (imageElement?.type !== ElementTypeEnum.Image) throw new Error("Expected image")
		if (videoElement?.type !== ElementTypeEnum.Video) throw new Error("Expected video")
		expect(elements[0]).toMatchObject({
			width: 400,
			height: 200,
		})
		expect((imageElement as ImageElement).contents[0]?.src).toBe("/outside/photo.png")
		expect(elements[1]).toMatchObject({
			width: 1920,
			height: 1080,
		})
		expect((videoElement as VideoElement).contents[0]?.src).toBe("/outside/clip.mp4")
		expect(harness.selectionManager.selectMultiple).toHaveBeenCalledWith(
			elements.map(({ id }) => id),
		)
		expect(harness.historyManager.recordHistoryImmediate).toHaveBeenCalledTimes(1)
		expect(toast.dismiss).toHaveBeenCalledWith("drop-toast-id")
		expect(harness.canvas.imageResourceManager.primeCache).toHaveBeenCalledTimes(1)
		expect(harness.canvas.videoResourceManager.primeCache).toHaveBeenCalledTimes(1)
	})

	it("uses the requested fallback dimensions without a later resize", async () => {
		const harness = createDropHarness({
			getFileInfo: vi.fn(async () => ({
				src: "https://example.test/photo.png",
				fileName: "photo.png",
			})),
		})
		harness.manager.getImageDimensionsFromUrl = vi.fn(async () => {
			throw new Error("dimensions unavailable")
		})

		await harness.manager.handleCustomDragData(["/outside/photo.png"], {
			x: 100,
			y: 200,
		})

		const [element] = harness.elements.values()
		expect(element).toMatchObject({ width: 1024, height: 1024 })
		expect(toast.dismiss).toHaveBeenCalledWith("drop-toast-id")
	})

	it("creates project audio directly at the fixed card size", async () => {
		const harness = createDropHarness({
			getFileInfo: vi.fn(async () => ({
				src: "https://example.test/voice.mp3",
				fileName: "voice.mp3",
			})),
		})

		await harness.manager.handleCustomDragData(["./audios/voice.mp3"], {
			x: 100,
			y: 200,
		})

		const [element] = harness.elements.values()
		if (element?.type !== ElementTypeEnum.Audio) throw new Error("Expected audio")
		expect(element).toMatchObject({
			type: "audio",
			width: 1280,
			height: 720,
		})
		expect(element).not.toHaveProperty("name")
		expect((element as AudioElement).contents[0]?.src).toBe("./audios/voice.mp3")
		expect(harness.canvas.audioResourceManager.primeCache).toHaveBeenCalledTimes(1)
		expect(harness.canvas.imageResourceManager.loadResource).not.toHaveBeenCalled()
		expect(harness.canvas.videoResourceManager.loadResource).not.toHaveBeenCalled()
	})

	it("uses asset metadata to create a video without workspace lookup or URL cache priming", async () => {
		const getFileInfo = vi.fn()
		const getAssetResource = vi.fn(async () => ({
			assetId: "asset-video-1",
			mediaType: "video",
			fileUrl: "https://assets.test/video-1",
			fileName: "library-video.mp4",
		}))
		const harness = createDropHarness({ getFileInfo, getAssetResource })

		await harness.manager.handleCustomDragData([" asset://asset-video-1 "], {
			x: 100,
			y: 200,
		})

		const [element] = harness.elements.values()
		if (element?.type !== ElementTypeEnum.Video) throw new Error("Expected video")
		expect((element as VideoElement).contents[0]?.src).toBe("asset://asset-video-1")
		expect(getAssetResource).toHaveBeenCalledWith("asset-video-1")
		expect(getFileInfo).not.toHaveBeenCalled()
		expect(harness.canvas.videoResourceManager.primeCache).not.toHaveBeenCalled()
		expect(harness.canvas.videoResourceManager.loadResource).toHaveBeenCalledWith(
			"asset://asset-video-1",
		)
	})

	it("rejects a malformed asset scheme before workspace lookup", async () => {
		const getFileInfo = vi.fn()
		const harness = createDropHarness({ getFileInfo })

		await harness.manager.handleCustomDragData(["asset://asset-video-1/child"], {
			x: 100,
			y: 200,
		})

		expect(harness.elements.size).toBe(0)
		expect(getFileInfo).not.toHaveBeenCalled()
		expect(toast.error).toHaveBeenCalledWith("媒体文件加载失败，请重试", {
			id: "drop-toast-id",
		})
	})

	it("shows an error toast and creates nothing when preload fails", async () => {
		const failure = new Error("file info failed")
		const harness = createDropHarness({
			getFileInfo: vi.fn(async () => Promise.reject(failure)),
		})

		await harness.manager.handleCustomDragData(["/outside/photo.png"], {
			x: 100,
			y: 200,
		})

		expect(harness.elements.size).toBe(0)
		expect(toast.error).toHaveBeenCalledWith("媒体文件加载失败，请重试", {
			id: "drop-toast-id",
		})
		expect(harness.historyManager.recordHistoryImmediate).not.toHaveBeenCalled()
	})

	it("mounts the drop overlay above the canvas stacking context", () => {
		const harness = createDropHarness({ getFileInfo: vi.fn() })
		const overlay = harness.manager.createOverlayElement("drop", 0, 0)

		expect(harness.manager.getOverlayHostElement()).toBe(harness.overlayHost)
		expect(overlay.style.zIndex).toBe("9999")
		expect(overlay.style.pointerEvents).toBe("none")
	})

	it("keeps the drop overlay visible when dragging from the canvas onto the element toolbar", () => {
		const overlayHost = document.createElement("div")
		const canvasContainer = document.createElement("div")
		const elementToolbar = document.createElement("div")
		overlayHost.append(canvasContainer, elementToolbar)

		const manager = new DropOverlayManager({
			canvas: {
				permissionManager: { can: vi.fn(() => true) },
				container: canvasContainer,
				can: vi.fn(() => true),
				viewportController: {
					getResolvedDefaultViewportPadding: vi.fn(() => ({
						left: 0,
						right: 0,
						top: 0,
						bottom: 0,
					})),
				},
				t: vi.fn((_key: string, fallback: string) => fallback),
			} as unknown as Canvas,
		})
		const dataTransfer = { types: ["text/plain"] } as Partial<DataTransfer>

		canvasContainer.dispatchEvent(createDragEvent("dragenter", dataTransfer))
		expect(overlayHost.children).toHaveLength(3)

		elementToolbar.dispatchEvent(createDragEvent("dragenter", dataTransfer))
		canvasContainer.dispatchEvent(createDragEvent("dragleave", dataTransfer))
		expect(overlayHost.children).toHaveLength(3)

		elementToolbar.dispatchEvent(createDragEvent("dragleave", dataTransfer))
		expect(overlayHost.children).toHaveLength(2)

		manager.destroy()
		canvasContainer.dispatchEvent(createDragEvent("dragenter", dataTransfer))
		expect(overlayHost.children).toHaveLength(2)
	})

	it("yields project-file drops to nested image and video editor drop surfaces", () => {
		const overlayHost = document.createElement("div")
		const canvasContainer = document.createElement("div")
		const editorDropSurface = document.createElement("div")
		editorDropSurface.setAttribute("data-canvas-resource-drop-surface", "")
		overlayHost.append(canvasContainer, editorDropSurface)
		const getDataTransferFileInfo = vi.fn()
		const nestedDropHandler = vi.fn((event: Event) => event.preventDefault())
		editorDropSurface.addEventListener("drop", nestedDropHandler)

		const manager = new DropOverlayManager({
			canvas: {
				permissionManager: { can: vi.fn(() => true) },
				container: canvasContainer,
				can: vi.fn(() => true),
				magicConfigManager: {
					config: { methods: { getDataTransferFileInfo } },
				},
			} as unknown as Canvas,
		})
		const dataTransfer = { types: ["text/plain"] } as Partial<DataTransfer>

		editorDropSurface.dispatchEvent(createDragEvent("dragenter", dataTransfer))
		expect(overlayHost.children).toHaveLength(2)

		editorDropSurface.dispatchEvent(createDragEvent("drop", dataTransfer))
		expect(nestedDropHandler).toHaveBeenCalledTimes(1)
		expect(getDataTransferFileInfo).not.toHaveBeenCalled()

		manager.destroy()
	})

	it("restores the canvas drop overlay after moving through a nested editor", () => {
		const overlayHost = document.createElement("div")
		const canvasContainer = document.createElement("div")
		const editorDropSurface = document.createElement("div")
		editorDropSurface.setAttribute("data-canvas-resource-drop-surface", "")
		overlayHost.append(canvasContainer, editorDropSurface)

		const manager = new DropOverlayManager({
			canvas: {
				permissionManager: { can: vi.fn(() => true) },
				container: canvasContainer,
				can: vi.fn(() => true),
				viewportController: {
					getResolvedDefaultViewportPadding: vi.fn(() => ({
						left: 0,
						right: 0,
						top: 0,
						bottom: 0,
					})),
				},
				t: vi.fn((_key: string, fallback: string) => fallback),
			} as unknown as Canvas,
		})
		const dataTransfer = { types: ["text/plain"] } as Partial<DataTransfer>

		canvasContainer.dispatchEvent(createDragEvent("dragenter", dataTransfer))
		expect(overlayHost.children).toHaveLength(3)

		editorDropSurface.dispatchEvent(createDragEvent("dragenter", dataTransfer))
		expect(overlayHost.children).toHaveLength(2)

		canvasContainer.dispatchEvent(createDragEvent("dragleave", dataTransfer))
		canvasContainer.dispatchEvent(createDragEvent("dragenter", dataTransfer))
		expect(overlayHost.children).toHaveLength(3)

		manager.destroy()
	})
})
