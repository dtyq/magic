import { describe, expect, it, vi } from "vitest"
import { ClipboardManager } from "../clipboard/ClipboardManager"
import type {
	AudioElement,
	FrameElement,
	ImageElement,
	LayerElement,
	VideoElement,
} from "../../document/types"
import { ElementTypeEnum } from "../../document/types"
import {
	GenerationStatus,
	ImageGenerationTaskTypeMap,
	type UploadFileResponse,
} from "../../../public/magic-types"
import { createTestResourceReferenceResolver } from "../../../public/__tests__/testResourceReferenceResolver"

const CONTENT_FIELDS = new Set([
	"src",
	"status",
	"errorMessage",
	"generateImageRequest",
	"imageGenerationTaskMeta",
	"crop",
	"generateVideoRequest",
	"videoGenerationResultMeta",
	"content",
	"defaultStyle",
	"fill",
	"stroke",
	"strokeWidth",
	"cornerRadius",
	"sides",
	"innerRadiusRatio",
	"generationConfig",
	"shots",
	"output",
])

function v3<T extends LayerElement>(element: Record<string, unknown>): T {
	const { id, type, ...rest } = element
	const contentFields: Record<string, unknown> = {}
	for (const field of CONTENT_FIELDS) {
		if (field in rest) {
			contentFields[field] = rest[field]
			delete rest[field]
		}
	}
	const contentId = `${String(id)}-content`
	return {
		...rest,
		id,
		type,
		contents: [{ contentId, ...contentFields }],
		activeContentId: contentId,
		mainContentId: contentId,
	} as T
}

function activeContent(element: LayerElement): Record<string, any> {
	const contentElement = element as LayerElement & {
		contents: Array<Record<string, any>>
		activeContentId: string | null
	}
	return (
		contentElement.contents.find(
			(content) => content.contentId === contentElement.activeContentId,
		) ??
		contentElement.contents[0] ??
		{}
	)
}

interface ClipboardManagerTestHarness {
	canvas: {
		canvasFileUploadManager: {
			getCompletedRemoteResourceTransfer: ReturnType<typeof vi.fn>
			getReusableCompletedRemoteResourceTransfer: ReturnType<typeof vi.fn>
			transferRemoteResource: ReturnType<typeof vi.fn>
		}
		imageResourceManager: {
			primeCache: ReturnType<typeof vi.fn>
		}
		videoResourceManager: {
			primeCache: ReturnType<typeof vi.fn>
		}
		audioResourceManager: {
			primeCache: ReturnType<typeof vi.fn>
		}
		assetResourceManager: {
			getResource: ReturnType<typeof vi.fn>
		}
	}
	collectClipboardFiles: (elements: LayerElement[]) => Promise<{
		metadata: Array<{
			elementId: string
			role?: string
			resourcePath?: string
			sourceRef?: { src?: string; ossUrl?: string }
		}>
		files: unknown[]
		native?: unknown
	}>
	getCanvasFileMetadata: ReturnType<typeof vi.fn>
	prepareClipboardTreeElement: (options: {
		sourceElement: LayerElement
		currentNames: Set<string>
		isRoot: boolean
		offsetX: number
		offsetY: number
		rootZIndex?: number
		canReuseElementSrc: boolean
		fileByElementId: Map<string, File>
		metadataByElementId: Map<string, unknown>
		sourceCanvasId?: string
	}) => Promise<{
		element: LayerElement | null
		sourceReferenceFailureCount: number
		pendingUploads: Array<{
			sourceElementId: string
			targetElementId: string
			targetContentId: string
			sourceCanvasId?: string
			sourcePath?: string
			file?: File
			metadata?: unknown
		}>
	}>
}

function createClipboardManager(): ClipboardManagerTestHarness {
	const manager = Object.create(ClipboardManager.prototype) as ClipboardManagerTestHarness
	manager.canvas = {
		getEffectiveContent: vi.fn((elementId: string) => {
			const element = (
				manager.canvas as unknown as {
					elementManager?: { getElementData?: (id: string) => LayerElement | undefined }
				}
			).elementManager?.getElementData?.(elementId)
			return element ? activeContent(element) : undefined
		}),
		canvasFileUploadManager: {
			getCompletedRemoteResourceTransfer: vi.fn(),
			getReusableCompletedRemoteResourceTransfer: vi.fn(),
			transferRemoteResource: vi.fn(),
		},
		imageResourceManager: {
			primeCache: vi.fn(),
		},
		videoResourceManager: {
			primeCache: vi.fn(),
		},
		audioResourceManager: {
			primeCache: vi.fn(),
		},
		assetResourceManager: {
			getResource: vi.fn(),
		},
	}
	return manager
}

describe("ClipboardManager frame clipboard trees", () => {
	it("refreshes an expiring source URL before serializing clipboard metadata", async () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date("2026-09-14T10:00:00Z"))
		const getFileInfo = vi
			.fn()
			.mockResolvedValueOnce({
				src: "https://example.test/image.png?signature=old",
				fileName: "image.png",
				expires_at: "2026-09-14T10:00:20Z",
			})
			.mockResolvedValueOnce({
				src: "https://example.test/image.png?signature=fresh",
				fileName: "image.png",
				expires_at: "2026-09-14T10:05:00Z",
			})
		const manager = createClipboardManager()
		;(manager.canvas as unknown as { magicConfigManager: unknown }).magicConfigManager = {
			config: { methods: { getFileInfo } },
		}

		const metadata = await (
			manager as unknown as {
				fetchOriginalFileMetadata: (options: {
					src: string
					fallbackFilename: string
					fallbackMimeType: string
				}) => Promise<{ sourceRef?: { ossUrl?: string } } | null>
			}
		).fetchOriginalFileMetadata({
			src: "images/image.png",
			fallbackFilename: "image.png",
			fallbackMimeType: "image/png",
		})

		expect(metadata).toMatchObject({
			sourceRef: {
				ossUrl: "https://example.test/image.png?signature=fresh",
			},
		})
		expect(getFileInfo).toHaveBeenNthCalledWith(1, "images/image.png", {
			useImageProcess: false,
		})
		expect(getFileInfo).toHaveBeenNthCalledWith(2, "images/image.png", {
			useImageProcess: false,
			forceRefresh: true,
		})
		vi.useRealTimers()
	})

	it("does not produce metadata when refresh still returns an expiring URL", async () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date("2026-09-14T10:00:00Z"))
		const getFileInfo = vi
			.fn()
			.mockResolvedValueOnce({
				src: "https://example.test/image.png?signature=old",
				fileName: "image.png",
				expires_at: "2026-09-14T10:00:20Z",
			})
			.mockResolvedValueOnce({
				src: "https://example.test/image.png?signature=still-old",
				fileName: "image.png",
				expires_at: "2026-09-14T10:00:25Z",
			})
		const manager = createClipboardManager()
		;(manager.canvas as unknown as { magicConfigManager: unknown }).magicConfigManager = {
			config: { methods: { getFileInfo } },
		}

		const metadata = await (
			manager as unknown as {
				fetchOriginalFileMetadata: (options: {
					src: string
					fallbackFilename: string
					fallbackMimeType: string
				}) => Promise<unknown>
			}
		).fetchOriginalFileMetadata({
			src: "images/image.png",
			fallbackFilename: "image.png",
			fallbackMimeType: "image/png",
		})

		expect(metadata).toBeNull()
		expect(getFileInfo).toHaveBeenCalledTimes(2)
		vi.useRealTimers()
	})

	it("resolves asset metadata through the asset manager without workspace lookup", async () => {
		const manager = createClipboardManager()
		const getFileInfo = vi.fn()
		;(manager.canvas as unknown as { magicConfigManager: unknown }).magicConfigManager = {
			config: { methods: { getFileInfo } },
		}
		manager.canvas.assetResourceManager.getResource.mockResolvedValue({
			assetId: "audio-asset",
			mediaType: "audio",
			fileUrl: "https://assets.test/audio-asset",
			fileName: "voice",
		})

		const metadata = await (
			manager as unknown as {
				fetchOriginalFileMetadata: (options: {
					src: string
					fallbackFilename: string
					fallbackMimeType: string
					mediaType?: "image" | "video" | "audio"
				}) => Promise<{
					filename: string
					mimeType: string
					sourceRef?: { src?: string; ossUrl?: string }
				} | null>
			}
		).fetchOriginalFileMetadata({
			src: " asset://audio-asset ",
			fallbackFilename: "audio.mp3",
			fallbackMimeType: "audio/mpeg",
			mediaType: "audio",
		})

		expect(metadata).toEqual({
			filename: "voice.mp3",
			mimeType: "audio/mpeg",
			fileSize: 0,
			sourceRef: {
				src: "asset://audio-asset",
				ossUrl: "https://assets.test/audio-asset",
			},
		})
		expect(manager.canvas.assetResourceManager.getResource).toHaveBeenCalledWith("audio-asset")
		expect(getFileInfo).not.toHaveBeenCalled()
	})

	it("rejects an asset whose declared element type disagrees with asset metadata", async () => {
		const manager = createClipboardManager()
		manager.canvas.assetResourceManager.getResource.mockResolvedValue({
			assetId: "video-asset",
			mediaType: "video",
			fileUrl: "https://assets.test/video-asset",
			fileName: "clip.mp4",
		})

		const metadata = await (
			manager as unknown as {
				fetchOriginalFileMetadata: (options: {
					src: string
					fallbackFilename: string
					fallbackMimeType: string
					mediaType?: "image" | "video" | "audio"
				}) => Promise<unknown>
			}
		).fetchOriginalFileMetadata({
			src: "asset://video-asset",
			fallbackFilename: "image.png",
			fallbackMimeType: "image/png",
			mediaType: "image",
		})

		expect(metadata).toBeNull()
	})

	it("starts media metadata lookups concurrently so get-file-url can batch them", async () => {
		const firstImage = v3<ImageElement>({
			id: "first-image",
			type: "image",
			name: "First image",
			src: "source/first.png",
			x: 0,
			y: 0,
			width: 80,
			height: 60,
		})
		const secondImage = v3<ImageElement>({
			id: "second-image",
			type: "image",
			name: "Second image",
			src: "source/second.png",
			x: 100,
			y: 0,
			width: 80,
			height: 60,
		})
		let resolveFirstLookup!: (value: { src: string; fileName: string }) => void
		const firstLookup = new Promise<{ src: string; fileName: string }>((resolve) => {
			resolveFirstLookup = resolve
		})
		const getFileInfo = vi.fn((path: string) => {
			if (path === activeContent(firstImage).src) {
				return firstLookup
			}
			return Promise.resolve({
				src: `https://example.test/${path}`,
				fileName: path.split("/").pop() ?? "image.png",
			})
		})
		const manager = createClipboardManager()
		;(manager.canvas as unknown as { magicConfigManager: unknown }).magicConfigManager = {
			config: { methods: { getFileInfo } },
		}

		const resultPromise = manager.collectClipboardFiles([firstImage, secondImage])
		await Promise.resolve()

		expect(getFileInfo).toHaveBeenCalledTimes(2)
		expect(getFileInfo).toHaveBeenNthCalledWith(1, activeContent(firstImage).src, {
			useImageProcess: false,
		})
		expect(getFileInfo).toHaveBeenNthCalledWith(2, activeContent(secondImage).src, {
			useImageProcess: false,
		})

		resolveFirstLookup({
			src: "https://example.test/source/first.png",
			fileName: "first.png",
		})
		await expect(resultPromise).resolves.toMatchObject({
			metadata: [{ elementId: firstImage.id }, { elementId: secondImage.id }],
		})
	})

	it("keeps source-less image and video placeholders in a multi-element copy", async () => {
		const validImage = v3<ImageElement>({
			id: "valid-image",
			type: "image",
			src: "source/valid.png",
			x: 0,
			y: 0,
			width: 80,
			height: 60,
		})
		const emptyImage = v3<ImageElement>({
			id: "empty-image",
			type: "image",
			x: 100,
			y: 0,
			width: 80,
			height: 60,
		})
		const emptyVideo = v3<VideoElement>({
			id: "empty-video",
			type: "video",
			x: 200,
			y: 0,
			width: 80,
			height: 60,
		})
		const getFileInfo = vi.fn(async (path: string) => ({
			src: `https://example.test/${path}`,
			fileName: path.split("/").pop() ?? "image.png",
		}))
		const manager = createClipboardManager()
		;(manager.canvas as unknown as { magicConfigManager: unknown }).magicConfigManager = {
			config: { methods: { getFileInfo } },
		}

		const result = await manager.collectClipboardFiles([validImage, emptyImage, emptyVideo])

		expect(result.metadata).toEqual([
			expect.objectContaining({ elementId: validImage.id, role: "element-media" }),
		])
		expect(getFileInfo).toHaveBeenCalledTimes(1)
		expect(getFileInfo).toHaveBeenCalledWith("source/valid.png", { useImageProcess: false })
	})

	it("collects media metadata from frame children", async () => {
		const child = v3<ImageElement>({
			id: "image-child",
			type: "image",
			name: "Child image",
			src: "source/image.png",
			x: 12,
			y: 16,
			width: 80,
			height: 60,
			generateImageRequest: {
				image_id: "source-image-task",
				model_id: "image-model",
				prompt: "a friendly creature",
				size: "1024x1024",
			},
			imageGenerationTaskMeta: {
				type: ImageGenerationTaskTypeMap.High,
				image_id: "source-high-task",
				file_path: "source/image.png",
				size: "2048x2048",
			},
		})
		const frame = v3<FrameElement>({
			id: "frame-1",
			type: "frame",
			name: "Frame",
			x: 100,
			y: 120,
			width: 300,
			height: 200,
			children: [child],
		})
		const manager = createClipboardManager()
		manager.getCanvasFileMetadata = vi.fn(async (element: ImageElement) => ({
			element,
			filename: "image.png",
			mimeType: "image/png",
			fileSize: 0,
			sourceRef: {
				src: activeContent(element).src,
				ossUrl: "https://example.test/image.png",
			},
		}))

		const result = await manager.collectClipboardFiles([frame])

		expect(result.metadata).toEqual([
			expect.objectContaining({
				elementId: "image-child",
				sourceRef: expect.objectContaining({
					src: "source/image.png",
				}),
			}),
		])
		expect(result.native).toBeUndefined()
	})

	it("collects generation resource metadata from image requests", async () => {
		const child = v3<ImageElement>({
			id: "image-child",
			type: "image",
			name: "Child image",
			src: "source/image.png",
			x: 12,
			y: 16,
			width: 80,
			height: 60,
			generateImageRequest: {
				model_id: "image-model",
				prompt: "a friendly creature",
				reference_images: ["source/ref.png", "source/image.png"],
			},
		})
		const manager = createClipboardManager()
		manager.getCanvasFileMetadata = vi.fn(async (element: ImageElement) => ({
			element,
			filename: "image.png",
			mimeType: "image/png",
			fileSize: 0,
			sourceRef: {
				src: activeContent(element).src,
				ossUrl: "https://example.test/image.png",
			},
		}))
		;(manager.canvas as unknown as { magicConfigManager: unknown }).magicConfigManager = {
			config: {
				methods: {
					getFileInfo: vi.fn(async (path: string) => ({
						src: `https://example.test/${path}`,
						fileName: path.split("/").pop(),
					})),
				},
			},
		}

		const result = await manager.collectClipboardFiles([child])

		expect(result.metadata).toEqual([
			expect.objectContaining({
				elementId: "image-child",
				role: "element-media",
				sourceRef: expect.objectContaining({ src: "source/image.png" }),
			}),
			expect.objectContaining({
				role: "generation-resource",
				resourcePath: "source/ref.png",
				sourceRef: expect.objectContaining({ src: "source/ref.png" }),
			}),
		])
	})

	it("collects non-active media Contents as cross-canvas generation resources", async () => {
		const image: ImageElement = {
			id: "image-with-contents",
			type: "image",
			name: "Image with contents",
			x: 12,
			y: 16,
			width: 80,
			height: 60,
			contents: [
				{ contentId: "inactive-content", src: "source/inactive.png" },
				{ contentId: "active-content", src: "source/active.png" },
			],
			activeContentId: "active-content",
			mainContentId: "inactive-content",
		}
		const manager = createClipboardManager()
		manager.getCanvasFileMetadata = vi.fn(async (element: ImageElement) => ({
			element,
			filename: "active.png",
			mimeType: "image/png",
			fileSize: 0,
			sourceRef: {
				src: activeContent(element).src,
				ossUrl: "https://example.test/active.png",
			},
		}))
		;(manager.canvas as unknown as { magicConfigManager: unknown }).magicConfigManager = {
			config: {
				methods: {
					getFileInfo: vi.fn(async (path: string) => ({
						src: `https://example.test/${path}`,
						fileName: path.split("/").pop(),
					})),
				},
			},
		}

		const result = await manager.collectClipboardFiles([image])

		expect(result.metadata).toEqual([
			expect.objectContaining({
				elementId: image.id,
				role: "element-media",
				sourceRef: expect.objectContaining({ src: "source/active.png" }),
			}),
			expect.objectContaining({
				role: "generation-resource",
				resourcePath: "source/inactive.png",
				sourceRef: expect.objectContaining({ src: "source/inactive.png" }),
			}),
		])
	})

	it("stores all source-canvas aliases on element media metadata", async () => {
		const child = v3<ImageElement>({
			id: "image-child",
			type: "image",
			name: "Child image",
			src: "./images/image.png",
			x: 12,
			y: 16,
			width: 80,
			height: 60,
			generateImageRequest: {
				model_id: "image-model",
				prompt: "reuse the current image",
				reference_images: ["/画布A/images/image.png"],
			},
		})
		const manager = createClipboardManager()
		manager.getCanvasFileMetadata = vi.fn(async (element: ImageElement) => ({
			element,
			filename: "image.png",
			mimeType: "image/png",
			fileSize: 0,
			sourceRef: {
				src: activeContent(element).src,
				ossUrl: "https://example.test/image.png",
			},
		}))
		;(manager.canvas as unknown as { magicConfigManager: unknown }).magicConfigManager = {
			config: {
				methods: {
					resolveResourceReference: createTestResourceReferenceResolver({
						currentCanvasWorkspacePath: "/画布A",
					}),
				},
			},
		}

		const result = await manager.collectClipboardFiles([child])

		expect(result.metadata).toEqual([
			expect.objectContaining({
				elementId: "image-child",
				role: "element-media",
				resourceIdentity: "workspace:/画布A/images/image.png",
				resourceAliases: ["./images/image.png", "/画布A/images/image.png"],
			}),
		])
	})

	it("collects cross-element media references as generation resources", async () => {
		const referencedElement = v3<ImageElement>({
			id: "referenced-image",
			type: "image",
			name: "Referenced image",
			src: "./images/referenced.png",
			x: 0,
			y: 0,
			width: 80,
			height: 60,
			imageGenerationTaskMeta: {
				type: ImageGenerationTaskTypeMap.High,
				file_path: "./images/referenced.png",
			},
		})
		const referringElement = v3<ImageElement>({
			id: "referring-image",
			type: "image",
			name: "Referring image",
			src: "source/referring.png",
			x: 100,
			y: 0,
			width: 80,
			height: 60,
			generateImageRequest: {
				model_id: "image-model",
				prompt: "use the other pasted image",
				reference_images: ["images/referenced.png"],
			},
		})
		const manager = createClipboardManager()
		manager.getCanvasFileMetadata = vi.fn(async (element: ImageElement) => ({
			element,
			filename: `${element.id}.png`,
			mimeType: "image/png",
			fileSize: 0,
			sourceRef: {
				src: activeContent(element).src,
				ossUrl: `https://example.test/${activeContent(element).src}`,
			},
		}))
		;(manager.canvas as unknown as { magicConfigManager: unknown }).magicConfigManager = {
			config: {
				methods: {
					getFileInfo: vi.fn(async (path: string) => ({
						src: `https://example.test/${path}`,
						fileName: path.split("/").pop(),
					})),
				},
			},
		}

		const result = await manager.collectClipboardFiles([referencedElement, referringElement])

		expect(result.metadata).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					elementId: "referenced-image",
					role: "element-media",
				}),
				expect.objectContaining({
					elementId: "referring-image",
					role: "element-media",
				}),
				expect.objectContaining({
					role: "generation-resource",
					resourcePath: "images/referenced.png",
				}),
			]),
		)
	})

	it("deduplicates generation resource transfers and reports failures", async () => {
		const manager = createClipboardManager()
		const transferRemoteResource = vi.fn(async ({ metadata }: { metadata: { id: string } }) =>
			metadata.id === "missing"
				? null
				: {
						path: "target/ref.png",
						src: "https://target.test/ref.png",
						fileName: "ref.png",
						expires_at: "2030-01-01 00:00:00",
					},
		)
		manager.canvas.canvasFileUploadManager.transferRemoteResource = transferRemoteResource

		const result = await (
			manager as unknown as {
				resolveGenerationResourcePathMap: (
					fileMetadata: Array<{
						id: string
						elementId: string
						filename: string
						mimeType: string
						fileSize: number
						role: string
						resourcePath?: string
						sourceRef?: { src?: string; ossUrl?: string }
					}>,
					sourceCanvasId?: string,
				) => Promise<{ pathMap: Map<string, string>; failureCount: number }>
			}
		).resolveGenerationResourcePathMap(
			[
				{
					id: "ref-a",
					elementId: "ref-a",
					filename: "ref.png",
					mimeType: "image/png",
					fileSize: 0,
					role: "generation-resource",
					resourcePath: "source/ref.png",
					resourceIdentity: "workspace:/source/ref.png",
					resourceAliases: ["source/ref.png", "./source/ref.png"],
					sourceRef: { src: "source/ref.png", ossUrl: "https://source.test/ref.png" },
				},
				{
					id: "ref-a-duplicate",
					elementId: "ref-a-duplicate",
					filename: "ref.png",
					mimeType: "image/png",
					fileSize: 0,
					role: "generation-resource",
					resourcePath: "./source/ref.png",
					resourceIdentity: "workspace:/source/ref.png",
					resourceAliases: ["source/ref.png", "./source/ref.png"],
					sourceRef: { src: "./source/ref.png", ossUrl: "https://source.test/ref.png" },
				},
				{
					id: "missing",
					elementId: "missing",
					filename: "missing.png",
					mimeType: "image/png",
					fileSize: 0,
					role: "generation-resource",
					resourcePath: "source/missing.png",
					sourceRef: {
						src: "source/missing.png",
						ossUrl: "https://source.test/missing.png",
					},
				},
			],
			"source-canvas",
		)

		expect(Array.from(result.pathMap.entries())).toEqual([
			["source/ref.png", "target/ref.png"],
			["./source/ref.png", "target/ref.png"],
		])
		expect(result.failureCount).toBe(1)
		expect(transferRemoteResource).toHaveBeenCalledTimes(2)
	})

	it("transfers distinct generation resources concurrently", async () => {
		const manager = createClipboardManager()
		let resolveFirst: (value: UploadFileResponse) => void = () => undefined
		const firstTransfer = new Promise<UploadFileResponse>((resolve) => {
			resolveFirst = resolve
		})
		const transferRemoteResource = vi.fn(
			({ metadata }: { metadata: { id: string; filename: string } }) => {
				if (metadata.id === "ref-a") {
					return firstTransfer
				}
				return Promise.resolve({
					path: "target/ref-b.png",
					src: "https://target.test/ref-b.png",
					fileName: metadata.filename,
					expires_at: "2030-01-01 00:00:00",
				})
			},
		)
		manager.canvas.canvasFileUploadManager.transferRemoteResource = transferRemoteResource

		const resultPromise = (
			manager as unknown as {
				resolveGenerationResourcePathMap: (
					fileMetadata: Array<{
						id: string
						elementId: string
						filename: string
						mimeType: string
						fileSize: number
						role: string
						resourcePath?: string
						sourceRef?: { src?: string; ossUrl?: string }
					}>,
					sourceCanvasId?: string,
				) => Promise<{ pathMap: Map<string, string>; failureCount: number }>
			}
		).resolveGenerationResourcePathMap(
			[
				{
					id: "ref-a",
					elementId: "ref-a",
					filename: "ref-a.png",
					mimeType: "image/png",
					fileSize: 0,
					role: "generation-resource",
					resourcePath: "source/ref-a.png",
					sourceRef: { src: "source/ref-a.png", ossUrl: "https://source.test/ref-a.png" },
				},
				{
					id: "ref-b",
					elementId: "ref-b",
					filename: "ref-b.png",
					mimeType: "image/png",
					fileSize: 0,
					role: "generation-resource",
					resourcePath: "source/ref-b.png",
					sourceRef: { src: "source/ref-b.png", ossUrl: "https://source.test/ref-b.png" },
				},
			],
			"source-canvas",
		)

		await Promise.resolve()
		expect(transferRemoteResource).toHaveBeenCalledTimes(2)

		resolveFirst({
			path: "target/ref-a.png",
			src: "https://target.test/ref-a.png",
			fileName: "ref-a.png",
			expires_at: "2030-01-01 00:00:00",
		})
		const result = await resultPromise

		expect(Array.from(result.pathMap.entries())).toEqual([
			["source/ref-a.png", "target/ref-a.png"],
			["source/ref-b.png", "target/ref-b.png"],
		])
		expect(result.failureCount).toBe(0)
	})

	it("prepares frame child media without rewriting references before uploads finish", async () => {
		const child = v3<ImageElement>({
			id: "image-child",
			type: "image",
			name: "Child image",
			src: "./images/image.png",
			x: 12,
			y: 16,
			width: 80,
			height: 60,
			generateImageRequest: {
				image_id: "source-image-task",
				model_id: "image-model",
				prompt: "a friendly creature",
				size: "1024x1024",
			},
			imageGenerationTaskMeta: {
				type: ImageGenerationTaskTypeMap.High,
				image_id: "source-high-task",
				file_path: "images/image.png",
				size: "2048x2048",
			},
		})
		const frame = v3<FrameElement>({
			id: "frame-1",
			type: "frame",
			name: "Frame",
			x: 100,
			y: 120,
			width: 300,
			height: 200,
			zIndex: 3,
			children: [child],
		})
		const manager = createClipboardManager()

		const result = await manager.prepareClipboardTreeElement({
			sourceElement: frame,
			currentNames: new Set(),
			isRoot: true,
			offsetX: 10,
			offsetY: 20,
			rootZIndex: 9,
			canReuseElementSrc: false,
			fileByElementId: new Map(),
			metadataByElementId: new Map([
				[
					"image-child",
					{
						elementId: "image-child",
						filename: "image.png",
						mimeType: "image/png",
						fileSize: 0,
						role: "element-media",
						resourceIdentity: "workspace:/画布A/images/image.png",
						resourceAliases: ["./images/image.png", "images/image.png"],
						sourceRef: {
							src: "./images/image.png",
							ossUrl: "https://source.test/image.png",
						},
					},
				],
			]),
			sourceCanvasId: "source-canvas",
		})

		expect(result.sourceReferenceFailureCount).toBe(0)
		expect(result.pendingUploads).toEqual([
			expect.objectContaining({
				sourceElementId: "image-child",
				sourceCanvasId: "source-canvas",
			}),
		])
		expect(result.element).toEqual(
			expect.objectContaining({
				type: "frame",
				x: 110,
				y: 140,
				zIndex: 9,
			}),
		)
		const pastedFrame = result.element as FrameElement
		expect(pastedFrame.id).not.toBe("frame-1")
		expect(pastedFrame.children).toHaveLength(1)
		expect(pastedFrame.children?.[0]).toEqual(
			expect.objectContaining({
				type: "image",
				contents: [
					expect.objectContaining({
						status: GenerationStatus.Processing,
						generateImageRequest: expect.objectContaining({
							model_id: "image-model",
							prompt: "a friendly creature",
						}),
						imageGenerationTaskMeta: expect.objectContaining({
							type: ImageGenerationTaskTypeMap.High,
							file_path: "images/image.png",
							size: "2048x2048",
						}),
					}),
				],
			}),
		)
		const pastedChild = pastedFrame.children?.[0] as ImageElement
		const pastedContent = activeContent(pastedChild)
		expect(pastedChild.id).not.toBe("image-child")
		expect(pastedContent.generateImageRequest?.image_id).toBeUndefined()
		expect(pastedContent.imageGenerationTaskMeta?.image_id).toBeUndefined()
		expect(pastedChild.id).toBe(result.pendingUploads[0]?.targetElementId)
		expect(pastedContent.contentId).toBe(result.pendingUploads[0]?.targetContentId)
		expect(
			manager.canvas.canvasFileUploadManager.getReusableCompletedRemoteResourceTransfer,
		).not.toHaveBeenCalled()
		expect(manager.canvas.imageResourceManager.primeCache).not.toHaveBeenCalled()
	})

	it("keeps image generation references until background transfers finish", async () => {
		const child = v3<ImageElement>({
			id: "image-child",
			type: "image",
			name: "Child image",
			src: "source/image.png",
			x: 12,
			y: 16,
			width: 80,
			height: 60,
			generateImageRequest: {
				image_id: "source-image-task",
				project_id: "source-project",
				file_dir: "/source/images/",
				model_id: "image-model",
				prompt: "use source/ref.png as a reference",
				reference_images: ["source/ref.png", "source/image.png"],
				reference_image_options: [{ path: "source/ref.png" }],
			},
			imageGenerationTaskMeta: {
				type: ImageGenerationTaskTypeMap.Eraser,
				image_id: "source-eraser-task",
				file_path: "source/image.png",
				mask_path: "source/mask.png",
				mark_path: "source/mark.png",
				reference_image_options: [{ path: "source/ref.png" }],
			},
		})
		const manager = createClipboardManager()

		const result = await manager.prepareClipboardTreeElement({
			sourceElement: child,
			currentNames: new Set(),
			isRoot: true,
			offsetX: 0,
			offsetY: 0,
			rootZIndex: 8,
			canReuseElementSrc: false,
			fileByElementId: new Map(),
			metadataByElementId: new Map([
				[
					"image-child",
					{
						elementId: "image-child",
						filename: "image.png",
						mimeType: "image/png",
						fileSize: 0,
						sourceRef: {
							src: "source/image.png",
							ossUrl: "https://source.test/image.png",
						},
					},
				],
			]),
			sourceCanvasId: "source-canvas",
		})

		const pastedChild = result.element as ImageElement
		const pastedContent = activeContent(pastedChild)
		expect(result.pendingUploads).toEqual([
			expect.objectContaining({
				sourceElementId: "image-child",
				sourceCanvasId: "source-canvas",
			}),
		])
		expect(pastedContent.src).toBeUndefined()
		expect(pastedContent.generateImageRequest).toEqual(
			expect.objectContaining({
				model_id: "image-model",
				prompt: "use source/ref.png as a reference",
				reference_images: ["source/ref.png", "source/image.png"],
				reference_image_options: [expect.objectContaining({ path: "source/ref.png" })],
			}),
		)
		expect(pastedContent.generateImageRequest?.image_id).toBeUndefined()
		expect(pastedContent.generateImageRequest?.project_id).toBeUndefined()
		expect(pastedContent.generateImageRequest?.file_dir).toBeUndefined()
		expect(pastedContent.imageGenerationTaskMeta).toEqual(
			expect.objectContaining({
				file_path: "source/image.png",
				mask_path: "source/mask.png",
				mark_path: "source/mark.png",
				reference_image_options: [expect.objectContaining({ path: "source/ref.png" })],
			}),
		)
	})

	it("keeps video generation inputs until background transfers finish", async () => {
		const child = v3<VideoElement>({
			id: "video-child",
			type: "video",
			name: "Child video",
			src: "source/video.mp4",
			x: 12,
			y: 16,
			width: 160,
			height: 90,
			generateVideoRequest: {
				video_id: "source-video-task",
				project_id: "source-project",
				file_dir: "/source/videos/",
				file_name: "source.mp4",
				model_id: "video-model",
				prompt: "a cinematic clip",
				inputs: {
					frames: [{ role: "start", uri: "source/start.png" }],
					reference_images: [{ uri: "source/ref.png" }],
					reference_videos: [{ uri: "source/ref.mp4" }],
					reference_audios: [{ uri: "source/ref.mp3" }],
					video: { uri: "source/video.mp4" },
					mask: { uri: "source/mask.png" },
					audio: [{ uri: "source/audio.wav" }],
				},
			},
		})
		const manager = createClipboardManager()

		const result = await manager.prepareClipboardTreeElement({
			sourceElement: child,
			currentNames: new Set(),
			isRoot: true,
			offsetX: 0,
			offsetY: 0,
			rootZIndex: 8,
			canReuseElementSrc: false,
			fileByElementId: new Map(),
			metadataByElementId: new Map([
				[
					"video-child",
					{
						elementId: "video-child",
						filename: "video.mp4",
						mimeType: "video/mp4",
						fileSize: 0,
						sourceRef: {
							src: "source/video.mp4",
							ossUrl: "https://source.test/video.mp4",
						},
					},
				],
			]),
			sourceCanvasId: "source-canvas",
		})

		const pastedChild = result.element as VideoElement
		const pastedContent = activeContent(pastedChild)
		expect(result.pendingUploads).toEqual([
			expect.objectContaining({
				sourceElementId: "video-child",
				sourceCanvasId: "source-canvas",
			}),
		])
		expect(pastedContent.src).toBeUndefined()
		expect(pastedContent.generateVideoRequest?.video_id).toBeUndefined()
		expect(pastedContent.generateVideoRequest?.project_id).toBeUndefined()
		expect(pastedContent.generateVideoRequest?.file_dir).toBeUndefined()
		expect(pastedContent.generateVideoRequest?.file_name).toBeUndefined()
		expect(pastedContent.generateVideoRequest?.inputs).toEqual({
			frames: [expect.objectContaining({ uri: "source/start.png" })],
			reference_images: [expect.objectContaining({ uri: "source/ref.png" })],
			reference_videos: [expect.objectContaining({ uri: "source/ref.mp4" })],
			reference_audios: [expect.objectContaining({ uri: "source/ref.mp3" })],
			video: expect.objectContaining({ uri: "source/video.mp4" }),
			mask: expect.objectContaining({ uri: "source/mask.png" }),
			audio: [expect.objectContaining({ uri: "source/audio.wav" })],
		})
	})

	it("returns an uploading frame child placeholder before remote transfer finishes", async () => {
		const child = v3<ImageElement>({
			id: "image-child",
			type: "image",
			name: "Child image",
			src: "source/image.png",
			x: 12,
			y: 16,
			width: 80,
			height: 60,
			generateImageRequest: {
				image_id: "source-image-task",
				model_id: "image-model",
				prompt: "a friendly creature",
			},
			imageGenerationTaskMeta: {
				type: ImageGenerationTaskTypeMap.RemoveBackground,
				image_id: "source-remove-bg-task",
				file_path: "source/image.png",
			},
		})
		const frame = v3<FrameElement>({
			id: "frame-1",
			type: "frame",
			name: "Frame",
			x: 100,
			y: 120,
			width: 300,
			height: 200,
			children: [child],
		})
		const manager = createClipboardManager()
		const metadata = {
			elementId: "image-child",
			filename: "image.png",
			mimeType: "image/png",
			fileSize: 0,
			sourceRef: {
				src: "source/image.png",
				ossUrl: "https://source.test/image.png",
			},
		}

		const result = await manager.prepareClipboardTreeElement({
			sourceElement: frame,
			currentNames: new Set(),
			isRoot: true,
			offsetX: 0,
			offsetY: 0,
			canReuseElementSrc: false,
			fileByElementId: new Map(),
			metadataByElementId: new Map([["image-child", metadata]]),
			sourceCanvasId: "source-canvas",
		})

		expect(result.sourceReferenceFailureCount).toBe(0)
		expect(result.pendingUploads).toEqual([
			expect.objectContaining({
				sourceElementId: "image-child",
				sourceCanvasId: "source-canvas",
				metadata,
			}),
		])
		const pastedFrame = result.element as FrameElement
		const pastedChild = pastedFrame.children?.[0] as ImageElement
		const pastedContent = activeContent(pastedChild)
		expect(pastedChild).toEqual(
			expect.objectContaining({
				type: "image",
				contents: [
					expect.objectContaining({
						status: GenerationStatus.Processing,
						generateImageRequest: expect.objectContaining({
							model_id: "image-model",
							prompt: "a friendly creature",
						}),
						imageGenerationTaskMeta: expect.objectContaining({
							type: ImageGenerationTaskTypeMap.RemoveBackground,
							file_path: "source/image.png",
						}),
					}),
				],
			}),
		)
		expect(pastedContent.generateImageRequest?.image_id).toBeUndefined()
		expect(pastedContent.imageGenerationTaskMeta?.image_id).toBeUndefined()
		expect(pastedChild.id).toBe(result.pendingUploads[0]?.targetElementId)
		expect(pastedChild.id).not.toBe("image-child")
	})

	it("keeps pasted video info data but drops the source polling id", async () => {
		const child = v3<VideoElement>({
			id: "video-child",
			type: "video",
			name: "Child video",
			src: "source/video.mp4",
			x: 12,
			y: 16,
			width: 160,
			height: 90,
			generateVideoRequest: {
				video_id: "source-video-task",
				model_id: "video-model",
				prompt: "a cinematic clip",
			},
		})
		const frame = v3<FrameElement>({
			id: "frame-1",
			type: "frame",
			name: "Frame",
			x: 100,
			y: 120,
			width: 300,
			height: 200,
			children: [child],
		})
		const manager = createClipboardManager()
		const metadata = {
			elementId: "video-child",
			filename: "video.mp4",
			mimeType: "video/mp4",
			fileSize: 0,
			sourceRef: {
				src: "source/video.mp4",
				ossUrl: "https://source.test/video.mp4",
			},
		}

		const result = await manager.prepareClipboardTreeElement({
			sourceElement: frame,
			currentNames: new Set(),
			isRoot: true,
			offsetX: 0,
			offsetY: 0,
			canReuseElementSrc: false,
			fileByElementId: new Map(),
			metadataByElementId: new Map([["video-child", metadata]]),
			sourceCanvasId: "source-canvas",
		})

		expect(result.sourceReferenceFailureCount).toBe(0)
		expect(result.pendingUploads).toEqual([
			expect.objectContaining({
				sourceElementId: "video-child",
				sourceCanvasId: "source-canvas",
				metadata,
			}),
		])
		const pastedFrame = result.element as FrameElement
		const pastedChild = pastedFrame.children?.[0] as VideoElement
		const pastedContent = activeContent(pastedChild)
		expect(pastedChild).toEqual(
			expect.objectContaining({
				type: "video",
				contents: [
					expect.objectContaining({
						status: GenerationStatus.Processing,
						generateVideoRequest: expect.objectContaining({
							model_id: "video-model",
							prompt: "a cinematic clip",
						}),
					}),
				],
			}),
		)
		expect(pastedContent.generateVideoRequest?.video_id).toBeUndefined()
		expect(pastedChild.id).toBe(result.pendingUploads[0]?.targetElementId)
		expect(pastedChild.id).not.toBe("video-child")
	})

	it("uploads an audio child before returning the pasted frame", async () => {
		const child = v3<AudioElement>({
			id: "audio-child",
			type: "audio",
			name: "Child audio",
			src: "source/audio.mp3",
			x: 12,
			y: 16,
			width: 480,
			height: 120,
		})
		const frame = v3<FrameElement>({
			id: "frame-1",
			type: "frame",
			name: "Frame",
			x: 100,
			y: 120,
			width: 600,
			height: 240,
			children: [child],
		})
		const manager = createClipboardManager()
		manager.canvas.canvasFileUploadManager.transferRemoteResource.mockResolvedValue({
			path: "target/audio.mp3",
			src: "https://target.test/audio.mp3",
			fileName: "audio.mp3",
		})
		const metadata = {
			elementId: "audio-child",
			filename: "audio.mp3",
			mimeType: "audio/mpeg",
			fileSize: 0,
			sourceRef: {
				src: "source/audio.mp3",
				ossUrl: "https://source.test/audio.mp3",
			},
		}

		const result = await manager.prepareClipboardTreeElement({
			sourceElement: frame,
			currentNames: new Set(),
			isRoot: true,
			offsetX: 0,
			offsetY: 0,
			canReuseElementSrc: false,
			fileByElementId: new Map(),
			metadataByElementId: new Map([["audio-child", metadata]]),
			sourceCanvasId: "source-canvas",
		})

		expect(result.sourceReferenceFailureCount).toBe(0)
		expect(result.pendingUploads).toEqual([])
		const pastedFrame = result.element as FrameElement
		const pastedChild = pastedFrame.children?.[0] as AudioElement
		const pastedContent = activeContent(pastedChild)
		expect(pastedChild).toEqual(
			expect.objectContaining({
				type: "audio",
				contents: [expect.objectContaining({ src: "target/audio.mp3" })],
			}),
		)
		expect(pastedChild.visible).toBe(true)
		expect(pastedContent.src).toBe("target/audio.mp3")
		expect(pastedFrame.children).toHaveLength(1)
		expect(pastedChild.id).not.toBe("audio-child")
		expect(manager.canvas.audioResourceManager.primeCache).toHaveBeenCalledWith(
			"target/audio.mp3",
			expect.objectContaining({ path: "target/audio.mp3" }),
		)
	})

	it("rewrites every source-canvas alias after a pasted image upload applies", () => {
		const uploadResult: UploadFileResponse = {
			path: "target/image.png",
			src: "https://target.test/image.png",
			fileName: "image.png",
		}
		const currentElement = v3<ImageElement>({
			id: "pasted-image",
			type: "image",
			name: "Pasted image",
			x: 12,
			y: 16,
			width: 80,
			height: 60,
			status: GenerationStatus.Processing,
			generateImageRequest: {
				model_id: "image-model",
				prompt: "pasted image",
				reference_images: ["/画布A/images/image.png"],
			},
		})
		const setOssSrc = vi.fn()
		const requestImmediateMediaLoadForElements = vi.fn()
		const convertToPermament = vi.fn()
		const manager = createClipboardManager()
		manager.canvas = {
			...manager.canvas,
			elementManager: {
				hasElement: vi.fn(() => true),
				getElementData: vi.fn(() => currentElement),
				getElementInstance: vi.fn(() => ({ setOssSrc })),
				isTemporary: vi.fn(() => true),
				convertToPermament,
				update: vi.fn(),
			},
			visibilityManager: {
				requestImmediateMediaLoadForElements,
			},
		} as unknown as ClipboardManagerTestHarness["canvas"]

		const applied = (
			manager as unknown as {
				applyClipboardTreeUploadResult: (
					upload: {
						sourceElementId: string
						targetElementId: string
						targetContentId: string
						sourcePath?: string
						metadata?: {
							resourceAliases?: string[]
						}
					},
					nextUploadResult: UploadFileResponse,
				) => boolean
			}
		).applyClipboardTreeUploadResult(
			{
				sourceElementId: "source-image",
				targetElementId: "pasted-image",
				targetContentId: "pasted-image-content",
				sourcePath: "./images/image.png",
				metadata: {
					resourceAliases: ["./images/image.png", "/画布A/images/image.png"],
				},
			},
			uploadResult,
		)

		expect(applied).toBe(true)
		const imageResourceUpdates = convertToPermament.mock.calls[0]?.[1]
		expect(imageResourceUpdates).toEqual(
			expect.objectContaining({
				contents: [
					expect.objectContaining({
						src: "target/image.png",
						status: GenerationStatus.Completed,
						errorMessage: undefined,
						generateImageRequest: expect.objectContaining({
							reference_images: ["target/image.png"],
						}),
					}),
				],
			}),
		)
		expect(imageResourceUpdates).not.toHaveProperty("id")
		expect(imageResourceUpdates).not.toHaveProperty("x")
		expect(imageResourceUpdates).not.toHaveProperty("y")
		expect(imageResourceUpdates).not.toHaveProperty("width")
		expect(imageResourceUpdates).not.toHaveProperty("height")
		expect(convertToPermament).toHaveBeenCalledWith("pasted-image", imageResourceUpdates, {
			silent: true,
		})
		expect(manager.canvas.imageResourceManager.primeCache).toHaveBeenCalledWith(
			"target/image.png",
			uploadResult,
		)
		expect(setOssSrc).toHaveBeenCalledWith("https://target.test/image.png")
		expect(requestImmediateMediaLoadForElements).toHaveBeenCalledWith(["pasted-image"], {
			reason: "clipboard-tree-upload",
			priority: "critical",
		})
	})

	it("writes a pasted image upload back to the captured Content after active changes", () => {
		const uploadResult: UploadFileResponse = {
			path: "target/uploaded.png",
			src: "https://target.test/uploaded.png",
			fileName: "uploaded.png",
		}
		const currentElement: ImageElement = {
			id: "pasted-image",
			type: "image",
			name: "Pasted image",
			x: 12,
			y: 16,
			width: 80,
			height: 60,
			contents: [
				{
					contentId: "upload-target",
					src: undefined,
					status: GenerationStatus.Processing,
				},
				{
					contentId: "visible-content",
					src: "target/visible.png",
					status: GenerationStatus.Completed,
				},
			],
			activeContentId: "visible-content",
			mainContentId: "upload-target",
		}
		const setOssSrc = vi.fn()
		const requestImmediateMediaLoadForElements = vi.fn()
		const update = vi.fn()
		const manager = createClipboardManager()
		manager.canvas = {
			...manager.canvas,
			elementManager: {
				hasElement: vi.fn(() => true),
				getElementData: vi.fn(() => currentElement),
				getElementInstance: vi.fn(() => ({ setOssSrc })),
				isTemporary: vi.fn(() => false),
				convertToPermament: vi.fn(),
				update,
			},
			visibilityManager: {
				requestImmediateMediaLoadForElements,
			},
		} as unknown as ClipboardManagerTestHarness["canvas"]

		const applied = (
			manager as unknown as {
				applyClipboardTreeUploadResult: (
					upload: {
						sourceElementId: string
						targetElementId: string
						targetContentId: string
					},
					nextUploadResult: UploadFileResponse,
				) => boolean
			}
		).applyClipboardTreeUploadResult(
			{
				sourceElementId: "source-image",
				targetElementId: "pasted-image",
				targetContentId: "upload-target",
			},
			uploadResult,
		)

		expect(applied).toBe(true)
		const resourceUpdates = update.mock.calls[0]?.[1]
		expect(resourceUpdates).toEqual(
			expect.objectContaining({
				contents: [
					expect.objectContaining({
						contentId: "upload-target",
						src: "target/uploaded.png",
						status: GenerationStatus.Completed,
					}),
					expect.objectContaining({
						contentId: "visible-content",
						src: "target/visible.png",
						status: GenerationStatus.Completed,
					}),
				],
				activeContentId: "visible-content",
				mainContentId: "upload-target",
			}),
		)
		expect(setOssSrc).not.toHaveBeenCalled()
		expect(requestImmediateMediaLoadForElements).not.toHaveBeenCalled()
	})

	it("writes a pasted media upload failure to the captured Content", () => {
		const currentElement: VideoElement = {
			id: "pasted-video",
			type: "video",
			contents: [
				{
					contentId: "upload-target",
					status: GenerationStatus.Processing,
				},
				{
					contentId: "visible-content",
					src: "target/visible.mp4",
					status: GenerationStatus.Completed,
				},
			],
			activeContentId: "visible-content",
			mainContentId: "upload-target",
		}
		const update = vi.fn()
		const manager = createClipboardManager()
		manager.canvas = {
			...manager.canvas,
			elementManager: {
				hasElement: vi.fn(() => true),
				getElementData: vi.fn(() => currentElement),
				getElementInstance: vi.fn(() => undefined),
				update,
			},
		} as unknown as ClipboardManagerTestHarness["canvas"]
		;(
			manager as unknown as {
				applyClipboardTreeUploadFailure: (upload: {
					sourceElementId: string
					targetElementId: string
					targetContentId: string
				}) => void
			}
		).applyClipboardTreeUploadFailure({
			sourceElementId: "source-video",
			targetElementId: "pasted-video",
			targetContentId: "upload-target",
		})

		expect(update).toHaveBeenCalledWith(
			"pasted-video",
			{
				contents: [
					expect.objectContaining({
						contentId: "upload-target",
						status: GenerationStatus.Failed,
						errorMessage: expect.any(String),
					}),
					expect.objectContaining({
						contentId: "visible-content",
						status: GenerationStatus.Completed,
					}),
				],
			},
			{ silent: true },
		)
	})

	it("activates pasted frame child video resources after upload applies", () => {
		const uploadResult: UploadFileResponse = {
			path: "target/video.mp4",
			src: "https://target.test/video.mp4",
			fileName: "video.mp4",
		}
		const currentElement = v3<VideoElement>({
			id: "pasted-video",
			type: "video",
			name: "Pasted video",
			x: 12,
			y: 16,
			width: 160,
			height: 90,
			status: GenerationStatus.Processing,
		})
		const requestPreviewLoad = vi.fn()
		const requestImmediateMediaLoadForElements = vi.fn()
		const convertToPermament = vi.fn()
		const manager = createClipboardManager()
		manager.canvas = {
			...manager.canvas,
			elementManager: {
				hasElement: vi.fn(() => true),
				getElementData: vi.fn(() => currentElement),
				getElementInstance: vi.fn(() => ({ requestPreviewLoad })),
				isTemporary: vi.fn(() => true),
				convertToPermament,
				update: vi.fn(),
			},
			visibilityManager: {
				requestImmediateMediaLoadForElements,
			},
		} as unknown as ClipboardManagerTestHarness["canvas"]

		const applied = (
			manager as unknown as {
				applyClipboardTreeUploadResult: (
					upload: {
						sourceElementId: string
						targetElementId: string
						targetContentId: string
						sourcePath?: string
					},
					nextUploadResult: UploadFileResponse,
				) => boolean
			}
		).applyClipboardTreeUploadResult(
			{
				sourceElementId: "source-video",
				targetElementId: "pasted-video",
				targetContentId: "pasted-video-content",
			},
			uploadResult,
		)

		expect(applied).toBe(true)
		const videoResourceUpdates = convertToPermament.mock.calls[0]?.[1]
		expect(videoResourceUpdates).toEqual(
			expect.objectContaining({
				contents: [
					expect.objectContaining({
						src: "target/video.mp4",
						status: GenerationStatus.Completed,
						errorMessage: undefined,
					}),
				],
			}),
		)
		expect(videoResourceUpdates).not.toHaveProperty("id")
		expect(videoResourceUpdates).not.toHaveProperty("x")
		expect(videoResourceUpdates).not.toHaveProperty("y")
		expect(videoResourceUpdates).not.toHaveProperty("width")
		expect(videoResourceUpdates).not.toHaveProperty("height")
		expect(convertToPermament).toHaveBeenCalledWith("pasted-video", videoResourceUpdates, {
			silent: true,
		})
		expect(manager.canvas.videoResourceManager.primeCache).toHaveBeenCalledWith(
			"target/video.mp4",
			uploadResult,
		)
		expect(requestPreviewLoad).toHaveBeenCalledWith({ force: true })
		expect(requestImmediateMediaLoadForElements).toHaveBeenCalledWith(["pasted-video"], {
			reason: "clipboard-tree-upload",
			priority: "critical",
		})
	})

	it("finalizes a pasted frame audio child without scheduling viewport media loading", () => {
		const uploadResult: UploadFileResponse = {
			path: "target/audio.mp3",
			src: "https://target.test/audio.mp3",
			fileName: "audio.mp3",
		}
		const currentElement = v3<AudioElement>({
			id: "pasted-audio",
			type: "audio",
			name: "Pasted audio",
			x: 12,
			y: 16,
			width: 480,
			height: 120,
			visible: false,
		})
		const requestImmediateMediaLoadForElements = vi.fn()
		const convertToPermament = vi.fn()
		const manager = createClipboardManager()
		manager.canvas = {
			...manager.canvas,
			elementManager: {
				hasElement: vi.fn(() => true),
				getElementData: vi.fn(() => currentElement),
				getElementInstance: vi.fn(() => undefined),
				isTemporary: vi.fn(() => true),
				convertToPermament,
				update: vi.fn(),
			},
			visibilityManager: {
				requestImmediateMediaLoadForElements,
			},
		} as unknown as ClipboardManagerTestHarness["canvas"]

		const applied = (
			manager as unknown as {
				applyClipboardTreeUploadResult: (
					upload: {
						sourceElementId: string
						targetElementId: string
						targetContentId: string
					},
					nextUploadResult: UploadFileResponse,
				) => boolean
			}
		).applyClipboardTreeUploadResult(
			{
				sourceElementId: "source-audio",
				targetElementId: "pasted-audio",
				targetContentId: "pasted-audio-content",
			},
			uploadResult,
		)

		expect(applied).toBe(true)
		const audioResourceUpdates = convertToPermament.mock.calls[0]?.[1]
		expect(audioResourceUpdates).toEqual({
			contents: [expect.objectContaining({ src: "target/audio.mp3" })],
			activeContentId: "pasted-audio-content",
			mainContentId: "pasted-audio-content",
			visible: true,
		})
		expect(convertToPermament).toHaveBeenCalledWith("pasted-audio", audioResourceUpdates, {
			silent: true,
		})
		expect(manager.canvas.audioResourceManager.primeCache).toHaveBeenCalledWith(
			"target/audio.mp3",
			uploadResult,
		)
		expect(requestImmediateMediaLoadForElements).not.toHaveBeenCalled()
	})

	it("omits a cross-canvas audio child when its upload fails", async () => {
		const child = v3<AudioElement>({
			id: "source-audio",
			type: "audio",
			src: "source/audio.mp3",
			x: 12,
			y: 16,
			width: 480,
			height: 120,
		})
		const frame = v3<FrameElement>({
			id: "frame-1",
			type: "frame",
			x: 0,
			y: 0,
			width: 600,
			height: 240,
			children: [child],
		})
		const manager = createClipboardManager()
		manager.canvas.canvasFileUploadManager.transferRemoteResource.mockResolvedValue(null)
		const metadata = {
			elementId: "source-audio",
			filename: "audio.mp3",
			mimeType: "audio/mpeg",
			fileSize: 0,
			sourceRef: {
				src: "source/audio.mp3",
				ossUrl: "https://source.test/audio.mp3",
			},
		}

		const result = await manager.prepareClipboardTreeElement({
			sourceElement: frame,
			currentNames: new Set(),
			isRoot: true,
			offsetX: 0,
			offsetY: 0,
			canReuseElementSrc: false,
			fileByElementId: new Map(),
			metadataByElementId: new Map([["source-audio", metadata]]),
			sourceCanvasId: "source-canvas",
		})

		expect(result.sourceReferenceFailureCount).toBe(1)
		expect(result.pendingUploads).toEqual([])
		expect((result.element as FrameElement).children).toEqual([])
	})

	it("rewrites source-canvas aliases during background resource transfers", async () => {
		const uploadResult: UploadFileResponse = {
			path: "./videos/reference-copy.mp4",
			src: "https://target.test/reference-copy.mp4",
			fileName: "reference-copy.mp4",
			expires_at: "2030-01-01 00:00:00",
		}
		const currentElement = v3<VideoElement>({
			id: "pasted-video",
			type: "video",
			name: "Pasted video",
			x: 12,
			y: 16,
			width: 160,
			height: 90,
			generateVideoRequest: {
				model_id: "video-model",
				prompt: "merge clips",
				inputs: {
					reference_videos: [{ uri: "/画布A/videos/reference.mp4" }],
				},
			},
		})
		const transferRemoteResource = vi.fn(async () => uploadResult)
		const update = vi.fn()
		const recordHistoryImmediate = vi.fn()
		const releaseLoadDeferral = vi.fn()
		const manager = createClipboardManager()
		manager.canvas = {
			id: "target-canvas",
			canvasFileUploadManager: {
				getCompletedRemoteResourceTransfer: vi.fn(),
				getReusableCompletedRemoteResourceTransfer: vi.fn(),
				transferRemoteResource,
			},
			elementManager: {
				getElementData: vi.fn(() => currentElement),
				update,
			},
			historyManager: {
				recordHistoryImmediate,
			},
			imageResourceManager: {
				primeCache: vi.fn(),
			},
			videoResourceManager: {
				primeCache: vi.fn(),
			},
		} as unknown as ClipboardManagerTestHarness["canvas"]
		;(
			manager as unknown as {
				runClipboardGenerationResourceTransfers: (options: {
					fileMetadata: Array<{
						elementId: string
						filename: string
						mimeType: string
						fileSize: number
						role: string
						resourcePath?: string
						resourceIdentity?: string
						resourceAliases?: string[]
						sourceRef?: { src?: string; ossUrl?: string }
					}>
					sourceCanvasId?: string
					targetElementIds: string[]
					releaseLoadDeferrals?: Array<() => void>
				}) => void
			}
		).runClipboardGenerationResourceTransfers({
			fileMetadata: [
				{
					elementId: "generation-resource:0",
					filename: "reference.mp4",
					mimeType: "video/mp4",
					fileSize: 0,
					role: "generation-resource",
					resourcePath: "./videos/reference.mp4",
					resourceIdentity: "workspace:/画布A/videos/reference.mp4",
					resourceAliases: ["./videos/reference.mp4", "/画布A/videos/reference.mp4"],
					sourceRef: {
						src: "./videos/reference.mp4",
						ossUrl: "https://source.test/reference.mp4",
					},
				},
			],
			sourceCanvasId: "source-canvas",
			targetElementIds: ["pasted-video"],
			releaseLoadDeferrals: [releaseLoadDeferral],
		})

		await vi.waitFor(() => {
			expect(transferRemoteResource).toHaveBeenCalledTimes(1)
			expect(update).toHaveBeenCalledTimes(1)
		})

		expect(update).toHaveBeenCalledWith(
			"pasted-video",
			expect.objectContaining({
				contents: [
					expect.objectContaining({
						generateVideoRequest: expect.objectContaining({
							inputs: expect.objectContaining({
								reference_videos: [{ uri: "./videos/reference-copy.mp4" }],
							}),
						}),
					}),
				],
			}),
			{ silent: false },
		)
		expect(manager.canvas.videoResourceManager.primeCache).toHaveBeenCalledWith(
			"./videos/reference-copy.mp4",
			uploadResult,
		)
		expect(recordHistoryImmediate).toHaveBeenCalledTimes(1)
		expect(releaseLoadDeferral).toHaveBeenCalledTimes(1)
	})

	it("preserves a cross-canvas empty image element without requiring a source", async () => {
		const emptyImage: ImageElement = {
			id: "empty-image",
			type: "image",
			x: 12,
			y: 16,
			width: 80,
			height: 60,
		}
		const manager = createClipboardManager()

		const result = await manager.prepareClipboardTreeElement({
			sourceElement: emptyImage,
			currentNames: new Set(),
			isRoot: true,
			offsetX: 20,
			offsetY: 30,
			rootZIndex: 7,
			canReuseElementSrc: false,
			fileByElementId: new Map(),
			metadataByElementId: new Map(),
			resourcePathMap: new Map(),
			sourceCanvasId: "source-canvas",
		})

		expect(result.sourceReferenceFailureCount).toBe(0)
		expect(result.pendingUploads).toEqual([])
		expect(result.element).toEqual(
			expect.objectContaining({
				type: "image",
				x: 32,
				y: 46,
				zIndex: 7,
			}),
		)
		expect((result.element as ImageElement).src).toBeUndefined()
	})

	it("rewrites source-canvas aliases during background resource transfers", async () => {
		const uploadResult: UploadFileResponse = {
			path: "./videos/reference-copy.mp4",
			src: "https://target.test/reference-copy.mp4",
			fileName: "reference-copy.mp4",
			expires_at: "2030-01-01 00:00:00",
		}
		const currentElement: VideoElement = {
			id: "pasted-video",
			type: "video",
			name: "Pasted video",
			x: 12,
			y: 16,
			width: 160,
			height: 90,
			generateVideoRequest: {
				model_id: "video-model",
				prompt: "merge clips",
				inputs: {
					reference_videos: [{ uri: "./videos/reference.mp4" }],
				},
			},
		}
		const transferRemoteResource = vi.fn(async () => uploadResult)
		const update = vi.fn()
		const recordHistoryImmediate = vi.fn()
		const releaseLoadDeferral = vi.fn()
		const manager = createClipboardManager()
		manager.canvas = {
			id: "target-canvas",
			canvasFileUploadManager: {
				getCompletedRemoteResourceTransfer: vi.fn(),
				getReusableCompletedRemoteResourceTransfer: vi.fn(),
				transferRemoteResource,
			},
			elementManager: {
				getElementData: vi.fn(() => currentElement),
				update,
			},
			historyManager: {
				recordHistoryImmediate,
			},
			imageResourceManager: {
				primeCache: vi.fn(),
			},
			videoResourceManager: {
				primeCache: vi.fn(),
			},
		} as unknown as ClipboardManagerTestHarness["canvas"]
		;(
			manager as unknown as {
				runClipboardGenerationResourceTransfers: (options: {
					fileMetadata: Array<{
						elementId: string
						filename: string
						mimeType: string
						fileSize: number
						role: string
						resourcePath?: string
						sourceRef?: { src?: string; ossUrl?: string }
					}>
					sourceCanvasId?: string
					targetElementIds: string[]
					releaseLoadDeferrals?: Array<() => void>
				}) => void
			}
		).runClipboardGenerationResourceTransfers({
			fileMetadata: [
				{
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
			],
			sourceCanvasId: "source-canvas",
			targetElementIds: ["pasted-video"],
			releaseLoadDeferrals: [releaseLoadDeferral],
		})

		await vi.waitFor(() => {
			expect(transferRemoteResource).toHaveBeenCalledTimes(1)
			expect(update).toHaveBeenCalledTimes(1)
		})

		expect(update).toHaveBeenCalledWith(
			"pasted-video",
			expect.objectContaining({
				generateVideoRequest: expect.objectContaining({
					inputs: expect.objectContaining({
						reference_videos: [{ uri: "./videos/reference-copy.mp4" }],
					}),
				}),
			}),
			{ silent: false },
		)
		expect(manager.canvas.videoResourceManager.primeCache).toHaveBeenCalledWith(
			"./videos/reference-copy.mp4",
			uploadResult,
		)
		expect(recordHistoryImmediate).toHaveBeenCalledTimes(1)
		expect(releaseLoadDeferral).toHaveBeenCalledTimes(1)
	})

	it("preserves a cross-canvas empty image element without requiring a source", async () => {
		const emptyImage: ImageElement = {
			id: "empty-image",
			type: "image",
			x: 12,
			y: 16,
			width: 80,
			height: 60,
		}
		const manager = createClipboardManager()

		const result = await manager.prepareClipboardTreeElement({
			sourceElement: emptyImage,
			currentNames: new Set(),
			isRoot: true,
			offsetX: 20,
			offsetY: 30,
			rootZIndex: 7,
			canReuseElementSrc: false,
			fileByElementId: new Map(),
			metadataByElementId: new Map(),
			resourcePathMap: new Map(),
			sourceCanvasId: "source-canvas",
		})

		expect(result.sourceReferenceFailureCount).toBe(0)
		expect(result.pendingUploads).toEqual([])
		expect(result.element).toEqual(
			expect.objectContaining({
				type: "image",
				x: 32,
				y: 46,
				zIndex: 7,
			}),
		)
		expect((result.element as ImageElement).src).toBeUndefined()
	})

	it("rewrites source-canvas aliases during background resource transfers", async () => {
		const uploadResult: UploadFileResponse = {
			path: "./videos/reference-copy.mp4",
			src: "https://target.test/reference-copy.mp4",
			fileName: "reference-copy.mp4",
			expires_at: "2030-01-01 00:00:00",
		}
		const currentElement: VideoElement = {
			id: "pasted-video",
			type: "video",
			name: "Pasted video",
			x: 12,
			y: 16,
			width: 160,
			height: 90,
			generateVideoRequest: {
				model_id: "video-model",
				prompt: "merge clips",
				inputs: {
					reference_videos: [{ uri: "./videos/reference.mp4" }],
				},
			},
		}
		const transferRemoteResource = vi.fn(async () => uploadResult)
		const update = vi.fn()
		const recordHistoryImmediate = vi.fn()
		const releaseLoadDeferral = vi.fn()
		const manager = createClipboardManager()
		manager.canvas = {
			id: "target-canvas",
			canvasFileUploadManager: {
				getCompletedRemoteResourceTransfer: vi.fn(),
				getReusableCompletedRemoteResourceTransfer: vi.fn(),
				transferRemoteResource,
			},
			elementManager: {
				getElementData: vi.fn(() => currentElement),
				update,
			},
			historyManager: {
				recordHistoryImmediate,
			},
			imageResourceManager: {
				primeCache: vi.fn(),
			},
			videoResourceManager: {
				primeCache: vi.fn(),
			},
		} as unknown as ClipboardManagerTestHarness["canvas"]
		;(
			manager as unknown as {
				runClipboardGenerationResourceTransfers: (options: {
					fileMetadata: Array<{
						elementId: string
						filename: string
						mimeType: string
						fileSize: number
						role: string
						resourcePath?: string
						sourceRef?: { src?: string; ossUrl?: string }
					}>
					sourceCanvasId?: string
					targetElementIds: string[]
					releaseLoadDeferrals?: Array<() => void>
				}) => void
			}
		).runClipboardGenerationResourceTransfers({
			fileMetadata: [
				{
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
			],
			sourceCanvasId: "source-canvas",
			targetElementIds: ["pasted-video"],
			releaseLoadDeferrals: [releaseLoadDeferral],
		})

		await vi.waitFor(() => {
			expect(transferRemoteResource).toHaveBeenCalledTimes(1)
			expect(update).toHaveBeenCalledTimes(1)
		})

		expect(update).toHaveBeenCalledWith(
			"pasted-video",
			expect.objectContaining({
				generateVideoRequest: expect.objectContaining({
					inputs: expect.objectContaining({
						reference_videos: [{ uri: "./videos/reference-copy.mp4" }],
					}),
				}),
			}),
			{ silent: false },
		)
		expect(manager.canvas.videoResourceManager.primeCache).toHaveBeenCalledWith(
			"./videos/reference-copy.mp4",
			uploadResult,
		)
		expect(recordHistoryImmediate).toHaveBeenCalledTimes(1)
		expect(releaseLoadDeferral).toHaveBeenCalledTimes(1)
	})
})

describe("ClipboardManager connection clipboard", () => {
	it("keeps only connections whose endpoints are inside the copied element tree", () => {
		const firstChild = v3<ImageElement>({
			id: "frame-image-1",
			type: "image",
			x: 0,
			y: 0,
			width: 80,
			height: 60,
		})
		const secondChild = v3<ImageElement>({
			id: "frame-image-2",
			type: "image",
			x: 100,
			y: 0,
			width: 80,
			height: 60,
		})
		const frame = v3<FrameElement>({
			id: "frame-1",
			type: "frame",
			x: 0,
			y: 0,
			width: 300,
			height: 200,
			children: [firstChild, secondChild],
		})
		const manager = Object.create(ClipboardManager.prototype) as {
			canvas: { connectionManager: { exportConnections: () => unknown[] } }
			getClipboardConnections: (elements: LayerElement[]) => unknown[]
		}
		manager.canvas = {
			connectionManager: {
				exportConnections: () => [
					{
						id: "internal",
						sourceElementId: firstChild.id,
						targetElementId: secondChild.id,
					},
					{
						id: "external",
						sourceElementId: secondChild.id,
						targetElementId: "outside-element",
					},
				],
			},
		}

		expect(manager.getClipboardConnections([frame])).toEqual([
			expect.objectContaining({ id: "internal" }),
		])
	})

	it("remaps connection endpoints and waits for temporary elements", () => {
		const manager = Object.create(ClipboardManager.prototype) as {
			canvas: {
				elementManager: {
					hasElement: (elementId: string) => boolean
					isTemporary: (elementId: string) => boolean
					getElementData: (elementId: string) => { type: string } | null
				}
				connectionManager: {
					hasConnection: (sourceElementId: string, targetElementId: string) => boolean
					hasReverseConnection: (
						sourceElementId: string,
						targetElementId: string,
					) => boolean
					connectElementsBatch: (options: { edges: unknown[] }) => { status: "created" }
				}
			}
			remapClipboardConnections: (
				connections: Array<{
					id: string
					sourceElementId: string
					targetElementId: string
				}>,
				mapping: ReadonlyMap<string, string>,
			) => unknown[]
			getClipboardDeferredVideoEditConnectionTargets: (
				connections: Array<{ sourceElementId: string; targetElementId: string }>,
			) => Set<string>
			createClipboardConnections: (
				connections: unknown[],
				deferredTargetElementIds?: ReadonlySet<string>,
			) => boolean
		}
		const connectElementsBatch = vi.fn(() => ({ status: "created" as const }))
		manager.canvas = {
			elementManager: {
				hasElement: (elementId) => elementId !== "missing",
				isTemporary: (elementId) => elementId === "target-pending",
				getElementData: (elementId) =>
					elementId === "target-video-edit" ? { type: ElementTypeEnum.VideoEdit } : null,
			},
			connectionManager: {
				hasConnection: () => false,
				hasReverseConnection: () => false,
				connectElementsBatch,
			},
		}

		const remapped = manager.remapClipboardConnections(
			[
				{ id: "edge-1", sourceElementId: "source-a", targetElementId: "source-b" },
				{ id: "edge-2", sourceElementId: "source-b", targetElementId: "source-c" },
			],
			new Map([
				["source-a", "target-a"],
				["source-b", "target-pending"],
				["source-c", "target-c"],
			]),
		)

		expect(remapped).toEqual([
			{ sourceElementId: "target-a", targetElementId: "target-pending" },
			{ sourceElementId: "target-pending", targetElementId: "target-c" },
		])
		expect(manager.createClipboardConnections(remapped)).toBe(false)
		expect(connectElementsBatch).not.toHaveBeenCalled()

		manager.canvas.elementManager.isTemporary = () => false
		expect(manager.createClipboardConnections(remapped)).toBe(true)
		expect(connectElementsBatch).toHaveBeenCalledWith({ edges: remapped })

		connectElementsBatch.mockClear()
		manager.canvas.elementManager.isTemporary = (elementId) => elementId === "source-pending"
		const videoEditConnections = [
			{ sourceElementId: "source-pending", targetElementId: "target-video-edit" },
			{ sourceElementId: "source-ready", targetElementId: "target-video-edit" },
			{ sourceElementId: "source-ready", targetElementId: "target-regular" },
		]
		const deferredTargets =
			manager.getClipboardDeferredVideoEditConnectionTargets(videoEditConnections)

		expect(deferredTargets).toEqual(new Set(["target-video-edit"]))
		expect(manager.createClipboardConnections(videoEditConnections, deferredTargets)).toBe(true)
		expect(connectElementsBatch).toHaveBeenCalledWith({
			edges: [{ sourceElementId: "source-ready", targetElementId: "target-regular" }],
		})

		connectElementsBatch.mockClear()
		manager.canvas.elementManager.isTemporary = () => false
		expect(manager.createClipboardConnections(videoEditConnections)).toBe(true)
		expect(connectElementsBatch).toHaveBeenCalledWith({ edges: videoEditConnections })
	})
})
