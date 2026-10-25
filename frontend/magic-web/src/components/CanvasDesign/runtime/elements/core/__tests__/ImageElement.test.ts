import Konva from "konva"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ImageElement } from "../../image/ImageElement"
import { VideoElement } from "../../video/VideoElement"
import { GenerationStatus, type GenerateImageRequest } from "../../../../public/magic-types"
import { RenderUtils } from "../../../shared/render/RenderUtils"
import {
	ElementTypeEnum,
	type ElementUpdatePatch,
	type ImageElement as ImageElementData,
	type ImageElementContent,
	type VideoElement as VideoElementData,
} from "../../../document/types"
import { isImageElementContent } from "../../../document/elementContent"
import { GenerationRuntimeManager } from "../../../generation/GenerationRuntimeManager"
import { GenerationAttemptCoordinator } from "../../../generation/GenerationAttemptCoordinator"
import type { Canvas } from "../../../core/Canvas"
import { INVALID_GENERATED_RESOURCE_PATH_ERROR } from "../../../resources/polling/generationPollingUtils"
import {
	buildMediaEditSourceFingerprint,
	MediaEditRecoveryManager,
} from "../../../interaction/media-edit-recovery/MediaEditRecoveryManager"

function createDeferred() {
	let resolve!: () => void
	let reject!: (reason?: unknown) => void
	const promise = new Promise<void>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise
		reject = rejectPromise
	})
	return { promise, resolve, reject }
}

function createDeferredValue<T>() {
	let resolve!: (value: T) => void
	let reject!: (reason?: unknown) => void
	const promise = new Promise<T>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise
		reject = rejectPromise
	})
	return { promise, resolve, reject }
}

/** Object.create-based unit fixtures bypass ImageElement's constructor, so provide its timing reader. */
function attachGenerationTimingStub(element: ImageElement): void {
	Object.assign(element, {
		pollingManager: { getGenerationTiming: () => undefined },
	})
}

function contentImage(
	contents: ImageElementContent[],
	activeContentId = contents[0]?.contentId ?? null,
	mainContentId = contents[0]?.contentId ?? null,
): ImageElementData {
	return {
		id: "image-1",
		type: ElementTypeEnum.Image,
		activeContentId,
		mainContentId,
		contents,
	}
}

describe("ImageElement generation timing", () => {
	afterEach(() => {
		vi.useRealTimers()
	})

	it("persists the backend start and expected finish times on the request", () => {
		const element = Object.create(ImageElement.prototype) as ImageElement & {
			applyGenerationTiming: (
				request: GenerateImageRequest,
				response?: { started_at?: string; expected_finished_at?: string },
			) => void
		}
		const request: GenerateImageRequest = { prompt: "a test image" }

		element.applyGenerationTiming(request, {
			started_at: "2026-10-05T10:00:00+08:00",
			expected_finished_at: "2026-10-05T10:01:30+08:00",
		})

		expect(request).toMatchObject({
			start_time: "2026-10-05T10:00:00+08:00",
			expected_finished_at: "2026-10-05T10:01:30+08:00",
		})
	})

	it("stops the progress timer when visibility culling destroys the render node", () => {
		vi.useFakeTimers()
		const node = new Konva.Group()
		const element = Object.create(ImageElement.prototype) as ImageElement
		Object.assign(element, {
			node,
			renderToken: 0,
			generationProgressTimer: setInterval(vi.fn(), 1000),
		})

		element.destroyRenderNodeForVisibilityCull()

		expect(vi.getTimerCount()).toBe(0)
		expect((element as unknown as { node: Konva.Group | null }).node).toBeNull()
	})
})

type ContentApiTestImageElement = {
	data: ImageElementData
	canvas: Canvas
	getActiveContentData: ImageElement["getActiveContentData"]
	getMainContentData: ImageElement["getMainContentData"]
	getContentData: ImageElement["getContentData"]
	updateActiveContentData: ImageElement["updateActiveContentData"]
	updateContentData: ImageElement["updateContentData"]
}

type GenerationTestImageElement = {
	data: ImageElementData
	isGenerating: boolean
	isErrorState: boolean
	isRetryEditing: boolean
	canvas: Canvas
	pollingManager: { start: ReturnType<typeof vi.fn> }
	rerender?: ReturnType<typeof vi.fn>
	rerenderWhenTransformIdle?: ReturnType<typeof vi.fn>
	updateImageElementNames?: ReturnType<typeof vi.fn>
	createOssSrcPromise?: ReturnType<typeof vi.fn>
	submitContentGeneration: ImageElement["submitContentGeneration"]
	getContentData: ImageElement["getContentData"]
}

describe("ImageElement mounted image node sync", () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("updates the mounted Konva image source without recreating the group", () => {
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
			clearRect: vi.fn(),
			fillRect: vi.fn(),
			getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([0, 0, 0, 0]) })),
		} as unknown as CanvasRenderingContext2D)

		const oldImage = new Image()
		const newImage = new Image()
		const imageNode = new Konva.Image({
			image: oldImage,
			name: "image-content",
			width: 100,
			height: 100,
		})
		const group = new Konva.Group()
		group.add(imageNode)

		const element = Object.create(ImageElement.prototype) as ImageElement & {
			node: Konva.Group
			loadedImage: HTMLImageElement
			data: { id: string; width: number; height: number }
			canvas: { cropManager: { getCroppingElementId: () => string | null } }
			getSourceCrop: () => { x: number; y: number; width: number; height: number }
			patchMountedImageContentNodeWithLoadedResource: () => { type: string }
		}
		element.node = group
		element.loadedImage = newImage
		element.data = { id: "image-1", width: 200, height: 120 }
		element.canvas = {
			cropManager: {
				getCroppingElementId: () => null,
			},
		}
		element.getSourceCrop = vi.fn(() => ({ x: 1, y: 2, width: 3, height: 4 }))

		const result = element.patchMountedImageContentNodeWithLoadedResource()

		expect(result).toEqual({ type: "patched-content" })
		expect(imageNode.image()).toBe(newImage)
		expect(imageNode.width()).toBe(200)
		expect(imageNode.height()).toBe(120)
		expect(imageNode.crop()).toEqual({ x: 1, y: 2, width: 3, height: 4 })
	})

	it("applies resource upgrades to the mounted image node without rerendering", () => {
		const oldImage = new Image()
		const fullImage = new Image()
		const imageNode = new Konva.Image({
			image: oldImage,
			name: "image-content",
			width: 100,
			height: 80,
		})
		const group = new Konva.Group({ width: 100, height: 80 })
		group.add(imageNode)

		const emit = vi.fn()
		const batchDraw = vi.fn()
		const rerenderWhenTransformIdle = vi.fn()
		const resource = {
			ossSrc: "https://example.test/full.png",
			image: fullImage,
			imageInfo: {
				naturalWidth: 100,
				naturalHeight: 80,
				fileSize: 10,
				mimeType: "image/png",
				filename: "full.png",
			},
			variant: "full" as const,
			sourceWidth: 100,
			sourceHeight: 80,
			isFullSize: true,
		}
		const element = Object.create(ImageElement.prototype) as ImageElement & {
			node: Konva.Group
			loadedImage: HTMLImageElement
			loadedImageVariant: "preview"
			data: {
				id: string
				type: typeof ElementTypeEnum.Image
				width: number
				height: number
				activeContentId: string
				mainContentId: string
				contents: ImageElementContent[]
			}
			canvas: {
				cropManager: { getCroppingElementId: () => string | null }
				eventEmitter: { emit: ReturnType<typeof vi.fn> }
			}
			getSourceCrop: () => { x: number; y: number; width: number; height: number }
			isErrorState: boolean
			isResourceLoading: boolean
			lastAppliedLoadFailureSignature: string | null
			rerenderWhenTransformIdle: ReturnType<typeof vi.fn>
			applyPresentedResource: (
				loadedResource: typeof resource,
				targetVariant: "full",
			) => boolean
		}
		element.node = group
		element.loadedImage = oldImage
		element.loadedImageVariant = "preview"
		element.data = {
			id: "image-1",
			type: ElementTypeEnum.Image,
			width: 100,
			height: 80,
			activeContentId: "image-1-content-1",
			mainContentId: "image-1-content-1",
			contents: [{ contentId: "image-1-content-1", src: "/image.png" }],
		}
		element.canvas = {
			cropManager: {
				getCroppingElementId: () => null,
			},
			eventEmitter: { emit },
		}
		element.getSourceCrop = vi.fn(() => ({ x: 0, y: 0, width: 100, height: 80 }))
		element.isErrorState = false
		element.isResourceLoading = true
		element.lastAppliedLoadFailureSignature = "/image.png:load-error"
		element.rerenderWhenTransformIdle = rerenderWhenTransformIdle
		vi.spyOn(imageNode, "getLayer").mockReturnValue({ batchDraw } as never)

		const previousAutoDrawEnabled = Konva.autoDrawEnabled
		let changed = false
		try {
			Konva.autoDrawEnabled = false
			changed = element.applyPresentedResource(resource, "full")
		} finally {
			Konva.autoDrawEnabled = previousAutoDrawEnabled
		}

		expect(changed).toBe(true)
		expect(imageNode.image()).toBe(fullImage)
		expect(element.loadedImage).toBe(fullImage)
		expect(element.isResourceLoading).toBe(false)
		expect(element.lastAppliedLoadFailureSignature).toBeNull()
		expect(emit).toHaveBeenCalledWith({
			type: "element:image:ossSrcReady",
			data: { elementId: "image-1" },
		})
		expect(rerenderWhenTransformIdle).not.toHaveBeenCalled()
		expect(batchDraw).not.toHaveBeenCalled()
	})

	it("rerenders when a loaded resource has no mounted image node to update", () => {
		const previewImage = new Image()
		const group = new Konva.Group({ width: 100, height: 80 })
		const emit = vi.fn()
		const rerenderWhenTransformIdle = vi.fn()
		const resource = {
			ossSrc: "https://example.test/preview.png",
			image: previewImage,
			imageInfo: {
				naturalWidth: 100,
				naturalHeight: 80,
				fileSize: 10,
				mimeType: "image/png",
				filename: "preview.png",
			},
			variant: "preview" as const,
			sourceWidth: 100,
			sourceHeight: 80,
			isFullSize: false,
		}
		const element = Object.create(ImageElement.prototype) as ImageElement & {
			node: Konva.Group
			loadedImage?: HTMLImageElement
			data: {
				id: string
				type: typeof ElementTypeEnum.Image
				width: number
				height: number
				activeContentId: string
				mainContentId: string
				contents: ImageElementContent[]
			}
			canvas: {
				cropManager: { getCroppingElementId: () => string | null }
				eventEmitter: { emit: ReturnType<typeof vi.fn> }
			}
			isErrorState: boolean
			isResourceLoading: boolean
			lastAppliedLoadFailureSignature: string | null
			rerenderWhenTransformIdle: ReturnType<typeof vi.fn>
			applyPresentedResource: (
				loadedResource: typeof resource,
				targetVariant: "preview",
			) => boolean
		}
		element.node = group
		element.loadedImage = undefined
		element.data = {
			id: "image-1",
			type: ElementTypeEnum.Image,
			width: 100,
			height: 80,
			activeContentId: "image-1-content-1",
			mainContentId: "image-1-content-1",
			contents: [{ contentId: "image-1-content-1", src: "/image.png" }],
		}
		element.canvas = {
			cropManager: {
				getCroppingElementId: () => null,
			},
			eventEmitter: { emit },
		}
		element.isErrorState = false
		element.isResourceLoading = true
		element.lastAppliedLoadFailureSignature = null
		element.rerenderWhenTransformIdle = rerenderWhenTransformIdle

		const changed = element.applyPresentedResource(resource, "preview")

		expect(changed).toBe(true)
		expect(element.loadedImage).toBe(previewImage)
		expect(rerenderWhenTransformIdle).toHaveBeenCalledTimes(1)
	})

	it("renders the loaded image even when oss metadata is temporarily absent", () => {
		const imageGroup = new Konva.Group()
		const loadingGroup = new Konva.Group()
		const element = Object.create(ImageElement.prototype) as ImageElement & {
			data: {
				id: string
				type: typeof ElementTypeEnum.Image
				width: number
				height: number
				activeContentId: string
				mainContentId: string
				contents: ImageElementContent[]
			}
			isErrorState: boolean
			storedOssSrc: string | null
			storedImageInfo: undefined
			loadedImage: HTMLImageElement
			getImageGenerationTaskMeta: () => undefined
			renderImage: ReturnType<typeof vi.fn>
			renderLoadingPlaceholder: ReturnType<typeof vi.fn>
		}
		attachGenerationTimingStub(element)
		element.data = {
			id: "image-1",
			type: ElementTypeEnum.Image,
			width: 100,
			height: 80,
			activeContentId: "image-1-content-1",
			mainContentId: "image-1-content-1",
			contents: [{ contentId: "image-1-content-1", src: "/image.png" }],
		}
		element.isErrorState = false
		element.storedOssSrc = null
		element.storedImageInfo = undefined
		element.loadedImage = new Image()
		element.getImageGenerationTaskMeta = vi.fn(() => undefined)
		element.renderImage = vi.fn(() => imageGroup)
		element.renderLoadingPlaceholder = vi.fn(() => loadingGroup)

		expect(element.render()).toBe(imageGroup)
		expect(element.renderImage).toHaveBeenCalledTimes(1)
		expect(element.renderLoadingPlaceholder).not.toHaveBeenCalled()
	})

	it("labels temporary pasted image placeholders with existing info as uploading", () => {
		const element = Object.create(ImageElement.prototype) as ImageElement & {
			data: {
				id: string
				name: string
				type: typeof ElementTypeEnum.Image
				activeContentId: string
				mainContentId: string
				contents: ImageElementContent[]
			}
			canvas: { t: undefined; elementManager: { isTemporary: ReturnType<typeof vi.fn> } }
			isGenerating: boolean
			isErrorState: boolean
		}
		attachGenerationTimingStub(element)
		element.data = {
			id: "pasted-image",
			name: "Pasted image",
			type: ElementTypeEnum.Image,
			activeContentId: "pasted-image-content-1",
			mainContentId: "pasted-image-content-1",
			contents: [
				{
					contentId: "pasted-image-content-1",
					status: GenerationStatus.Processing,
					generateImageRequest: {
						model_id: "image-model",
						prompt: "a friendly creature",
					},
				},
			],
		}
		element.canvas = {
			t: undefined,
			elementManager: {
				isTemporary: vi.fn(() => true),
			},
		}
		element.isGenerating = false
		element.isErrorState = false

		expect(element.getNameLabelText()).toBe("Pasted image(上传中)")
	})

	it("labels persisted pending image generations as generating", () => {
		const element = Object.create(ImageElement.prototype) as ImageElement & {
			data: {
				id: string
				name: string
				type: typeof ElementTypeEnum.Image
				activeContentId: string
				mainContentId: string
				contents: ImageElementContent[]
			}
			canvas: { t: undefined; elementManager: { isTemporary: ReturnType<typeof vi.fn> } }
			isGenerating: boolean
			isErrorState: boolean
		}
		attachGenerationTimingStub(element)
		element.data = {
			id: "agent-image",
			name: "Agent image",
			type: ElementTypeEnum.Image,
			activeContentId: "agent-image-content-1",
			mainContentId: "agent-image-content-1",
			contents: [
				{
					contentId: "agent-image-content-1",
					status: GenerationStatus.Pending,
				},
			],
		}
		element.canvas = {
			t: undefined,
			elementManager: {
				isTemporary: vi.fn(() => false),
			},
		}
		element.isGenerating = false
		element.isErrorState = false

		expect(element.getNameLabelText()).toBe("Agent image(生成中)")
	})

	it("keeps the base image name while its display resource is loading", () => {
		const element = Object.create(ImageElement.prototype) as ImageElement & {
			data: { name: string }
			getDisplayState: ReturnType<typeof vi.fn>
		}
		element.data = { name: "Loaded thumbnail" }
		element.getDisplayState = vi.fn(() => ({
			status: "loading",
			surface: "loading",
			contentId: "image-content-1",
		}))

		expect(element.getNameLabelText()).toBe("Loaded thumbnail")
		expect(element.getDisplayState()).toMatchObject({ status: "loading", surface: "loading" })
	})

	it("keeps the base video name while its preview resource is loading", () => {
		const element = Object.create(VideoElement.prototype) as VideoElement & {
			data: { name: string }
			getDisplayState: ReturnType<typeof vi.fn>
		}
		element.data = { name: "Loaded poster" }
		element.getDisplayState = vi.fn(() => ({
			status: "loading",
			surface: "loading",
			contentId: "video-content-1",
		}))

		expect(element.getNameLabelText()).toBe("Loaded poster")
		expect(element.getDisplayState()).toMatchObject({ status: "loading", surface: "loading" })
	})

	it("appends the compliance suffix while a media element is being checked", () => {
		const image = Object.create(ImageElement.prototype) as ImageElement & {
			data: { name: string }
			canvas: { t: undefined }
			getDisplayState: ReturnType<typeof vi.fn>
			getActiveContentData: ReturnType<typeof vi.fn>
		}
		image.data = { name: "Checked image" }
		image.canvas = { t: undefined }
		image.getDisplayState = vi.fn(() => ({
			status: "completed",
			surface: "image",
			contentId: "image-content-1",
		}))
		image.getActiveContentData = vi.fn(() => ({
			contentId: "image-content-1",
			complianceStatus: "PROCESSING",
		}))

		expect(image.getNameLabelText()).toBe("Checked image(校验中)")
		expect(image.getNameLabelContent()).toEqual({
			primaryText: "Checked image",
			suffix: { text: "(校验中)" },
		})
	})

	it("treats pasted video placeholders with existing info as uploading", () => {
		const element = Object.create(VideoElement.prototype) as VideoElement & {
			data: {
				id: string
				type: typeof ElementTypeEnum.Video
				activeContentId: string
				mainContentId: string
				contents: ImageElementContent[]
			}
			canvas: {
				t: undefined
				elementManager: { isTemporary: ReturnType<typeof vi.fn> }
			}
			isGenerating: boolean
			resolveRenderState: () => { stage: string; text?: string }
		}
		element.data = {
			id: "pasted-video",
			type: ElementTypeEnum.Video,
			activeContentId: "pasted-video-content-1",
			mainContentId: "pasted-video-content-1",
			contents: [
				{
					contentId: "pasted-video-content-1",
					status: GenerationStatus.Processing,
					generateVideoRequest: {
						model_id: "video-model",
						prompt: "a cinematic clip",
					},
				},
			],
		}
		element.canvas = {
			t: undefined,
			elementManager: {
				isTemporary: vi.fn(() => true),
			},
		}
		element.isGenerating = false

		expect(element.resolveRenderState()).toEqual({
			stage: "uploading",
			placeholderMode: "loading",
			text: "正在上传中...",
		})
	})

	it("renders a localized image generation failure when the completed path is unresolved", () => {
		const renderedError = new Konva.Group()
		const element = Object.create(ImageElement.prototype) as ImageElement & {
			data: {
				id: string
				type: typeof ElementTypeEnum.Image
				activeContentId: string
				mainContentId: string
				contents: ImageElementContent[]
			}
			canvas: { t: (key: string, fallback: string) => string }
			isGenerating: boolean
			getActiveGenerateImageRequest: () => undefined
			getActiveImageGenerationTaskMeta: () => undefined
			renderError: ReturnType<typeof vi.fn>
		}
		attachGenerationTimingStub(element)
		element.data = {
			id: "failed-image",
			type: ElementTypeEnum.Image,
			activeContentId: "failed-image-content-1",
			mainContentId: "failed-image-content-1",
			contents: [
				{
					contentId: "failed-image-content-1",
					status: GenerationStatus.Failed,
					errorMessage: INVALID_GENERATED_RESOURCE_PATH_ERROR,
				},
			],
		}
		element.canvas = {
			t: (key, fallback) => (key === "image.generateFailed" ? "本地化图片失败" : fallback),
		}
		element.isGenerating = false
		element.getActiveGenerateImageRequest = () => undefined
		element.getActiveImageGenerationTaskMeta = () => undefined
		element.renderError = vi.fn(() => renderedError)

		expect(element.render()).toBe(renderedError)
		expect(element.renderError).toHaveBeenCalledWith("本地化图片失败")
	})

	it("ignores a stale placeholder background completion after the group is replaced", async () => {
		const background = createDeferredValue<HTMLImageElement>()
		const createBackgroundImage = vi
			.spyOn(RenderUtils, "createBackgroundImage")
			.mockReturnValue(new Konva.Image())
		const createCenteredIconText = vi.spyOn(RenderUtils, "createCenteredIconText")
		const registerViewportScaleLayout = vi.fn(() => vi.fn())
		const element = Object.create(ImageElement.prototype) as ImageElement
		const canvas = {
			t: undefined,
			runtimeScheduler: { registerViewportScaleLayout },
		}
		Object.assign(element, {
			data: { id: "stale-image", width: 100, height: 80 },
			canvas,
			imageLoader: { loadImage: vi.fn(() => background.promise) },
			renderToken: 0,
			node: null,
			getText: vi.fn((_key: string, fallback: string) => fallback),
			createBorder: vi.fn(),
			createCornerActions: vi.fn(),
			createMainVersionTag: vi.fn(),
			finalizeNode: (node: Konva.Group) => Object.assign(element, { node }),
		})

		const renderPlaceholder = (
			element as unknown as { renderEmptyPlaceholder: () => Konva.Group }
		).renderEmptyPlaceholder.bind(element)
		const oldGroup = renderPlaceholder()
		expect(registerViewportScaleLayout).toHaveBeenCalledTimes(1)
		Object.assign(element, { renderToken: 1, node: new Konva.Group() })

		background.resolve(new Image())
		await Promise.resolve()
		await Promise.resolve()

		expect(createBackgroundImage).not.toHaveBeenCalled()
		expect(createCenteredIconText).not.toHaveBeenCalled()
		expect(registerViewportScaleLayout).toHaveBeenCalledTimes(1)

		oldGroup.destroy()
		;(element as unknown as { node: Konva.Group }).node.destroy()
	})

	it("does not register an additional scale listener when stale placeholder content resolves", async () => {
		const content = createDeferredValue<Konva.Group>()
		const createCenteredIconText = vi
			.spyOn(RenderUtils, "createCenteredIconText")
			.mockReturnValue(content.promise)
		vi.spyOn(RenderUtils, "createBackgroundImage").mockReturnValue(new Konva.Image())
		const registerViewportScaleLayout = vi.fn(() => vi.fn())
		const element = Object.create(ImageElement.prototype) as ImageElement
		const canvas = {
			t: undefined,
			runtimeScheduler: { registerViewportScaleLayout },
		}
		Object.assign(element, {
			data: { id: "stale-image", width: 100, height: 80 },
			canvas,
			imageLoader: { loadImage: vi.fn(() => Promise.resolve(new Image())) },
			renderToken: 0,
			node: null,
			getText: vi.fn((_key: string, fallback: string) => fallback),
			createBorder: vi.fn(),
			createCornerActions: vi.fn(),
			createMainVersionTag: vi.fn(),
			finalizeNode: (node: Konva.Group) => Object.assign(element, { node }),
		})

		const renderPlaceholder = (
			element as unknown as { renderEmptyPlaceholder: () => Konva.Group }
		).renderEmptyPlaceholder.bind(element)
		const oldGroup = renderPlaceholder()
		await Promise.resolve()
		await Promise.resolve()
		expect(createCenteredIconText).toHaveBeenCalledTimes(1)
		expect(registerViewportScaleLayout).toHaveBeenCalledTimes(1)

		const replacementGroup = new Konva.Group()
		Object.assign(element, { renderToken: 1, node: replacementGroup })
		const staleContentGroup = new Konva.Group()
		const destroyStaleContentGroup = vi.spyOn(staleContentGroup, "destroy")
		content.resolve(staleContentGroup)
		await Promise.resolve()
		await Promise.resolve()

		expect(registerViewportScaleLayout).toHaveBeenCalledTimes(1)
		expect(destroyStaleContentGroup).toHaveBeenCalledTimes(1)

		oldGroup.destroy()
		replacementGroup.destroy()
	})

	it("runs content and animated border layout from one viewport callback", () => {
		const registerViewportScaleLayout = vi.fn(() => vi.fn())
		const updateContentScale = vi.fn()
		const updateViewportScaleLayout = vi.fn()
		const element = Object.create(ImageElement.prototype) as ImageElement & {
			data: { id: string; width: number; height: number }
			canvas: {
				runtimeScheduler: {
					registerViewportScaleLayout: typeof registerViewportScaleLayout
				}
			}
			borderDecorator: { updateViewportScaleLayout: typeof updateViewportScaleLayout }
			updateContentScale: typeof updateContentScale
			setupContentUpdateListener: (group: Konva.Group) => void
		}
		const group = new Konva.Group()
		Object.assign(element, {
			data: { id: "image-layout", width: 100, height: 80 },
			canvas: { runtimeScheduler: { registerViewportScaleLayout } },
			borderDecorator: { updateViewportScaleLayout },
			updateContentScale,
		})

		element.setupContentUpdateListener(group)
		const viewportCallback = registerViewportScaleLayout.mock.calls[0]?.[1]
		viewportCallback?.()

		expect(registerViewportScaleLayout).toHaveBeenCalledTimes(1)
		expect(updateContentScale).toHaveBeenCalledTimes(1)
		expect(updateViewportScaleLayout).toHaveBeenCalledTimes(1)

		group.fire("transform")
		expect(updateContentScale).toHaveBeenCalledTimes(2)
		expect(updateViewportScaleLayout).toHaveBeenCalledTimes(2)
		group.destroy()
	})

	it("renders a localized video generation failure when the completed path is unresolved", () => {
		const element = Object.create(VideoElement.prototype) as VideoElement & {
			data: {
				id: string
				type: typeof ElementTypeEnum.Video
				activeContentId: string
				mainContentId: string
				contents: ImageElementContent[]
			}
			canvas: { t: (key: string, fallback: string) => string }
			isRetryEditing: boolean
			resolveRenderState: () => { stage: string; placeholderMode?: string; text?: string }
		}
		element.data = {
			id: "failed-video",
			type: ElementTypeEnum.Video,
			activeContentId: "failed-video-content-1",
			mainContentId: "failed-video-content-1",
			contents: [
				{
					contentId: "failed-video-content-1",
					status: GenerationStatus.Failed,
					errorMessage: INVALID_GENERATED_RESOURCE_PATH_ERROR,
				},
			],
		}
		element.canvas = {
			t: (key, fallback) => (key === "video.generateFailed" ? "本地化视频失败" : fallback),
		}
		element.isRetryEditing = false

		expect(element.resolveRenderState()).toEqual({
			stage: "error",
			placeholderMode: "error",
			text: "本地化视频失败",
		})
	})

	it("clears video generating state when terminal generation data arrives", () => {
		const element = Object.create(VideoElement.prototype) as VideoElement & {
			data: {
				id: string
				type: typeof ElementTypeEnum.Video
				width: number
				height: number
				activeContentId: string
				mainContentId: string
				contents: Array<{
					contentId: string
					src?: string
					status?: GenerationStatus
					generateVideoRequest?: { video_id: string }
					errorMessage?: string
				}>
			}
			isGenerating: boolean
			cancelScheduledPreviewRefresh: ReturnType<typeof vi.fn>
			releasePlaybackConsumers: ReturnType<typeof vi.fn>
			renderer: { resetPreview: ReturnType<typeof vi.fn> }
			canvas: {
				visibilityManager: {
					updateVideoElement: ReturnType<typeof vi.fn>
					unregisterVideoElement: ReturnType<typeof vi.fn>
				}
			}
		}
		element.data = {
			id: "video-1",
			type: ElementTypeEnum.Video,
			width: 100,
			height: 100,
			activeContentId: "video-1-content-1",
			mainContentId: "video-1-content-1",
			contents: [
				{
					contentId: "video-1-content-1",
					status: GenerationStatus.Processing,
					generateVideoRequest: { video_id: "task-1" },
				},
			],
		}
		element.isGenerating = true
		element.cancelScheduledPreviewRefresh = vi.fn()
		element.releasePlaybackConsumers = vi.fn()
		element.renderer = { resetPreview: vi.fn() }
		element.canvas = {
			visibilityManager: {
				updateVideoElement: vi.fn(),
				unregisterVideoElement: vi.fn(),
			},
		}

		const shouldRerender = element.update({
			...element.data,
			contents: [
				{
					...element.data.contents[0],
					src: "videos/result.mp4",
					status: GenerationStatus.Completed,
				},
			],
		})

		expect(element.isGenerating).toBe(false)
		expect(element.canvas.visibilityManager.updateVideoElement).toHaveBeenCalledWith(
			"video-1",
			"videos/result.mp4",
		)
		expect(shouldRerender).toBe(true)
	})

	it("rerenders video Content controls when active, main, or version count changes", () => {
		const createElement = () => {
			const element = Object.create(VideoElement.prototype) as VideoElement & {
				data: VideoElementData
				isGenerating: boolean
			}
			element.data = {
				id: "video-versions",
				type: ElementTypeEnum.Video,
				width: 100,
				height: 100,
				activeContentId: "v1",
				mainContentId: "v1",
				contents: [
					{
						contentId: "v1",
						src: "./videos/shared.mp4",
						status: GenerationStatus.Completed,
					},
					{
						contentId: "v2",
						src: "./videos/shared.mp4",
						status: GenerationStatus.Completed,
					},
				],
			}
			element.isGenerating = false
			return element
		}

		const activeChanged = createElement()
		expect(activeChanged.update({ ...activeChanged.data, activeContentId: "v2" })).toBe(true)

		const mainChanged = createElement()
		expect(mainChanged.update({ ...mainChanged.data, mainContentId: "v2" })).toBe(true)

		const contentsChanged = createElement()
		expect(
			contentsChanged.update({
				...contentsChanged.data,
				contents: [
					...contentsChanged.data.contents,
					{
						contentId: "v3",
						src: "./videos/third.mp4",
						status: GenerationStatus.Completed,
					},
				],
			}),
		).toBe(true)
	})

	it("resizes mounted image layout during node-only transform resize", () => {
		const imageNode = new Konva.Image({
			image: new Image(),
			name: "image-content",
			width: 100,
			height: 80,
		})
		const backgroundNode = new Konva.Image({
			image: new Image(),
			name: "background",
			width: 100,
			height: 80,
		})
		const hitRect = new Konva.Rect({
			name: "hit-area",
			width: 100,
			height: 80,
		})
		const group = new Konva.Group({ width: 100, height: 80 })
		group.add(imageNode)
		group.add(backgroundNode)
		group.add(hitRect)

		const borderDecorator = { updateSize: vi.fn() }
		const cornerActionsDecorator = { updateConfig: vi.fn() }
		const element = Object.create(ImageElement.prototype) as ImageElement & {
			node: Konva.Group
			borderDecorator: typeof borderDecorator
			cornerActionsDecorator: typeof cornerActionsDecorator
			data: { id: string; width: number; height: number }
		}
		element.node = group
		element.borderDecorator = borderDecorator
		element.cornerActionsDecorator = cornerActionsDecorator
		element.data = { id: "image-1", width: 100, height: 80 }

		element.onTransformResize(240, 160)

		expect(imageNode.width()).toBe(240)
		expect(imageNode.height()).toBe(160)
		expect(backgroundNode.width()).toBe(240)
		expect(backgroundNode.height()).toBe(160)
		expect(hitRect.width()).toBe(240)
		expect(hitRect.height()).toBe(160)
		expect(borderDecorator.updateSize).toHaveBeenCalledWith(240, 160)
		expect(cornerActionsDecorator.updateConfig).toHaveBeenCalledWith({
			width: 240,
			height: 160,
		})
	})

	it("resizes named placeholder background images without relying on backgroundNode", () => {
		const backgroundImage = new Image()
		backgroundImage.width = 400
		backgroundImage.height = 200
		const group = new Konva.Group({ width: 100, height: 100 })
		const backgroundNode = RenderUtils.createBackgroundImage(group, 100, 100, backgroundImage)
		const hitRect = new Konva.Rect({
			name: "hit-area",
			width: 100,
			height: 100,
		})
		group.add(hitRect)

		const element = Object.create(ImageElement.prototype) as ImageElement & {
			node: Konva.Group
			borderDecorator: undefined
			cornerActionsDecorator: undefined
		}
		element.node = group
		element.borderDecorator = undefined
		element.cornerActionsDecorator = undefined

		expect(backgroundNode.crop()).toEqual({ x: 100, y: 0, width: 200, height: 200 })

		element.onTransformResize(240, 60)

		expect(backgroundNode.width()).toBe(240)
		expect(backgroundNode.height()).toBe(60)
		expect(backgroundNode.crop()).toEqual({ x: 0, y: 50, width: 400, height: 100 })
	})

	it("resizes named video placeholder background images", () => {
		const backgroundImage = new Image()
		backgroundImage.width = 400
		backgroundImage.height = 200
		const group = new Konva.Group({ width: 100, height: 100 })
		const backgroundNode = RenderUtils.createBackgroundImage(group, 100, 100, backgroundImage)
		const hitRect = new Konva.Rect({
			name: "hit-area",
			width: 100,
			height: 100,
		})
		group.add(hitRect)

		const element = Object.create(VideoElement.prototype) as VideoElement & {
			node: Konva.Group
			borderDecorator: undefined
			cornerActionsDecorator: undefined
		}
		element.node = group
		element.borderDecorator = undefined
		element.cornerActionsDecorator = undefined
		;(
			element as unknown as {
				renderer: {
					updatePlaceholderContentLayout: ReturnType<typeof vi.fn>
					updatePlayerLayout: ReturnType<typeof vi.fn>
				}
			}
		).renderer = {
			updatePlaceholderContentLayout: vi.fn(),
			updatePlayerLayout: vi.fn(),
		}

		element.onTransformResize(240, 60)

		expect(backgroundNode.width()).toBe(240)
		expect(backgroundNode.height()).toBe(60)
		expect(backgroundNode.crop()).toEqual({ x: 0, y: 50, width: 400, height: 100 })
	})

	it("switches mounted image away from a resource before it closes", () => {
		const closingImage = new Image()
		const fallbackImage = new Image()
		const imageNode = new Konva.Image({
			image: closingImage,
			name: "image-content",
			width: 100,
			height: 80,
		})
		const group = new Konva.Group({ width: 100, height: 80 })
		group.add(imageNode)

		const fallbackResource = {
			ossSrc: "oss://image",
			image: fallbackImage,
			imageInfo: {
				naturalWidth: 100,
				naturalHeight: 80,
				fileSize: 1,
				mimeType: "image/png",
				filename: "image.png",
			},
			variant: "preview" as const,
			sourceWidth: 100,
			sourceHeight: 80,
			isFullSize: false,
		}
		const rerenderWhenTransformIdle = vi.fn()
		const requestLayerDraw = vi.fn()
		const element = Object.create(ImageElement.prototype) as ImageElement & {
			node: Konva.Group
			loadedImage: HTMLImageElement
			loadedImageVariant: "preview"
			data: { id: string; src: string; width: number; height: number }
			canvas: {
				cropManager: { getCroppingElementId: () => string | null }
				imageResourceManager: {
					peekResource: ReturnType<typeof vi.fn>
				}
				runtimeScheduler: {
					requestLayerDraw: typeof requestLayerDraw
				}
			}
			getSourceCrop: () => { x: number; y: number; width: number; height: number }
			rerenderWhenTransformIdle: ReturnType<typeof vi.fn>
			handleImageSourceWillClose: (image: HTMLImageElement, variant: "preview") => void
		}
		element.node = group
		element.loadedImage = closingImage
		element.loadedImageVariant = "preview"
		element.data = {
			id: "image-1",
			type: "image",
			width: 100,
			height: 80,
			contents: [{ contentId: "content-1", src: "/image.png" }],
			activeContentId: "content-1",
			mainContentId: "content-1",
		} as never
		element.canvas = {
			cropManager: {
				getCroppingElementId: () => null,
			},
			imageResourceManager: {
				peekResource: vi.fn(() => fallbackResource),
			},
			runtimeScheduler: {
				requestLayerDraw,
			},
		}
		element.getSourceCrop = vi.fn(() => ({ x: 0, y: 0, width: 100, height: 80 }))
		element.rerenderWhenTransformIdle = rerenderWhenTransformIdle

		element.handleImageSourceWillClose(closingImage, "preview")

		expect(imageNode.image()).toBe(fallbackImage)
		expect(element.loadedImage).toBe(fallbackImage)
		expect(rerenderWhenTransformIdle).not.toHaveBeenCalled()
		expect(requestLayerDraw).toHaveBeenCalledWith("content", {
			source: "ImageElement",
			reason: "resource-will-close",
		})
	})

	it("removes mounted image node when a closing resource has no fallback", () => {
		const closingImage = new Image()
		const imageNode = new Konva.Image({
			image: closingImage,
			name: "image-content",
			width: 100,
			height: 80,
		})
		const group = new Konva.Group({ width: 100, height: 80 })
		group.add(imageNode)

		const rerenderWhenTransformIdle = vi.fn()
		const element = Object.create(ImageElement.prototype) as ImageElement & {
			node: Konva.Group
			loadedImage?: HTMLImageElement
			loadedImageVariant: "preview"
			data: { id: string; src: string; width: number; height: number }
			canvas: {
				imageResourceManager: {
					peekResource: ReturnType<typeof vi.fn>
				}
			}
			rerenderWhenTransformIdle: ReturnType<typeof vi.fn>
			handleImageSourceWillClose: (image: HTMLImageElement, variant: "preview") => void
		}
		element.node = group
		element.loadedImage = closingImage
		element.loadedImageVariant = "preview"
		element.data = { id: "image-1", src: "/image.png", width: 100, height: 80 }
		element.canvas = {
			imageResourceManager: {
				peekResource: vi.fn(() => null),
			},
		}
		element.rerenderWhenTransformIdle = rerenderWhenTransformIdle

		element.handleImageSourceWillClose(closingImage, "preview")

		expect(element.loadedImage).toBeUndefined()
		expect(imageNode.getParent()).toBeNull()
		expect(rerenderWhenTransformIdle).toHaveBeenCalledTimes(1)
	})

	it("clears stale not-found state when an uploaded oss src is applied", () => {
		const loadResource = vi.fn()
		const emit = vi.fn()
		const rerenderWhenTransformIdle = vi.fn()
		const element = Object.create(ImageElement.prototype) as ImageElement & {
			data: {
				id: string
				type: typeof ElementTypeEnum.Image
				activeContentId: string
				mainContentId: string
				contents: ImageElementContent[]
			}
			canvas: {
				imageResourceManager: {
					loadResource: ReturnType<typeof vi.fn>
				}
				eventEmitter: {
					emit: ReturnType<typeof vi.fn>
				}
			}
			storedOssSrc: string | null
			imageLoadFailureReason: "not-found" | null
			isErrorState: boolean
			isResourceLoading: boolean
			lastAppliedLoadFailureSignature: string | null
			rerenderWhenTransformIdle: ReturnType<typeof vi.fn>
		}
		element.data = {
			id: "image-1",
			type: ElementTypeEnum.Image,
			activeContentId: "image-1-content-1",
			mainContentId: "image-1-content-1",
			contents: [{ contentId: "image-1-content-1", src: "./images/image.png" }],
		}
		element.canvas = {
			imageResourceManager: { loadResource },
			eventEmitter: { emit },
		}
		element.storedOssSrc = null
		element.imageLoadFailureReason = "not-found"
		element.isErrorState = true
		element.isResourceLoading = false
		element.lastAppliedLoadFailureSignature = "./images/image.png:not-found"
		element.rerenderWhenTransformIdle = rerenderWhenTransformIdle

		element.setOssSrc("https://oss.example/image.png")

		expect(element.storedOssSrc).toBe("https://oss.example/image.png")
		expect(element.imageLoadFailureReason).toBeNull()
		expect(element.isErrorState).toBe(false)
		expect(element.isResourceLoading).toBe(true)
		expect(element.lastAppliedLoadFailureSignature).toBeNull()
		expect(loadResource).toHaveBeenCalledWith("./images/image.png", {
			variant: "preview",
			priority: "visible",
		})
		expect(emit).toHaveBeenCalledWith({
			type: "element:image:ossSrcReady",
			data: { elementId: "image-1" },
		})
		expect(rerenderWhenTransformIdle).toHaveBeenCalled()
	})

	it("subscribes to recovery, load failures, and decoded surface close events", () => {
		const cleanup = vi.fn()
		const onImageResourceWillClose = vi.fn(() => cleanup)
		const onImageResourceLoadFailed = vi.fn(() => cleanup)
		let recoveryStartedHandler:
			((event: { data: { path: string; ossSrc: string } }) => void) | undefined
		const onImageResourceRecoveryStarted = vi.fn(
			(_path: string, handler: typeof recoveryStartedHandler) => {
				recoveryStartedHandler = handler
				return cleanup
			},
		)
		const setOssSrc = vi.fn()
		const element = Object.create(ImageElement.prototype) as {
			data: {
				id: string
				type: typeof ElementTypeEnum.Image
				activeContentId: string
				mainContentId: string
				contents: ImageElementContent[]
			}
			canvas: {
				magicConfigManager: { config: { methods: Record<string, never> } }
				elementManager: { isTemporary: () => boolean }
				imageResourceManager: {
					onImageResourceWillClose: typeof onImageResourceWillClose
					onImageResourceLoadFailed: typeof onImageResourceLoadFailed
					onImageResourceRecoveryStarted: typeof onImageResourceRecoveryStarted
				}
			}
			resourceSubscriptionCleanups: Array<() => void>
			setOssSrc: typeof setOssSrc
			removeResourceLoadedListener: () => void
			setupResourceLoadedListener: () => void
		}
		element.data = {
			id: "image-1",
			type: ElementTypeEnum.Image,
			activeContentId: "image-1-content-1",
			mainContentId: "image-1-content-1",
			contents: [{ contentId: "image-1-content-1", src: "./images/a.png" }],
		}
		element.canvas = {
			magicConfigManager: { config: { methods: {} } },
			elementManager: { isTemporary: () => false },
			imageResourceManager: {
				onImageResourceWillClose,
				onImageResourceLoadFailed,
				onImageResourceRecoveryStarted,
			},
		}
		element.resourceSubscriptionCleanups = []
		element.setOssSrc = setOssSrc

		element.setupResourceLoadedListener()

		expect(onImageResourceWillClose).toHaveBeenCalledWith(
			"./images/a.png",
			expect.any(Function),
		)
		expect(onImageResourceLoadFailed).toHaveBeenCalledWith(
			"./images/a.png",
			expect.any(Function),
		)
		expect(onImageResourceRecoveryStarted).toHaveBeenCalledWith(
			"./images/a.png",
			expect.any(Function),
		)
		expect(element.resourceSubscriptionCleanups).toHaveLength(3)

		recoveryStartedHandler?.({
			data: {
				path: "./images/a.png",
				ossSrc: "https://oss.example/a.png",
			},
		})
		expect(setOssSrc).toHaveBeenCalledWith("https://oss.example/a.png")
	})

	it("rebinds identity-scoped resource listeners when the host resolver changes", () => {
		const setupResourceLoadedListener = vi.fn()
		const element = Object.create(ImageElement.prototype) as ImageElement & {
			setupResourceLoadedListener: typeof setupResourceLoadedListener
		}
		element.setupResourceLoadedListener = setupResourceLoadedListener

		element.onResourceReferenceResolverChanged()

		expect(setupResourceLoadedListener).toHaveBeenCalledTimes(1)
	})

	it("rerenders image Content controls when Contents are appended or main changes", () => {
		const base = contentImage([
			{ contentId: "v1", src: "./images/v1.png", status: GenerationStatus.Completed },
		])
		const element = Object.create(ImageElement.prototype) as ImageElement & {
			data: ImageElementData
			isGenerating: boolean
		}
		element.data = base
		element.isGenerating = false

		expect(
			element.update({
				...base,
				contents: [
					...base.contents,
					{ contentId: "v2", status: GenerationStatus.Processing },
				],
			}),
		).toBe(true)

		const withTwoVersions = element.data
		expect(
			element.update({
				...withTwoVersions,
				mainContentId: "v2",
			}),
		).toBe(true)
	})

	it("exposes the main Content through the associated-media semantic entry", () => {
		const data = contentImage(
			[
				{ contentId: "v1", src: "./images/v1.png", status: GenerationStatus.Completed },
				{ contentId: "v2", src: "./images/v2.png", status: GenerationStatus.Completed },
			],
			"v2",
			"v1",
		)
		const element = Object.create(ImageElement.prototype) as ImageElement & {
			data: ImageElementData
		}
		element.data = data

		expect(element.getAssociatedContentData()).toMatchObject({
			contentId: "v1",
			src: "./images/v1.png",
		})
	})

	it("exposes an image Content as its associated-media entry", () => {
		const data = contentImage([
			{ contentId: "v1", src: "./images/v1.png", status: GenerationStatus.Completed },
		])
		const element = Object.create(ImageElement.prototype) as ImageElement & {
			data: ImageElementData
		}
		element.data = data

		expect(element.getAssociatedContentData()).toMatchObject({
			src: "./images/v1.png",
			status: GenerationStatus.Completed,
		})
	})

	it("resolves and writes Contents through explicit instance methods", () => {
		const data = contentImage(
			[
				{ contentId: "v1", src: "./images/v1.png", status: GenerationStatus.Completed },
				{ contentId: "v2", src: "./images/v2.png", status: GenerationStatus.Completed },
			],
			"v2",
			"v1",
		)
		const element = Object.create(ImageElement.prototype) as ContentApiTestImageElement
		element.data = data
		element.canvas = {
			elementManager: {
				update: vi.fn((_id: string, patch: ElementUpdatePatch) => {
					element.data = { ...element.data, ...patch }
				}),
			},
		} as unknown as Canvas

		expect(element.getActiveContentData().contentId).toBe("v2")
		expect(element.getMainContentData().contentId).toBe("v1")
		expect(element.getContentData("v1")?.src).toBe("./images/v1.png")
		expect(element.getContentData("missing")).toBeUndefined()
		expect(element.updateActiveContentData({ status: GenerationStatus.Failed })).toBe(true)
		expect(element.getActiveContentData().status).toBe(GenerationStatus.Failed)
		expect(element.updateContentData("v1", { src: "./images/v1-new.png" })).toBe(true)
		expect(element.getContentData("v1")?.src).toBe("./images/v1-new.png")
		expect(element.updateContentData("missing", { src: "./images/missing.png" })).toBe(false)
		expect(element.canvas.elementManager.update).toHaveBeenCalledTimes(2)
	})

	it("updates a single Content through the same active API", () => {
		const data = contentImage([
			{ contentId: "v1", src: "./images/v1.png", status: GenerationStatus.Completed },
		])
		const element = Object.create(ImageElement.prototype) as ContentApiTestImageElement
		const update = vi.fn((_id: string, patch: ElementUpdatePatch) => {
			element.data = { ...element.data, ...patch }
		})
		element.data = data
		element.canvas = { elementManager: { update } } as unknown as Canvas

		expect(element.updateActiveContentData({ src: "./images/updated.png" })).toBe(true)
		expect(element.getActiveContentData().src).toBe("./images/updated.png")
		expect(element.updateContentData("v1", { src: "./images/noop.png" })).toBe(true)
	})

	it("exposes generation history and the latest Content through semantic methods", () => {
		const data = contentImage(
			[
				{ contentId: "v1", src: "./images/v1.png", status: GenerationStatus.Completed },
				{ contentId: "v2", status: GenerationStatus.Processing },
			],
			"v1",
			"v1",
		)
		const element = Object.create(ImageElement.prototype) as ImageElement & {
			data: ImageElementData
		}
		element.data = data

		expect(element.hasGenerationHistory()).toBe(true)
		expect(element.getLatestContentData()).toMatchObject({
			contentId: "v2",
			status: GenerationStatus.Processing,
		})
	})

	it("cleans markers when active changes through a document update", () => {
		const base = contentImage(
			[
				{ contentId: "v1", src: "./images/v1.png", status: GenerationStatus.Completed },
				{ contentId: "v2", src: "./images/v1.png", status: GenerationStatus.Completed },
			],
			"v1",
			"v1",
		)
		const handleImageContentChanged = vi.fn()
		const element = Object.create(ImageElement.prototype) as ImageElement & {
			data: ImageElementData
			isGenerating: boolean
			canvas: {
				markerManager: { handleImageContentChanged: typeof handleImageContentChanged }
			}
		}
		element.data = base
		element.isGenerating = false
		element.canvas = { markerManager: { handleImageContentChanged } }

		expect(element.update({ ...base, activeContentId: "v2" })).toBe(true)
		expect(handleImageContentChanged).toHaveBeenCalledWith("image-1", "v1", "v2")
	})

	it("exposes an image generation request while submission is pending", async () => {
		const deferred = createDeferred()
		const generateImage = vi.fn(() => deferred.promise)
		type TestImageData = {
			id: string
			type: typeof ElementTypeEnum.Image
			width: number
			height: number
			generateImageRequest?: GenerateImageRequest
		}
		const generationRuntimeManager = new GenerationRuntimeManager()
		const commitGenerationTargets = vi.fn(
			(targets: Array<{ persistedPatch: Partial<TestImageData> }>) => {
				element.data = { ...element.data, ...targets[0]?.persistedPatch }
			},
		)
		const element = Object.create(ImageElement.prototype) as ImageElement & {
			data: TestImageData
			isGenerating: boolean
			isErrorState: boolean
			isRetryEditing: boolean
			canvas: {
				magicConfigManager: { config: { methods: { generateImage: typeof generateImage } } }
				generationRuntimeManager: GenerationRuntimeManager
				generationAttemptCoordinator: GenerationAttemptCoordinator
				elementManager: {
					getElementData: () => TestImageData
					getTemporaryElementMetadata: () => null
					commitGenerationTargets: typeof commitGenerationTargets
				}
				eventEmitter: { emit: ReturnType<typeof vi.fn> }
			}
			pollingManager: { start: ReturnType<typeof vi.fn> }
			updateImageElementNames: ReturnType<typeof vi.fn>
			createOssSrcPromise: ReturnType<typeof vi.fn>
			rerender: ReturnType<typeof vi.fn>
		}
		element.data = {
			id: "image-1",
			type: ElementTypeEnum.Image,
			width: 100,
			height: 100,
		}
		element.isGenerating = false
		element.isErrorState = false
		element.isRetryEditing = false
		const canvas = {
			magicConfigManager: { config: { methods: { generateImage } } },
			generationRuntimeManager,
			elementManager: {
				getElementData: () => element.data,
				getTemporaryElementMetadata: () => null,
				commitGenerationTargets,
			},
			eventEmitter: { emit: vi.fn() },
		} as unknown as Canvas
		canvas.generationAttemptCoordinator = new GenerationAttemptCoordinator(canvas)
		element.canvas = canvas as typeof element.canvas
		element.pollingManager = { start: vi.fn() }
		element.updateImageElementNames = vi.fn()
		element.createOssSrcPromise = vi.fn()
		element.rerender = vi.fn()

		const resultPromise = element.submitInitialGeneration({
			model_id: "image-model",
			prompt: "A product photo",
		})
		await Promise.resolve()

		expect(element.data.generateImageRequest).toBeUndefined()
		expect(generationRuntimeManager.getTargetState("image-1")?.generateImageRequest).toEqual(
			expect.objectContaining({
				model_id: "image-model",
				prompt: "A product photo",
				image_id: expect.any(String),
			}),
		)
		expect(element.data).not.toHaveProperty("runtimeGenerateImageRequest")
		expect(element.rerender).toHaveBeenCalledTimes(1)

		deferred.resolve()
		await expect(resultPromise).resolves.toBe(true)
		expect(generationRuntimeManager.getTargetState("image-1")).toBeNull()
		expect(element.data.generateImageRequest).toEqual(
			expect.objectContaining({ image_id: expect.any(String) }),
		)
		expect(commitGenerationTargets).toHaveBeenCalledWith([
			expect.objectContaining({
				elementId: "image-1",
				persistedPatch: expect.objectContaining({
					generateImageRequest: element.data.generateImageRequest,
				}),
			}),
		])
	})

	it("appends a successful Content generation and activates the new Content", async () => {
		const generateImage = vi.fn().mockResolvedValue(undefined)
		const generationRuntimeManager = new GenerationRuntimeManager()
		const data = contentImage(
			[
				{ contentId: "v1", src: "./images/v1.png", status: GenerationStatus.Completed },
				{ contentId: "v2", src: "./images/v2.png", status: GenerationStatus.Completed },
			],
			"v2",
			"v1",
		)
		const commitGenerationTargets = vi.fn(
			(targets: Array<{ contentId?: string; persistedPatch: ElementUpdatePatch }>) => {
				element.data = { ...element.data, ...targets[0]?.persistedPatch }
			},
		)
		const element = Object.create(ImageElement.prototype) as GenerationTestImageElement
		element.data = data
		element.isGenerating = false
		element.isErrorState = false
		element.isRetryEditing = false
		const canvas = {
			magicConfigManager: { config: { methods: { generateImage } } },
			generationRuntimeManager,
			elementManager: {
				getElementData: () => element.data,
				getTemporaryElementMetadata: () => null,
				commitGenerationTargets,
			},
			eventEmitter: { emit: vi.fn() },
		} as unknown as Canvas
		canvas.generationAttemptCoordinator = new GenerationAttemptCoordinator(canvas)
		element.canvas = canvas
		element.pollingManager = { start: vi.fn() }
		element.updateImageElementNames = vi.fn()
		element.createOssSrcPromise = vi.fn()
		element.rerender = vi.fn()

		await expect(
			element.submitContentGeneration({ model_id: "image-model", prompt: "A product photo" }),
		).resolves.toBe(true)

		const target = commitGenerationTargets.mock.calls[0]?.[0]?.[0]
		expect(target).toMatchObject({ elementId: "image-1", contentId: expect.any(String) })
		expect(target?.contentId).not.toBe("v2")
		expect(target?.persistedPatch).toHaveProperty("contents")
		expect(element.data).not.toHaveProperty("generateImageRequest")
		if (!isImageElementContent(element.data)) throw new Error("Expected image Content data")
		expect(element.data.contents).toHaveLength(3)
		expect(element.getContentData(target?.contentId)?.generateImageRequest).toEqual(
			expect.objectContaining({ image_id: expect.any(String), prompt: "A product photo" }),
		)
		expect(element.data.mainContentId).toBe("v1")
		expect(element.data.activeContentId).toBe(target?.contentId)
	})

	it("persists a failed Content when a later submission fails", async () => {
		const generateImage = vi.fn().mockRejectedValue(new Error("submit failed"))
		const generationRuntimeManager = new GenerationRuntimeManager()
		const mediaEditRecoveryManager = new MediaEditRecoveryManager()
		const initialData = contentImage([
			{
				contentId: "v1",
				src: "./images/original.png",
				status: GenerationStatus.Completed,
			},
		])
		const element = Object.create(ImageElement.prototype) as GenerationTestImageElement
		element.data = { ...initialData }
		element.isGenerating = false
		element.isErrorState = false
		element.isRetryEditing = false

		const canvas = {
			magicConfigManager: { config: { methods: { generateImage } } },
			generationRuntimeManager,
			mediaEditRecoveryManager,
			elementManager: {
				getElementData: () => element.data,
				getTemporaryElementMetadata: () => null,
				commitGenerationTargets: vi.fn(
					(targets: Array<{ persistedPatch: ElementUpdatePatch }>) => {
						element.data = {
							...element.data,
							...targets[0]?.persistedPatch,
						} as ImageElementData
					},
				),
			},
			eventEmitter: { emit: vi.fn() },
		} as unknown as Canvas
		canvas.generationAttemptCoordinator = new GenerationAttemptCoordinator(canvas)
		element.canvas = canvas
		element.pollingManager = { start: vi.fn() }
		element.rerenderWhenTransformIdle = vi.fn()

		await expect(
			element.submitContentGeneration(
				{ model_id: "image-model", prompt: "new version" },
				{ recoveryIntent: "re-edit" },
			),
		).resolves.toBe(false)

		if (!isImageElementContent(element.data)) throw new Error("Expected image Content data")
		expect(element.data.contents).toHaveLength(2)
		expect(element.data.contents[1]).toEqual(
			expect.objectContaining({
				status: GenerationStatus.Failed,
				generateImageRequest: expect.objectContaining({ prompt: "new version" }),
			}),
		)
		expect(element.data.activeContentId).toBe(element.data.contents[0]?.contentId)
		expect(element.data.mainContentId).toBe(element.data.contents[0]?.contentId)
		expect(element.isGenerating).toBe(false)
		expect(generationRuntimeManager.getTargetState(element.data.id)).toBeNull()
		expect(canvas.eventEmitter.emit).toHaveBeenCalledWith({
			type: "element:image:generate-submit-failed",
			data: { elementId: element.data.id },
		})
		expect(
			mediaEditRecoveryManager.get(
				{
					elementId: element.data.id,
					contentId: "v1",
					intent: "re-edit",
				},
				buildMediaEditSourceFingerprint("v1", "./images/original.png"),
			)?.draft,
		).toEqual({
			request: expect.objectContaining({
				model_id: "image-model",
				prompt: "new version",
				image_id: expect.any(String),
			}),
		})
		expect(
			mediaEditRecoveryManager.get(
				{
					elementId: element.data.id,
					contentId: "v1",
					intent: "generate",
				},
				buildMediaEditSourceFingerprint("v1", "./images/original.png"),
			),
		).toBeNull()
	})

	it("clears the pending version attempt when the element disappears after submission", async () => {
		const deferred = createDeferred()
		const generateImage = vi.fn(() => deferred.promise)
		const generationRuntimeManager = new GenerationRuntimeManager()
		const element = Object.create(ImageElement.prototype) as GenerationTestImageElement
		element.data = {
			id: "image-1",
			type: ElementTypeEnum.Image,
			width: 100,
			height: 100,
			contents: [
				{
					contentId: "v1",
					src: "./images/original.png",
					status: GenerationStatus.Completed,
				},
			],
			activeContentId: "v1",
			mainContentId: "v1",
		}
		element.isGenerating = false
		element.isErrorState = false
		element.isRetryEditing = false
		let elementExists = true

		const canvas = {
			magicConfigManager: { config: { methods: { generateImage } } },
			generationRuntimeManager,
			elementManager: {
				getElementData: () => (elementExists ? element.data : undefined),
				getTemporaryElementMetadata: () => null,
				commitGenerationTargets: vi.fn(),
			},
			eventEmitter: { emit: vi.fn() },
		} as unknown as Canvas
		canvas.generationAttemptCoordinator = new GenerationAttemptCoordinator(canvas)
		element.canvas = canvas
		element.pollingManager = { start: vi.fn() }
		element.rerenderWhenTransformIdle = vi.fn()

		const resultPromise = element.submitContentGeneration({
			model_id: "image-model",
			prompt: "new version",
		})
		await Promise.resolve()
		elementExists = false
		deferred.resolve()

		await expect(resultPromise).resolves.toBe(false)
		expect(element.isGenerating).toBe(false)
		expect(generationRuntimeManager.getTargetState(element.data.id)).toBeNull()
		expect(canvas.elementManager.commitGenerationTargets).not.toHaveBeenCalled()
	})

	it("appends a new processing Content when retrying a failed Content", async () => {
		const generateImage = vi.fn().mockResolvedValue(undefined)
		const generationRuntimeManager = new GenerationRuntimeManager()
		const data = contentImage(
			[
				{
					contentId: "v1",
					src: "./images/original.png",
					status: GenerationStatus.Completed,
				},
				{
					contentId: "failed",
					status: GenerationStatus.Failed,
					generateImageRequest: {
						image_id: "old-task",
						model_id: "image-model",
						prompt: "old prompt",
					},
				},
			],
			"failed",
			"v1",
		)
		const commitGenerationTargets = vi.fn(
			(targets: Array<{ persistedPatch: ElementUpdatePatch }>) => {
				Object.assign(data, targets[0]?.persistedPatch)
			},
		)
		const element = Object.create(ImageElement.prototype) as GenerationTestImageElement
		element.data = data
		element.isGenerating = false
		element.isErrorState = false
		element.isRetryEditing = false
		const canvas = {
			magicConfigManager: { config: { methods: { generateImage } } },
			generationRuntimeManager,
			elementManager: {
				getElementData: () => data,
				getTemporaryElementMetadata: () => null,
				commitGenerationTargets,
			},
			eventEmitter: { emit: vi.fn() },
		} as unknown as Canvas
		canvas.generationAttemptCoordinator = new GenerationAttemptCoordinator(canvas)
		element.canvas = canvas
		element.pollingManager = { start: vi.fn() }
		element.rerenderWhenTransformIdle = vi.fn()

		await expect(
			element.submitContentGeneration({ model_id: "image-model", prompt: "retry prompt" }),
		).resolves.toBe(true)

		expect(data.contents).toHaveLength(3)
		expect(data.contents[1]).toEqual(
			expect.objectContaining({
				contentId: "failed",
				status: GenerationStatus.Failed,
			}),
		)
		expect(data.contents[2]).toEqual(
			expect.objectContaining({
				status: GenerationStatus.Processing,
				generateImageRequest: expect.objectContaining({ prompt: "retry prompt" }),
			}),
		)
		expect(data.activeContentId).toBe(data.contents[2]?.contentId)
		expect(data.mainContentId).toBe("v1")
	})

	it("keeps concurrent image Content generation attempts independent", async () => {
		const first = createDeferred()
		const second = createDeferred()
		const generateImage = vi
			.fn()
			.mockImplementationOnce(() => first.promise)
			.mockImplementationOnce(() => second.promise)
		const generationRuntimeManager = new GenerationRuntimeManager()
		const data = contentImage(
			[{ contentId: "v1", src: "./images/original.png", status: GenerationStatus.Completed }],
			"v1",
			"v1",
		)
		const element = Object.create(ImageElement.prototype) as GenerationTestImageElement
		element.data = data
		element.isGenerating = false
		element.isErrorState = false
		element.isRetryEditing = false
		const canvas = {
			magicConfigManager: { config: { methods: { generateImage } } },
			generationRuntimeManager,
			mediaEditRecoveryManager: new MediaEditRecoveryManager(),
			elementManager: {
				getElementData: () => element.data,
				getTemporaryElementMetadata: () => null,
				commitGenerationTargets: vi.fn(
					(targets: Array<{ persistedPatch: ElementUpdatePatch }>) => {
						element.data = { ...element.data, ...targets[0]?.persistedPatch }
					},
				),
			},
			eventEmitter: { emit: vi.fn() },
		} as unknown as Canvas
		canvas.generationAttemptCoordinator = new GenerationAttemptCoordinator(canvas)
		element.canvas = canvas
		element.pollingManager = { start: vi.fn() }
		element.rerenderWhenTransformIdle = vi.fn()

		const firstPromise = element.submitContentGeneration({
			model_id: "image-model",
			prompt: "first version",
		})
		await Promise.resolve()
		const secondPromise = element.submitContentGeneration({
			model_id: "image-model",
			prompt: "second version",
		})
		await Promise.resolve()

		expect(generationRuntimeManager.getTargetStates("image-1")).toHaveLength(2)
		first.resolve()
		await expect(firstPromise).resolves.toBe(true)
		expect(generationRuntimeManager.getTargetStates("image-1")).toHaveLength(1)
		const firstContentId = element.data.contents[1]?.contentId
		expect(element.data.activeContentId).toBe(firstContentId)

		second.resolve()
		await expect(secondPromise).resolves.toBe(true)
		expect(generationRuntimeManager.getTargetStates("image-1")).toHaveLength(0)
		expect(element.data.contents).toHaveLength(3)
		expect(element.data.activeContentId).toBe(element.data.contents[2]?.contentId)
	})

	it("exposes a video generation request while submission is pending", async () => {
		const deferred = createDeferred()
		const generateVideo = vi.fn(() => deferred.promise)
		type TestVideoData = VideoElementData
		const generationRuntimeManager = new GenerationRuntimeManager()
		const commitGenerationTargets = vi.fn(
			(targets: Array<{ persistedPatch: Partial<TestVideoData> }>) => {
				element.data = { ...element.data, ...targets[0]?.persistedPatch }
			},
		)
		const element = Object.create(VideoElement.prototype) as VideoElement & {
			data: TestVideoData
			isGenerating: boolean
			isErrorState: boolean
			isRetryEditing: boolean
			canvas: {
				magicConfigManager: { config: { methods: { generateVideo: typeof generateVideo } } }
				generationRuntimeManager: GenerationRuntimeManager
				generationAttemptCoordinator: GenerationAttemptCoordinator
				elementManager: {
					getElementData: () => TestVideoData
					getTemporaryElementMetadata: () => null
					commitGenerationTargets: typeof commitGenerationTargets
				}
				eventEmitter: { emit: ReturnType<typeof vi.fn> }
			}
			pollingManager: { start: ReturnType<typeof vi.fn> }
			rerender: ReturnType<typeof vi.fn>
		}
		element.data = {
			id: "video-1",
			type: ElementTypeEnum.Video,
			width: 100,
			height: 100,
			activeContentId: "video-1-content-1",
			mainContentId: "video-1-content-1",
			contents: [{ contentId: "video-1-content-1" }],
		}
		element.isGenerating = false
		element.isErrorState = false
		element.isRetryEditing = false
		const canvas = {
			magicConfigManager: { config: { methods: { generateVideo } } },
			generationRuntimeManager,
			elementManager: {
				getElementData: () => element.data,
				getTemporaryElementMetadata: () => null,
				commitGenerationTargets,
			},
			eventEmitter: { emit: vi.fn() },
		} as unknown as Canvas
		canvas.generationAttemptCoordinator = new GenerationAttemptCoordinator(canvas)
		element.canvas = canvas as typeof element.canvas
		element.pollingManager = { start: vi.fn() }
		element.rerender = vi.fn()

		const resultPromise = element.generateVideo({
			model_id: "video-model",
			prompt: "A product video",
		})
		await Promise.resolve()

		expect(element.data.contents[0]?.generateVideoRequest).toBeUndefined()
		expect(generationRuntimeManager.getTargetState("video-1")?.generateVideoRequest).toEqual(
			expect.objectContaining({
				model_id: "video-model",
				prompt: "A product video",
				video_id: expect.any(String),
			}),
		)
		expect(element.data).not.toHaveProperty("runtimeGenerateVideoRequest")
		expect(element.rerender).toHaveBeenCalledTimes(1)

		deferred.resolve()
		await expect(resultPromise).resolves.toBe(true)
		expect(generationRuntimeManager.getTargetState("video-1")).toBeNull()
		expect(element.data.contents[0]?.generateVideoRequest).toEqual(
			expect.objectContaining({ video_id: expect.any(String) }),
		)
		expect(commitGenerationTargets).toHaveBeenCalledWith([
			expect.objectContaining({
				elementId: "video-1",
				persistedPatch: expect.objectContaining({
					contents: expect.arrayContaining([
						expect.objectContaining({
							generateVideoRequest: element.data.contents[0]?.generateVideoRequest,
						}),
					]),
				}),
			}),
		])
	})

	it("submits canvas composition through the common video task lifecycle", async () => {
		const deferred = createDeferred()
		const generateVideo = vi.fn(() => deferred.promise)
		const generationRuntimeManager = new GenerationRuntimeManager()
		const data: VideoElementData = {
			id: "composition-result",
			type: ElementTypeEnum.Video,
			width: 320,
			height: 180,
			activeContentId: "composition-content",
			mainContentId: "composition-content",
			contents: [{ contentId: "composition-content" }],
		}
		const element = Object.create(VideoElement.prototype) as VideoElement & {
			data: VideoElementData
			isGenerating: boolean
			isErrorState: boolean
			isRetryEditing: boolean
			canvas: Canvas
			pollingManager: {
				setContentId: ReturnType<typeof vi.fn>
				start: ReturnType<typeof vi.fn>
			}
			rerender: ReturnType<typeof vi.fn>
		}
		const update = vi.fn((_id: string, patch: Partial<VideoElementData>) => {
			Object.assign(data, patch)
		})
		const canvas = {
			magicConfigManager: { config: { methods: { generateVideo } } },
			generationRuntimeManager,
			elementManager: {
				getElementData: () => data,
				getTemporaryElementMetadata: () => ({ kind: "generation-result" }),
				update,
			},
			eventEmitter: { emit: vi.fn() },
		} as unknown as Canvas
		canvas.generationAttemptCoordinator = new GenerationAttemptCoordinator(canvas)
		element.data = data
		element.canvas = canvas
		element.isGenerating = false
		element.isErrorState = false
		element.isRetryEditing = false
		element.pollingManager = { setContentId: vi.fn(), start: vi.fn() }
		element.rerender = vi.fn()

		const resultPromise = element.generateVideo(
			{
				generation_type: "canvas_composition",
				composition: { videos: [{ path: "/新建画布/videos/a.mp4" }] },
			},
			{ failurePolicy: "remove-placeholder", keepTemporaryUntilComplete: true },
		)
		await Promise.resolve()

		expect(generateVideo).toHaveBeenCalledWith(
			expect.objectContaining({
				generation_type: "canvas_composition",
				composition: { videos: [{ path: "/新建画布/videos/a.mp4" }] },
				video_id: expect.any(String),
			}),
		)
		expect(data.contents[0]?.generateVideoRequest).toBeUndefined()

		deferred.resolve()
		expect(await resultPromise).toBe(true)
		expect(data.contents[0]?.generateVideoRequest).toEqual(
			expect.objectContaining({
				generation_type: "canvas_composition",
				video_id: expect.any(String),
			}),
		)
		expect(data.contents[0]?.generateVideoRequest).not.toHaveProperty("extensions")
		expect(element.pollingManager.start).toHaveBeenCalledOnce()
	})

	it("saves the complete request when initial video submission fails", async () => {
		const generateVideo = vi.fn().mockRejectedValue(new Error("submit failed"))
		const generationRuntimeManager = new GenerationRuntimeManager()
		const mediaEditRecoveryManager = new MediaEditRecoveryManager()
		const data: VideoElementData = {
			id: "video-failed-initial",
			type: ElementTypeEnum.Video,
			width: 100,
			height: 100,
			activeContentId: "video-content-1",
			mainContentId: "video-content-1",
			contents: [{ contentId: "video-content-1" }],
		}
		const element = Object.create(VideoElement.prototype) as VideoElement & {
			data: VideoElementData
			isGenerating: boolean
			isErrorState: boolean
			isRetryEditing: boolean
			canvas: Canvas
			pollingManager: { start: ReturnType<typeof vi.fn> }
			rerender: ReturnType<typeof vi.fn>
		}
		element.data = data
		element.isGenerating = false
		element.isErrorState = false
		element.isRetryEditing = false
		const canvas = {
			magicConfigManager: { config: { methods: { generateVideo } } },
			generationRuntimeManager,
			mediaEditRecoveryManager,
			elementManager: {
				getElementData: () => data,
				getTemporaryElementMetadata: () => null,
			},
			eventEmitter: { emit: vi.fn() },
		} as unknown as Canvas
		canvas.generationAttemptCoordinator = new GenerationAttemptCoordinator(canvas)
		element.canvas = canvas
		element.pollingManager = { start: vi.fn() }
		element.rerender = vi.fn()

		await expect(
			element.generateVideo({
				model_id: "video-model",
				prompt: "initial prompt",
				input_mode: "standard",
			}),
		).resolves.toBe(false)

		const recovery = mediaEditRecoveryManager.get(
			{
				elementId: data.id,
				contentId: "video-content-1",
				intent: "generate",
			},
			buildMediaEditSourceFingerprint("video-content-1"),
		)
		expect(recovery?.draft).toEqual({
			request: expect.objectContaining({
				model_id: "video-model",
				prompt: "initial prompt",
				input_mode: "standard",
				video_id: expect.any(String),
			}),
		})
	})

	it("appends a new video Content for result-state regeneration", async () => {
		const deferred = createDeferred()
		const generateVideo = vi.fn(() => deferred.promise)
		const generationRuntimeManager = new GenerationRuntimeManager()
		const data: VideoElementData = {
			id: "video-content-1",
			type: ElementTypeEnum.Video,
			width: 100,
			height: 100,
			activeContentId: "video-v1",
			mainContentId: "video-v1",
			contents: [
				{
					contentId: "video-v1",
					src: "./videos/original.mp4",
					status: GenerationStatus.Completed,
					generateVideoRequest: {
						video_id: "old-video-id",
						model_id: "video-model",
						prompt: "original prompt",
					},
				},
			],
		}
		const commitGenerationTargets = vi.fn(
			(targets: Array<{ persistedPatch: Partial<VideoElementData> }>) => {
				Object.assign(data, targets[0]?.persistedPatch)
			},
		)
		const element = Object.create(VideoElement.prototype) as VideoElement & {
			data: VideoElementData
			isGenerating: boolean
			isErrorState: boolean
			isRetryEditing: boolean
			canvas: {
				magicConfigManager: { config: { methods: { generateVideo: typeof generateVideo } } }
				generationRuntimeManager: GenerationRuntimeManager
				generationAttemptCoordinator: GenerationAttemptCoordinator
				elementManager: {
					getElementData: () => VideoElementData
					commitGenerationTargets: typeof commitGenerationTargets
				}
				eventEmitter: { emit: ReturnType<typeof vi.fn> }
			}
			pollingManager: {
				setContentId: ReturnType<typeof vi.fn>
				start: ReturnType<typeof vi.fn>
			}
			rerender: ReturnType<typeof vi.fn>
		}
		element.data = data
		element.isGenerating = false
		element.isErrorState = false
		element.isRetryEditing = false
		const canvas = {
			magicConfigManager: { config: { methods: { generateVideo } } },
			generationRuntimeManager,
			elementManager: {
				getElementData: () => data,
				commitGenerationTargets,
			},
			eventEmitter: { emit: vi.fn() },
		} as unknown as Canvas
		canvas.generationAttemptCoordinator = new GenerationAttemptCoordinator(canvas)
		element.canvas = canvas as typeof element.canvas
		element.pollingManager = { setContentId: vi.fn(), start: vi.fn() }
		element.rerender = vi.fn()

		const resultPromise = element.submitContentGeneration({
			model_id: "video-model",
			prompt: "  edited prompt  ",
			video_id: "old-video-id",
		})
		await Promise.resolve()

		expect(data.contents).toHaveLength(1)
		expect(generationRuntimeManager.getTargetState(data.id)?.contentId).toMatch(/^content-/)

		deferred.resolve()
		await expect(resultPromise).resolves.toBe(true)

		expect(data.contents).toHaveLength(2)
		expect(data.activeContentId).toBe(data.contents[1]?.contentId)
		expect(data.mainContentId).toBe("video-v1")
		expect(data.contents[1]).toEqual(
			expect.objectContaining({
				generateVideoRequest: expect.objectContaining({
					model_id: "video-model",
					prompt: "edited prompt",
					video_id: expect.any(String),
				}),
			}),
		)
		expect(data.contents[1]?.generateVideoRequest?.video_id).not.toBe("old-video-id")
		expect(element.pollingManager.setContentId).toHaveBeenCalledWith(
			data.contents[1]?.contentId,
		)
		expect(element.pollingManager.start).toHaveBeenCalledTimes(1)
	})

	it("keeps concurrent video Content generation attempts independent", async () => {
		const first = createDeferred()
		const second = createDeferred()
		const generateVideo = vi
			.fn()
			.mockImplementationOnce(() => first.promise)
			.mockImplementationOnce(() => second.promise)
		const generationRuntimeManager = new GenerationRuntimeManager()
		const data: VideoElementData = {
			id: "video-1",
			type: ElementTypeEnum.Video,
			width: 100,
			height: 100,
			activeContentId: "video-v1",
			mainContentId: "video-v1",
			contents: [
				{
					contentId: "video-v1",
					src: "./videos/original.mp4",
					status: GenerationStatus.Completed,
				},
			],
		}
		const element = Object.create(VideoElement.prototype) as VideoElement & {
			data: VideoElementData
			isGenerating: boolean
			isErrorState: boolean
			isRetryEditing: boolean
			canvas: Canvas
			pollingManager: {
				setContentId: ReturnType<typeof vi.fn>
				start: ReturnType<typeof vi.fn>
			}
			rerender: ReturnType<typeof vi.fn>
		}
		element.data = data
		element.isGenerating = false
		element.isErrorState = false
		element.isRetryEditing = false
		const canvas = {
			magicConfigManager: { config: { methods: { generateVideo } } },
			generationRuntimeManager,
			mediaEditRecoveryManager: new MediaEditRecoveryManager(),
			elementManager: {
				getElementData: () => element.data,
				getTemporaryElementMetadata: () => null,
				commitGenerationTargets: vi.fn(
					(targets: Array<{ persistedPatch: Partial<VideoElementData> }>) => {
						element.data = { ...element.data, ...targets[0]?.persistedPatch }
					},
				),
			},
			eventEmitter: { emit: vi.fn() },
		} as unknown as Canvas
		canvas.generationAttemptCoordinator = new GenerationAttemptCoordinator(canvas)
		element.canvas = canvas
		element.pollingManager = { setContentId: vi.fn(), start: vi.fn() }
		element.rerender = vi.fn()

		const firstPromise = element.submitContentGeneration({
			model_id: "video-model",
			prompt: "first version",
		})
		await Promise.resolve()
		const secondPromise = element.submitContentGeneration({
			model_id: "video-model",
			prompt: "second version",
		})
		await Promise.resolve()

		expect(generationRuntimeManager.getTargetStates("video-1")).toHaveLength(2)
		first.resolve()
		await expect(firstPromise).resolves.toBe(true)
		expect(generationRuntimeManager.getTargetStates("video-1")).toHaveLength(1)
		const firstContentId = element.data.contents[1]?.contentId
		expect(element.data.activeContentId).toBe(firstContentId)

		second.resolve()
		await expect(secondPromise).resolves.toBe(true)
		expect(generationRuntimeManager.getTargetStates("video-1")).toHaveLength(0)
		expect(element.data.contents).toHaveLength(3)
		expect(element.data.activeContentId).toBe(element.data.contents[2]?.contentId)
	})

	it("preserves re-edit mode drafts without polluting the generate session on failure", async () => {
		const generateVideo = vi.fn().mockRejectedValue(new Error("submit failed"))
		const generationRuntimeManager = new GenerationRuntimeManager()
		const mediaEditRecoveryManager = new MediaEditRecoveryManager()
		const data: VideoElementData = {
			id: "video-failed-1",
			type: ElementTypeEnum.Video,
			width: 100,
			height: 100,
			activeContentId: "video-v1",
			mainContentId: "video-v1",
			contents: [
				{
					contentId: "video-v1",
					src: "./videos/original.mp4",
					status: GenerationStatus.Completed,
				},
			],
		}
		const element = Object.create(VideoElement.prototype) as VideoElement & {
			data: VideoElementData
			isGenerating: boolean
			isErrorState: boolean
			isRetryEditing: boolean
			canvas: {
				magicConfigManager: { config: { methods: { generateVideo: typeof generateVideo } } }
				generationRuntimeManager: GenerationRuntimeManager
				generationAttemptCoordinator: GenerationAttemptCoordinator
				mediaEditRecoveryManager: MediaEditRecoveryManager
				elementManager: { getElementData: () => VideoElementData }
				eventEmitter: { emit: ReturnType<typeof vi.fn> }
			}
			pollingManager: {
				setContentId: ReturnType<typeof vi.fn>
				start: ReturnType<typeof vi.fn>
			}
			rerender: ReturnType<typeof vi.fn>
		}
		element.data = data
		element.isGenerating = false
		element.isErrorState = false
		element.isRetryEditing = false
		const canvas = {
			magicConfigManager: { config: { methods: { generateVideo } } },
			generationRuntimeManager,
			mediaEditRecoveryManager,
			elementManager: { getElementData: () => data },
			eventEmitter: { emit: vi.fn() },
		} as unknown as Canvas
		canvas.generationAttemptCoordinator = new GenerationAttemptCoordinator(canvas)
		element.canvas = canvas as typeof element.canvas
		element.pollingManager = { setContentId: vi.fn(), start: vi.fn() }
		element.rerender = vi.fn()
		const sourceFingerprint = buildMediaEditSourceFingerprint(
			"video-v1",
			"./videos/original.mp4",
		)
		mediaEditRecoveryManager.set(
			{
				elementId: data.id,
				contentId: "video-v1",
				intent: "re-edit",
			},
			sourceFingerprint,
			{
				request: { model_id: "video-model", prompt: "draft prompt" },
				modeDrafts: {
					keyframe_guided: {
						prompt: "saved keyframe prompt",
						linkedFrameBindings: [{ sourceConnectionId: "connection-1" }],
					},
				},
			},
		)

		await expect(
			element.submitContentGeneration(
				{
					model_id: "video-model",
					prompt: "  edited prompt  ",
					input_mode: "first_last_frame",
					inputs: { start_frame: { path: "./images/start.png" } },
				},
				{ recoveryIntent: "re-edit" },
			),
		).resolves.toBe(false)

		const recovery = mediaEditRecoveryManager.get(
			{
				elementId: data.id,
				contentId: "video-v1",
				intent: "re-edit",
			},
			sourceFingerprint,
		)
		expect(recovery?.draft).toEqual({
			request: expect.objectContaining({
				model_id: "video-model",
				prompt: "edited prompt",
				input_mode: "first_last_frame",
				video_id: expect.any(String),
			}),
			modeDrafts: {
				keyframe_guided: {
					prompt: "saved keyframe prompt",
					linkedFrameBindings: [{ sourceConnectionId: "connection-1" }],
				},
			},
		})
		expect(
			mediaEditRecoveryManager.get(
				{
					elementId: data.id,
					contentId: "video-v1",
					intent: "generate",
				},
				sourceFingerprint,
			),
		).toBeNull()
	})
})
