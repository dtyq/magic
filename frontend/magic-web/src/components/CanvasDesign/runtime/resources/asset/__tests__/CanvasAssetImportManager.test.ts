import { afterEach, describe, expect, it, vi } from "vitest"
import { createTestResourceReferenceResolver } from "../../../../public/__tests__/testResourceReferenceResolver"
import { ElementTypeEnum, type LayerElement } from "../../../document/types"
import { CanvasAssetImportManager, getAssetUploadSubDir } from "../CanvasAssetImportManager"
import { UploadSubDir, type CanvasAssetResourceInfo } from "../../../../public/magic-types"
import { rememberAssetMediaDimensions } from "../assetMediaDimensionCache"

// This manager suite supplies its own Canvas/resource harness; avoid loading the
// unrelated admin API barrel while resolving runtime Canvas dependencies.
vi.mock("@/apis", () => ({ AssetsApi: {} }))

vi.mock("../../../shared/placement/placementEngine", () => ({
	resolveConnectedPlacement: vi.fn(() => ({ x: 10, y: 20 })),
	resolveNearestFreeMediaPlacement: vi.fn(() => ({ x: 30, y: 40 })),
}))

interface CanvasHarnessOptions {
	elements?: LayerElement[]
	asset?: CanvasAssetResourceInfo
	assets?: Record<string, CanvasAssetResourceInfo>
	connect?: ReturnType<typeof vi.fn>
	connectBatch?: ReturnType<typeof vi.fn>
	attachmentPathsByFileId?: Record<string, string>
	upstreamConnections?: Array<{
		id: string
		sourceElementId: string
		targetElementId: string
	}>
}

function createHarness(options: CanvasHarnessOptions = {}) {
	const target: LayerElement = {
		id: "video-target",
		type: ElementTypeEnum.Video,
		x: 500,
		y: 100,
		width: 1280,
		height: 720,
		activeContentId: "video-target-content",
		mainContentId: "video-target-content",
		contents: [{ contentId: "video-target-content" }],
	}
	const elements = new Map(
		[target, ...(options.elements ?? [])].map((element) => [element.id, element]),
	)
	const uploadResult = {
		path: "./audios/imported.mp3",
		src: "https://example.test/imported.mp3",
		fileName: "imported.mp3",
	}
	const uploadDirect = vi.fn(async () => [uploadResult])
	const upstreamConnections: Array<{
		id: string
		sourceElementId: string
		targetElementId: string
	}> = [...(options.upstreamConnections ?? [])]
	const connect =
		options.connect ??
		vi.fn(
			({
				sourceElementId,
				targetElementId,
			}: {
				sourceElementId: string
				targetElementId: string
			}) => {
				const connectionId = `connection-${sourceElementId}`
				upstreamConnections.push({ id: connectionId, sourceElementId, targetElementId })
				return { status: "created" as const, connectionId }
			},
		)
	const connectElementsBatch =
		options.connectBatch ??
		vi.fn(
			({ edges }: { edges: Array<{ sourceElementId: string; targetElementId: string }> }) => {
				const connectionIds = edges.map(({ sourceElementId, targetElementId }) => {
					const connectionId = `batch-connection-${sourceElementId}`
					upstreamConnections.push({
						id: connectionId,
						sourceElementId,
						targetElementId,
					})
					return connectionId
				})
				return { status: "created" as const, connectionIds }
			},
		)
	const removeConnections = vi.fn((connectionIds: string[]) => {
		const ids = new Set(connectionIds)
		for (let index = upstreamConnections.length - 1; index >= 0; index -= 1) {
			if (ids.has(upstreamConnections[index]?.id ?? "")) upstreamConnections.splice(index, 1)
		}
		return connectionIds
	})
	let currentSeed: { id: string; targetElementId: string; [key: string]: unknown } | null = null
	const register = vi.fn((seed: { targetElementId: string; [key: string]: unknown }) => {
		const id = `seed-${register.mock.calls.length + 1}`
		currentSeed = { ...seed, id }
		return id
	})
	const peek = vi.fn((targetElementId: string) =>
		currentSeed?.targetElementId === targetElementId ? { ...currentSeed } : null,
	)
	const remove = vi.fn((targetElementId: string) => {
		if (currentSeed?.targetElementId === targetElementId) currentSeed = null
	})
	const canvas = {
		elementManager: {
			getAllElementIds: () => [...elements.keys()],
			getElementData: (elementId: string) => elements.get(elementId),
			getAllElements: () => [...elements.values()],
			getNextZIndexInLevel: () => 10,
			create: vi.fn((element: LayerElement) => {
				elements.set(element.id, element)
				return { elementId: element.id, element }
			}),
			delete: vi.fn((elementId: string) => elements.delete(elementId)),
		},
		canvasFileUploadManager: {
			isPendingResourcePath: vi.fn(() => false),
			uploadDirect,
		},
		magicConfigManager: {
			config: {
				methods: {
					resolveResourceReference: createTestResourceReferenceResolver({
						attachmentPathsByFileId: options.attachmentPathsByFileId ?? {
							existing: "./images/existing.png",
						},
						attachmentsReady: true,
					}),
				},
			},
		},
		assetResourceManager: {
			getResource: vi.fn(async (assetId: string) =>
				Promise.resolve(
					options.assets?.[assetId] ??
						options.asset ?? {
							assetId,
							mediaType: "audio",
							fileUrl: "https://example.test/source.mp3",
							fileName: "source",
						},
				),
			),
		},
		historyManager: {
			runTransaction: vi.fn((callback: () => unknown) => callback()),
		},
		connectionManager: {
			connectElements: connect,
			connectElementsBatch,
			removeConnections,
			getUpstreamConnections: () => upstreamConnections,
		},
		connectionAssociationSeedManager: { register, peek, remove },
		geometryCacheManager: {
			getElementBounds: () => ({ x: 500, y: 100, width: 1280, height: 720 }),
		},
		imageResourceManager: { primeCache: vi.fn() },
		videoResourceManager: { primeCache: vi.fn() },
		audioResourceManager: { primeCache: vi.fn() },
	}
	return { canvas, elements, uploadDirect, connect, register, uploadResult }
}

afterEach(() => {
	vi.unstubAllGlobals()
})

describe("CanvasAssetImportManager", () => {
	it("maps asset media types to explicit upload directories", () => {
		expect(getAssetUploadSubDir("image")).toBe(UploadSubDir.Images)
		expect(getAssetUploadSubDir("video")).toBe(UploadSubDir.Videos)
		expect(getAssetUploadSubDir("audio")).toBe(UploadSubDir.Audios)
	})

	it("reuses a current-canvas binding and creates a new connected media element", async () => {
		const existingImage: LayerElement = {
			id: "existing-image",
			type: ElementTypeEnum.Image,
			width: 640,
			height: 360,
			activeContentId: "existing-content",
			mainContentId: "existing-content",
			contents: [
				{
					contentId: "existing-content",
					src: "./images/existing.png",
					assetId: "asset-image",
				},
			],
		}
		const harness = createHarness({ elements: [existingImage] })
		const manager = new CanvasAssetImportManager(harness.canvas as never)

		const result = await manager.importAndConnect({
			assetId: "asset-image",
			targetElementId: "video-target",
			targetKind: "video-generator",
			slot: { kind: "reference" },
			allowedMediaTypes: ["image"],
		})

		expect(result).toMatchObject({
			workspacePath: "./images/existing.png",
			mediaType: "image",
			source: "existing-binding",
		})
		expect(harness.canvas.assetResourceManager.getResource).not.toHaveBeenCalled()
		expect(harness.uploadDirect).not.toHaveBeenCalled()
		const created = harness.elements.get(result.elementId)
		expect(created).toMatchObject({
			type: ElementTypeEnum.Image,
			x: 10,
			y: 20,
			contents: [{ src: "./images/existing.png", assetId: "asset-image" }],
		})
		expect(harness.connect).toHaveBeenCalledWith({
			sourceElementId: result.elementId,
			targetElementId: "video-target",
		})
		expect(harness.register).toHaveBeenCalledWith(
			expect.objectContaining({
				targetElementId: "video-target",
				createdBy: "assets",
				orderedSources: [{ elementId: result.elementId, kind: "image" }],
			}),
		)
	})

	it("creates a standalone image element with the workspace binding", async () => {
		const existingImage: LayerElement = {
			id: "existing-image",
			type: ElementTypeEnum.Image,
			width: 640,
			height: 360,
			activeContentId: "existing-content",
			mainContentId: "existing-content",
			contents: [
				{
					contentId: "existing-content",
					src: "./images/existing.png",
					assetId: "asset-image",
				},
			],
		}
		const harness = createHarness({ elements: [existingImage] })
		const manager = new CanvasAssetImportManager(harness.canvas as never)

		const result = await manager.importAndCreateElement({
			assetId: "asset-image",
			allowedMediaTypes: ["image"],
		})

		expect(result).toMatchObject({
			workspacePath: "./images/existing.png",
			mediaType: "image",
			source: "existing-binding",
		})
		expect(harness.canvas.elementManager.create).toHaveBeenCalledTimes(1)
		expect(harness.elements.get(result.elementId)).toMatchObject({
			type: ElementTypeEnum.Image,
			x: 30,
			y: 40,
			contents: [{ src: "./images/existing.png", assetId: "asset-image" }],
		})
	})

	it("reuses the existing connection when the asset is already connected to the target video", async () => {
		const existingImage: LayerElement = {
			id: "existing-image",
			type: ElementTypeEnum.Image,
			width: 640,
			height: 360,
			activeContentId: "existing-content",
			mainContentId: "existing-content",
			contents: [
				{
					contentId: "existing-content",
					src: "./images/existing.png",
					assetId: "asset-image",
				},
			],
		}
		const harness = createHarness({
			elements: [existingImage],
			upstreamConnections: [
				{
					id: "existing-connection",
					sourceElementId: "existing-image",
					targetElementId: "video-target",
				},
			],
		})
		const manager = new CanvasAssetImportManager(harness.canvas as never)

		const result = await manager.importAndConnect({
			assetId: "asset-image",
			targetElementId: "video-target",
			targetKind: "video-generator",
			slot: { kind: "reference" },
			allowedMediaTypes: ["image"],
		})

		expect(result).toMatchObject({
			elementId: "existing-image",
			connectionId: "existing-connection",
			workspacePath: "./images/existing.png",
			source: "existing-connection",
		})
		expect(harness.canvas.elementManager.create).not.toHaveBeenCalled()
		expect(harness.connect).not.toHaveBeenCalled()
		expect(harness.register).not.toHaveBeenCalled()
	})

	it("does not register a reference seed when a batch only reuses existing connections", async () => {
		const existingImage: LayerElement = {
			id: "existing-image",
			type: ElementTypeEnum.Image,
			width: 640,
			height: 360,
			activeContentId: "existing-content",
			mainContentId: "existing-content",
			contents: [
				{
					contentId: "existing-content",
					src: "./images/existing.png",
					assetId: "asset-image",
				},
			],
		}
		const harness = createHarness({
			elements: [existingImage],
			upstreamConnections: [
				{
					id: "existing-connection",
					sourceElementId: "existing-image",
					targetElementId: "video-target",
				},
			],
		})
		const manager = new CanvasAssetImportManager(harness.canvas as never)

		const results = await manager.importAndConnectMany({
			assetIds: ["asset-image"],
			targetElementId: "video-target",
			targetKind: "video-generator",
			slot: { kind: "reference" },
			allowedMediaTypes: ["image"],
		})

		expect(results).toEqual([
			expect.objectContaining({
				elementId: "existing-image",
				connectionId: "existing-connection",
				workspacePath: "./images/existing.png",
				source: "existing-connection",
			}),
		])
		expect(harness.canvas.connectionManager.connectElementsBatch).not.toHaveBeenCalled()
		// The editor's explicit asset insertion already adds the mention; a seed
		// would insert a second, path-named mention for the same media.
		expect(harness.register).not.toHaveBeenCalled()
	})

	it("registers a batch reference seed only for newly created connections", async () => {
		const connectedImage: LayerElement = {
			id: "connected-image",
			type: ElementTypeEnum.Image,
			width: 640,
			height: 360,
			activeContentId: "connected-content",
			mainContentId: "connected-content",
			contents: [
				{
					contentId: "connected-content",
					src: "./images/connected.png",
					assetId: "asset-connected",
				},
			],
		}
		const freshImage: LayerElement = {
			id: "fresh-image",
			type: ElementTypeEnum.Image,
			width: 640,
			height: 360,
			activeContentId: "fresh-content",
			mainContentId: "fresh-content",
			contents: [
				{
					contentId: "fresh-content",
					src: "./images/fresh.png",
					assetId: "asset-fresh",
				},
			],
		}
		const harness = createHarness({
			elements: [connectedImage, freshImage],
			attachmentPathsByFileId: {
				connected: "./images/connected.png",
				fresh: "./images/fresh.png",
			},
			upstreamConnections: [
				{
					id: "existing-connection",
					sourceElementId: "connected-image",
					targetElementId: "video-target",
				},
			],
		})
		const manager = new CanvasAssetImportManager(harness.canvas as never)

		const results = await manager.importAndConnectMany({
			assetIds: ["asset-connected", "asset-fresh"],
			targetElementId: "video-target",
			targetKind: "video-generator",
			slot: { kind: "reference" },
			allowedMediaTypes: ["image"],
		})

		expect(results.map((result) => result.source)).toEqual([
			"existing-connection",
			"existing-binding",
		])
		expect(harness.register).toHaveBeenCalledTimes(1)
		expect(harness.register).toHaveBeenCalledWith(
			expect.objectContaining({
				targetElementId: "video-target",
				orderedSources: [{ elementId: results[1]?.elementId, kind: "image" }],
			}),
		)
	})

	it("reuses a same-name current-canvas file before requiring a signed URL", async () => {
		const harness = createHarness({
			asset: {
				assetId: "asset-image",
				mediaType: "image",
				fileUrl: null,
				fileName: "portrait.png",
			},
			attachmentPathsByFileId: { portrait: "./images/portrait.png" },
		})
		const fetchMock = vi.fn()
		vi.stubGlobal("fetch", fetchMock)
		const manager = new CanvasAssetImportManager(harness.canvas as never)

		const result = await manager.importAndConnect({
			assetId: "asset-image",
			targetElementId: "video-target",
			targetKind: "video-generator",
			slot: { kind: "reference" },
			allowedMediaTypes: ["image"],
		})

		expect(result).toMatchObject({
			workspacePath: "./images/portrait.png",
			fileName: "portrait.png",
			mediaType: "image",
			source: "existing-file",
		})
		expect(fetchMock).not.toHaveBeenCalled()
		expect(harness.uploadDirect).not.toHaveBeenCalled()
		expect(harness.elements.get(result.elementId)).toMatchObject({
			contents: [{ src: "./images/portrait.png", assetId: "asset-image" }],
		})
	})

	it("does not treat an unconnected canvas binding as an existing target connection", async () => {
		const existingImage: LayerElement = {
			id: "existing-image",
			type: ElementTypeEnum.Image,
			activeContentId: "existing-content",
			mainContentId: "existing-content",
			contents: [
				{
					contentId: "existing-content",
					src: "./images/existing.png",
					assetId: "asset-image",
				},
			],
		}
		const harness = createHarness({ elements: [existingImage] })
		const manager = new CanvasAssetImportManager(harness.canvas as never)

		const result = await manager.importAndConnect({
			assetId: "asset-image",
			targetElementId: "video-target",
			targetKind: "video-generator",
			slot: { kind: "reference" },
			allowedMediaTypes: ["image"],
		})

		expect(result.source).toBe("existing-binding")
		expect(result.elementId).not.toBe("existing-image")
		expect(harness.connect).toHaveBeenCalledWith({
			sourceElementId: result.elementId,
			targetElementId: "video-target",
		})
	})

	it("downloads, uploads, and connects a missing asset once for concurrent target imports", async () => {
		const harness = createHarness()
		const fetchMock = vi.fn(
			async () => new Response(new Blob(["audio"], { type: "audio/mpeg" }), { status: 200 }),
		)
		vi.stubGlobal("fetch", fetchMock)
		const manager = new CanvasAssetImportManager(harness.canvas as never)
		const request = {
			assetId: "asset-audio",
			targetElementId: "video-target",
			targetKind: "video-generator" as const,
			slot: { kind: "reference" } as const,
			allowedMediaTypes: ["audio"] as const,
		}

		const [first, second] = await Promise.all([
			manager.importAndConnect(request),
			manager.importAndConnect(request),
		])

		expect(first.source).toBe("downloaded")
		expect(second.source).toBe("existing-connection")
		expect(first.elementId).toBe(second.elementId)
		expect(fetchMock).toHaveBeenCalledTimes(1)
		expect(harness.uploadDirect).toHaveBeenCalledTimes(1)
		expect(harness.connect).toHaveBeenCalledTimes(1)
		expect(harness.uploadDirect).toHaveBeenCalledWith(expect.any(Array), undefined, undefined, {
			uploadSubDir: UploadSubDir.Audios,
		})
		expect(harness.canvas.audioResourceManager.primeCache).toHaveBeenCalledWith(
			harness.uploadResult.path,
			harness.uploadResult,
		)
	})

	it("uploads multiple selected assets in one media-type batch and preserves selection order", async () => {
		const harness = createHarness({
			assets: {
				"asset-audio-a": {
					assetId: "asset-audio-a",
					mediaType: "audio",
					fileUrl: "https://example.test/a.mp3",
					fileName: "a.mp3",
				},
				"asset-audio-b": {
					assetId: "asset-audio-b",
					mediaType: "audio",
					fileUrl: "https://example.test/b.mp3",
					fileName: "b.mp3",
				},
			},
		})
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async (url: string) =>
					new Response(new Blob([url], { type: "audio/mpeg" }), { status: 200 }),
			),
		)
		harness.uploadDirect.mockImplementationOnce(async (files: File[]) =>
			files.map((file, index) => ({
				...harness.uploadResult,
				path: `./audios/${file.name}`,
				fileName: file.name,
				src: `https://example.test/uploaded-${index}.mp3`,
			})),
		)
		const manager = new CanvasAssetImportManager(harness.canvas as never)

		const results = await manager.importAndConnectMany({
			assetIds: ["asset-audio-b", "asset-audio-a"],
			targetElementId: "video-target",
			targetKind: "video-generator",
			slot: { kind: "reference" },
			allowedMediaTypes: ["audio"],
		})

		expect(harness.uploadDirect).toHaveBeenCalledTimes(1)
		expect(harness.uploadDirect).toHaveBeenCalledWith(
			[
				expect.objectContaining({ name: "b.mp3" }),
				expect.objectContaining({ name: "a.mp3" }),
			],
			undefined,
			undefined,
			{ uploadSubDir: UploadSubDir.Audios },
		)
		expect(results.map((result) => result.workspacePath)).toEqual([
			"./audios/b.mp3",
			"./audios/a.mp3",
		])
	})

	it("keeps different media directories in separate upload batches", async () => {
		const harness = createHarness({
			assets: {
				"asset-audio": {
					assetId: "asset-audio",
					mediaType: "audio",
					fileUrl: "https://example.test/audio.mp3",
					fileName: "audio.mp3",
				},
				"asset-video": {
					assetId: "asset-video",
					mediaType: "video",
					fileUrl: "https://example.test/video.mp4",
					fileName: "video.mp4",
				},
			},
		})
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async (url: string) =>
					new Response(
						new Blob([url], {
							type: url.endsWith(".mp4") ? "video/mp4" : "audio/mpeg",
						}),
						{ status: 200 },
					),
			),
		)
		harness.uploadDirect.mockImplementation(async (files: File[], _a, _b, options) =>
			files.map((file) => ({
				...harness.uploadResult,
				path: `${options?.uploadSubDir}/${file.name}`,
				fileName: file.name,
			})),
		)
		const manager = new CanvasAssetImportManager(harness.canvas as never)
		rememberAssetMediaDimensions("asset-video", { width: 640, height: 360 })

		await manager.importAndConnectMany({
			assetIds: ["asset-video", "asset-audio"],
			targetElementId: "video-target",
			targetKind: "video-generator",
			slot: { kind: "reference" },
			allowedMediaTypes: ["audio", "video"],
		})

		expect(harness.uploadDirect).toHaveBeenCalledTimes(2)
		expect(harness.uploadDirect.mock.calls.map((call) => call[3])).toEqual([
			{ uploadSubDir: UploadSubDir.Videos },
			{ uploadSubDir: UploadSubDir.Audios },
		])
	})

	it("does not share concurrent batch promises across slot or media policies", async () => {
		const harness = createHarness({
			asset: {
				assetId: "asset-image",
				mediaType: "image",
				fileUrl: null,
				fileName: "shared.png",
			},
			attachmentPathsByFileId: { shared: "./images/shared.png" },
		})
		const manager = new CanvasAssetImportManager(harness.canvas as never)

		const [frameResult, referenceResult] = await Promise.all([
			manager.importAndConnectMany({
				assetIds: ["asset-image"],
				targetElementId: "video-target",
				targetKind: "video-generator",
				slot: { kind: "frame" },
				allowedMediaTypes: ["image"],
			}),
			manager.importAndConnectMany({
				assetIds: ["asset-image"],
				targetElementId: "video-target",
				targetKind: "video-generator",
				slot: { kind: "reference" },
				allowedMediaTypes: ["image"],
			}),
		])

		expect(frameResult).toHaveLength(1)
		expect(referenceResult).toHaveLength(1)
		expect(harness.canvas.connectionManager.connectElementsBatch).toHaveBeenCalledTimes(1)
		// The reference call reuses the frame call's connection instead of sharing
		// its promise, and a reused connection does not register a seed.
		expect(referenceResult[0]).toMatchObject({
			elementId: frameResult[0]?.elementId,
			connectionId: frameResult[0]?.connectionId,
			source: "existing-connection",
		})
		expect(harness.register).not.toHaveBeenCalled()
	})

	it("does not share a batch promise across incompatible media policies", async () => {
		const existingVideo: LayerElement = {
			id: "existing-video",
			type: ElementTypeEnum.Video,
			activeContentId: "existing-video-content",
			mainContentId: "existing-video-content",
			contents: [
				{
					contentId: "existing-video-content",
					src: "./videos/shared.mp4",
					assetId: "asset-video",
				},
			],
		}
		const harness = createHarness({
			elements: [existingVideo],
			asset: {
				assetId: "asset-video",
				mediaType: "video",
				fileUrl: null,
				fileName: "shared.mp4",
			},
			attachmentPathsByFileId: { shared: "./videos/shared.mp4" },
		})
		const manager = new CanvasAssetImportManager(harness.canvas as never)

		const imageOnly = manager.importAndConnectMany({
			assetIds: ["asset-video"],
			targetElementId: "video-target",
			targetKind: "video-generator",
			slot: { kind: "reference" },
			allowedMediaTypes: ["image"],
		})
		const videoOnly = manager.importAndConnectMany({
			assetIds: ["asset-video"],
			targetElementId: "video-target",
			targetKind: "video-generator",
			slot: { kind: "reference" },
			allowedMediaTypes: ["video"],
		})

		await expect(imageOnly).rejects.toThrow("not allowed")
		await expect(videoOnly).resolves.toEqual([
			expect.objectContaining({ mediaType: "video", workspacePath: "./videos/shared.mp4" }),
		])
	})

	it("does not share a guarded batch promise across editor sessions", async () => {
		const harness = createHarness({
			asset: {
				assetId: "asset-image",
				mediaType: "image",
				fileUrl: null,
				fileName: "guarded.png",
			},
			attachmentPathsByFileId: { guarded: "./images/guarded.png" },
		})
		const manager = new CanvasAssetImportManager(harness.canvas as never)
		let firstCurrent = true
		const firstPromise = manager.importAndConnectMany({
			assetIds: ["asset-image"],
			targetElementId: "video-target",
			targetKind: "video-generator",
			slot: { kind: "reference" },
			allowedMediaTypes: ["image"],
			isCurrent: () => firstCurrent,
		})
		firstCurrent = false
		const secondPromise = manager.importAndConnectMany({
			assetIds: ["asset-image"],
			targetElementId: "video-target",
			targetKind: "video-generator",
			slot: { kind: "reference" },
			allowedMediaTypes: ["image"],
			isCurrent: () => true,
		})

		await expect(firstPromise).rejects.toThrow("stale")
		await expect(secondPromise).resolves.toEqual([
			expect.objectContaining({ workspacePath: "./images/guarded.png" }),
		])
		expect(harness.canvas.connectionManager.connectElementsBatch).toHaveBeenCalledTimes(1)
	})

	it("rejects disallowed asset media before downloading or creating an element", async () => {
		const harness = createHarness({
			asset: {
				assetId: "asset-video",
				mediaType: "video",
				fileUrl: "https://example.test/source.mp4",
			},
		})
		const fetchMock = vi.fn()
		vi.stubGlobal("fetch", fetchMock)
		const manager = new CanvasAssetImportManager(harness.canvas as never)

		await expect(
			manager.importAndConnect({
				assetId: "asset-video",
				targetElementId: "video-target",
				targetKind: "video-generator",
				slot: { kind: "frame" },
				allowedMediaTypes: ["image"],
			}),
		).rejects.toThrow("not allowed")

		expect(fetchMock).not.toHaveBeenCalled()
		expect(harness.uploadDirect).not.toHaveBeenCalled()
		expect(harness.canvas.elementManager.create).not.toHaveBeenCalled()
	})

	it("rejects a non-image frame policy before preparing the asset", async () => {
		const harness = createHarness()
		const manager = new CanvasAssetImportManager(harness.canvas as never)

		await expect(
			manager.importAndConnectMany({
				assetIds: ["asset-video"],
				targetElementId: "video-target",
				targetKind: "video-generator",
				slot: { kind: "frame" },
				allowedMediaTypes: ["video"],
			}),
		).rejects.toThrow("frame")
		expect(harness.canvas.assetResourceManager.getResource).not.toHaveBeenCalled()
	})

	it.each([
		["download", () => Promise.resolve(new Response(null, { status: 403 }))],
		[
			"upload",
			() => Promise.resolve(new Response(new Blob(["audio"], { type: "audio/mpeg" }))),
		],
	] as const)("does not create a Canvas element when %s fails", async (stage, fetchResponse) => {
		const harness = createHarness()
		vi.stubGlobal("fetch", vi.fn(fetchResponse))
		if (stage === "upload") {
			harness.uploadDirect.mockRejectedValueOnce(new Error("upload failed"))
		}
		const manager = new CanvasAssetImportManager(harness.canvas as never)

		await expect(
			manager.importAndConnect({
				assetId: "asset-audio",
				targetElementId: "video-target",
				targetKind: "video-generator",
				slot: { kind: "reference" },
				allowedMediaTypes: ["audio"],
			}),
		).rejects.toThrow()

		expect(harness.canvas.elementManager.create).not.toHaveBeenCalled()
		expect(harness.connect).not.toHaveBeenCalled()
		expect(harness.register).not.toHaveBeenCalled()
	})

	it("does not create an element when the target disappears after upload", async () => {
		const harness = createHarness()
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(new Blob(["audio"], { type: "audio/mpeg" }), { status: 200 }),
			),
		)
		let resolveUpload: ((value: (typeof harness.uploadResult)[]) => void) | undefined
		harness.uploadDirect.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					resolveUpload = resolve
				}),
		)
		const manager = new CanvasAssetImportManager(harness.canvas as never)
		const importPromise = manager.importAndConnect({
			assetId: "asset-audio",
			targetElementId: "video-target",
			targetKind: "video-generator",
			slot: { kind: "reference" },
			allowedMediaTypes: ["audio"],
		})
		await vi.waitFor(() => expect(resolveUpload).toBeTypeOf("function"))
		harness.elements.delete("video-target")
		resolveUpload?.([harness.uploadResult])

		await expect(importPromise).rejects.toThrow("target video is unavailable")
		expect(harness.canvas.elementManager.create).not.toHaveBeenCalled()
		expect(harness.connect).not.toHaveBeenCalled()
	})

	it("rolls back the media element when the connection cannot be created", async () => {
		const existingImage: LayerElement = {
			id: "existing-image",
			type: ElementTypeEnum.Image,
			activeContentId: "content",
			mainContentId: "content",
			contents: [
				{ contentId: "content", src: "./images/existing.png", assetId: "asset-image" },
			],
		}
		const harness = createHarness({
			elements: [existingImage],
			connect: vi.fn(() => ({
				status: "invalid" as const,
				reason: "missing-element" as const,
			})),
		})
		const manager = new CanvasAssetImportManager(harness.canvas as never)

		await expect(
			manager.importAndConnect({
				assetId: "asset-image",
				targetElementId: "video-target",
				targetKind: "video-generator",
				slot: { kind: "frame" },
				allowedMediaTypes: ["image"],
			}),
		).rejects.toThrow("Failed to create")

		expect(harness.canvas.elementManager.delete).toHaveBeenCalledTimes(1)
		expect([...harness.elements.values()].filter((item) => item.id !== "video-target")).toEqual(
			[existingImage],
		)
		expect(harness.register).not.toHaveBeenCalled()
	})

	it("imports image references in selection order and registers one image seed", async () => {
		const imageTarget: LayerElement = {
			id: "image-target",
			type: ElementTypeEnum.Image,
			x: 500,
			y: 100,
			width: 1024,
			height: 1024,
			activeContentId: "image-target-content",
			mainContentId: "image-target-content",
			contents: [{ contentId: "image-target-content" }],
		}
		const sourceA: LayerElement = {
			id: "source-a",
			type: ElementTypeEnum.Image,
			width: 100,
			height: 100,
			activeContentId: "source-a-content",
			mainContentId: "source-a-content",
			contents: [
				{
					contentId: "source-a-content",
					src: "./images/a.png",
					assetId: "asset-a",
				},
			],
		}
		const sourceB: LayerElement = {
			...sourceA,
			id: "source-b",
			activeContentId: "source-b-content",
			mainContentId: "source-b-content",
			contents: [
				{
					contentId: "source-b-content",
					src: "./images/b.png",
					assetId: "asset-b",
				},
			],
		}
		const harness = createHarness({
			elements: [imageTarget, sourceA, sourceB],
			attachmentPathsByFileId: {
				a: "./images/a.png",
				b: "./images/b.png",
			},
		})
		const manager = new CanvasAssetImportManager(harness.canvas as never)

		const results = await manager.importAndConnectMany({
			assetIds: ["asset-b", "asset-a", "asset-b"],
			targetElementId: "image-target",
			targetKind: "image-generator",
			slot: { kind: "reference" },
			allowedMediaTypes: ["image"],
		})

		expect(results.map((result) => result.workspacePath)).toEqual([
			"./images/b.png",
			"./images/a.png",
		])
		expect(harness.canvas.connectionManager.connectElementsBatch).toHaveBeenCalledWith({
			edges: [
				expect.objectContaining({ targetElementId: "image-target" }),
				expect.objectContaining({ targetElementId: "image-target" }),
			],
		})
		expect(harness.register).toHaveBeenCalledTimes(1)
		expect(harness.register).toHaveBeenCalledWith(
			expect.objectContaining({
				targetElementId: "image-target",
				targetKind: "image-generator",
				orderedSources: results.map((result) => ({
					elementId: result.elementId,
					kind: "image",
				})),
			}),
		)
	})

	it("rejects video assets for an image-generator target before creating a node", async () => {
		const imageTarget: LayerElement = {
			id: "image-target",
			type: ElementTypeEnum.Image,
			activeContentId: "image-content",
			mainContentId: "image-content",
			contents: [{ contentId: "image-content" }],
		}
		const harness = createHarness({
			elements: [imageTarget],
			asset: {
				assetId: "asset-video",
				mediaType: "video",
				fileUrl: "https://example.test/source.mp4",
			},
		})
		const manager = new CanvasAssetImportManager(harness.canvas as never)

		await expect(
			manager.importAndConnectMany({
				assetIds: ["asset-video"],
				targetElementId: "image-target",
				targetKind: "image-generator",
				slot: { kind: "reference" },
				allowedMediaTypes: ["image"],
			}),
		).rejects.toThrow("not allowed")
		expect(harness.canvas.elementManager.create).not.toHaveBeenCalled()
		expect(harness.register).not.toHaveBeenCalled()
	})

	it("rolls back every newly created image node when a batch connection fails", async () => {
		const imageTarget: LayerElement = {
			id: "image-target",
			type: ElementTypeEnum.Image,
			activeContentId: "image-content",
			mainContentId: "image-content",
			contents: [{ contentId: "image-content" }],
		}
		const sourceA: LayerElement = {
			id: "source-a",
			type: ElementTypeEnum.Image,
			activeContentId: "source-a-content",
			mainContentId: "source-a-content",
			contents: [
				{ contentId: "source-a-content", src: "./images/a.png", assetId: "asset-a" },
			],
		}
		const sourceB: LayerElement = {
			...sourceA,
			id: "source-b",
			activeContentId: "source-b-content",
			mainContentId: "source-b-content",
			contents: [
				{ contentId: "source-b-content", src: "./images/b.png", assetId: "asset-b" },
			],
		}
		const harness = createHarness({
			elements: [imageTarget, sourceA, sourceB],
			attachmentPathsByFileId: { a: "./images/a.png", b: "./images/b.png" },
			connectBatch: vi.fn(() => ({
				status: "invalid" as const,
				reason: "missing-element" as const,
			})),
		})
		const manager = new CanvasAssetImportManager(harness.canvas as never)

		await expect(
			manager.importAndConnectMany({
				assetIds: ["asset-a", "asset-b"],
				targetElementId: "image-target",
				targetKind: "image-generator",
				slot: { kind: "reference" },
				allowedMediaTypes: ["image"],
			}),
		).rejects.toThrow("Failed to create")

		expect(harness.canvas.elementManager.delete).toHaveBeenCalledTimes(2)
		expect([...harness.elements.keys()].sort()).toEqual(
			["image-target", "source-a", "source-b", "video-target"].sort(),
		)
		expect(harness.register).not.toHaveBeenCalled()
	})

	it("rolls back nodes and connections when the session becomes stale after connect", async () => {
		const imageTarget: LayerElement = {
			id: "image-target",
			type: ElementTypeEnum.Image,
			activeContentId: "image-content",
			mainContentId: "image-content",
			contents: [{ contentId: "image-content" }],
		}
		const harness = createHarness({
			elements: [imageTarget],
			asset: {
				assetId: "asset-image",
				mediaType: "image",
				fileUrl: null,
				fileName: "stale-after-connect.png",
			},
			attachmentPathsByFileId: { "stale-after-connect": "./images/stale-after-connect.png" },
		})
		let current = true
		harness.canvas.connectionManager.connectElementsBatch = vi.fn(
			({ edges }: { edges: Array<{ sourceElementId: string; targetElementId: string }> }) => {
				const result = {
					status: "created" as const,
					connectionIds: edges.map(({ sourceElementId }) => `stale-${sourceElementId}`),
				}
				for (const [index, edge] of edges.entries()) {
					const connectionId = result.connectionIds[index]
					if (!connectionId) continue
					harness.canvas.connectionManager.getUpstreamConnections().push({
						id: connectionId,
						sourceElementId: edge.sourceElementId,
						targetElementId: edge.targetElementId,
					})
				}
				current = false
				return result
			},
		)
		const manager = new CanvasAssetImportManager(harness.canvas as never)

		await expect(
			manager.importAndConnectMany({
				assetIds: ["asset-image"],
				targetElementId: "image-target",
				targetKind: "image-generator",
				slot: { kind: "reference" },
				allowedMediaTypes: ["image"],
				isCurrent: () => current,
			}),
		).rejects.toThrow("Failed to create")

		expect(harness.canvas.elementManager.delete).toHaveBeenCalledTimes(1)
		expect(harness.canvas.connectionManager.removeConnections).toHaveBeenCalledWith(
			expect.arrayContaining([expect.stringMatching(/^stale-/)]),
			expect.objectContaining({ emitChange: false }),
		)
		expect(harness.register).not.toHaveBeenCalled()
	})

	it("restores the previous seed when seed registration fails after a batch connect", async () => {
		const harness = createHarness({
			asset: {
				assetId: "asset-audio",
				mediaType: "audio",
				fileUrl: null,
				fileName: "seed.mp3",
			},
			attachmentPathsByFileId: { seed: "./audios/seed.mp3" },
		})
		harness.register({
			targetElementId: "video-target",
			targetKind: "video-generator",
			rootElementIds: ["old-root"],
			orderedSources: [{ elementId: "old-source", kind: "audio" }],
			originRevision: "old-revision",
			createdBy: "assets",
			mediaRole: "reference",
		})
		harness.register.mockImplementationOnce(() => {
			harness.canvas.connectionAssociationSeedManager.remove("video-target")
			throw new Error("seed registration failed")
		})
		const manager = new CanvasAssetImportManager(harness.canvas as never)

		await expect(
			manager.importAndConnectMany({
				assetIds: ["asset-audio"],
				targetElementId: "video-target",
				targetKind: "video-generator",
				slot: { kind: "reference" },
				allowedMediaTypes: ["audio"],
			}),
		).rejects.toThrow("seed registration failed")

		expect(harness.canvas.elementManager.delete).toHaveBeenCalledTimes(1)
		expect(harness.canvas.connectionManager.removeConnections).toHaveBeenCalledWith(
			expect.arrayContaining([expect.stringMatching(/^batch-/)]),
			expect.objectContaining({ emitChange: false }),
		)
		expect(harness.canvas.connectionAssociationSeedManager.peek("video-target")).toMatchObject({
			targetElementId: "video-target",
			rootElementIds: ["old-root"],
			orderedSources: [{ elementId: "old-source", kind: "audio" }],
		})
	})

	it("stops a batch before creating nodes when the image edit session is stale", async () => {
		const imageTarget: LayerElement = {
			id: "image-target",
			type: ElementTypeEnum.Image,
			activeContentId: "image-content",
			mainContentId: "image-content",
			contents: [{ contentId: "image-content" }],
		}
		const harness = createHarness({
			elements: [imageTarget],
			attachmentPathsByFileId: { stale: "./images/stale.png" },
			asset: {
				assetId: "asset-image",
				mediaType: "image",
				fileUrl: null,
				fileName: "stale.png",
			},
		})
		const manager = new CanvasAssetImportManager(harness.canvas as never)

		await expect(
			manager.importAndConnectMany({
				assetIds: ["asset-image"],
				targetElementId: "image-target",
				targetKind: "image-generator",
				slot: { kind: "reference" },
				allowedMediaTypes: ["image"],
				isCurrent: () => false,
			}),
		).rejects.toThrow("stale")
		expect(harness.canvas.elementManager.create).not.toHaveBeenCalled()
		expect(harness.register).not.toHaveBeenCalled()
	})
})
