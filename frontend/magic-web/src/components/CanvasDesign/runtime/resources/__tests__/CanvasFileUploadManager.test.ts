import { describe, expect, it, vi } from "vitest"
import { CanvasFileUploadManager, type UploadRequest } from "../upload/CanvasFileUploadManager"
import {
	GenerationStatus,
	UploadSubDir,
	type UploadFile,
	type UploadFileResponse,
	type UploadSubDirType,
} from "../../../public/magic-types"
import type { CanvasElementClipboardFileMetadata } from "../clipboard/CanvasElementClipboard"
import { createTestResourceReferenceResolver } from "../../../public/__tests__/testResourceReferenceResolver"
import { ElementTypeEnum, type LayerElement, type VideoElement } from "../../document/types"
import { validateElementData } from "../../document/validateElement"
import { ImageElement } from "../../elements/image/ImageElement"

const resolveDesignAResourceReference = createTestResourceReferenceResolver()

interface RemoteTransferHarness {
	canvas: {
		id: string
		magicConfigManager: {
			config: {
				methods: {
					getFileInfo: ReturnType<typeof vi.fn>
					getFileResourceMeta?: ReturnType<typeof vi.fn>
				}
			}
		}
	}
	remoteResourceTransfers: Map<
		string,
		{
			status: "completed"
			result: UploadFileResponse
		}
	>
	getReusableCompletedRemoteResourceTransfer: CanvasFileUploadManager["getReusableCompletedRemoteResourceTransfer"]
	getCompletedRemoteResourceTransfer: CanvasFileUploadManager["getCompletedRemoteResourceTransfer"]
}

function createRemoteTransferManager(options: {
	getFileInfo: ReturnType<typeof vi.fn>
	getFileResourceMeta?: ReturnType<typeof vi.fn>
	result: UploadFileResponse
	metadata: CanvasElementClipboardFileMetadata
	sourceCanvasId: string
}): RemoteTransferHarness {
	const manager = Object.create(CanvasFileUploadManager.prototype) as RemoteTransferHarness
	manager.canvas = {
		id: "target-canvas",
		magicConfigManager: {
			config: {
				methods: {
					getFileInfo: options.getFileInfo,
					getFileResourceMeta: options.getFileResourceMeta,
				},
			},
		},
	}
	manager.remoteResourceTransfers = new Map([
		[
			`target-canvas:${options.sourceCanvasId}:${
				options.metadata.resourceIdentity || options.metadata.sourceRef?.src
			}`,
			{
				status: "completed",
				result: options.result,
			},
		],
	])
	return manager
}

describe("CanvasFileUploadManager upload sub directories", () => {
	it("routes video and audio files to their asset directories", () => {
		const manager = Object.create(CanvasFileUploadManager.prototype) as {
			getUploadSubDir: (file: File) => UploadSubDirType
		}

		expect(
			manager.getUploadSubDir(new File(["video"], "clip.mp4", { type: "video/mp4" })),
		).toBe(UploadSubDir.Videos)
		expect(
			manager.getUploadSubDir(new File(["audio"], "voice.mp3", { type: "audio/mpeg" })),
		).toBe(UploadSubDir.Audios)
		expect(
			manager.getUploadSubDir(new File(["image"], "photo.png", { type: "image/png" })),
		).toBe(UploadSubDir.Images)
	})
})

describe("CanvasFileUploadManager pending resource confirmation", () => {
	it("uses an explicit upload directory when the caller supplies one", async () => {
		const uploadFiles = vi.fn(async (files: UploadFile[]) => {
			expect(files).toHaveLength(1)
			return [
				{
					path: "./audios/asset.mp3",
					src: "https://example.test/asset.mp3",
					fileName: "asset.mp3",
				},
			]
		})
		const manager = Object.create(CanvasFileUploadManager.prototype) as CanvasFileUploadManager
		Object.assign(manager as unknown as Record<string, unknown>, {
			pendingResourcePaths: new Set<string>(),
			canvas: {
				eventEmitter: { emit: vi.fn() },
				magicConfigManager: { config: { methods: { uploadFiles } } },
			},
		})

		await manager.uploadDirect(
			[new File(["asset"], "asset.bin", { type: "application/octet-stream" })],
			undefined,
			undefined,
			{ uploadSubDir: UploadSubDir.Audios },
		)

		expect(uploadFiles.mock.calls[0]?.[0]?.[0]?.uploadSubDir).toBe(UploadSubDir.Audios)
		expect(manager.isPendingResourcePath("./audios/asset.mp3")).toBe(true)
	})

	it("keeps an uploaded resource pending until the resolver confirms its attachment", async () => {
		let attachmentConfirmed = false
		const resolveResourceReference = (
			input: Parameters<ResolveCanvasResourceReference>[0],
			options?: Parameters<ResolveCanvasResourceReference>[1],
		) =>
			createTestResourceReferenceResolver({
				attachmentPathsByFileId: attachmentConfirmed ? { newFile: "./images/new.png" } : {},
				attachmentsReady: true,
			})(input, options)
		const emit = vi.fn()
		const uploadResult: UploadFileResponse = {
			path: "./images/new.png",
			src: "https://example.test/new.png",
			fileName: "new.png",
		}
		const manager = Object.create(CanvasFileUploadManager.prototype) as CanvasFileUploadManager
		Object.assign(manager as unknown as Record<string, unknown>, {
			pendingResourcePaths: new Set<string>(),
			canvas: {
				eventEmitter: { emit },
				magicConfigManager: {
					config: {
						methods: {
							resolveResourceReference,
							uploadFiles: vi.fn(async (files: UploadFile[]) => {
								files[0]?.onUploadComplete?.(uploadResult)
								return [uploadResult]
							}),
						},
					},
				},
			},
		})

		await manager.uploadDirect([new File(["new"], "new.png", { type: "image/png" })])

		expect(manager.isPendingResourcePath("./images/new.png")).toBe(true)
		manager.reconcilePendingResourcePaths(["/画布A/images/other.png"])
		expect(manager.isPendingResourcePath("./images/new.png")).toBe(true)
		manager.reconcilePendingResourcePaths(["/画布A/images/new.png"])
		expect(manager.isPendingResourcePath("./images/new.png")).toBe(true)

		attachmentConfirmed = true
		manager.reconcilePendingResourcePaths([])

		expect(manager.isPendingResourcePath("./images/new.png")).toBe(false)
		expect(emit).toHaveBeenCalledWith({
			type: "upload:resource-pending-change",
			data: { paths: ["./images/new.png"] },
		})
	})
})

describe("CanvasFileUploadManager image replacement", () => {
	function createImageInstance(status = GenerationStatus.Completed) {
		const instance = Object.create(ImageElement.prototype) as ImageElement
		const content = { contentId: "content-1", status, assetId: "asset-before-replacement" }
		const data = {
			id: "image-1",
			type: ElementTypeEnum.Image,
			activeContentId: content.contentId,
			mainContentId: content.contentId,
			contents: [content],
		}
		Object.assign(instance, {
			getData: vi.fn(() => data),
			getActiveContentData: vi.fn(() => content),
			getContentData: vi.fn((contentId: string) =>
				contentId === content.contentId ? content : undefined,
			),
			updateActiveContentData: vi.fn(() => true),
			updateContentData: vi.fn(() => true),
			setOssSrc: vi.fn(),
		})
		return instance
	}

	it("replaces only the active image Content after upload and records one history entry", async () => {
		const image = createImageInstance()
		const disable = vi.fn()
		const enable = vi.fn()
		const recordHistoryImmediate = vi.fn()
		const primeCache = vi.fn()
		const requestImmediateImageLoad = vi.fn()
		const removeMarkersByImageContent = vi.fn()
		const manager = Object.create(CanvasFileUploadManager.prototype) as CanvasFileUploadManager
		const uploadResult: UploadFileResponse = {
			path: "./images/new.png",
			src: "https://example.test/new.png",
			fileName: "new.png",
		}
		Object.assign(manager as unknown as Record<string, unknown>, {
			canvas: {
				t: vi.fn((_key: string, fallback: string) => fallback),
				elementManager: { getElementInstance: vi.fn(() => image) },
				historyManager: { disable, enable, recordHistoryImmediate },
				imageResourceManager: { primeCache },
				markerManager: { removeMarkersByImageContent },
				visibilityManager: { requestImmediateImageLoad },
			},
			uploadDirect: vi.fn(async () => [uploadResult]),
		})

		await expect(
			manager.replaceImageElement({
				elementId: "image-1",
				file: new File(["new"], "new.png", { type: "image/png" }),
				contentId: null,
			}),
		).resolves.toBe(true)

		expect(image.updateContentData).toHaveBeenCalledWith(
			"content-1",
			{
				src: "./images/new.png",
				assetId: undefined,
				complianceStatus: undefined,
				complianceFailedReason: undefined,
				complianceCheckId: undefined,
				status: GenerationStatus.Completed,
				errorMessage: undefined,
				crop: undefined,
			},
			{ silent: false },
		)
		expect(image.setOssSrc).toHaveBeenCalledWith("https://example.test/new.png")
		expect(primeCache).toHaveBeenCalledWith("./images/new.png", uploadResult)
		expect(disable).toHaveBeenCalledTimes(1)
		expect(enable).toHaveBeenCalledTimes(1)
		expect(recordHistoryImmediate).toHaveBeenCalledTimes(1)
		expect(removeMarkersByImageContent).toHaveBeenCalledWith("image-1", "content-1")
		expect(requestImmediateImageLoad).toHaveBeenCalledWith("image-1", {
			reason: "image-replaced",
			priority: "critical",
		})
	})

	it("does not apply an uploaded replacement after document write access is revoked", async () => {
		const image = createImageInstance()
		let canWrite = true
		let resolveUpload!: (results: UploadFileResponse[]) => void
		const uploadDirect = vi.fn(
			() =>
				new Promise<UploadFileResponse[]>((resolve) => {
					resolveUpload = resolve
				}),
		)
		const primeCache = vi.fn()
		const manager = Object.create(CanvasFileUploadManager.prototype) as CanvasFileUploadManager
		Object.assign(manager as unknown as Record<string, unknown>, {
			canvas: {
				permissionManager: {
					can: vi.fn(() => canWrite),
				},
				elementManager: { getElementInstance: vi.fn(() => image) },
				imageResourceManager: { primeCache },
			},
			uploadDirect,
		})

		const replacement = manager.replaceImageElement({
			elementId: "image-1",
			file: new File(["new"], "new.png", { type: "image/png" }),
			contentId: "content-1",
		})
		canWrite = false
		resolveUpload([
			{
				path: "./images/new.png",
				src: "https://example.test/new.png",
				fileName: "new.png",
			},
		])

		await expect(replacement).resolves.toBe(false)
		expect(image.updateContentData).not.toHaveBeenCalled()
		expect(primeCache).not.toHaveBeenCalled()
	})

	it("replaces the active image Content with an existing project path", () => {
		const image = createImageInstance()
		const removeMarkersByImageContent = vi.fn()
		const manager = Object.create(CanvasFileUploadManager.prototype) as CanvasFileUploadManager
		Object.assign(manager as unknown as Record<string, unknown>, {
			canvas: {
				t: vi.fn((_key: string, fallback: string) => fallback),
				elementManager: { getElementInstance: vi.fn(() => image) },
				historyManager: {
					disable: vi.fn(),
					enable: vi.fn(),
					recordHistoryImmediate: vi.fn(),
				},
				markerManager: { removeMarkersByImageContent },
				visibilityManager: { requestImmediateImageLoad: vi.fn() },
			},
		})

		expect(
			manager.replaceImageElementFromProject({
				elementId: "image-1",
				path: "/images/project.webp",
				contentId: null,
			}),
		).toBe(true)
		expect(image.updateContentData).toHaveBeenCalledWith(
			"content-1",
			expect.objectContaining({
				src: "/images/project.webp",
				assetId: undefined,
				crop: undefined,
			}),
			{ silent: false },
		)
		expect(removeMarkersByImageContent).toHaveBeenCalledWith("image-1", "content-1")
	})

	it("targets the Content that was active when replacement started", () => {
		const image = createImageInstance(GenerationStatus.Completed)
		const removeMarkersByImageContent = vi.fn()
		const manager = Object.create(CanvasFileUploadManager.prototype) as CanvasFileUploadManager
		Object.assign(manager as unknown as Record<string, unknown>, {
			canvas: {
				t: vi.fn((_key: string, fallback: string) => fallback),
				elementManager: { getElementInstance: vi.fn(() => image) },
				historyManager: {
					disable: vi.fn(),
					enable: vi.fn(),
					recordHistoryImmediate: vi.fn(),
				},
				markerManager: { removeMarkersByImageContent },
				visibilityManager: { requestImmediateImageLoad: vi.fn() },
			},
		})

		expect(
			manager.replaceImageElementFromProject({
				elementId: "image-1",
				path: "/images/project.png",
				contentId: "content-1",
			}),
		).toBe(true)
		expect(image.updateContentData).toHaveBeenCalledWith(
			"content-1",
			expect.objectContaining({ src: "/images/project.png", crop: undefined }),
			{ silent: false },
		)
		expect(image.updateActiveContentData).not.toHaveBeenCalled()
		expect(removeMarkersByImageContent).toHaveBeenCalledWith("image-1", "content-1")
	})

	it("does not upload over an active processing image Content", async () => {
		const image = createImageInstance(GenerationStatus.Processing)
		const uploadDirect = vi.fn()
		const manager = Object.create(CanvasFileUploadManager.prototype) as CanvasFileUploadManager
		Object.assign(manager as unknown as Record<string, unknown>, {
			canvas: {
				t: vi.fn((_key: string, fallback: string) => fallback),
				elementManager: { getElementInstance: vi.fn(() => image) },
			},
			uploadDirect,
		})

		await expect(
			manager.replaceImageElement({
				elementId: "image-1",
				file: new File(["new"], "new.png", { type: "image/png" }),
				contentId: null,
			}),
		).resolves.toBe(false)
		expect(uploadDirect).not.toHaveBeenCalled()
		expect(image.updateActiveContentData).not.toHaveBeenCalled()
	})
})

describe("CanvasFileUploadManager video replacement", () => {
	it("writes an uploaded video to the Content captured before the async upload", async () => {
		let current: VideoElement = {
			id: "video-1",
			type: ElementTypeEnum.Video,
			x: 0,
			y: 0,
			width: 640,
			height: 360,
			contents: [
				{
					contentId: "video-content-1",
					src: "./videos/old-1.mp4",
					assetId: "asset-video",
					status: GenerationStatus.Completed,
				},
				{
					contentId: "video-content-2",
					src: "./videos/old-2.mp4",
					status: GenerationStatus.Completed,
				},
			],
			activeContentId: "video-content-1",
			mainContentId: "video-content-1",
		}
		const update = vi.fn((_elementId: string, patch: Partial<VideoElement>) => {
			current = { ...current, ...patch }
		})
		const primeCache = vi.fn()
		const disable = vi.fn()
		const enable = vi.fn()
		const recordHistoryImmediate = vi.fn()
		let resolveUpload: ((results: UploadFileResponse[]) => void) | undefined
		const uploadDirect = vi.fn(
			() =>
				new Promise<UploadFileResponse[]>((resolve) => {
					resolveUpload = resolve
				}),
		)
		const manager = Object.create(CanvasFileUploadManager.prototype) as CanvasFileUploadManager
		Object.assign(manager as unknown as Record<string, unknown>, {
			canvas: {
				t: vi.fn((_key: string, fallback: string) => fallback),
				elementManager: { getElementData: vi.fn(() => current), update },
				historyManager: { disable, enable, recordHistoryImmediate },
				videoResourceManager: { primeCache },
			},
			uploadDirect,
		})
		const uploadResult: UploadFileResponse = {
			path: "./videos/new.mp4",
			src: "https://example.test/new.mp4",
			fileName: "new.mp4",
		}

		const replacement = manager.replaceVideoElement({
			elementId: "video-1",
			file: new File(["new"], "new.mp4", { type: "video/mp4" }),
			contentId: "video-content-1",
		})
		current = { ...current, activeContentId: "video-content-2" }
		resolveUpload?.([uploadResult])

		await expect(replacement).resolves.toBe(true)
		expect(update).toHaveBeenCalledWith(
			"video-1",
			{
				contents: [
					{
						contentId: "video-content-1",
						src: "./videos/new.mp4",
						assetId: undefined,
						complianceStatus: undefined,
						complianceFailedReason: undefined,
						complianceCheckId: undefined,
						status: GenerationStatus.Completed,
						errorMessage: undefined,
					},
					{
						contentId: "video-content-2",
						src: "./videos/old-2.mp4",
						status: GenerationStatus.Completed,
					},
				],
			},
			{ silent: false },
		)
		expect(primeCache).toHaveBeenCalledWith("./videos/new.mp4", uploadResult)
		expect(recordHistoryImmediate).toHaveBeenCalledTimes(1)
	})

	it("replaces video from a supported project path and rejects non-video paths", () => {
		const current = {
			id: "video-1",
			type: ElementTypeEnum.Video,
			contents: [
				{
					contentId: "video-content-1",
					src: "./videos/old.mp4",
					assetId: "asset-video",
					status: GenerationStatus.Failed,
					errorMessage: "failed",
				},
			],
			activeContentId: "video-content-1",
			mainContentId: "video-content-1",
		}
		const update = vi.fn()
		const manager = Object.create(CanvasFileUploadManager.prototype) as CanvasFileUploadManager
		Object.assign(manager as unknown as Record<string, unknown>, {
			canvas: {
				t: vi.fn((_key: string, fallback: string) => fallback),
				elementManager: { getElementData: vi.fn(() => current), update },
				historyManager: {
					disable: vi.fn(),
					enable: vi.fn(),
					recordHistoryImmediate: vi.fn(),
				},
			},
		})

		expect(
			manager.replaceVideoElementFromProject({
				elementId: "video-1",
				path: "/videos/project.webm",
				contentId: "video-content-1",
			}),
		).toBe(true)
		expect(update).toHaveBeenCalledWith(
			"video-1",
			{
				contents: [
					{
						contentId: "video-content-1",
						src: "/videos/project.webm",
						assetId: undefined,
						complianceStatus: undefined,
						complianceFailedReason: undefined,
						complianceCheckId: undefined,
						status: GenerationStatus.Completed,
						errorMessage: undefined,
					},
				],
			},
			{ silent: false },
		)
		expect(() =>
			manager.replaceVideoElementFromProject({
				elementId: "video-1",
				path: "/images/not-video.png",
				contentId: "video-content-1",
			}),
		).toThrow("不支持的视频格式")
	})
})

describe("CanvasFileUploadManager audio element uploads", () => {
	it("creates a temporary audio placeholder before upload and converts it after success", async () => {
		let uploadContext:
			| {
					onUploadComplete?: (elementId: string, result: UploadFileResponse) => void
					onUploadFailed?: (elementId: string, error: Error) => void
			  }
			| undefined
		let temporaryElement: LayerElement | undefined
		const createTemporary = vi.fn(
			(
				element: LayerElement,
				context: {
					onUploadComplete?: (elementId: string, result: UploadFileResponse) => void
					onUploadFailed?: (elementId: string, error: Error) => void
				},
			) => {
				temporaryElement = element
				uploadContext = context
			},
		)
		const convertToPermament = vi.fn()
		const disable = vi.fn()
		const enable = vi.fn()
		const recordHistoryImmediate = vi.fn()
		const primeCache = vi.fn()
		const manager = Object.create(CanvasFileUploadManager.prototype) as CanvasFileUploadManager
		Object.assign(manager as unknown as Record<string, unknown>, {
			pendingUploadBatches: [],
			currentPendingBatchId: null,
			canvas: {
				eventEmitter: { emit: vi.fn() },
				magicConfigManager: { config: { methods: { uploadFiles: vi.fn() } } },
				elementManager: {
					getElementsDict: vi.fn(() => ({})),
					getMaxZIndexInLevel: vi.fn(() => 2),
					createTemporary,
					hasElement: vi.fn(() => true),
					isTemporary: vi.fn(() => true),
					getElementData: vi.fn(() => temporaryElement),
					delete: vi.fn(),
					convertToPermament,
				},
				historyManager: { disable, enable, recordHistoryImmediate },
				audioResourceManager: { primeCache },
			},
		})
		const onUploadComplete = vi.fn()
		const file = new File(["audio"], "voice.mp3", { type: "audio/mpeg" })

		const pending = manager.uploadFileElement({
			file,
			position: { x: 300, y: 200 },
			onUploadComplete,
		})
		expect(createTemporary).toHaveBeenCalledTimes(1)
		const createdTemporaryElement = createTemporary.mock.calls[0]?.[0] as Record<
			string,
			unknown
		>
		expect(createdTemporaryElement).toMatchObject({
			type: ElementTypeEnum.Audio,
			width: 1280,
			height: 720,
		})
		expect(createdTemporaryElement).not.toHaveProperty("name")
		expect(
			(createdTemporaryElement.contents as Array<Record<string, unknown>>)[0]?.src,
		).toBeUndefined()
		expect(createdTemporaryElement).not.toHaveProperty("status")
		expect(createdTemporaryElement).not.toHaveProperty("errorMessage")
		expect(disable).toHaveBeenCalledTimes(1)
		expect(enable).toHaveBeenCalledTimes(1)
		expect(recordHistoryImmediate).not.toHaveBeenCalled()
		const elementId = createdTemporaryElement.id as string
		await expect(pending).resolves.toBe(elementId)
		expect(convertToPermament).not.toHaveBeenCalled()

		const uploadResult: UploadFileResponse = {
			path: "./audios/voice.mp3",
			src: "https://example.test/voice.mp3",
			fileName: "voice.mp3",
		}
		uploadContext?.onUploadComplete?.(elementId, uploadResult)

		expect(convertToPermament).toHaveBeenCalledWith(
			elementId,
			expect.objectContaining({
				contents: [expect.objectContaining({ src: "./audios/voice.mp3" })],
			}),
			{ silent: true },
		)
		expect(primeCache).toHaveBeenCalledWith("./audios/voice.mp3", uploadResult)
		expect(disable).toHaveBeenCalledTimes(1)
		expect(enable).toHaveBeenCalledTimes(1)
		expect(recordHistoryImmediate).toHaveBeenCalledTimes(1)
		expect(onUploadComplete).toHaveBeenCalledWith(elementId, uploadResult)
	})

	it("returns the audio placeholder before a locked upload queue is released", async () => {
		const uploadResult: UploadFileResponse = {
			path: "./audios/voice.mp3",
			src: "https://example.test/voice.mp3",
			fileName: "voice.mp3",
		}
		const uploadFiles = vi.fn(async (files: UploadFile[]) => {
			files[0]?.onUploadComplete(uploadResult)
			return [uploadResult]
		})
		const convertToPermament = vi.fn()
		const primeCache = vi.fn()
		const manager = Object.create(CanvasFileUploadManager.prototype) as CanvasFileUploadManager
		let temporaryElement: LayerElement | undefined
		const createTemporary = vi.fn(
			(
				element: LayerElement,
				context: {
					uploadFiles: File[]
					onUploadComplete?: (elementId: string, result: UploadFileResponse) => void
					onUploadFailed?: (elementId: string, error: Error) => void
				},
			) => {
				temporaryElement = element
				manager.queueUpload({
					elementId: element.id,
					file: context.uploadFiles[0],
					onUploadComplete: (result) => context.onUploadComplete?.(element.id, result),
					onUploadFailed: (error) => context.onUploadFailed?.(element.id, error),
				})
			},
		)
		Object.assign(manager as unknown as Record<string, unknown>, {
			isLocked: false,
			isProcessingQueue: false,
			uploadQueue: [],
			pendingUploadBatches: [],
			currentPendingBatchId: null,
			canvas: {
				eventEmitter: { emit: vi.fn() },
				magicConfigManager: { config: { methods: { uploadFiles } } },
				elementManager: {
					getElementsDict: vi.fn(() => ({})),
					getMaxZIndexInLevel: vi.fn(() => 0),
					createTemporary,
					hasElement: vi.fn(() => true),
					isTemporary: vi.fn(() => true),
					getElementData: vi.fn(() => temporaryElement),
					convertToPermament,
				},
				historyManager: {
					disable: vi.fn(),
					enable: vi.fn(),
					recordHistoryImmediate: vi.fn(),
				},
				audioResourceManager: { primeCache },
			},
		})

		manager.lock()
		const elementId = await manager.uploadFileElement({
			file: new File(["audio"], "voice.mp3", { type: "audio/mpeg" }),
			position: { x: 0, y: 0 },
			manageHistory: false,
		})

		expect(elementId).toEqual(expect.any(String))
		expect(createTemporary).toHaveBeenCalledTimes(1)
		expect(createTemporary.mock.calls[0]?.[1]).not.toHaveProperty("overwrite")
		expect(uploadFiles).not.toHaveBeenCalled()

		await manager.unlock()

		expect(uploadFiles).toHaveBeenCalledTimes(1)
		expect(uploadFiles.mock.calls[0]?.[0]?.[0]?.overwrite).toBe(true)
		expect(convertToPermament).toHaveBeenCalledWith(
			elementId,
			expect.objectContaining({
				contents: [expect.objectContaining({ src: "./audios/voice.mp3" })],
			}),
			{ silent: true },
		)
		expect(primeCache).toHaveBeenCalledWith("./audios/voice.mp3", uploadResult)
	})

	it("replaces only the audio source after upload succeeds and records one history entry", async () => {
		const update = vi.fn()
		const disable = vi.fn()
		const enable = vi.fn()
		const recordHistoryImmediate = vi.fn()
		const primeCache = vi.fn()
		const invalidatePath = vi.fn()
		const release = vi.fn()
		const invalidateAudioLoadRequest = vi.fn()
		const manager = Object.create(CanvasFileUploadManager.prototype) as CanvasFileUploadManager
		const current = {
			id: "audio-1",
			type: ElementTypeEnum.Audio,
			x: 10,
			y: 20,
			width: 640,
			height: 720,
			name: "原名称",
			contents: [
				{
					contentId: "content-1",
					src: "./audios/old.mp3",
					assetId: "asset-audio",
				},
			],
			activeContentId: "content-1",
			mainContentId: "content-1",
		}
		const uploadResult: UploadFileResponse = {
			path: "./audios/new.mp3",
			src: "https://example.test/new.mp3",
			fileName: "new.mp3",
		}
		Object.assign(manager as unknown as Record<string, unknown>, {
			canvas: {
				t: vi.fn((_key: string, fallback: string) => fallback),
				elementManager: { getElementData: vi.fn(() => current), update },
				historyManager: { disable, enable, recordHistoryImmediate },
				audioResourceManager: {
					getResourceIdentity: vi.fn((path: string) => path),
					primeCache,
				},
				audioPlaybackManager: { release },
				audioWaveformManager: { invalidatePath },
				visibilityManager: { invalidateAudioLoadRequest },
			},
			uploadDirect: vi.fn(async () => [uploadResult]),
		})

		await expect(
			manager.replaceAudioElement({
				elementId: "audio-1",
				file: new File(["new"], "new.mp3", { type: "audio/mpeg" }),
			}),
		).resolves.toBe(true)

		expect(update).toHaveBeenCalledWith(
			"audio-1",
			{
				contents: [
					{
						contentId: "content-1",
						src: "./audios/new.mp3",
						assetId: undefined,
					},
				],
			},
			{ silent: false },
		)
		expect(primeCache).toHaveBeenCalledWith("./audios/new.mp3", uploadResult)
		expect(release).toHaveBeenCalledWith("audio-1")
		expect(invalidatePath).toHaveBeenCalledWith("./audios/old.mp3")
		expect(disable).toHaveBeenCalledTimes(1)
		expect(enable).toHaveBeenCalledTimes(1)
		expect(recordHistoryImmediate).toHaveBeenCalledTimes(1)
	})

	it("adds an uploaded source to an empty audio node without invalidating prior resources", async () => {
		const update = vi.fn()
		const disable = vi.fn()
		const enable = vi.fn()
		const recordHistoryImmediate = vi.fn()
		const primeCache = vi.fn()
		const release = vi.fn()
		const invalidatePath = vi.fn()
		const invalidateAudioLoadRequest = vi.fn()
		const manager = Object.create(CanvasFileUploadManager.prototype) as CanvasFileUploadManager
		const current = {
			id: "audio-empty",
			type: ElementTypeEnum.Audio,
			contents: [{ contentId: "content-1" }],
			activeContentId: "content-1",
			mainContentId: "content-1",
		}
		const uploadResult: UploadFileResponse = {
			path: "./audios/voice.mp3",
			src: "https://example.test/voice.mp3",
			fileName: "voice.mp3",
		}
		Object.assign(manager as unknown as Record<string, unknown>, {
			canvas: {
				t: vi.fn((_key: string, fallback: string) => fallback),
				elementManager: { getElementData: vi.fn(() => current), update },
				historyManager: { disable, enable, recordHistoryImmediate },
				audioResourceManager: { primeCache },
				audioPlaybackManager: { release },
				audioWaveformManager: { invalidatePath },
				visibilityManager: { invalidateAudioLoadRequest },
			},
			uploadDirect: vi.fn(async () => [uploadResult]),
		})

		await expect(
			manager.replaceAudioElement({
				elementId: "audio-empty",
				file: new File(["voice"], "voice.mp3", { type: "audio/mpeg" }),
			}),
		).resolves.toBe(true)

		expect(update).toHaveBeenCalledWith(
			"audio-empty",
			{
				contents: [
					{
						contentId: "content-1",
						src: "./audios/voice.mp3",
						assetId: undefined,
					},
				],
			},
			{ silent: false },
		)
		expect(primeCache).toHaveBeenCalledWith("./audios/voice.mp3", uploadResult)
		expect(release).not.toHaveBeenCalled()
		expect(invalidatePath).not.toHaveBeenCalled()
		expect(invalidateAudioLoadRequest).not.toHaveBeenCalled()
		expect(disable).toHaveBeenCalledTimes(1)
		expect(enable).toHaveBeenCalledTimes(1)
		expect(recordHistoryImmediate).toHaveBeenCalledTimes(1)
	})

	it("writes only v3-allowed audio content fields so element validation passes", async () => {
		const update = vi.fn()
		const manager = Object.create(CanvasFileUploadManager.prototype) as CanvasFileUploadManager
		const current = {
			id: "audio-empty",
			type: ElementTypeEnum.Audio,
			contents: [{ contentId: "content-1" }],
			activeContentId: "content-1",
			mainContentId: "content-1",
		}
		const uploadResult: UploadFileResponse = {
			path: "./audios/voice.mp3",
			src: "https://example.test/voice.mp3",
			fileName: "voice.mp3",
		}
		Object.assign(manager as unknown as Record<string, unknown>, {
			canvas: {
				t: vi.fn((_key: string, fallback: string) => fallback),
				elementManager: { getElementData: vi.fn(() => current), update },
				historyManager: {
					disable: vi.fn(),
					enable: vi.fn(),
					recordHistoryImmediate: vi.fn(),
				},
				audioResourceManager: { primeCache: vi.fn() },
				audioPlaybackManager: { release: vi.fn() },
				audioWaveformManager: { invalidatePath: vi.fn() },
				visibilityManager: { invalidateAudioLoadRequest: vi.fn() },
			},
			uploadDirect: vi.fn(async () => [uploadResult]),
		})

		await expect(
			manager.replaceAudioElement({
				elementId: "audio-empty",
				file: new File(["voice"], "voice.mp3", { type: "audio/mpeg" }),
			}),
		).resolves.toBe(true)

		expect(update).toHaveBeenCalledTimes(1)
		const contents = update.mock.calls[0]?.[1]?.contents as
			Array<Record<string, unknown>> | undefined
		expect(contents).toBeDefined()
		if (!contents) throw new Error("expected replacement contents")
		expect(Object.keys(contents[0]).sort()).toEqual(["assetId", "contentId", "src"])

		const merged = { ...current, contents }
		expect(() => validateElementData(merged)).not.toThrow()
	})

	it("keeps the previous audio unchanged when replacement upload fails", async () => {
		const update = vi.fn()
		const recordHistoryImmediate = vi.fn()
		const manager = Object.create(CanvasFileUploadManager.prototype) as CanvasFileUploadManager
		Object.assign(manager as unknown as Record<string, unknown>, {
			canvas: {
				t: vi.fn((_key: string, fallback: string) => fallback),
				elementManager: {
					getElementData: vi.fn(() => ({
						id: "audio-1",
						type: ElementTypeEnum.Audio,
						contents: [
							{
								contentId: "content-1",
								src: "./audios/old.mp3",
								assetId: "asset-audio",
							},
						],
						activeContentId: "content-1",
						mainContentId: "content-1",
					})),
					update,
				},
				historyManager: { recordHistoryImmediate },
			},
			uploadDirect: vi.fn(async () => {
				throw new Error("upload failed")
			}),
		})

		await expect(
			manager.replaceAudioElement({
				elementId: "audio-1",
				file: new File(["new"], "new.mp3", { type: "audio/mpeg" }),
			}),
		).rejects.toThrow("upload failed")
		expect(update).not.toHaveBeenCalled()
		expect(recordHistoryImmediate).not.toHaveBeenCalled()
	})

	it("replaces audio with an existing project path without uploading", () => {
		const update = vi.fn()
		const disable = vi.fn()
		const enable = vi.fn()
		const recordHistoryImmediate = vi.fn()
		const release = vi.fn()
		const invalidatePath = vi.fn()
		const invalidateAudioLoadRequest = vi.fn()
		const manager = Object.create(CanvasFileUploadManager.prototype) as CanvasFileUploadManager
		Object.assign(manager as unknown as Record<string, unknown>, {
			canvas: {
				t: vi.fn((_key: string, fallback: string) => fallback),
				elementManager: {
					getElementData: vi.fn(() => ({
						id: "audio-1",
						type: ElementTypeEnum.Audio,
						contents: [{ contentId: "content-1", src: "./audios/old.mp3" }],
						activeContentId: "content-1",
						mainContentId: "content-1",
					})),
					update,
				},
				historyManager: { disable, enable, recordHistoryImmediate },
				audioResourceManager: {
					getResourceIdentity: vi.fn((path: string) => path),
				},
				audioPlaybackManager: { release },
				audioWaveformManager: { invalidatePath },
				visibilityManager: { invalidateAudioLoadRequest },
			},
		})

		expect(
			manager.replaceAudioElementFromProject({
				elementId: "audio-1",
				path: "/audios/project.m4a",
			}),
		).toBe(true)

		expect(update).toHaveBeenCalledWith(
			"audio-1",
			{
				contents: [
					{
						contentId: "content-1",
						src: "/audios/project.m4a",
						assetId: undefined,
					},
				],
			},
			{ silent: false },
		)
		expect(release).toHaveBeenCalledWith("audio-1")
		expect(invalidatePath).toHaveBeenCalledWith("./audios/old.mp3")
		expect(recordHistoryImmediate).toHaveBeenCalledTimes(1)
	})

	it("adds a project audio path to an empty audio node", () => {
		const update = vi.fn()
		const disable = vi.fn()
		const enable = vi.fn()
		const recordHistoryImmediate = vi.fn()
		const release = vi.fn()
		const invalidatePath = vi.fn()
		const invalidateAudioLoadRequest = vi.fn()
		const manager = Object.create(CanvasFileUploadManager.prototype) as CanvasFileUploadManager
		Object.assign(manager as unknown as Record<string, unknown>, {
			canvas: {
				t: vi.fn((_key: string, fallback: string) => fallback),
				elementManager: {
					getElementData: vi.fn(() => ({
						id: "audio-empty",
						type: ElementTypeEnum.Audio,
						contents: [{ contentId: "content-1" }],
						activeContentId: "content-1",
						mainContentId: "content-1",
					})),
					update,
				},
				historyManager: { disable, enable, recordHistoryImmediate },
				audioResourceManager: {},
				audioPlaybackManager: { release },
				audioWaveformManager: { invalidatePath },
				visibilityManager: { invalidateAudioLoadRequest },
			},
		})

		expect(
			manager.replaceAudioElementFromProject({
				elementId: "audio-empty",
				path: "/audios/project.m4a",
			}),
		).toBe(true)

		expect(update).toHaveBeenCalledWith(
			"audio-empty",
			{
				contents: [
					{
						contentId: "content-1",
						src: "/audios/project.m4a",
						assetId: undefined,
					},
				],
			},
			{ silent: false },
		)
		expect(release).not.toHaveBeenCalled()
		expect(invalidatePath).not.toHaveBeenCalled()
		expect(invalidateAudioLoadRequest).not.toHaveBeenCalled()
		expect(recordHistoryImmediate).toHaveBeenCalledTimes(1)
	})

	it("replaces the captured audio Content without retargeting the active Content", () => {
		const current = {
			id: "audio-1",
			type: ElementTypeEnum.Audio,
			contents: [
				{
					contentId: "audio-content-1",
					src: "./audios/old-1.mp3",
					assetId: "asset-audio",
				},
				{ contentId: "audio-content-2", src: "./audios/old-2.mp3" },
			],
			activeContentId: "audio-content-2",
			mainContentId: "audio-content-1",
		}
		const update = vi.fn()
		const release = vi.fn()
		const invalidatePath = vi.fn()
		const manager = Object.create(CanvasFileUploadManager.prototype) as CanvasFileUploadManager
		Object.assign(manager as unknown as Record<string, unknown>, {
			canvas: {
				t: vi.fn((_key: string, fallback: string) => fallback),
				elementManager: { getElementData: vi.fn(() => current), update },
				historyManager: {
					disable: vi.fn(),
					enable: vi.fn(),
					recordHistoryImmediate: vi.fn(),
				},
				audioResourceManager: {},
				audioPlaybackManager: { release },
				audioWaveformManager: { invalidatePath },
				visibilityManager: { invalidateAudioLoadRequest: vi.fn() },
			},
		})

		expect(
			manager.replaceAudioElementFromProject({
				elementId: "audio-1",
				path: "/audios/project.mp3",
				contentId: "audio-content-1",
			}),
		).toBe(true)
		expect(update).toHaveBeenCalledWith(
			"audio-1",
			{
				contents: [
					{
						contentId: "audio-content-1",
						src: "/audios/project.mp3",
						assetId: undefined,
					},
					{ contentId: "audio-content-2", src: "./audios/old-2.mp3" },
				],
			},
			{ silent: false },
		)
		expect(release).not.toHaveBeenCalled()
		expect(invalidatePath).not.toHaveBeenCalled()
	})

	it("rejects a non-audio project path before changing the element", () => {
		const update = vi.fn()
		const manager = Object.create(CanvasFileUploadManager.prototype) as CanvasFileUploadManager
		Object.assign(manager as unknown as Record<string, unknown>, {
			canvas: {
				t: vi.fn((_key: string, fallback: string) => fallback),
				elementManager: { update },
			},
		})

		expect(() =>
			manager.replaceAudioElementFromProject({
				elementId: "audio-1",
				path: "/images/not-audio.png",
			}),
		).toThrow("不支持的音频格式")
		expect(update).not.toHaveBeenCalled()
	})

	it("returns the audio placeholder immediately and removes it without history on failure", async () => {
		let uploadContext:
			| {
					onUploadFailed?: (elementId: string, error: Error) => void
			  }
			| undefined
		let hasElement = true
		const createTemporary = vi.fn(
			(
				_element: LayerElement,
				context: { onUploadFailed?: (elementId: string, error: Error) => void },
			) => {
				uploadContext = context
			},
		)
		const deleteElement = vi.fn(() => {
			hasElement = false
		})
		const disable = vi.fn()
		const enable = vi.fn()
		const recordHistoryImmediate = vi.fn()
		const manager = Object.create(CanvasFileUploadManager.prototype) as CanvasFileUploadManager
		Object.assign(manager as unknown as Record<string, unknown>, {
			pendingUploadBatches: [],
			currentPendingBatchId: null,
			canvas: {
				eventEmitter: { emit: vi.fn() },
				magicConfigManager: { config: { methods: { uploadFiles: vi.fn() } } },
				elementManager: {
					getElementsDict: vi.fn(() => ({})),
					getMaxZIndexInLevel: vi.fn(() => 0),
					createTemporary,
					hasElement: vi.fn(() => hasElement),
					delete: deleteElement,
				},
				historyManager: { disable, enable, recordHistoryImmediate },
				audioResourceManager: { primeCache: vi.fn() },
			},
		})
		const onUploadFailed = vi.fn()
		const pending = manager.uploadFileElement({
			file: new File(["audio"], "voice.mp3", { type: "audio/mpeg" }),
			position: { x: 0, y: 0 },
			onUploadFailed,
		})
		const temporaryElement = createTemporary.mock.calls[0]?.[0] as Record<string, unknown>
		await expect(pending).resolves.toBe(temporaryElement.id)
		expect(deleteElement).not.toHaveBeenCalled()
		const uploadError = new Error("upload failed")
		uploadContext?.onUploadFailed?.(temporaryElement.id as string, uploadError)

		expect(deleteElement).toHaveBeenCalledWith(temporaryElement.id)
		expect(disable).toHaveBeenCalledTimes(2)
		expect(enable).toHaveBeenCalledTimes(2)
		expect(recordHistoryImmediate).not.toHaveBeenCalled()
		expect(onUploadFailed).toHaveBeenCalledWith(temporaryElement.id, uploadError)
	})
})

describe("CanvasFileUploadManager upload queue", () => {
	it("settles each queued upload request only once when batch upload rejects after per-file callbacks", async () => {
		const firstFailure = new Error("first failed")
		const batchFailure = new Error("batch failed")
		const uploadFiles = vi.fn(async (files: UploadFile[]) => {
			files[0]?.onUploadFailed(firstFailure)
			throw batchFailure
		})
		const firstRequest: UploadRequest = {
			file: new File(["first"], "first.png", { type: "image/png" }),
			onUploadComplete: vi.fn(),
			onUploadFailed: vi.fn(),
		}
		const secondRequest: UploadRequest = {
			file: new File(["second"], "second.png", { type: "image/png" }),
			onUploadComplete: vi.fn(),
			onUploadFailed: vi.fn(),
		}
		const manager = Object.create(CanvasFileUploadManager.prototype) as {
			canvas: {
				magicConfigManager: {
					config: {
						methods: {
							uploadFiles: typeof uploadFiles
						}
					}
				}
			}
			uploadQueue: UploadRequest[]
			isProcessingQueue: boolean
			currentReferenceImages?: string[]
			processQueue: () => Promise<void>
		}
		manager.canvas = {
			magicConfigManager: {
				config: {
					methods: { uploadFiles },
				},
			},
		}
		manager.uploadQueue = [firstRequest, secondRequest]
		manager.isProcessingQueue = false

		await manager.processQueue()

		expect(firstRequest.onUploadFailed).toHaveBeenCalledTimes(1)
		expect(firstRequest.onUploadFailed).toHaveBeenCalledWith(firstFailure)
		expect(secondRequest.onUploadFailed).toHaveBeenCalledTimes(1)
		expect(secondRequest.onUploadFailed).toHaveBeenCalledWith(expect.any(Error))
		expect(vi.mocked(secondRequest.onUploadFailed).mock.calls[0]?.[0].message).toBe(
			"batch failed",
		)
		expect(firstRequest.onUploadComplete).not.toHaveBeenCalled()
		expect(secondRequest.onUploadComplete).not.toHaveBeenCalled()
		expect(manager.isProcessingQueue).toBe(false)
	})

	it("settles a queued request once when its file upload progress reaches 100", async () => {
		const uploadFiles = vi.fn(async (files: UploadFile[]) => {
			files[0]?.onUploadProgress?.(42)
			files[0]?.onUploadProgress?.(100)
			files[0]?.onUploadProgress?.(100)
		})
		const request: UploadRequest = {
			file: new File(["first"], "first.png", { type: "image/png" }),
			onUploadComplete: vi.fn(),
			onUploadFailed: vi.fn(),
			onUploadSettled: vi.fn(),
		}
		const manager = Object.create(CanvasFileUploadManager.prototype) as {
			canvas: {
				magicConfigManager: {
					config: {
						methods: {
							uploadFiles: typeof uploadFiles
						}
					}
				}
			}
			uploadQueue: UploadRequest[]
			isProcessingQueue: boolean
			currentReferenceImages?: string[]
			processQueue: () => Promise<void>
		}
		manager.canvas = {
			magicConfigManager: {
				config: {
					methods: { uploadFiles },
				},
			},
		}
		manager.uploadQueue = [request]
		manager.isProcessingQueue = false

		await manager.processQueue()

		expect(request.onUploadSettled).toHaveBeenCalledTimes(1)
		expect(request.onUploadComplete).not.toHaveBeenCalled()
		expect(request.onUploadFailed).not.toHaveBeenCalled()
	})
})

describe("CanvasFileUploadManager remote resource load deferrals", () => {
	it("defers resource loads until all registrations for the same path are released", () => {
		const emit = vi.fn()
		const manager = Object.create(CanvasFileUploadManager.prototype) as {
			canvas: {
				id: string
				eventEmitter: { emit: ReturnType<typeof vi.fn> }
				magicConfigManager: {
					config: {
						methods: {
							resolveResourceReference: typeof resolveDesignAResourceReference
						}
					}
				}
			}
			pendingRemoteResourceLoadDeferrals: Map<string, number>
			registerPendingRemoteResourceLoadDeferral: CanvasFileUploadManager["registerPendingRemoteResourceLoadDeferral"]
			shouldDeferRemoteResourceLoad: CanvasFileUploadManager["shouldDeferRemoteResourceLoad"]
			getRemoteResourceLoadDeferralKey: CanvasFileUploadManager["getRemoteResourceLoadDeferralKey"]
		}
		manager.canvas = {
			id: "target-canvas",
			eventEmitter: { emit },
			magicConfigManager: {
				config: {
					methods: { resolveResourceReference: resolveDesignAResourceReference },
				},
			},
		}
		manager.pendingRemoteResourceLoadDeferrals = new Map()

		const releaseA = manager.registerPendingRemoteResourceLoadDeferral("./videos/reference.mp4")
		const releaseB = manager.registerPendingRemoteResourceLoadDeferral(
			"/画布A/videos/reference.mp4",
		)

		expect(manager.shouldDeferRemoteResourceLoad("./videos/reference.mp4")).toBe(true)
		expect(manager.shouldDeferRemoteResourceLoad("/画布A/videos/reference.mp4")).toBe(true)
		expect(manager.shouldDeferRemoteResourceLoad("https://example.test/reference.mp4")).toBe(
			false,
		)

		releaseA()
		expect(manager.shouldDeferRemoteResourceLoad("./videos/reference.mp4")).toBe(true)
		expect(emit).not.toHaveBeenCalled()

		releaseB()
		expect(manager.shouldDeferRemoteResourceLoad("./videos/reference.mp4")).toBe(false)
		expect(emit).toHaveBeenCalledTimes(1)
		expect(emit).toHaveBeenCalledWith({
			type: "resource:remote-load-deferral-released",
			data: {
				path: "/画布A/videos/reference.mp4",
				key: "workspace:/画布A/videos/reference.mp4",
			},
		})

		releaseB()
		expect(emit).toHaveBeenCalledTimes(1)
	})
})

describe("CanvasFileUploadManager remote resource transfer cache", () => {
	it("uses source resource identity to reuse transfers across path aliases and roles", () => {
		const manager = Object.create(CanvasFileUploadManager.prototype) as {
			canvas: { id: string }
			getRemoteResourceTransferKey: (
				options: Parameters<CanvasFileUploadManager["transferRemoteResource"]>[0],
			) => string | undefined
		}
		manager.canvas = { id: "target-canvas" }

		const elementMediaKey = manager.getRemoteResourceTransferKey({
			sourceCanvasId: "source-canvas",
			metadata: {
				id: "element-media",
				elementId: "source-image",
				filename: "image.png",
				mimeType: "image/png",
				fileSize: 0,
				role: "element-media",
				resourceIdentity: "workspace:/画布A/images/image.png",
				sourceRef: { src: "./images/image.png" },
			},
		})
		const generationResourceKey = manager.getRemoteResourceTransferKey({
			sourceCanvasId: "source-canvas",
			metadata: {
				id: "generation-resource:0",
				elementId: "generation-resource:0",
				filename: "image.png",
				mimeType: "image/png",
				fileSize: 0,
				role: "generation-resource",
				resourcePath: "/画布A/images/image.png",
				resourceIdentity: "workspace:/画布A/images/image.png",
				sourceRef: { src: "/画布A/images/image.png" },
			},
		})

		expect(elementMediaKey).toBe(
			"target-canvas:source-canvas:workspace:/画布A/images/image.png",
		)
		expect(generationResourceKey).toBe(elementMediaKey)
	})

	it("reuses completed element media transfers without creating another upload", async () => {
		const result: UploadFileResponse = {
			path: "target/videos/video.mp4",
			src: "https://target.test/video.mp4",
			fileName: "video.mp4",
			expires_at: "2030-01-01 00:00:00",
		}
		const manager = Object.create(CanvasFileUploadManager.prototype) as {
			canvas: {
				id: string
				magicConfigManager: {
					config: {
						methods: {
							uploadFiles: ReturnType<typeof vi.fn>
						}
					}
				}
			}
			currentPendingBatchId: string | null
			remoteResourceTransfers: Map<string, unknown>
			getReusableCompletedRemoteResourceTransfer: ReturnType<typeof vi.fn>
			getRemoteResourceTransferKey: ReturnType<typeof vi.fn>
			createRemoteResourceTransferPromise: ReturnType<typeof vi.fn>
			persistCompletedRemoteResourceTransfer: ReturnType<typeof vi.fn>
			transferRemoteResource: CanvasFileUploadManager["transferRemoteResource"]
		}
		manager.canvas = {
			id: "target-canvas",
			magicConfigManager: {
				config: {
					methods: {
						uploadFiles: vi.fn(),
					},
				},
			},
		}
		manager.currentPendingBatchId = null
		manager.remoteResourceTransfers = new Map()
		manager.getReusableCompletedRemoteResourceTransfer = vi.fn(async () => result)
		manager.getRemoteResourceTransferKey = vi.fn(() => "transfer-key")
		manager.createRemoteResourceTransferPromise = vi.fn(async () => result)
		manager.persistCompletedRemoteResourceTransfer = vi.fn()

		await expect(
			manager.transferRemoteResource({
				sourceCanvasId: "source-canvas",
				metadata: {
					id: "file-1",
					elementId: "source-video",
					filename: "video.mp4",
					mimeType: "video/mp4",
					fileSize: 0,
					role: "element-media",
					sourceRef: {
						src: "./videos/video.mp4",
						ossUrl: "https://source.test/video.mp4",
					},
				},
			}),
		).resolves.toBe(result)

		expect(manager.getReusableCompletedRemoteResourceTransfer).toHaveBeenCalledWith({
			sourceCanvasId: "source-canvas",
			metadata: expect.objectContaining({
				role: "element-media",
				sourceRef: expect.objectContaining({
					src: "./videos/video.mp4",
				}),
			}),
			allowFileInfoFallback: true,
		})
		expect(manager.createRemoteResourceTransferPromise).not.toHaveBeenCalled()
	})

	it("uploads element media when no completed transfer is reusable", async () => {
		const result: UploadFileResponse = {
			path: "target/videos/video.mp4",
			src: "https://target.test/video.mp4",
			fileName: "video.mp4",
			expires_at: "2030-01-01 00:00:00",
		}
		const manager = Object.create(CanvasFileUploadManager.prototype) as {
			canvas: {
				id: string
				magicConfigManager: {
					config: {
						methods: {
							uploadFiles: ReturnType<typeof vi.fn>
						}
					}
				}
			}
			currentPendingBatchId: string | null
			remoteResourceTransfers: Map<string, unknown>
			getReusableCompletedRemoteResourceTransfer: ReturnType<typeof vi.fn>
			getRemoteResourceTransferKey: ReturnType<typeof vi.fn>
			createRemoteResourceTransferPromise: ReturnType<typeof vi.fn>
			persistCompletedRemoteResourceTransfer: ReturnType<typeof vi.fn>
			transferRemoteResource: CanvasFileUploadManager["transferRemoteResource"]
		}
		manager.canvas = {
			id: "target-canvas",
			magicConfigManager: {
				config: {
					methods: {
						uploadFiles: vi.fn(),
					},
				},
			},
		}
		manager.currentPendingBatchId = null
		manager.remoteResourceTransfers = new Map()
		manager.getReusableCompletedRemoteResourceTransfer = vi.fn(async () => null)
		manager.getRemoteResourceTransferKey = vi.fn(() => "transfer-key")
		manager.createRemoteResourceTransferPromise = vi.fn(async () => result)
		manager.persistCompletedRemoteResourceTransfer = vi.fn()

		await expect(
			manager.transferRemoteResource({
				sourceCanvasId: "source-canvas",
				metadata: {
					id: "file-1",
					elementId: "source-video",
					filename: "video.mp4",
					mimeType: "video/mp4",
					fileSize: 0,
					role: "element-media",
					sourceRef: {
						src: "./videos/video.mp4",
						ossUrl: "https://source.test/video.mp4",
					},
				},
			}),
		).resolves.toBe(result)

		expect(manager.getReusableCompletedRemoteResourceTransfer).toHaveBeenCalledWith({
			sourceCanvasId: "source-canvas",
			metadata: expect.objectContaining({
				role: "element-media",
				sourceRef: expect.objectContaining({
					src: "./videos/video.mp4",
				}),
			}),
			allowFileInfoFallback: true,
		})
		expect(manager.createRemoteResourceTransferPromise).toHaveBeenCalled()
	})

	it("reuses completed generation resource transfers without creating another upload", async () => {
		const result: UploadFileResponse = {
			path: "target/videos/reference.mp4",
			src: "https://target.test/reference.mp4",
			fileName: "reference.mp4",
			expires_at: "2030-01-01 00:00:00",
		}
		const manager = Object.create(CanvasFileUploadManager.prototype) as {
			canvas: {
				id: string
				magicConfigManager: {
					config: {
						methods: {
							uploadFiles: ReturnType<typeof vi.fn>
						}
					}
				}
			}
			currentPendingBatchId: string | null
			remoteResourceTransfers: Map<string, unknown>
			getReusableCompletedRemoteResourceTransfer: ReturnType<typeof vi.fn>
			getRemoteResourceTransferKey: ReturnType<typeof vi.fn>
			createRemoteResourceTransferPromise: ReturnType<typeof vi.fn>
			persistCompletedRemoteResourceTransfer: ReturnType<typeof vi.fn>
			transferRemoteResource: CanvasFileUploadManager["transferRemoteResource"]
		}
		manager.canvas = {
			id: "target-canvas",
			magicConfigManager: {
				config: {
					methods: {
						uploadFiles: vi.fn(),
					},
				},
			},
		}
		manager.currentPendingBatchId = null
		manager.remoteResourceTransfers = new Map()
		manager.getReusableCompletedRemoteResourceTransfer = vi.fn(async () => result)
		manager.getRemoteResourceTransferKey = vi.fn(() => "transfer-key")
		manager.createRemoteResourceTransferPromise = vi.fn(async () => result)
		manager.persistCompletedRemoteResourceTransfer = vi.fn()

		await expect(
			manager.transferRemoteResource({
				sourceCanvasId: "source-canvas",
				metadata: {
					id: "generation-resource:0",
					elementId: "generation-resource:0",
					filename: "reference.mp4",
					mimeType: "video/mp4",
					fileSize: 0,
					role: "generation-resource",
					resourcePath: "./videos/reference.mp4",
					sourceRef: {
						src: "./videos/reference.mp4",
						ossUrl: "https://source.test/reference.mp4",
					},
				},
			}),
		).resolves.toBe(result)

		expect(manager.getReusableCompletedRemoteResourceTransfer).toHaveBeenCalledWith({
			sourceCanvasId: "source-canvas",
			metadata: expect.objectContaining({
				role: "generation-resource",
				resourcePath: "./videos/reference.mp4",
			}),
			allowFileInfoFallback: false,
		})
		expect(manager.createRemoteResourceTransferPromise).not.toHaveBeenCalled()
	})

	it("drops stale completed transfers so paste can re-upload deleted target files", async () => {
		const metadata: CanvasElementClipboardFileMetadata = {
			id: "file-1",
			elementId: "source-image",
			filename: "image.png",
			mimeType: "image/png",
			fileSize: 0,
			role: "element-media",
			sourceRef: {
				src: "source/images/image.png",
				ossUrl: "https://source.test/image.png",
			},
		}
		const result: UploadFileResponse = {
			path: "target/images/image.png",
			src: "https://target.test/image.png",
			fileName: "image.png",
			expires_at: "2030-01-01 00:00:00",
		}
		const getFileInfo = vi.fn(async () => {
			throw new Error("file not found")
		})
		const getFileResourceMeta = vi.fn(async () => ({
			status: "deleted" as const,
		}))
		const manager = createRemoteTransferManager({
			getFileInfo,
			getFileResourceMeta,
			result,
			metadata,
			sourceCanvasId: "source-canvas",
		})

		await expect(
			manager.getReusableCompletedRemoteResourceTransfer({
				sourceCanvasId: "source-canvas",
				metadata,
			}),
		).resolves.toBeNull()

		expect(getFileResourceMeta).toHaveBeenCalledWith("target/images/image.png", {
			useImageProcess: false,
		})
		expect(getFileInfo).not.toHaveBeenCalled()
		expect(manager.remoteResourceTransfers.size).toBe(0)
	})

	it("keeps completed transfers when the target path is still available", async () => {
		const metadata: CanvasElementClipboardFileMetadata = {
			id: "file-1",
			elementId: "source-image",
			filename: "image.png",
			mimeType: "image/png",
			fileSize: 0,
			role: "element-media",
			sourceRef: {
				src: "source/images/image.png",
				ossUrl: "https://source.test/image.png",
			},
		}
		const result: UploadFileResponse = {
			path: "target/images/image.png",
			src: "https://target.test/image.png",
			fileName: "image.png",
			expires_at: "2030-01-01 00:00:00",
		}
		const getFileInfo = vi.fn(async () => ({
			...result,
			src: "https://target.test/fresh-image.png",
		}))
		const getFileResourceMeta = vi.fn(async () => ({
			status: "exists" as const,
		}))
		const manager = createRemoteTransferManager({
			getFileInfo,
			getFileResourceMeta,
			result,
			metadata,
			sourceCanvasId: "source-canvas",
		})

		await expect(
			manager.getReusableCompletedRemoteResourceTransfer({
				sourceCanvasId: "source-canvas",
				metadata,
			}),
		).resolves.toBe(result)

		expect(getFileResourceMeta).toHaveBeenCalledWith("target/images/image.png", {
			useImageProcess: false,
		})
		expect(getFileInfo).not.toHaveBeenCalled()
		expect(manager.remoteResourceTransfers.size).toBe(1)
	})

	it("falls back to getFileInfo only when lightweight resource metadata is unavailable", async () => {
		const metadata: CanvasElementClipboardFileMetadata = {
			id: "file-1",
			elementId: "source-image",
			filename: "image.png",
			mimeType: "image/png",
			fileSize: 0,
			role: "element-media",
			sourceRef: {
				src: "source/images/image.png",
				ossUrl: "https://source.test/image.png",
			},
		}
		const result: UploadFileResponse = {
			path: "target/images/image.png",
			src: "https://target.test/image.png",
			fileName: "image.png",
			expires_at: "2030-01-01 00:00:00",
		}
		const getFileInfo = vi.fn(async () => ({
			...result,
			src: "https://target.test/fresh-image.png",
		}))
		const manager = createRemoteTransferManager({
			getFileInfo,
			result,
			metadata,
			sourceCanvasId: "source-canvas",
		})

		await expect(
			manager.getReusableCompletedRemoteResourceTransfer({
				sourceCanvasId: "source-canvas",
				metadata,
			}),
		).resolves.toBe(result)

		expect(getFileInfo).toHaveBeenCalledWith("target/images/image.png", {
			useImageProcess: false,
			forceRefresh: true,
		})
	})

	it("trusts completed transfers without getFileInfo when fallback is disabled", async () => {
		const metadata: CanvasElementClipboardFileMetadata = {
			id: "generation-resource:0",
			elementId: "generation-resource:0",
			filename: "reference.mp4",
			mimeType: "video/mp4",
			fileSize: 0,
			role: "generation-resource",
			resourcePath: "./videos/reference.mp4",
			sourceRef: {
				src: "./videos/reference.mp4",
				ossUrl: "https://source.test/reference.mp4",
			},
		}
		const result: UploadFileResponse = {
			path: "target/videos/reference.mp4",
			src: "https://target.test/reference.mp4",
			fileName: "reference.mp4",
			expires_at: "2030-01-01 00:00:00",
		}
		const getFileInfo = vi.fn(async () => {
			throw new Error("file not found")
		})
		const manager = createRemoteTransferManager({
			getFileInfo,
			result,
			metadata,
			sourceCanvasId: "source-canvas",
		})

		await expect(
			manager.getReusableCompletedRemoteResourceTransfer({
				sourceCanvasId: "source-canvas",
				metadata,
				allowFileInfoFallback: false,
			}),
		).resolves.toBe(result)

		expect(getFileInfo).not.toHaveBeenCalled()
	})

	it("trusts generation resource cache when file info fallback is disabled", async () => {
		const metadata: CanvasElementClipboardFileMetadata = {
			id: "generation-resource:0",
			elementId: "generation-resource:0",
			filename: "reference.mp4",
			mimeType: "video/mp4",
			fileSize: 0,
			role: "generation-resource",
			resourcePath: "./videos/reference.mp4",
			sourceRef: {
				src: "./videos/reference.mp4",
				ossUrl: "https://source.test/reference.mp4",
			},
		}
		const result: UploadFileResponse = {
			path: "target/videos/reference.mp4",
			src: "https://target.test/reference.mp4",
			fileName: "reference.mp4",
			expires_at: "2030-01-01 00:00:00",
		}
		const getFileInfo = vi.fn(async () => {
			throw new Error("file not found")
		})
		const getFileResourceMeta = vi.fn(async () => ({
			status: "deleted" as const,
		}))
		const manager = createRemoteTransferManager({
			getFileInfo,
			getFileResourceMeta,
			result,
			metadata,
			sourceCanvasId: "source-canvas",
		})

		await expect(
			manager.getReusableCompletedRemoteResourceTransfer({
				sourceCanvasId: "source-canvas",
				metadata,
				allowFileInfoFallback: false,
			}),
		).resolves.toBe(result)

		expect(getFileResourceMeta).not.toHaveBeenCalled()
		expect(getFileInfo).not.toHaveBeenCalled()
		expect(manager.remoteResourceTransfers.size).toBe(1)
	})
})
