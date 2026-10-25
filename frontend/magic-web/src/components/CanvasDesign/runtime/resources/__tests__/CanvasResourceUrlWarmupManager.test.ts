import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { EventEmitter } from "../../core/EventEmitter"
import { ElementTypeEnum, type LayerElement } from "../../document/types"
import type { Canvas } from "../../core/Canvas"
import { CanvasResourceUrlWarmupManager } from "../scheduler/CanvasResourceUrlWarmupManager"
import { createTestResourceReferenceResolver } from "../../../public/__tests__/testResourceReferenceResolver"
import type { ResolveCanvasResourceReference } from "../../../public/resource-reference"

function createImage(id: string, src: string): LayerElement {
	const contentId = `${id}-content`
	return {
		id,
		type: ElementTypeEnum.Image,
		contents: [{ contentId, src }],
		activeContentId: contentId,
		mainContentId: contentId,
	}
}

function createVideo(id: string, src: string): LayerElement {
	const contentId = `${id}-content`
	return {
		id,
		type: ElementTypeEnum.Video,
		contents: [{ contentId, src }],
		activeContentId: contentId,
		mainContentId: contentId,
	}
}

function createAudio(id: string, src: string): LayerElement {
	const contentId = `${id}-content`
	return {
		id,
		type: ElementTypeEnum.Audio,
		contents: [{ contentId, src }],
		activeContentId: contentId,
		mainContentId: contentId,
	}
}

function createCanvasMock(
	elements: Record<string, LayerElement>,
	getFileInfo = vi.fn(),
	resolveResourceReference: ResolveCanvasResourceReference = createTestResourceReferenceResolver(),
	getAssetResourceInfo = vi.fn(),
) {
	const eventEmitter = new EventEmitter()
	const imageResourceManager = {
		markResourceLoadFailed: vi.fn(),
	}
	return {
		id: "canvas-1",
		getEffectiveContent: vi.fn((elementId: string) =>
			elements[elementId]?.contents?.find(
				(content) => content.contentId === elements[elementId]?.activeContentId,
			),
		),
		getEffectiveContentId: vi.fn((elementId: string) => elements[elementId]?.activeContentId),
		eventEmitter,
		elementManager: {
			getElementsDict: vi.fn(() => elements),
			getElementData: vi.fn((elementId: string) => elements[elementId]),
		},
		magicConfigManager: {
			config: {
				methods: {
					getFileInfo,
					resolveResourceReference,
				},
			},
		},
		assetResourceManager: {
			getResource: getAssetResourceInfo,
		},
		imageResourceManager,
		resourceScheduler: {
			run: vi.fn(
				(
					_kind: string,
					task: (signal: AbortSignal) => Promise<unknown>,
					options?: { signal?: AbortSignal },
				) => task(options?.signal ?? new AbortController().signal),
			),
		},
	}
}

async function flushWarmupTimer(): Promise<void> {
	await vi.advanceTimersByTimeAsync(80)
	await Promise.resolve()
	await Promise.resolve()
}

describe("CanvasResourceUrlWarmupManager", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it("warms image and video URLs without requesting media body resources", async () => {
		const getFileInfo = vi.fn(async (path: string) => ({
			src: `https://example.test/${path}`,
			fileName: path,
		}))
		const elements = {
			image: createImage("image", "./images/a.png"),
			video: createVideo("video", "./videos/a.mp4"),
		}
		const manager = new CanvasResourceUrlWarmupManager({
			canvas: createCanvasMock(elements, getFileInfo) as unknown as Canvas,
		})

		manager.warmupCurrentDocument("test")
		await flushWarmupTimer()

		expect(getFileInfo).toHaveBeenCalledTimes(2)
		expect(getFileInfo).toHaveBeenCalledWith("./images/a.png", {
			useImageProcess: true,
			forceRefresh: false,
			priority: "background",
		})
		expect(getFileInfo).toHaveBeenCalledWith("./videos/a.mp4", {
			useImageProcess: false,
			forceRefresh: false,
			priority: "background",
		})
		expect(manager.getSnapshot()).toMatchObject({
			readyCount: 2,
			successCount: 2,
			queuedCount: 0,
			warmingCount: 0,
		})
		manager.destroy()
	})

	it("leaves audio URL admission to the visibility manager", async () => {
		const getFileInfo = vi.fn(async (path: string) => ({
			src: `https://example.test/${path}`,
			fileName: path,
		}))
		const elements = {
			audio: createAudio("audio", "./audios/a.mp3"),
		}
		const manager = new CanvasResourceUrlWarmupManager({
			canvas: createCanvasMock(elements, getFileInfo) as unknown as Canvas,
		})

		manager.warmupCurrentDocument("test")
		await flushWarmupTimer()

		expect(getFileInfo).not.toHaveBeenCalled()
		expect(manager.getSnapshot()).toMatchObject({
			registeredElementCount: 0,
			trackedPathCount: 0,
		})
		manager.destroy()
	})

	it("warms valid asset paths through the asset manager without calling getFileInfo", async () => {
		const getFileInfo = vi.fn()
		const getAssetResourceInfo = vi.fn().mockResolvedValue({
			assetId: "asset-image",
			mediaType: "image",
			fileUrl: "https://assets.test/image.png",
		})
		const elements = {
			image: createImage("image", "asset://asset-image"),
		}
		const manager = new CanvasResourceUrlWarmupManager({
			canvas: createCanvasMock(
				elements,
				getFileInfo,
				createTestResourceReferenceResolver(),
				getAssetResourceInfo,
			) as unknown as Canvas,
		})

		manager.warmupCurrentDocument("asset")
		await flushWarmupTimer()

		expect(getAssetResourceInfo).toHaveBeenCalledWith("asset-image", {
			priority: "background",
		})
		expect(getFileInfo).not.toHaveBeenCalled()
		expect(manager.getSnapshot()).toMatchObject({ readyCount: 1, successCount: 1 })
		manager.destroy()
	})

	it("runs a warmup batch without occupying media scheduler capacity", async () => {
		const getFileInfo = vi.fn(async (path: string) => ({
			src: `https://example.test/${path}`,
			fileName: path,
		}))
		const elements = Object.fromEntries(
			Array.from({ length: 40 }, (_, index) => {
				const id = `image-${index}`
				return [id, createImage(id, `./images/${index}.png`)]
			}),
		)
		const canvas = createCanvasMock(elements, getFileInfo)
		const manager = new CanvasResourceUrlWarmupManager({
			canvas: canvas as unknown as Canvas,
		})

		manager.warmupCurrentDocument("batch")
		await flushWarmupTimer()

		expect(canvas.resourceScheduler.run).not.toHaveBeenCalled()
		expect(getFileInfo).toHaveBeenCalledTimes(40)
		expect(manager.getSnapshot()).toMatchObject({
			lastBatchSize: 40,
			readyCount: 40,
		})
		manager.destroy()
	})

	it("admits a large DSL inventory before downstream API chunking", async () => {
		const getFileInfo = vi.fn(async (path: string) => ({
			src: `https://example.test/${path}`,
			fileName: path,
		}))
		const elements = Object.fromEntries(
			Array.from({ length: 150 }, (_, index) => {
				const id = `image-${index}`
				return [id, createImage(id, `./images/${index}.png`)]
			}),
		)
		const manager = new CanvasResourceUrlWarmupManager({
			canvas: createCanvasMock(elements, getFileInfo) as unknown as Canvas,
		})

		manager.warmupDocument({ elements: Object.values(elements) }, "dsl-loaded")
		await flushWarmupTimer()

		expect(getFileInfo).toHaveBeenCalledTimes(150)
		expect(manager.getSnapshot()).toMatchObject({
			lastBatchSize: 150,
			queuedCount: 0,
			readyCount: 150,
		})
		manager.destroy()
	})

	it("starts the full DSL resource inventory without viewport admission", async () => {
		const getFileInfo = vi.fn(async (path: string) => ({
			src: `https://example.test/${path}`,
			fileName: path,
		}))
		const elements = {
			visibleImage: createImage("visibleImage", "./images/visible.png"),
			nearImage: createImage("nearImage", "./images/near.png"),
		}
		const canvas = createCanvasMock(elements, getFileInfo)
		const manager = new CanvasResourceUrlWarmupManager({
			canvas: canvas as unknown as Canvas,
		})

		manager.warmupDocument({ elements: Object.values(elements) }, "dsl-loaded")
		await flushWarmupTimer()

		expect(getFileInfo).toHaveBeenCalledTimes(2)
		expect(manager.getSnapshot()).toMatchObject({
			lastBatchPriority: "background",
			lastBatchSize: 2,
			readyCount: 2,
		})
		manager.destroy()
	})

	it("dedupes the same canonical resource path", async () => {
		const getFileInfo = vi.fn(async (path: string) => ({
			src: `https://example.test/${path}`,
			fileName: path,
		}))
		const elements = {
			imageA: createImage("imageA", "./images/a.png"),
			imageB: createImage("imageB", "/画布A/images/a.png"),
		}
		const manager = new CanvasResourceUrlWarmupManager({
			canvas: createCanvasMock(elements, getFileInfo) as unknown as Canvas,
		})

		manager.warmupCurrentDocument("test")
		await flushWarmupTimer()

		expect(getFileInfo).toHaveBeenCalledTimes(1)
		expect(manager.getSnapshot()).toMatchObject({
			trackedPathCount: 1,
			registeredElementCount: 2,
			readyCount: 1,
		})
		manager.destroy()
	})

	it("rebuilds identity keys and ref counts when resolver semantics change", async () => {
		const getFileInfo = vi.fn(async (path: string) => ({
			src: `https://example.test/${path}`,
			fileName: path,
		}))
		const elements = {
			image: createImage("image", "images/a.png"),
		}
		const canvas = createCanvasMock(
			elements,
			getFileInfo,
			createTestResourceReferenceResolver({
				currentCanvasWorkspacePath: "/画布A",
				attachmentsReady: false,
			}),
		)
		const manager = new CanvasResourceUrlWarmupManager({
			canvas: canvas as unknown as Canvas,
		})

		manager.warmupCurrentDocument("attachments-pending")
		expect(
			Array.from((manager as unknown as { entries: Map<string, unknown> }).entries.keys()),
		).toEqual(["image\0unresolved:images/a.png"])

		canvas.magicConfigManager.config.methods.resolveResourceReference =
			createTestResourceReferenceResolver({
				currentCanvasWorkspacePath: "/画布A",
				attachmentsReady: true,
				attachmentPathsByFileId: {
					image: "/画布A/images/a.png",
				},
			})
		manager.handleResourceReferenceResolverChanged()

		const internalManager = manager as unknown as {
			entries: Map<string, unknown>
			pathRefCounts: Map<string, number>
		}
		expect(Array.from(internalManager.entries.keys())).toEqual([
			"image\0workspace:/画布A/images/a.png",
		])
		expect(Array.from(internalManager.pathRefCounts.values())).toEqual([1])

		await flushWarmupTimer()
		expect(getFileInfo).toHaveBeenCalledTimes(1)
		expect(manager.getSnapshot()).toMatchObject({
			registeredElementCount: 1,
			trackedPathCount: 1,
			readyCount: 1,
		})
		manager.destroy()
	})

	it("warms far DSL resources independently from viewport visibility", async () => {
		const getFileInfo = vi.fn(async (path: string) => ({
			src: `https://example.test/${path}`,
			fileName: path,
		}))
		const elements = {
			visibleImage: createImage("visibleImage", "./images/visible.png"),
			farImage: createImage("farImage", "./images/far.png"),
		}
		const canvas = createCanvasMock(elements, getFileInfo)
		const manager = new CanvasResourceUrlWarmupManager({
			canvas: canvas as unknown as Canvas,
		})

		manager.warmupDocument({ elements: Object.values(elements) }, "dsl-loaded")
		await flushWarmupTimer()

		expect(getFileInfo).toHaveBeenCalledTimes(2)
		expect(getFileInfo).toHaveBeenCalledWith("./images/visible.png", {
			useImageProcess: true,
			forceRefresh: false,
			priority: "background",
		})
		expect(getFileInfo).toHaveBeenCalledWith("./images/far.png", {
			useImageProcess: true,
			forceRefresh: false,
			priority: "background",
		})
		manager.destroy()
	})

	it("does not rescan or reschedule URL inventory during viewport pan", async () => {
		const getFileInfo = vi.fn(async (path: string) => ({
			src: `https://example.test/${path}`,
			fileName: path,
		}))
		const elements = {
			visibleImage: createImage("visibleImage", "./images/visible.png"),
			farImage: createImage("farImage", "./images/far.png"),
		}
		const canvas = createCanvasMock(elements, getFileInfo)
		const manager = new CanvasResourceUrlWarmupManager({
			canvas: canvas as unknown as Canvas,
		})

		canvas.eventEmitter.emit({ type: "viewport:pan", data: { x: 1, y: 1 } })
		await flushWarmupTimer()

		expect(canvas.elementManager.getElementsDict).not.toHaveBeenCalled()
		expect(canvas.elementManager.getElementData).not.toHaveBeenCalled()
		expect(getFileInfo).not.toHaveBeenCalled()
		manager.destroy()
	})

	it("keeps queued DSL warmups across viewport changes", async () => {
		const getFileInfo = vi.fn(async (path: string) => ({
			src: `https://example.test/${path}`,
			fileName: path,
		}))
		const elements = {
			image: createImage("image", "./images/a.png"),
		}
		const canvas = createCanvasMock(elements, getFileInfo)
		const manager = new CanvasResourceUrlWarmupManager({
			canvas: canvas as unknown as Canvas,
		})

		manager.warmupDocument({ elements: Object.values(elements) }, "dsl-loaded")
		expect(manager.getSnapshot().queuedCount).toBe(1)

		canvas.eventEmitter.emit({ type: "viewport:scale", data: { scale: 2 } })
		expect(manager.getSnapshot().queuedCount).toBe(1)

		await flushWarmupTimer()
		expect(getFileInfo).toHaveBeenCalledTimes(1)
		manager.destroy()
	})

	it("keeps an in-flight warmup alive across raw viewport pan events", async () => {
		let resolveFileInfo!: (value: { src: string; fileName: string }) => void
		const getFileInfo = vi.fn(
			() =>
				new Promise<{ src: string; fileName: string }>((resolve) => {
					resolveFileInfo = resolve
				}),
		)
		const elements = {
			image: createImage("image", "./images/a.png"),
		}
		const canvas = createCanvasMock(elements, getFileInfo)
		const manager = new CanvasResourceUrlWarmupManager({
			canvas: canvas as unknown as Canvas,
		})

		manager.warmupCurrentDocument("initial")
		await flushWarmupTimer()
		canvas.eventEmitter.emit({ type: "viewport:pan", data: { x: 1, y: 1 } })
		await Promise.resolve()
		await Promise.resolve()

		expect(manager.getSnapshot()).toMatchObject({ failedCount: 0, warmingCount: 1 })
		resolveFileInfo({ src: "https://example.test/images/a.png", fileName: "a.png" })
		await Promise.resolve()
		await Promise.resolve()
		expect(manager.getSnapshot()).toMatchObject({ failedCount: 0, readyCount: 1 })
		manager.destroy()
	})

	it("keeps ready warmup entries until their URL expires", async () => {
		vi.setSystemTime(new Date("2026-01-01T00:00:00"))
		const getFileInfo = vi.fn(async (path: string) => ({
			src: `https://example.test/${path}`,
			fileName: path,
			expires_at: "2026-01-01 00:00:10",
		}))
		const elements = {
			image: createImage("image", "./images/a.png"),
		}
		const manager = new CanvasResourceUrlWarmupManager({
			canvas: createCanvasMock(elements, getFileInfo) as unknown as Canvas,
		})

		manager.warmupCurrentDocument("initial")
		await flushWarmupTimer()
		manager.warmupCurrentDocument("still-fresh")
		await flushWarmupTimer()

		expect(getFileInfo).toHaveBeenCalledTimes(1)

		vi.setSystemTime(new Date("2026-01-01T00:00:11"))
		manager.warmupCurrentDocument("expired")
		await flushWarmupTimer()

		expect(getFileInfo).toHaveBeenCalledTimes(2)
		expect(manager.getSnapshot()).toMatchObject({
			readyCount: 1,
			successCount: 2,
		})
		manager.destroy()
	})

	it("retries failed warmup entries after the retry delay", async () => {
		const getFileInfo = vi
			.fn()
			.mockRejectedValueOnce(new Error("network failed"))
			.mockResolvedValue({
				src: "https://example.test/images/a.png",
				fileName: "a.png",
			})
		const elements = {
			image: createImage("image", "./images/a.png"),
		}
		const manager = new CanvasResourceUrlWarmupManager({
			canvas: createCanvasMock(elements, getFileInfo) as unknown as Canvas,
		})

		manager.warmupCurrentDocument("initial")
		await flushWarmupTimer()

		expect(getFileInfo).toHaveBeenCalledTimes(1)
		expect(manager.getSnapshot()).toMatchObject({
			failedCount: 1,
			failedRequestCount: 1,
		})

		manager.warmupCurrentDocument("too-soon")
		await flushWarmupTimer()
		expect(getFileInfo).toHaveBeenCalledTimes(1)

		await vi.advanceTimersByTimeAsync(30_000)
		manager.warmupCurrentDocument("retry")
		await flushWarmupTimer()

		expect(getFileInfo).toHaveBeenCalledTimes(2)
		expect(manager.getSnapshot()).toMatchObject({
			readyCount: 1,
			failedCount: 0,
			successCount: 1,
		})
		manager.destroy()
	})

	it("propagates failed image warmup to the image resource manager", async () => {
		const getFileInfo = vi.fn(async () => {
			throw new Error("未找到路径对应的文件: ./images/missing.png")
		})
		const elements = {
			image: createImage("image", "./images/missing.png"),
		}
		const canvas = createCanvasMock(elements, getFileInfo)
		const manager = new CanvasResourceUrlWarmupManager({
			canvas: canvas as unknown as Canvas,
		})

		manager.warmupCurrentDocument("initial")
		await flushWarmupTimer()

		expect(canvas.imageResourceManager.markResourceLoadFailed).toHaveBeenCalledWith(
			"./images/missing.png",
			"not-found",
		)
		manager.destroy()
	})

	it("does not propagate transient warmup failures to image elements", async () => {
		const getFileInfo = vi.fn(async () => {
			throw new Error("network failed")
		})
		const elements = {
			image: createImage("image", "./images/a.png"),
		}
		const canvas = createCanvasMock(elements, getFileInfo)
		const manager = new CanvasResourceUrlWarmupManager({
			canvas: canvas as unknown as Canvas,
		})

		manager.warmupCurrentDocument("initial")
		await flushWarmupTimer()

		expect(canvas.imageResourceManager.markResourceLoadFailed).not.toHaveBeenCalled()
		expect(manager.getSnapshot()).toMatchObject({ failedCount: 1, failedRequestCount: 1 })
		manager.destroy()
	})
})
