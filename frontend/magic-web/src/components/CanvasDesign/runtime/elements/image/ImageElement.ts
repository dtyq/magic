import Konva from "konva"
import type {
	CropConfig,
	ImageElement as ImageElementData,
	ImageElementContent,
	LayerElement,
} from "../../document/types"
import { ElementTypeEnum } from "../../document/types"
import {
	appendImageContent,
	createContentId,
	deleteActiveImageContent,
	getActiveImageContent as resolveActiveImageContent,
	getActiveImageContentId,
	getDownstreamContent,
	getImageContentById,
	getMainImageContent as resolveMainImageContent,
	hasProcessingImageContent,
	isImageElementContent,
	isContentGenerationPending,
	updateImageContent,
	type ImageContentFields,
} from "../../document/elementContent"
import { BaseElement } from "../core/BaseElement"
import type { ElementOperationOptions } from "../core/ElementManager"
import imageIcon from "../../../assets/image/image-icon.png"
import imageIconError from "../../../assets/image/image-icon-error.png"
import imageBackgroundUnselected from "../../../assets/image/image-background-unselected.jpg"
import imageBackgroundLoading from "../../../assets/image/image-background-loading.jpg"
import type {
	EraserRequest,
	GenerateExtendedImageRequest,
	GenerateImageRequest,
	GenerateImageResponse,
	GenerateHightImageRequest,
	ImageGenerationTaskMeta,
	RemoveBackgroundRequest,
	UploadFileResponse,
} from "../../../public/magic-types"
import { GenerationStatus, ImageGenerationTaskTypeMap } from "../../../public/magic-types"
import { generateUUID, collectElementsByType, type Rect } from "../../shared/ids"
import {
	areCanvasHostResourceReferencesSame,
	getCanvasResourceFileName,
} from "../../shared/path/canvasResourcePath"
import type { ResourceLoadFailureReason } from "../../resources/media-common/resourceLoadFailure"
import { TransformBehavior } from "../../interaction/transform/TransformManager"
import type { Canvas } from "../../core/Canvas"
import type { CanvasConsumerVisibility } from "../../resources/visibility/CanvasVisibilityManager"
import type {
	GenerationAttemptTarget,
	GenerationOperation,
} from "../../generation/GenerationRuntimeManager"
import type {
	ImageSource,
	ImageInfo,
	LoadedResource,
	ImageResourceVariant,
	ImageResourceWillCloseHandler,
	ImageResourceLoadFailedHandler,
	ImageResourceRecoveryStartedHandler,
} from "../../resources/image/ImageResourceManager"
import { getPersistedSourceCrop } from "../../resources/image/imageCropUtils"
import { getImageSourceDimensions } from "../../resources/image/imageSourceUtils"
import { IMAGE_CONFIG, COLORS } from "./ImageElement.config"
import { ImageStaticLoader } from "../../resources/image/ImageStaticLoader"
import { RenderUtils } from "../../shared/render/RenderUtils"
import { BorderDecorator } from "../decorators/BorderDecorator"
import {
	ElementCornerActionsDecorator,
	type ElementCornerActionConfig,
} from "../decorators/ElementCornerActionsDecorator"
import { MediaVersionTagDecorator } from "../decorators/MediaVersionTagDecorator"
import { DiscardedImageDecorator } from "../decorators/DiscardedImageDecorator"
import { ImagePollingManager } from "../../resources/polling/ImagePollingManager"
import { resolveMediaComplianceStatus } from "../../resources/asset/assetComplianceState"
import { DECORATOR_COLORS, DECORATOR_CONFIG } from "../decorators/DecoratorConfig"
import type { NameLabelContent, TransformContext } from "../core/BaseElement"
import {
	appendReferenceImageInfos,
	removeReferenceImageInfosByPath,
	replaceReferenceImageInfos,
} from "../core/referenceImageInfos"
import {
	createExpandImageTaskMeta,
	createEraserTaskMeta,
	createHighImageTaskMeta,
	createRemoveBackgroundTaskMeta,
	isBatchImageGenerationTaskMeta,
} from "../../resources/image/imageGenerationTaskMeta"
import { resolveGenerationErrorMessage } from "../../resources/polling/generationPollingUtils"
import {
	buildMediaEditSourceFingerprint,
	type MediaEditIntent,
} from "../../interaction/media-edit-recovery/MediaEditRecoveryManager"
import { resolveImageDisplayState, type ImageDisplayState } from "./imageDisplayState"
import { resolveGenerationProgress } from "../../../../../utils/generationProgress"

const IMAGE_CONTENT_NODE_NAME = "image-content"

type ImageResourceStructureReason =
	"missing-image-node" | "cleared-image-node" | "error-to-image" | "resource-failed"

type ImageResourceMetadataReason = "non-fullsize-full" | "view-priority-blocked"

type ImageResourceReconcileResult =
	| { type: "patched-content" }
	| { type: "structure-required"; reason: ImageResourceStructureReason }
	| { type: "metadata-only"; reason: ImageResourceMetadataReason }

/**
 * 图片元素类
 */
export class ImageElement extends BaseElement<ImageElementData> {
	// 管理器和装饰器
	private imageLoader = new ImageStaticLoader()
	private pollingManager: ImagePollingManager
	private borderDecorator?: BorderDecorator
	private cornerActionsDecorator?: ElementCornerActionsDecorator
	private mainVersionTagDecorator?: MediaVersionTagDecorator
	private discardedImageDecorator?: DiscardedImageDecorator

	// 生成相关：Runtime manager 是并发状态的唯一事实来源；legacy 标记只兼容
	// 尚未建立 Runtime target 的测试和初始化生命周期。
	private legacyIsGenerating = false

	private get isGenerating(): boolean {
		return (
			this.canvas?.generationRuntimeManager?.hasActiveGeneration?.(this.data.id) ??
			this.legacyIsGenerating
		)
	}

	private set isGenerating(value: boolean) {
		this.legacyIsGenerating = value
	}

	// 渲染相关
	private isErrorState: boolean = false
	private contentGroup?: Konva.Group
	private contentLayoutGroup?: Konva.Group
	private contentUpdateHandler?: () => void
	private contentViewportScaleUnsubscribe?: () => void
	private contentPreviewUnsubscribe?: () => void
	/** Invalidates async placeholder work when the rendered Konva group is replaced. */
	private renderToken = 0
	private effectiveContentId?: string
	private effectiveContentSrc?: string

	// 后端任务起点尚未回写时，用本端首次观察时刻兜底。锚点与定时器分开保存：
	// 重渲染只停定时器、保留锚点，避免兼容路径的进度回退。
	private generationProgressAnchor?: { contentId: string; startedAtMs: number }
	private generationProgressTimer?: ReturnType<typeof setInterval>
	private consumerVisibility: CanvasConsumerVisibility = "visible"
	private consumerVisibilityUnsubscribe?: () => void

	// 缓存已加载的图片对象（ImageBitmap | HTMLImageElement，由 ImageResourceManager 统一管理）
	private loadedImage?: ImageSource
	private loadedImageVariant?: ImageResourceVariant
	private loadedImageSourceWidth?: number
	private loadedImageSourceHeight?: number
	/** 当前视口调度希望这个元素显示的资源等级；用于允许缩小时主动降级 */
	private targetDisplayResourceVariant?: ImageResourceVariant
	/** 从 resource:image:loaded 事件获取的 ossSrc */
	private storedOssSrc: string | null = null
	/** 从 resource:image:loaded 事件获取的 imageInfo */
	private storedImageInfo?: ImageInfo
	/** 已调用 loadResource 且尚未收到加载完成/失败事件 */
	private isResourceLoading = false

	// ossSrc 异步等待机制（生成/上传流程）
	private ossSrcPromise?: Promise<string>
	private ossSrcResolve?: (ossSrc: string) => void
	private ossSrcReject?: (reason?: Error) => void

	// 资源失败与 decoded surface 释放必须同步处理；成功资源由画布级呈现调度器提交。
	private resourceWillCloseHandler?: ImageResourceWillCloseHandler
	private resourceLoadFailedHandler?: ImageResourceLoadFailedHandler
	private resourceRecoveryStartedHandler?: ImageResourceRecoveryStartedHandler
	private resourceSubscriptionCleanups: Array<() => void> = []
	/** 最后一次加载失败原因（与 resource:image:load-failed 同步） */
	private imageLoadFailureReason: ResourceLoadFailureReason | null = null
	/** 最近一次已应用到视图的资源失败签名（用于去重，避免重复 rerender） */
	private lastAppliedLoadFailureSignature: string | null = null

	// 参考图信息列表（保存上传的参考图完整信息）
	private referenceImageInfos: UploadFileResponse[] = []
	// 上传结果（由全局上传管理器设置）
	public uploadResult?: UploadFileResponse

	// 裁剪相关（仅监听 enter/exit 用于 rerender，绘制由 CropRenderer 负责）
	private cropEnterHandler?: (event: { data: { elementId: string } }) => void
	private cropExitHandler?: (event: { data: { elementId: string; restored: boolean } }) => void
	private selectionChangeHandler?: (event: { data: { elementIds: string[] } }) => void
	private deselectHandler?: (event: { data: { elementIds?: string[] } | undefined }) => void
	private isRetryEditing = false
	private generationRuntimeUnsubscribe?: () => void
	private mediaReplaceStateUnsubscribe?: () => void

	constructor(data: ImageElementData, canvas: Canvas) {
		super(data, canvas)

		this.setupContentPreviewListener()
		// 设置裁剪事件监听
		this.setupCropEventListeners()
		this.setupRetryEditingListeners()
		this.generationRuntimeUnsubscribe = this.canvas.generationRuntimeManager.subscribeElement(
			this.data.id,
			() => {
				this.rerenderWhenTransformIdle()
			},
		)
		this.mediaReplaceStateUnsubscribe = this.canvas.eventEmitter.on(
			"element:media:replaceStateChanged",
			({ data: eventData }) => {
				if (eventData.elementId !== this.data.id) return
				this.rerenderWhenTransformIdle()
			},
		)

		// 初始化轮询管理器（仅用于生成状态轮询）
		this.pollingManager = new ImagePollingManager({
			elementId: this.data.id,
			canvas: this.canvas,
			getElementData: () => this.data,
			onStatusUpdate: (contentId) => {
				if (contentId && this.getActiveContentData().contentId !== contentId) return
				this.isErrorState = true
				// reject ossSrc Promise（生成失败）
				if (this.ossSrcReject) {
					this.ossSrcReject(new Error("Image generation failed"))
					this.ossSrcResolve = undefined
					this.ossSrcReject = undefined
					this.ossSrcPromise = undefined
				}
				this.rerender()
			},
		})
		this.canvas.eventEmitter.on(
			"element:image:displayStateChanged",
			this.handleDisplayStateChanged,
		)

		const activeContent = this.getActiveContentData()
		// active 有 src：先监听资源事件，实际加载交给 CanvasVisibilityManager 调度。
		if (activeContent.src) {
			this.setupResourceLoadedListener()
		}
		if (!activeContent.src && activeContent.generateImageRequest?.image_id) {
			this.createOssSrcPromise()
		} else if (!activeContent.src) {
			const imageGenerationTaskMeta = this.getImageGenerationTaskMeta()
			if (
				imageGenerationTaskMeta?.image_id &&
				!isBatchImageGenerationTaskMeta(imageGenerationTaskMeta)
			) {
				this.createOssSrcPromise()
			}
		}
		// 任一 Content 处于 processing 都需要继续轮询，即使 active 仍显示其他 Content。
		this.pollingManager.syncWithElementData()
	}

	private saveGenerateRecoveryDraft(
		request: Partial<GenerateImageRequest>,
		content?: ImageElementContent,
		intent: MediaEditIntent = "generate",
	): void {
		if (!isImageElementContent(this.data)) return
		const targetContent = content ?? this.getActiveContentData()
		this.canvas.mediaEditRecoveryManager?.saveDraft(
			{
				elementId: this.data.id,
				contentId: targetContent.contentId,
				intent,
			},
			buildMediaEditSourceFingerprint(targetContent.contentId, targetContent.src),
			{ request },
		)
	}

	private clearGenerateRecoveryDraft(content?: ImageElementContent): void {
		if (!isImageElementContent(this.data)) return
		const targetContent = content ?? this.getActiveContentData()
		this.canvas.mediaEditRecoveryManager?.clear({
			elementId: this.data.id,
			contentId: targetContent.contentId,
			intent: "generate",
		})
	}

	private resolveActiveContentData(data: ImageElementData = this.data): ImageElementContent {
		return this.getActiveContent<ImageElementContent>(data) ?? resolveActiveImageContent(data)
	}

	public getActiveContentData(data: ImageElementData = this.data): ImageElementContent {
		return this.resolveActiveContentData(data)
	}

	public getMainContentData(): ImageElementContent {
		return resolveMainImageContent(this.getData())
	}

	/**
	 * 返回图片作为画布关联媒体时应消费的主 Content。
	 * 连线、Storyboard 等关联消费者必须通过此语义入口获取，禁止自行读取 Content DSL。
	 */
	public getAssociatedContentData(): ImageElementContent {
		return getDownstreamContent(this.getData()) ?? this.getMainContentData()
	}

	/**
	 * 返回图片最近创建的 Content，供生成流程读取状态，避免消费者解析图片 DSL。
	 */
	public getLatestContentData(): ImageElementContent {
		const data = this.getData()
		if (isImageElementContent(data)) return data.contents.at(-1) ?? this.getActiveContentData()
		return this.getActiveContentData()
	}

	/** 返回图片当前唯一的展示状态，供名称、占位图和图层入口复用。 */
	public getDisplayState(): ImageDisplayState {
		const activeContent = this.getActiveContentData()
		const generationRequest = this.getActiveGenerateImageRequest()
		const taskMeta = this.getActiveImageGenerationTaskMeta()

		return resolveImageDisplayState({
			generationTiming: this.pollingManager.getGenerationTiming(activeContent.contentId),
			content: {
				...activeContent,
				generateImageRequest: generationRequest,
				imageGenerationTaskMeta: taskMeta,
			},
			isTemporary: this.canvas?.elementManager?.isTemporary?.(this.data.id) ?? false,
			hasActiveGeneration: this.hasActiveGeneration(activeContent.contentId),
			hasActiveGenerationTask: Boolean(generationRequest?.image_id || taskMeta?.image_id),
			hasGenerationRequest: Boolean(generationRequest || taskMeta),
			taskType: taskMeta?.type,
			isReplacementUploading: this.isReplacementUploadingActiveContent(),
			// Keep resource refresh failures distinguishable even when the old decoded
			// image is intentionally preserved and isErrorState is cleared.
			isResourceError: this.imageLoadFailureReason !== null,
			hasLoadedImage: Boolean(this.loadedImage),
		})
	}

	private handleDisplayStateChanged = (event: { data: { elementId: string } }): void => {
		if (event.data.elementId === this.data.id) this.rerenderWhenTransformIdle()
	}

	public getContentData(contentId: string): ImageElementContent | undefined {
		return getImageContentById(this.getData(), contentId)
	}

	public getGenerationTiming(contentId: string): ImageElementContent["generationTiming"] {
		return this.pollingManager.getGenerationTiming(contentId)
	}

	public updateActiveContentData(
		patch: Partial<ImageContentFields>,
		options?: ElementOperationOptions,
	): boolean {
		const data = this.getData()
		if (!isImageElementContent(data)) {
			this.canvas.elementManager.update(
				this.data.id,
				patch as Partial<ImageElementData>,
				options,
			)
			return true
		}
		if (!data.activeContentId) return false
		return this.updateContentData(data.activeContentId, patch, options)
	}

	public updateContentData(
		contentId: string,
		patch: Partial<ImageContentFields>,
		options?: ElementOperationOptions,
	): boolean {
		const data = this.getData()
		if (
			!isImageElementContent(data) ||
			!data.contents.some((content) => content.contentId === contentId)
		) {
			return false
		}
		const next = updateImageContent(data, contentId, patch)
		if (!isImageElementContent(next)) return false
		this.canvas.elementManager.update(this.data.id, { contents: next.contents }, options)
		return true
	}

	private buildContentElementPatch(
		contentId: string | undefined,
		patch: Partial<ImageContentFields>,
	): Partial<ImageElementData> {
		const data = this.getData()
		if (!isImageElementContent(data)) return patch as Partial<ImageElementData>
		const targetContentId = contentId ?? data.activeContentId ?? undefined
		if (!getImageContentById(data, targetContentId)) {
			throw new Error(`Image Content ${targetContentId} not found`)
		}
		const next = updateImageContent(data, targetContentId, patch)
		return isImageElementContent(next) ? { contents: next.contents } : {}
	}

	/**
	 * 判断图片是否已有生成历史，供再次生成流程选择 Content 路径。
	 */
	public hasGenerationHistory(): boolean {
		const data = this.getData()
		const active = this.getActiveContentData()
		return (
			Boolean(active.generateImageRequest || active.src || active.status) ||
			data.contents.length > 1
		)
	}

	/**
	 * 提交一次图片生成，由图片元素自身决定是首次生成还是追加 Content。
	 */
	public submitGeneration(request: GenerateImageRequest): Promise<boolean> {
		return this.hasGenerationHistory()
			? this.submitContentGeneration(request)
			: this.submitInitialGeneration(request)
	}

	/** 提交新图片元素的首次生成。 */
	public submitInitialGeneration(request: GenerateImageRequest): Promise<boolean> {
		return this.generateInitialImage(request)
	}

	/** 提交当前图片元素的重新编辑/再次生成 Content。 */
	public submitContentGeneration(
		request: GenerateImageRequest,
		options?: { recoveryIntent?: MediaEditIntent },
	): Promise<boolean> {
		return this.generateImageContent(request, options?.recoveryIntent)
	}

	public switchActiveContent(contentId: string): boolean {
		if (!this.canvas.permissionManager.can("document.write")) return false
		if (!isImageElementContent(this.data)) return false
		if (!this.data.contents.some((content) => content.contentId === contentId)) return false
		if (this.data.activeContentId === contentId) return true
		this.canvas.elementManager.update(
			this.data.id,
			{ activeContentId: contentId },
			{ silent: false },
		)
		this.pollingManager.syncWithElementData()
		return true
	}

	public setMainContent(contentId: string): boolean {
		if (!this.canvas.permissionManager.can("document.write")) return false
		if (!isImageElementContent(this.data)) return false
		const target = this.data.contents.find((content) => content.contentId === contentId)
		if (!target?.src || target.status !== GenerationStatus.Completed) return false
		if (this.data.mainContentId === contentId) return true
		this.canvas.elementManager.update(
			this.data.id,
			{ mainContentId: contentId },
			{ silent: false },
		)
		return true
	}

	public deleteActiveContent(): boolean {
		if (!this.canvas.permissionManager.can("document.delete")) return false
		if (!isImageElementContent(this.data)) return false
		const result = deleteActiveImageContent(this.data)
		if (!result) return false
		const deletedContentId = result.deletedContent.contentId
		this.canvas.generationRuntimeManager?.clearTarget(this.data.id, deletedContentId)
		this.canvas.elementDetailsRuntimeManager?.clearImageContent(this.data.id, deletedContentId)
		this.canvas.markerManager.removeMarkersByImageContent(this.data.id, deletedContentId)
		this.canvas.elementManager.update(
			this.data.id,
			{
				contents: result.element.contents,
				activeContentId: result.element.activeContentId,
				mainContentId: result.element.mainContentId,
			},
			{ silent: false },
		)
		this.pollingManager.syncWithElementData()
		return true
	}

	/**
	 * 重新渲染节点（重写以清理监听器）
	 */
	override rerender(): Konva.Node | null {
		this.renderToken += 1
		// 在重新渲染前清理监听器和装饰器
		this.removeContentUpdateListener()
		this.stopGenerationProgress()
		this.borderDecorator?.destroy()
		this.borderDecorator = undefined
		this.cornerActionsDecorator?.destroy()
		this.cornerActionsDecorator = undefined
		this.mainVersionTagDecorator?.destroy()
		this.mainVersionTagDecorator = undefined
		this.discardedImageDecorator?.destroy()
		this.discardedImageDecorator = undefined

		// 调用父类的 rerender
		return super.rerender()
	}

	override destroyRenderNodeForVisibilityCull(): void {
		this.renderToken += 1
		this.removeContentUpdateListener()
		this.stopGenerationProgress()
		super.destroyRenderNodeForVisibilityCull()
	}

	/**
	 * 销毁元素时清理资源
	 */
	override destroy(): void {
		this.renderToken += 1
		this.canvas.visibilityManager.unregisterImageElement(this.data.id)
		this.consumerVisibilityUnsubscribe?.()
		this.consumerVisibilityUnsubscribe = undefined
		this.removeResourceLoadedListener()
		this.contentPreviewUnsubscribe?.()
		this.contentPreviewUnsubscribe = undefined
		this.removeCropEventListeners()
		this.removeRetryEditingListeners()
		this.generationRuntimeUnsubscribe?.()
		this.generationRuntimeUnsubscribe = undefined
		this.mediaReplaceStateUnsubscribe?.()
		this.mediaReplaceStateUnsubscribe = undefined
		this.pollingManager.destroy()
		this.canvas.eventEmitter.off(
			"element:image:displayStateChanged",
			this.handleDisplayStateChanged,
		)
		this.borderDecorator?.destroy()
		this.cornerActionsDecorator?.destroy()
		this.mainVersionTagDecorator?.destroy()
		this.removeContentUpdateListener()
		this.discardedImageDecorator?.destroy()
		this.stopGenerationProgress()
		// 清理缓存的图片对象
		this.clearLoadedImageReference()
		// 清理 ossSrc Promise
		this.ossSrcPromise = undefined
		this.ossSrcResolve = undefined
		this.ossSrcReject = undefined
		super.destroy()
	}

	private clearLoadedImageReference(): void {
		this.loadedImage = undefined
		this.loadedImageVariant = undefined
		this.loadedImageSourceWidth = undefined
		this.loadedImageSourceHeight = undefined
	}

	private ensureConsumerVisibilitySubscription(): void {
		if (
			this.consumerVisibilityUnsubscribe ||
			!this.canvas.visibilityManager?.registerConsumerVisibility ||
			this.getDisplayState().surface === "image"
		) {
			return
		}

		this.consumerVisibilityUnsubscribe =
			this.canvas.visibilityManager.registerConsumerVisibility(this.data.id, (state) => {
				this.consumerVisibility = state
				this.syncRenderVisibility()
			})
	}

	private syncRenderVisibility(): void {
		const enabled = this.consumerVisibility !== "far"
		this.borderDecorator?.setRenderVisibility(enabled)
		if (!enabled) {
			this.stopGenerationProgress()
			return
		}

		const displayState = this.getDisplayState()
		if (
			displayState.status === "generating" &&
			this.node instanceof Konva.Group &&
			this.contentGroup
		) {
			this.attachGenerationProgress(
				this.node,
				this.contentGroup,
				this.getGeneratingPlaceholderText(displayState),
				this.renderToken,
			)
		}
	}

	/**
	 * 只读 Content 预览只改变 Canvas 的 effective Content，不会经过 update()。
	 * 图片的 decoded surface、失败原因和资源监听必须在这里按版本切换，避免
	 * previous/next 预览互相继承运行态。
	 */
	private setupContentPreviewListener(): void {
		const activeContent = this.getActiveContentData()
		this.effectiveContentId = activeContent.contentId
		this.effectiveContentSrc = activeContent.src
		const eventEmitter = this.canvas?.eventEmitter
		if (typeof eventEmitter?.on !== "function") return

		this.contentPreviewUnsubscribe = eventEmitter.on(
			"content:previewChanged",
			({ data: eventData }) => {
				if (eventData.elementId && eventData.elementId !== this.data.id) return

				const changed = this.syncEffectiveContentRuntimeState()
				if (!changed) return

				// setPreviewContent() 已经会自行 rerender；clearPreviewContent() 的
				// 事件在旧节点 rerender 后才发出，因此只在清理事件中补一次重绘。
				if (eventData.contentId === undefined && this.canvas?.transformManager) {
					this.rerenderWhenTransformIdle()
				}
			},
		)
	}

	private syncEffectiveContentRuntimeState(): boolean {
		const nextContent = this.getActiveContentData()
		if (this.effectiveContentId === undefined) {
			this.effectiveContentId = nextContent.contentId
			this.effectiveContentSrc = nextContent.src
			return false
		}
		if (nextContent.contentId === this.effectiveContentId) return false

		const sourceChanged = this.effectiveContentSrc !== nextContent.src
		this.resetRuntimeStateForContentChange(nextContent, sourceChanged)
		this.effectiveContentId = nextContent.contentId
		this.effectiveContentSrc = nextContent.src
		return true
	}

	private resetRuntimeStateForContentChange(
		nextContent: ImageElementContent,
		sourceChanged: boolean,
	): void {
		this.isErrorState = false
		this.imageLoadFailureReason = null
		this.lastAppliedLoadFailureSignature = null

		if (!sourceChanged) return

		this.clearLoadedImageReference()
		this.targetDisplayResourceVariant = undefined
		this.storedOssSrc = null
		this.storedImageInfo = undefined
		this.isResourceLoading = false
		this.removeResourceLoadedListener()

		if (nextContent.src && this.canvas?.imageResourceManager) {
			this.setupResourceLoadedListener()
			this.canvas.visibilityManager?.updateImageElement?.(this.data.id, nextContent.src)
		} else {
			this.canvas?.visibilityManager?.unregisterImageElement?.(this.data.id)
		}
	}

	private applyResourceMetadata(resource: LoadedResource): void {
		this.storedOssSrc = resource.ossSrc
		this.storedImageInfo = resource.imageInfo
		this.isResourceLoading = false
	}

	private applyResourceToView(resource: LoadedResource): void {
		this.loadedImage = resource.image
		this.loadedImageVariant = resource.variant
		this.loadedImageSourceWidth = resource.sourceWidth
		this.loadedImageSourceHeight = resource.sourceHeight
		this.applyResourceMetadata(resource)
	}

	private getMountedImageContentNode(): Konva.Image | null {
		if (!(this.node instanceof Konva.Group)) return null

		const namedNode = this.node.findOne(`.${IMAGE_CONTENT_NODE_NAME}`)
		if (namedNode instanceof Konva.Image) {
			return namedNode
		}

		return (
			this.node.children?.find((child): child is Konva.Image => {
				if (!(child instanceof Konva.Image)) return false
				const name = child.name()
				return !name || name === IMAGE_CONTENT_NODE_NAME
			}) ?? null
		)
	}

	private patchMountedImageContentNodeWithLoadedResource(): ImageResourceReconcileResult {
		const imageNode = this.getMountedImageContentNode()
		if (!imageNode) {
			return { type: "structure-required", reason: "missing-image-node" }
		}

		if (!this.loadedImage) {
			imageNode.destroy()
			return { type: "structure-required", reason: "cleared-image-node" }
		}

		imageNode.image(this.loadedImage)
		imageNode.width(this.data.width ?? imageNode.width())
		imageNode.height(this.data.height ?? imageNode.height())
		imageNode.crop(
			this.canvas.cropManager.getCroppingElementId() === this.data.id
				? undefined
				: this.getSourceCrop(this.loadedImage),
		)
		return { type: "patched-content" }
	}

	private commitImageResourceReconcile(result: ImageResourceReconcileResult): void {
		if (result.type !== "structure-required") return
		this.rerenderWhenTransformIdle()
	}

	private requireImageResourceStructure(
		reason: ImageResourceStructureReason,
	): ImageResourceReconcileResult {
		return { type: "structure-required", reason }
	}

	private getVariantViewRank(variant: ImageResourceVariant | undefined): number {
		if (variant === "full") return 2
		if (variant === "preview") return 1
		if (variant === "low") return 0
		return 0
	}

	private shouldApplyResourceToView(resource: LoadedResource): boolean {
		if (!this.loadedImage) return true
		if (this.loadedImageVariant === "full" && resource.variant !== "full") return false
		const targetVariant = this.targetDisplayResourceVariant
		if (targetVariant) {
			const resourceRank = this.getVariantViewRank(resource.variant)
			const targetRank = this.getVariantViewRank(targetVariant)
			if (resource.variant === targetVariant) return true
			if (resourceRank > targetRank) return false
		}
		return (
			this.getVariantViewRank(resource.variant) >=
			this.getVariantViewRank(this.loadedImageVariant)
		)
	}

	public getDisplayResourceVariant(): ImageResourceVariant | undefined {
		return this.loadedImageVariant
	}

	private getDisplayTargetFallbackVariants(
		targetVariant: ImageResourceVariant,
	): ImageResourceVariant[] {
		if (targetVariant === "low") return ["low", "preview"]
		if (targetVariant === "preview") return ["preview", "low"]
		return ["preview", "low"]
	}

	private peekExactResourceVariant(variant: ImageResourceVariant): LoadedResource | null {
		const src = this.getActiveContentData().src
		if (!src) return null
		const resource = this.canvas.imageResourceManager.peekResource(src, { variant })
		return resource?.variant === variant ? resource : null
	}

	override onMounted(): void {
		super.onMounted()
		this.ensureConsumerVisibilitySubscription()
		this.mainVersionTagDecorator?.refreshLayout()
		const src = this.getActiveContentData().src
		if (src) {
			this.canvas.visibilityManager.registerImageElement(this.data.id, src)
		}
	}

	override onResourceReferenceResolverChanged(): void {
		this.setupResourceLoadedListener()
	}

	/**
	 * 发起图片生成请求
	 * @param request 请求参数
	 * @returns 请求是否成功发起
	 */
	private async generateInitialImage(request: GenerateImageRequest): Promise<boolean> {
		if (!this.canvas.magicConfigManager.config?.methods?.generateImage) {
			return false
		}
		const contentId = getActiveImageContentId(this.data)

		if (this.hasActiveGeneration(contentId)) {
			return false
		}

		// 检查必要参数
		if (!request.model_id || !request.prompt) {
			return false
		}

		// 生成新的 image_id 并添加到请求中
		const requestWithId: GenerateImageRequest = {
			...request,
			image_id: generateUUID(),
		}
		this.isGenerating = true
		this.isErrorState = false
		this.imageLoadFailureReason = null
		this.isRetryEditing = false
		const recoveryContent = this.getActiveContentData()
		const attemptId = this.beginOrReuseGenerationAttempt("image-generate", {
			elementId: this.data.id,
			...(contentId ? { contentId } : {}),
			generateImageRequest: requestWithId,
		})
		this.rerender()
		this.canvas.eventEmitter.emit({
			type: "element:image:generate-submit-started",
			data: { elementId: this.data.id },
		})

		try {
			// 发起图片生成请求
			const response =
				await this.canvas.magicConfigManager.config?.methods?.generateImage(requestWithId)
			this.applyGenerationTiming(requestWithId, response)

			if (
				!this.canvas.generationRuntimeManager.isCurrent(attemptId, this.data.id, contentId)
			) {
				return false
			}

			// 请求成功，确认元素仍存在并原子写入正式任务状态。
			const confirmed = this.canvas.generationAttemptCoordinator.confirmAttempt(attemptId, [
				{
					elementId: this.data.id,
					...(contentId ? { contentId } : {}),
					persistedPatch: this.buildContentElementPatch(contentId, {
						generateImageRequest: requestWithId,
						status: undefined,
						errorMessage: undefined,
					}),
				},
			])
			if (!confirmed) return false

			// 重置错误状态标记
			this.isErrorState = false

			// 检查画布中的所有 Image 元素并设置名称
			this.updateImageElementNames()

			// 创建 ossSrc Promise
			this.createOssSrcPromise()

			// 启动轮询检查结果
			this.pollingManager.start()

			this.clearGenerateRecoveryDraft(recoveryContent)

			// 触发重新渲染以清除错误状态显示
			this.rerender()

			return true
		} catch (error) {
			if (
				!this.canvas.generationRuntimeManager.isCurrent(attemptId, this.data.id, contentId)
			) {
				return false
			}
			this.isGenerating = false
			this.canvas.eventEmitter.emit({
				type: "element:image:generate-submit-failed",
				data: { elementId: this.data.id },
			})
			this.canvas.generationAttemptCoordinator.rejectAttempt(attemptId)
			this.saveGenerateRecoveryDraft(requestWithId, recoveryContent)
			return false
		}
	}

	/**
	 * 在当前元素内追加一次重新编辑/再次生成任务。
	 * 迁移后的 processing Content 追加只在生成确认后通过一次文档更新完成。
	 */
	private async generateImageContent(
		request: GenerateImageRequest,
		recoveryIntent: MediaEditIntent = "generate",
	): Promise<boolean> {
		const generateImage = this.canvas.magicConfigManager.config?.methods?.generateImage
		if (!generateImage) return false
		if (!request.model_id || !request.prompt?.trim()) return false

		const contentId = createContentId()
		const requestWithId: GenerateImageRequest = {
			...request,
			prompt: request.prompt.trim(),
			image_id: generateUUID(),
		}
		this.isGenerating = true
		this.isErrorState = false
		this.imageLoadFailureReason = null
		this.isRetryEditing = false
		const recoveryContent = this.getActiveContentData()

		const attemptId = this.beginOrReuseGenerationAttempt(
			"image-generate",
			{
				elementId: this.data.id,
				contentId,
				generateImageRequest: requestWithId,
			},
			{ allowConcurrent: true },
		)
		const rejectSubmission = (): false => {
			this.canvas.generationAttemptCoordinator.rejectAttempt(attemptId)
			this.isGenerating = false
			this.isErrorState = true
			this.imageLoadFailureReason = null
			this.saveGenerateRecoveryDraft(requestWithId, recoveryContent, recoveryIntent)
			this.rerenderWhenTransformIdle()
			return false
		}
		this.rerenderWhenTransformIdle()
		this.canvas.eventEmitter.emit({
			type: "element:image:generate-submit-started",
			data: { elementId: this.data.id },
		})

		try {
			const response = await generateImage(requestWithId)
			this.applyGenerationTiming(requestWithId, response)
			if (
				!this.canvas.generationRuntimeManager.isCurrent(attemptId, this.data.id, contentId)
			) {
				return rejectSubmission()
			}

			if (
				!this.commitImageContentAttempt(
					attemptId,
					contentId,
					requestWithId,
					GenerationStatus.Processing,
				)
			) {
				return rejectSubmission()
			}

			this.isGenerating = false
			this.clearGenerateRecoveryDraft(recoveryContent)
			this.pollingManager.start()
			this.rerenderWhenTransformIdle()
			return true
		} catch {
			if (
				!this.canvas.generationRuntimeManager.isCurrent(attemptId, this.data.id, contentId)
			) {
				return rejectSubmission()
			}
			const committed = this.commitImageContentAttempt(
				attemptId,
				contentId,
				requestWithId,
				GenerationStatus.Failed,
			)
			this.canvas.eventEmitter.emit({
				type: "element:image:generate-submit-failed",
				data: { elementId: this.data.id },
			})
			if (!committed) return rejectSubmission()
			this.isGenerating = false
			this.isErrorState = true
			this.imageLoadFailureReason = null
			this.saveGenerateRecoveryDraft(requestWithId, recoveryContent, recoveryIntent)
			this.rerenderWhenTransformIdle()
			return false
		}
	}

	/** 就地合并，让运行时占位和后续 DSL 持久化共用同一对任务时间。 */
	private applyGenerationTiming(
		request: GenerateImageRequest,
		response?: GenerateImageResponse,
	): void {
		const startedAt = response?.started_at
		if (typeof startedAt === "string" && startedAt) {
			request.start_time = startedAt
		}
		const expectedFinishedAt = response?.expected_finished_at
		if (typeof expectedFinishedAt === "string" && expectedFinishedAt) {
			request.expected_finished_at = expectedFinishedAt
		}
	}

	private commitImageContentAttempt(
		attemptId: string,
		contentId: string,
		request: GenerateImageRequest,
		status: GenerationStatus,
	): boolean {
		const current = this.canvas.elementManager.getElementData(this.data.id)
		if (!current || current.type !== ElementTypeEnum.Image) return false
		if (!isImageElementContent(current)) return false
		const currentElement = current
		const next = appendImageContent(currentElement, {
			contentId,
			generateImageRequest: request,
			status,
		})
		try {
			const committed = this.canvas.generationAttemptCoordinator.confirmAttempt(attemptId, [
				{
					elementId: this.data.id,
					contentId,
					persistedPatch: {
						contents: next.contents,
						// A successfully submitted generation becomes the active version so
						// "再次生成"/"重新编辑" immediately show the newly created Content.
						// Failed submissions are persisted for recovery, but must not replace
						// the currently visible version.
						activeContentId:
							status === GenerationStatus.Processing
								? contentId
								: currentElement.activeContentId,
						mainContentId: next.mainContentId,
					},
				},
			])
			return committed
		} catch {
			return false
		}
	}

	/**
	 * 发起高清图片生成请求
	 * @param request 请求参数
	 * @returns 请求是否成功发起
	 */
	async generateHightImage(
		request: GenerateHightImageRequest,
		options?: { attemptId?: string },
	): Promise<boolean> {
		if (!this.canvas.magicConfigManager.config?.methods?.generateHightImage) {
			return false
		}
		const contentId = getActiveImageContentId(this.data)

		const currentAttempt = this.canvas.generationRuntimeManager.getTargetState(
			this.data.id,
			contentId,
		)
		if (currentAttempt && currentAttempt.attemptId !== options?.attemptId) {
			return false
		}

		// 检查必要参数
		if (!request.file_path || !request.size) {
			return false
		}

		// 生成新的 image_id 并添加到请求中
		const requestWithId: GenerateHightImageRequest = {
			...request,
			image_id: request.image_id || generateUUID(),
		}

		this.isGenerating = true
		this.imageLoadFailureReason = null
		const attemptId = this.beginOrReuseGenerationAttempt("image-high", {
			elementId: this.data.id,
			...(contentId ? { contentId } : {}),
			imageGenerationTaskMeta: createHighImageTaskMeta(requestWithId),
		})

		try {
			// 发起高清图片生成请求
			await this.canvas.magicConfigManager.config?.methods?.generateHightImage(requestWithId)
			if (
				!this.canvas.generationRuntimeManager.isCurrent(attemptId, this.data.id, contentId)
			) {
				return false
			}

			// 请求成功，保存请求参数到元素，并清除错误状态
			const confirmed = this.canvas.generationAttemptCoordinator.confirmAttempt(attemptId, [
				{
					elementId: this.data.id,
					...(contentId ? { contentId } : {}),
					persistedPatch: this.buildContentElementPatch(contentId, {
						imageGenerationTaskMeta: createHighImageTaskMeta(requestWithId),
						status: undefined,
						errorMessage: undefined,
					}),
				},
			])
			if (!confirmed) return false

			// 重置错误状态标记
			this.isErrorState = false

			// 创建 ossSrc Promise
			this.createOssSrcPromise()

			// 启动轮询检查结果
			this.pollingManager.start()

			// 触发重新渲染以清除错误状态显示
			this.rerender()

			return true
		} catch (error) {
			if (
				!this.canvas.generationRuntimeManager.isCurrent(attemptId, this.data.id, contentId)
			) {
				return false
			}
			this.isGenerating = false
			this.canvas.eventEmitter.emit({
				type: "element:image:generate-submit-failed",
				data: { elementId: this.data.id },
			})
			this.canvas.generationAttemptCoordinator.rejectAttempt(attemptId)
			return false
		}
	}

	/**
	 * 发起去背景请求
	 * @param request 请求参数
	 * @returns 请求是否成功发起
	 */
	async removeBackground(
		request: RemoveBackgroundRequest,
		options?: { attemptId?: string },
	): Promise<boolean> {
		if (!this.canvas.magicConfigManager.config?.methods?.removeBackground) {
			return false
		}
		const contentId = getActiveImageContentId(this.data)

		const currentAttempt = this.canvas.generationRuntimeManager.getTargetState(
			this.data.id,
			contentId,
		)
		if (currentAttempt && currentAttempt.attemptId !== options?.attemptId) {
			return false
		}

		if (!request.file_path) {
			return false
		}

		const requestWithId: RemoveBackgroundRequest = {
			...request,
			image_id: request.image_id || generateUUID(),
		}

		this.isGenerating = true
		this.isErrorState = false
		this.imageLoadFailureReason = null
		const attemptId = this.beginOrReuseGenerationAttempt("image-remove-background", {
			elementId: this.data.id,
			...(contentId ? { contentId } : {}),
			imageGenerationTaskMeta: createRemoveBackgroundTaskMeta(requestWithId),
		})
		this.rerender()

		try {
			await this.canvas.magicConfigManager.config?.methods?.removeBackground(requestWithId)
			if (
				!this.canvas.generationRuntimeManager.isCurrent(attemptId, this.data.id, contentId)
			) {
				return false
			}

			const confirmed = this.canvas.generationAttemptCoordinator.confirmAttempt(attemptId, [
				{
					elementId: this.data.id,
					...(contentId ? { contentId } : {}),
					persistedPatch: this.buildContentElementPatch(contentId, {
						imageGenerationTaskMeta: createRemoveBackgroundTaskMeta(requestWithId),
						status: undefined,
						errorMessage: undefined,
					}),
				},
			])
			if (!confirmed) return false

			this.isErrorState = false
			this.createOssSrcPromise()
			this.pollingManager.start()
			this.rerender()

			return true
		} catch (error) {
			if (
				!this.canvas.generationRuntimeManager.isCurrent(attemptId, this.data.id, contentId)
			) {
				return false
			}
			this.isGenerating = false
			this.canvas.generationAttemptCoordinator.rejectAttempt(attemptId)
			return false
		}
	}

	/**
	 * 发起橡皮擦除请求
	 * @param request 请求参数
	 * @returns 请求是否成功发起
	 */
	async eraser(request: EraserRequest, options?: { attemptId?: string }): Promise<boolean> {
		if (!this.canvas.magicConfigManager.config?.methods?.eraser) {
			return false
		}
		const contentId = getActiveImageContentId(this.data)

		const currentAttempt = this.canvas.generationRuntimeManager.getTargetState(
			this.data.id,
			contentId,
		)
		if (currentAttempt && currentAttempt.attemptId !== options?.attemptId) {
			return false
		}

		if (!request.file_path || !request.mark_path) {
			return false
		}

		const requestWithId: EraserRequest = {
			...request,
			image_id: request.image_id || generateUUID(),
		}

		this.isGenerating = true
		this.isErrorState = false
		this.imageLoadFailureReason = null
		const attemptId = this.beginOrReuseGenerationAttempt("image-eraser", {
			elementId: this.data.id,
			...(contentId ? { contentId } : {}),
			imageGenerationTaskMeta: createEraserTaskMeta(requestWithId),
		})
		this.rerender()

		try {
			await this.canvas.magicConfigManager.config?.methods?.eraser(requestWithId)
			if (
				!this.canvas.generationRuntimeManager.isCurrent(attemptId, this.data.id, contentId)
			) {
				return false
			}

			const confirmed = this.canvas.generationAttemptCoordinator.confirmAttempt(attemptId, [
				{
					elementId: this.data.id,
					...(contentId ? { contentId } : {}),
					persistedPatch: this.buildContentElementPatch(contentId, {
						imageGenerationTaskMeta: createEraserTaskMeta(requestWithId),
						status: undefined,
						errorMessage: undefined,
					}),
				},
			])
			if (!confirmed) return false

			this.isErrorState = false
			this.createOssSrcPromise()
			this.pollingManager.start()
			this.rerender()

			return true
		} catch (error) {
			if (
				!this.canvas.generationRuntimeManager.isCurrent(attemptId, this.data.id, contentId)
			) {
				return false
			}
			this.isGenerating = false
			this.canvas.generationAttemptCoordinator.rejectAttempt(attemptId)
			return false
		}
	}

	/**
	 * 发起扩图请求
	 * @param request 请求参数
	 * @returns 请求是否成功发起
	 */
	async expandImage(
		request: GenerateExtendedImageRequest,
		options?: { attemptId?: string },
	): Promise<boolean> {
		if (!this.canvas.magicConfigManager.config?.methods?.expandImage) {
			return false
		}
		const contentId = getActiveImageContentId(this.data)

		const currentAttempt = this.canvas.generationRuntimeManager.getTargetState(
			this.data.id,
			contentId,
		)
		if (currentAttempt && currentAttempt.attemptId !== options?.attemptId) {
			return false
		}

		if (!request.file_path || !request.canvas_path || !request.mask_path || !request.size) {
			return false
		}

		const requestWithId: GenerateExtendedImageRequest = {
			...request,
			image_id: request.image_id || generateUUID(),
		}

		this.isGenerating = true
		this.isErrorState = false
		this.imageLoadFailureReason = null
		const attemptId = this.beginOrReuseGenerationAttempt("image-extend", {
			elementId: this.data.id,
			...(contentId ? { contentId } : {}),
			imageGenerationTaskMeta: createExpandImageTaskMeta(requestWithId),
		})
		this.rerender()

		try {
			await this.canvas.magicConfigManager.config?.methods?.expandImage(requestWithId)
			if (
				!this.canvas.generationRuntimeManager.isCurrent(attemptId, this.data.id, contentId)
			) {
				return false
			}

			const confirmed = this.canvas.generationAttemptCoordinator.confirmAttempt(attemptId, [
				{
					elementId: this.data.id,
					...(contentId ? { contentId } : {}),
					persistedPatch: this.buildContentElementPatch(contentId, {
						imageGenerationTaskMeta: createExpandImageTaskMeta(requestWithId),
						status: undefined,
						errorMessage: undefined,
					}),
				},
			])
			if (!confirmed) return false

			this.isErrorState = false
			this.createOssSrcPromise()
			this.pollingManager.start()
			this.rerender()

			return true
		} catch (error) {
			if (
				!this.canvas.generationRuntimeManager.isCurrent(attemptId, this.data.id, contentId)
			) {
				return false
			}
			this.isGenerating = false
			this.canvas.generationAttemptCoordinator.rejectAttempt(attemptId)
			return false
		}
	}

	private getImageGenerationTaskMeta(): ImageGenerationTaskMeta | undefined {
		return this.getActiveContentData().imageGenerationTaskMeta
	}

	private getActiveImageGenerationTaskMeta(): ImageGenerationTaskMeta | undefined {
		const activeContentId = this.getActiveContentData().contentId
		const runtimeTarget = activeContentId
			? this.canvas?.generationRuntimeManager?.getTargetState(this.data.id, activeContentId)
			: this.canvas?.generationRuntimeManager?.getTargetState(this.data.id)
		return runtimeTarget?.imageGenerationTaskMeta || this.getImageGenerationTaskMeta()
	}

	private beginOrReuseGenerationAttempt(
		operation: GenerationOperation,
		target: GenerationAttemptTarget,
		options?: { allowConcurrent?: boolean },
	): string {
		const runtimeManager = this.canvas.generationRuntimeManager
		const current = runtimeManager.getTargetState(this.data.id, target.contentId)
		if (!options?.allowConcurrent && current?.operation === operation) {
			runtimeManager.updateAttemptPhase(current.attemptId, "submitting")
			return current.attemptId
		}

		const isGenerationPlaceholder =
			this.canvas.elementManager.getTemporaryElementMetadata(this.data.id)?.kind ===
			"generation-result"
		const failurePolicy = isGenerationPlaceholder
			? operation === "image-generate"
				? "promote-empty"
				: "remove-placeholder"
			: "restore-existing"

		return runtimeManager.beginAttempt({
			operation,
			originElementId: this.data.id,
			targets: [target],
			phase: "submitting",
			failurePolicy,
		})
	}

	/**
	 * 获取图片生成状态
	 */
	isImageGenerating(contentId?: string): boolean {
		if (contentId !== undefined) {
			const content = getImageContentById(this.data, contentId)
			return Boolean(
				this.hasActiveGeneration(contentId) ||
				(content && isContentGenerationPending(content)),
			)
		}

		return this.hasActiveGeneration() || hasProcessingImageContent(this.data)
	}

	private hasActiveGeneration(contentId?: string): boolean {
		return (
			this.canvas?.generationRuntimeManager?.hasActiveGeneration?.(this.data.id, contentId) ??
			this.isGenerating
		)
	}

	/** 返回当前用于运行时展示的请求；未确认请求不会进入 DSL。 */
	public getActiveGenerateImageRequest(): GenerateImageRequest | undefined {
		const activeContentId = this.getActiveContentData().contentId
		const runtimeTarget = activeContentId
			? this.canvas?.generationRuntimeManager?.getTargetState(this.data.id, activeContentId)
			: this.canvas?.generationRuntimeManager?.getTargetState(this.data.id)
		return (
			runtimeTarget?.generateImageRequest || this.getActiveContentData().generateImageRequest
		)
	}

	/**
	 * 创建 ossSrc Promise（用于等待 ossSrc 换取完成）
	 */
	public createOssSrcPromise(): void {
		// 如果已经有 Promise，不重复创建
		if (this.ossSrcPromise) {
			return
		}

		this.ossSrcPromise = new Promise<string>((resolve, reject) => {
			this.ossSrcResolve = resolve
			this.ossSrcReject = reject
		})
	}

	/**
	 * 设置 ossSrc（公开方法，供外部调用）
	 * 会触发 ossSrcResolve 并启动预加载
	 */
	public setOssSrc(ossSrc: string): void {
		this.storedOssSrc = ossSrc
		this.imageLoadFailureReason = null
		this.isErrorState = false
		this.lastAppliedLoadFailureSignature = null

		// resolve ossSrc Promise
		if (this.ossSrcResolve) {
			this.ossSrcResolve(ossSrc)
			this.ossSrcResolve = undefined
			this.ossSrcReject = undefined
			this.ossSrcPromise = undefined
		}
		// ossSrc 已获取，如果 src 存在则预加载图片
		if (this.getActiveContentData().src) {
			this.preloadImageInternal()
		}

		// 触发 ossSrcReady 事件
		this.canvas.eventEmitter.emit({
			type: "element:image:ossSrcReady",
			data: { elementId: this.data.id },
		})
		this.rerenderWhenTransformIdle()
	}

	/**
	 * 从 resource:image:loaded 事件应用资源
	 */
	public applyPresentedResource(
		resource: LoadedResource,
		targetVariant: ImageResourceVariant,
	): boolean {
		this.targetDisplayResourceVariant = targetVariant
		if (resource.variant === "full" && !resource.isFullSize) {
			this.applyResourceMetadata(resource)
			this.commitImageResourceReconcile({
				type: "metadata-only",
				reason: "non-fullsize-full",
			})
			return false
		}

		const shouldApply = this.shouldApplyResourceToView(resource)
		if (!shouldApply) {
			this.applyResourceMetadata(resource)
			this.commitImageResourceReconcile({
				type: "metadata-only",
				reason: "view-priority-blocked",
			})
			return false
		}
		if (this.loadedImage === resource.image && this.loadedImageVariant === resource.variant) {
			this.applyResourceMetadata(resource)
			return false
		}

		const wasErrorState = this.isErrorState
		this.applyResourceToView(resource)
		this.imageLoadFailureReason = null
		this.isErrorState = false
		this.lastAppliedLoadFailureSignature = null
		const patchResult = this.patchMountedImageContentNodeWithLoadedResource()
		if ((resource.variant === "preview" || resource.variant === "full") && this.ossSrcResolve) {
			this.ossSrcResolve(resource.ossSrc)
			this.ossSrcResolve = undefined
			this.ossSrcReject = undefined
			this.ossSrcPromise = undefined
		}

		if (resource.variant === "preview" || resource.variant === "full") {
			this.canvas.eventEmitter.emit({
				type: "element:image:ossSrcReady",
				data: { elementId: this.data.id },
			})
		}

		const reconcileResult = wasErrorState
			? this.requireImageResourceStructure("error-to-image")
			: patchResult
		this.commitImageResourceReconcile(reconcileResult)
		return (
			reconcileResult.type === "patched-content" ||
			reconcileResult.type === "structure-required"
		)
	}

	/**
	 * 处理图片加载失败的逻辑
	 */
	private handleImageLoadFailure(): void {
		const currentFailureSignature = `${this.getActiveContentData().src || ""}:${
			this.imageLoadFailureReason || "load-error"
		}`
		const isSameFailureAsLastApplied =
			this.lastAppliedLoadFailureSignature === currentFailureSignature
		const isStableErrorState = this.isErrorState && !this.isResourceLoading

		this.clearLoadedImageReference()
		this.isResourceLoading = false
		this.imageLoadFailureReason = this.imageLoadFailureReason ?? "load-error"
		this.isErrorState = true
		this.lastAppliedLoadFailureSignature = currentFailureSignature
		this.patchMountedImageContentNodeWithLoadedResource()

		if (isSameFailureAsLastApplied && isStableErrorState) {
			return
		}

		this.commitImageResourceReconcile(this.requireImageResourceStructure("resource-failed"))
	}

	private getResourceReplacementBeforeClose(
		closingImage: ImageSource,
		closingVariant: ImageResourceVariant,
	): LoadedResource | null {
		if (!this.getActiveContentData().src) return null

		const targetVariant =
			this.targetDisplayResourceVariant ??
			(closingVariant === "full" ? "preview" : closingVariant)
		const candidates = [
			targetVariant,
			closingVariant,
			...this.getDisplayTargetFallbackVariants(targetVariant),
			"preview",
			"low",
		] satisfies ImageResourceVariant[]
		const visited = new Set<ImageResourceVariant>()

		for (const variant of candidates) {
			if (variant === "full" || visited.has(variant)) continue
			visited.add(variant)
			const resource = this.peekExactResourceVariant(variant)
			if (resource && resource.image !== closingImage) {
				return resource
			}
		}

		return null
	}

	private handleImageSourceWillClose(
		closingImage: ImageSource,
		closingVariant: ImageResourceVariant,
	): void {
		if (this.loadedImage !== closingImage) return

		const wasErrorState = this.isErrorState
		const replacementResource = this.getResourceReplacementBeforeClose(
			closingImage,
			closingVariant,
		)
		if (replacementResource) {
			this.applyResourceToView(replacementResource)
		} else {
			this.clearLoadedImageReference()
		}

		this.isResourceLoading = false
		this.isErrorState = false
		this.imageLoadFailureReason = null
		const patchResult = this.patchMountedImageContentNodeWithLoadedResource()
		this.commitImageResourceReconcile(
			!replacementResource || wasErrorState
				? this.requireImageResourceStructure(
						wasErrorState ? "error-to-image" : "cleared-image-node",
					)
				: patchResult,
		)
		if (patchResult.type === "patched-content") {
			this.canvas.runtimeScheduler.requestLayerDraw("content", {
				source: "ImageElement",
				reason: "resource-will-close",
			})
		}
	}

	private getImageLoadErrorText(): string {
		const src = this.getActiveContentData().src
		const failureReason =
			this.imageLoadFailureReason ??
			(src ? this.canvas?.imageResourceManager?.getFailureReason?.(src) : null)

		if (failureReason === "not-found") {
			return this.getText("image.fileMissing", "图片文件不存在")
		}

		return this.getText("image.loadError", "图片加载失败")
	}

	/** 监听必须同步处理的资源失败与 decoded surface 释放事件。 */
	private setupResourceLoadedListener(): void {
		this.removeResourceLoadedListener()
		const activeSrc = this.getActiveContentData().src
		if (!activeSrc) return

		const path = activeSrc
		const isCurrentResourcePath = (resourcePath: string): boolean =>
			areCanvasHostResourceReferencesSame(this.canvas, resourcePath, path)

		this.resourceLoadFailedHandler = ({ data }) => {
			if (isCurrentResourcePath(data.path)) {
				this.imageLoadFailureReason = data.reason ?? "load-error"
				if (data.preservePreview && this.loadedImage) {
					this.isResourceLoading = false
					this.isErrorState = false
					this.canvas.visibilityManager.invalidateImageLoadRequest(
						data.path,
						undefined,
						"refresh-failed",
						{ scheduleRefresh: false },
					)
					return
				}
				this.handleImageLoadFailure()
			}
		}
		this.resourceWillCloseHandler = ({ data }) => {
			this.handleImageSourceWillClose(data.image, data.variant)
		}
		this.resourceRecoveryStartedHandler = ({ data }) => {
			if (!isCurrentResourcePath(data.path)) return
			this.setOssSrc(data.ossSrc)
		}
		this.resourceSubscriptionCleanups = [
			this.canvas.imageResourceManager.onImageResourceWillClose(
				path,
				this.resourceWillCloseHandler,
			),
			this.canvas.imageResourceManager.onImageResourceLoadFailed(
				path,
				this.resourceLoadFailedHandler,
			),
			this.canvas.imageResourceManager.onImageResourceRecoveryStarted(
				path,
				this.resourceRecoveryStartedHandler,
			),
		]
	}

	/**
	 * 移除资源失败与 decoded surface 释放监听
	 */
	private removeResourceLoadedListener(): void {
		;(this.resourceSubscriptionCleanups ?? []).forEach((cleanup) => cleanup())
		this.resourceSubscriptionCleanups = []
		this.resourceLoadFailedHandler = undefined
		this.resourceRecoveryStartedHandler = undefined
		this.resourceWillCloseHandler = undefined
	}

	/**
	 * 获取图片信息（公开方法，供外部调用）
	 * @returns 图片信息，如果图片未加载则返回 undefined
	 */
	public getImageInfo(): ImageInfo | undefined {
		return this.storedImageInfo
	}

	/** 图片是否已加载完成 */
	public isImageLoaded(): boolean {
		return !!this.loadedImage
	}

	/**
	 * 预加载图片
	 * 当获取到 ossSrc 时调用，预先加载图片并在加载完成后触发重新渲染
	 * 使用 ImageResourceManager 统一管理资源，确保 render 和剪贴板使用同一个 Image 对象
	 */
	private preloadImageInternal(): void {
		const src = this.getActiveContentData().src
		if (!src) {
			return
		}

		// 如果已加载完成，不重复加载
		if (this.loadedImage) {
			return
		}

		// 使用 ImageResourceManager 加载图片（通过 resource:image:loaded 事件获取完成通知）
		this.isResourceLoading = true
		this.canvas.imageResourceManager.loadResource(src, {
			variant: "preview",
			priority: "visible",
		})
	}

	/**
	 * 更新当前 Image 元素的名称（Image 1, Image 2, ...）
	 */
	private updateImageElementNames(): void {
		const currentElement = this.canvas.elementManager.getElementData(this.data.id)

		if (!currentElement || !!currentElement.name) return

		// 获取所有顶层元素
		const allElements = this.canvas.elementManager.getAllElements()

		// 收集所有 Image 类型的元素（包括子元素）
		const imageElements = collectElementsByType(allElements, ElementTypeEnum.Image)

		// 按照 zIndex 降序排序（zIndex 大的在前面）
		imageElements.sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0))

		// 找到当前元素在列表中的索引
		const currentIndex = imageElements.findIndex((element) => element.id === this.data.id)

		if (currentIndex !== -1) {
			// 只为当前元素设置名称
			const newName = this.canvas.t
				? this.canvas.t("image.nameWithIndex", {
						defaultValue: "Image {{index}}",
						index: currentIndex + 1,
					})
				: `Image ${currentIndex + 1}`

			if (currentElement.name !== newName) {
				this.canvas.elementManager.update(
					this.data.id,
					{
						name: newName,
					},
					{ silent: false },
				)
			}
		}
	}

	/**
	 * 预加载图片（公开方法，供外部调用）
	 */
	public preloadImage(): void {
		this.preloadImageInternal()
	}

	private isLoadedImageFullSize(): boolean {
		if (!this.loadedImage || !this.storedImageInfo) return false
		const sourceWidth = this.loadedImageSourceWidth
		const sourceHeight = this.loadedImageSourceHeight
		if (!sourceWidth || !sourceHeight) return false
		return (
			Math.abs(sourceWidth - this.storedImageInfo.naturalWidth) <= 1 &&
			Math.abs(sourceHeight - this.storedImageInfo.naturalHeight) <= 1
		)
	}

	private canUseLoadedImageForVariant(variant: ImageResourceVariant): boolean {
		if (!this.loadedImage) return false
		if (variant === "low") return true
		if (variant === "preview") {
			return (
				this.loadedImageVariant === "preview" ||
				this.loadedImageVariant === "full" ||
				this.isLoadedImageFullSize()
			)
		}
		return this.loadedImageVariant === "full" || this.isLoadedImageFullSize()
	}

	/**
	 * 检查图片是否满足生成条件（正在生成中或等待生成结果）
	 */
	private isImageGenerationPending(): boolean {
		const activeContent = this.getActiveContentData()
		if (this.hasActiveGeneration(activeContent.contentId)) {
			return true
		}

		// 只有仍带任务 id 的请求才代表当前有生成轮询；无 id 的请求仅用于信息展示。
		const hasActiveGenerationTask = this.hasActiveImageGenerationTask()
		const hasSrc = !!activeContent.src
		const status = activeContent.status

		// 情况1: 有生成任务但还没有 src
		if ((hasActiveGenerationTask || this.isActiveGenerationPlaceholder()) && !hasSrc) {
			return true
		}

		// 情况2: 有 src 但状态是 pending 或 processing
		if (
			hasSrc &&
			(status === GenerationStatus.Pending || status === GenerationStatus.Processing)
		) {
			return true
		}

		// 情况3: 有 src 但还没有 ossSrc（正在换取中）
		if (hasSrc && activeContent.src && !this.storedOssSrc) {
			return true
		}

		return false
	}

	/**
	 * 获取可绘制图片源（ImageBitmap | HTMLImageElement）
	 * 该方法使用 ImageResourceManager 管理资源，避免重复加载
	 * 如果图片正在生成中，会等待生成完成 + ossSrc 换取完成 + 图片加载完成
	 * @returns Promise<ImageSource | null> - 成功返回图片对象，失败返回 null
	 */
	public async getHTMLImageElement(options?: {
		variant?: ImageResourceVariant
		applyToView?: boolean
	}): Promise<ImageSource | null> {
		const variant = options?.variant ?? "full"
		const applyToView = options?.applyToView ?? variant !== "full"

		// 如果 loadedImage 已加载，直接返回
		if (this.canUseLoadedImageForVariant(variant) && this.loadedImage) {
			return this.loadedImage
		}

		// 检查图片是否正在生成中或等待结果
		if (this.isImageGenerationPending()) {
			// 如果还没有 ossSrcPromise，创建一个
			if (!this.ossSrcPromise) {
				this.createOssSrcPromise()
			}

			// 等待 ossSrc 就绪（包括生成完成 + 换取完成）
			try {
				await this.ossSrcPromise
				// 如果图片已经加载完成
				if (this.canUseLoadedImageForVariant(variant) && this.loadedImage) {
					return this.loadedImage
				}
			} catch (error) {
				// 生成失败，返回 null
				return null
			}
		}

		// 使用 getResource 加载并获取图片
		const src = this.getActiveContentData().src
		if (!src) return null

		try {
			const resource = await this.canvas.imageResourceManager.getResource(src, { variant })
			if (resource) {
				if (applyToView) {
					this.applyResourceToView(resource)
				} else {
					this.applyResourceMetadata(resource)
				}
				return resource.image
			}
			return null
		} catch (error) {
			return null
		}
	}

	public async getFullHTMLImageElement(options?: {
		variant?: ImageResourceVariant
		applyToView?: boolean
	}): Promise<{ image: ImageSource } | null> {
		const variant = options?.variant ?? "full"
		const applyToView = options?.applyToView ?? variant !== "full"

		if (variant !== "full") {
			const image = await this.getHTMLImageElement({ variant, applyToView })
			return image ? { image } : null
		}

		if (this.canUseLoadedImageForVariant(variant) && this.loadedImage) {
			return { image: this.loadedImage }
		}

		if (this.isImageGenerationPending()) {
			if (!this.ossSrcPromise) {
				this.createOssSrcPromise()
			}

			try {
				await this.ossSrcPromise
				if (this.canUseLoadedImageForVariant(variant) && this.loadedImage) {
					return { image: this.loadedImage }
				}
			} catch (error) {
				return null
			}
		}

		const src = this.getActiveContentData().src
		if (!src) return null

		try {
			const resource = await this.canvas.imageResourceManager.getResource(src, { variant })
			if (!resource) return null

			if (applyToView) {
				this.applyResourceToView(resource)
			} else {
				this.applyResourceMetadata(resource)
			}

			return {
				image: resource.image,
			}
		} catch (error) {
			return null
		}
	}

	/**
	 * 获取图片源的尺寸
	 * @param image - 图片源
	 * @returns 图片源的尺寸
	 */
	private getSourceDimensions(image?: ImageSource): { width: number; height: number } {
		if (this.storedImageInfo?.naturalWidth && this.storedImageInfo?.naturalHeight) {
			return {
				width: this.storedImageInfo.naturalWidth,
				height: this.storedImageInfo.naturalHeight,
			}
		}

		if (image) {
			return getImageSourceDimensions(image)
		}

		return {
			width: this.data.width ?? 0,
			height: this.data.height ?? 0,
		}
	}

	/**
	 * 获取图片源的裁剪区域
	 * @param image - 图片源
	 * @returns 图片源的裁剪区域
	 */
	private getSourceCrop(image?: ImageSource) {
		const sourceDimensions = this.getSourceDimensions(image)
		const crop = getPersistedSourceCrop(this.getActiveContentData().crop, sourceDimensions)
		if (crop.width <= 0 || crop.height <= 0) {
			return undefined
		}

		if (!image) {
			return crop
		}

		const actualDimensions = getImageSourceDimensions(image)
		if (
			sourceDimensions.width <= 0 ||
			sourceDimensions.height <= 0 ||
			actualDimensions.width <= 0 ||
			actualDimensions.height <= 0
		) {
			return crop
		}

		const scaleX = actualDimensions.width / sourceDimensions.width
		const scaleY = actualDimensions.height / sourceDimensions.height
		if (Math.abs(scaleX - 1) <= 0.001 && Math.abs(scaleY - 1) <= 0.001) {
			return crop
		}

		return {
			x: crop.x * scaleX,
			y: crop.y * scaleY,
			width: crop.width * scaleX,
			height: crop.height * scaleY,
		}
	}

	/** 比较持久化 crop 是否一致（用于判断是否需要整节点重渲染） */
	private isPersistedCropConfigEqual(
		a: CropConfig | undefined,
		b: CropConfig | undefined,
	): boolean {
		if (a === b) return true
		if (a === undefined || b === undefined) return false
		return (
			a.x === b.x &&
			a.y === b.y &&
			a.width === b.width &&
			a.height === b.height &&
			a.displayWidth === b.displayWidth &&
			a.displayHeight === b.displayHeight
		)
	}

	/**
	 * 将元素渲染到Canvas上下文
	 * @param ctx - Canvas 2D渲染上下文
	 * @param offsetX - 元素在Canvas中的X偏移量
	 * @param offsetY - 元素在Canvas中的Y偏移量
	 * @param options - 可选参数
	 * @param options.shouldDrawBorder - 是否绘制边框（默认 false）
	 * @param options.width - 可选的渲染宽度，如果提供则使用此宽度而非元素实际宽度
	 * @param options.height - 可选的渲染高度，如果提供则使用此高度而非元素实际高度
	 * @returns Promise<boolean> - 渲染是否成功
	 */
	public override async renderToCanvas(
		ctx: CanvasRenderingContext2D,
		offsetX: number,
		offsetY: number,
		options?: { shouldDrawBorder?: boolean; width?: number; height?: number },
	): Promise<boolean> {
		try {
			// 获取图片元素
			const fullImage = await this.getFullHTMLImageElement({ variant: "full" })
			const img = fullImage?.image
			if (!img) {
				return false
			}

			// 计算元素的实际尺寸（考虑 scaleX/scaleY）
			const width = this.data.width || 0
			const height = this.data.height || 0
			const scaleX = this.data.scaleX ?? 1
			const scaleY = this.data.scaleY ?? 1

			const actualWidth = width * scaleX
			const actualHeight = height * scaleY

			// 如果提供了可选的宽高，则使用提供的宽高
			const renderWidth = options?.width ?? actualWidth
			const renderHeight = options?.height ?? actualHeight

			if (renderWidth <= 0 || renderHeight <= 0) {
				return false
			}

			const crop = this.getSourceCrop(img)

			if (crop) {
				ctx.drawImage(
					img,
					crop.x,
					crop.y,
					crop.width,
					crop.height,
					offsetX,
					offsetY,
					renderWidth,
					renderHeight,
				)
			} else {
				ctx.drawImage(img, offsetX, offsetY, renderWidth, renderHeight)
			}

			// 如果需要绘制边框
			if (options?.shouldDrawBorder) {
				ctx.save()
				ctx.strokeStyle = DECORATOR_COLORS.BORDER_DEFAULT
				ctx.lineWidth = DECORATOR_CONFIG.BORDER_WIDTH
				ctx.strokeRect(offsetX, offsetY, renderWidth, renderHeight)
				ctx.restore()
			}

			return true
		} catch (error) {
			return false
		}
	}

	/**
	 * 获取图片默认配置
	 * @param width 可选的宽度，如果不提供则使用默认值
	 * @param height 可选的高度，如果不提供则使用默认值
	 */
	static getDefaultConfig(width?: number, height?: number) {
		return {
			width: width ?? IMAGE_CONFIG.DEFAULT_WIDTH,
			height: height ?? IMAGE_CONFIG.DEFAULT_HEIGHT,
		}
	}

	/**
	 * 获取渲染名称（用于显示的默认名称，支持多语言）
	 */
	public getRenderName(): string {
		// 与音频名称展示一致：已存在图片但元素未命名时，使用真实文件名，空占位保留默认名称。
		const fileName = getCanvasResourceFileName(this.getActiveContentData().src)
		const baseName = fileName.replace(/\.[^/.]+$/, "")
		return baseName || this.getText("image.defaultName", "图片生成器")
	}

	/** 标题可省略，状态独立保留；所有名称展示入口仍来自同一展示状态。 */
	public override getNameLabelText(): string {
		const content = this.getNameLabelContent()
		const suffix = content.suffix?.text ?? ""
		return `${content.primaryText}${suffix ? (suffix.startsWith("(") ? suffix : `(${suffix})`) : ""}`
	}

	public override getNameLabelContent(): NameLabelContent {
		const baseName = this.data.name || this.getRenderName()
		const displayState = this.getDisplayState()
		const withStatus = (text: string, inProgress = false): NameLabelContent => ({
			primaryText: baseName,
			suffix: { text, inProgress },
		})

		switch (displayState.status) {
			case "timed-out":
				return withStatus(this.getText("image.status.timedOut", "超时"))
			case "generating":
				return withStatus(this.getGeneratingNameSuffix(displayState), true)
			case "uploading":
				return withStatus(this.getText("image.status.uploading", "上传中"), true)
			case "failed":
				return displayState.failureSource === "resource"
					? { primaryText: baseName }
					: withStatus(this.getText("image.status.failed", "失败"))
			case "terminated":
				return withStatus(this.getText("image.status.terminated", "已终止"))
			default:
				return this.canvas.isSeedanceComplianceEnabled() &&
					resolveMediaComplianceStatus(this.canvas, this.getActiveContentData()) ===
						"PROCESSING"
					? {
							primaryText: baseName,
							suffix: {
								text: this.getText(
									"image.nameSuffix.complianceProcessing",
									"(校验中)",
								),
							},
						}
					: { primaryText: baseName }
		}
	}

	/**
	 * 重写边界计算方法（用于 Transformer）
	 * Image 元素应该使用固定的 width/height，而不是计算子节点边界
	 */
	protected override setupCustomBoundingRect(node: Konva.Group): void {
		if (!(node instanceof Konva.Group)) {
			return
		}

		// Image 元素使用固定尺寸，基于 Group 的 width/height
		node.getClientRect = (config?: Parameters<Konva.Node["getClientRect"]>[0]) => {
			const width = node.width()
			const height = node.height()
			const scaleX = node.scaleX()
			const scaleY = node.scaleY()

			// 创建一个临时的矩形节点来计算位置
			const tempRect = new Konva.Rect({
				x: 0,
				y: 0,
				width: width || 0,
				height: height || 0,
			})

			// 将临时矩形添加到 Group 中（临时）
			node.add(tempRect)
			const tempRectClientRect = tempRect.getClientRect(config)
			tempRect.destroy()

			return {
				x: tempRectClientRect.x,
				y: tempRectClientRect.y,
				width: width * scaleX,
				height: height * scaleY,
			}
		}
	}

	/**
	 * 重写边界计算，排除 info 按钮的影响
	 * 直接返回图片的实际尺寸，不考虑装饰性按钮
	 */
	public override getBoundingRect(): Rect | null {
		if (!this.node) return null

		// 获取相对于 layer 的位置
		const layer = this.node.getLayer()
		if (!layer) return null

		// 优先使用节点的实际尺寸
		let width = this.data.width || 0
		let height = this.data.height || 0

		if (this.node instanceof Konva.Group) {
			const groupWidth = this.node.width()
			const groupHeight = this.node.height()
			const scaleX = this.node.scaleX()
			const scaleY = this.node.scaleY()

			if (groupWidth !== undefined && groupHeight !== undefined) {
				width = groupWidth * scaleX
				height = groupHeight * scaleY
			}

			// 创建临时矩形来计算位置
			const tempRect = new Konva.Rect({
				x: 0,
				y: 0,
				width: groupWidth || this.data.width || width,
				height: groupHeight || this.data.height || height,
			})

			this.node.add(tempRect)
			const tempRectClientRect = tempRect.getClientRect({
				relativeTo: layer,
			})
			tempRect.destroy()

			return {
				x: tempRectClientRect.x,
				y: tempRectClientRect.y,
				width,
				height,
			}
		}

		// 如果不是 Group，使用默认方法
		const clientRect = this.node.getClientRect({
			relativeTo: layer,
		})

		return {
			x: clientRect.x,
			y: clientRect.y,
			width,
			height,
		}
	}

	private isReplacementUploadingActiveContent(): boolean {
		const replacementState = this.canvas?.mediaReplaceController?.getReplacementState?.(
			this.data.id,
		)
		return (
			replacementState?.source === "local-upload" &&
			replacementState.phase === "uploading" &&
			replacementState.contentId === this.getActiveContentData().contentId
		)
	}

	render(): Konva.Group | null {
		this.syncEffectiveContentRuntimeState()
		const displayState = this.getDisplayState()

		if (displayState.surface === "image") {
			return this.renderImage()
		}

		if (displayState.surface === "loading") {
			return this.renderLoadingPlaceholder(displayState)
		}

		if (displayState.surface === "error") {
			if (displayState.status === "timed-out") {
				return this.renderError(this.getText("image.timedOut", "生成已超时"))
			}
			// 终止态复用错误表面：语义是「用户已终止」，不能用生成失败的兜底文案。
			if (displayState.status === "terminated") {
				return this.renderError(this.getText("image.generateTerminated", "生图已终止"))
			}
			const errorMessage =
				displayState.failureSource === "resource"
					? this.getImageLoadErrorText()
					: resolveGenerationErrorMessage(
							displayState.errorMessage,
							this.getText("image.generateFailed", "图片生成失败"),
						)
			return this.renderError(errorMessage)
		}

		if (displayState.surface === "placeholder") {
			return displayState.status === "generating" || displayState.status === "uploading"
				? this.renderGeneratingPlaceholder(displayState)
				: this.renderEmptyPlaceholder()
		}

		return this.renderEmptyPlaceholder()
	}

	update(newData: ImageElementData): boolean {
		const currentDocumentActiveContentId = getActiveImageContentId(this.data)
		const nextDocumentActiveContentId = getActiveImageContentId(newData)
		const currentContent = this.getActiveContentData(this.data)
		const nextContent = this.getActiveContentData(newData)
		const currentTaskMeta = currentContent.imageGenerationTaskMeta
		const nextTaskMeta = nextContent.imageGenerationTaskMeta
		const contentControlsChanged =
			isImageElementContent(this.data) !== isImageElementContent(newData) ||
			(isImageElementContent(this.data) &&
				isImageElementContent(newData) &&
				(this.data.contents.length !== newData.contents.length ||
					this.data.mainContentId !== newData.mainContentId))
		const needsRerender =
			contentControlsChanged ||
			Boolean(currentContent.generateImageRequest) !==
				Boolean(nextContent.generateImageRequest) ||
			currentContent.contentId !== nextContent.contentId ||
			currentContent.generateImageRequest?.image_id !==
				nextContent.generateImageRequest?.image_id ||
			currentTaskMeta?.image_id !== nextTaskMeta?.image_id ||
			currentTaskMeta?.type !== nextTaskMeta?.type ||
			currentContent.src !== nextContent.src ||
			currentContent.status !== nextContent.status ||
			currentContent.discarded !== nextContent.discarded ||
			currentContent.generationTiming?.startedAt !==
				nextContent.generationTiming?.startedAt ||
			!this.isPersistedCropConfigEqual(currentContent.crop, nextContent.crop)

		// Effective Content 切换时，元素级 decoded image / failure reason 不能跨版本复用。
		// 只读预览切换不会改文档 activeContentId，但会改 effective Content。
		const contentChanged = currentContent.contentId !== nextContent.contentId
		const srcChanged = currentContent.src !== nextContent.src

		// 检查状态是否变为 failed
		const oldStatus = currentContent.status
		const newStatus = nextContent.status
		const statusChangedToFailed =
			oldStatus !== GenerationStatus.Failed && newStatus === GenerationStatus.Failed
		const generationSettled =
			!!nextContent.src ||
			newStatus === GenerationStatus.Completed ||
			newStatus === GenerationStatus.Failed

		this.data = newData
		if (
			currentDocumentActiveContentId &&
			nextDocumentActiveContentId &&
			currentDocumentActiveContentId !== nextDocumentActiveContentId
		) {
			// 所有 active Content 变更（含撤销/重做、远端合并与轮询完成）统一清理旧 Content Marker。
			this.canvas.markerManager.handleImageContentChanged(
				this.data.id,
				currentDocumentActiveContentId,
				nextDocumentActiveContentId,
			)
		}

		if (generationSettled) {
			this.isGenerating = false
		}

		// 如果 effective Content 或 src 变化，清理旧版本运行态并重新设置监听。
		if (contentChanged || srcChanged) {
			this.resetRuntimeStateForContentChange(nextContent, srcChanged)
		}
		this.effectiveContentId = nextContent.contentId
		this.effectiveContentSrc = nextContent.src

		// 如果状态变为 failed，reject ossSrcPromise
		if (statusChangedToFailed && this.ossSrcReject) {
			this.ossSrcReject(new Error(nextContent.errorMessage || "Image generation failed"))
			this.ossSrcResolve = undefined
			this.ossSrcReject = undefined
			this.ossSrcPromise = undefined
		}

		if (needsRerender) {
			this.ensureConsumerVisibilitySubscription()
			return true
		}

		// 更新基础属性
		if (this.node instanceof Konva.Group) {
			this.updateBaseProps(this.node, newData)

			// 更新内部节点的尺寸
			if (newData.width !== undefined && newData.height !== undefined) {
				this.syncImageLayout(newData.width, newData.height)
			}
		}

		return false
	}

	/**
	 * 渲染无状态占位符
	 */
	private renderEmptyPlaceholder(): Konva.Group {
		if (!this.data.width || !this.data.height) {
			throw new Error("Image element must have width and height")
		}

		const width = this.data.width
		const height = this.data.height
		const renderToken = this.renderToken

		// 重置状态标记
		this.isErrorState = false

		// 创建 Group 容器
		const group = new Konva.Group({
			width,
			height,
			clipFunc: (ctx) => {
				ctx.rect(0, 0, width, height)
			},
		})

		// 创建事件代理 hit 节点
		RenderUtils.createHitNode(group, width, height)

		// 异步加载背景和内容
		this.imageLoader.loadImage(imageBackgroundUnselected).then((backgroundImage) => {
			if (!this.isCurrentRender(group, renderToken)) return

			// 创建背景图片节点
			const backgroundNode = RenderUtils.createBackgroundImage(
				group,
				width,
				height,
				backgroundImage,
			)

			// 创建居中的图标和文本
			RenderUtils.createCenteredIconText(group, width, height, {
				text: this.getText("image.empty", "请发送生成图像的指令"),
				textColor: COLORS.EMPTY_TEXT,
				iconSrc: imageIcon,
				withBackground: false,
				t: this.canvas.t,
			}).then((contentGroup) => {
				if (!this.isCurrentRender(group, renderToken)) {
					contentGroup.destroy()
					return
				}

				this.contentGroup = contentGroup
			})

			// 创建边框
			this.createBorder(group, width, height, false, backgroundNode)
			this.createCornerActions(group, width, height)
			this.createMediaStatusTags(group, width, height)
		})

		this.finalizeNode(group)
		this.setupContentUpdateListener(group)
		return group
	}

	/**
	 * 渲染生成中或上传中状态占位符
	 */
	private renderGeneratingPlaceholder(displayState = this.getDisplayState()): Konva.Group {
		if (!this.data.width || !this.data.height) {
			throw new Error("Image element must have width and height")
		}

		const width = this.data.width
		const height = this.data.height
		const renderToken = this.renderToken

		// 标记为生成中状态
		this.isErrorState = false

		// 创建 Group 容器
		const group = new Konva.Group({
			width,
			height,
			clipFunc: (ctx) => {
				ctx.rect(0, 0, width, height)
			},
		})

		// 创建事件代理 hit 节点
		RenderUtils.createHitNode(group, width, height)

		const displayText =
			displayState.status === "generating"
				? this.getGeneratingPlaceholderText(displayState)
				: this.getText("image.uploading", "正在上传中...")
		const placeholderText =
			displayState.status === "generating"
				? `${displayText} ${IMAGE_CONFIG.PROGRESS_TEXT_PROBE}`
				: displayText

		// 异步加载背景和内容
		this.imageLoader.loadImage(imageBackgroundLoading).then((backgroundImage) => {
			if (!this.isCurrentRender(group, renderToken)) return

			// 创建背景图片节点
			RenderUtils.createBackgroundImage(group, width, height, backgroundImage)

			// 创建居中的图标和文本
			RenderUtils.createCenteredIconText(group, width, height, {
				text: placeholderText,
				textColor: COLORS.LOADING_TEXT,
				iconSrc: imageIcon,
				withBackground: true,
				t: this.canvas.t,
			}).then((contentGroup) => {
				if (!this.isCurrentRender(group, renderToken)) {
					contentGroup.destroy()
					return
				}

				this.contentGroup = contentGroup
				if (displayState.status === "generating") {
					this.attachGenerationProgress(group, contentGroup, displayText, renderToken)
				}
			})

			this.createBorder(group, width, height, true)
			this.createCornerActions(group, width, height)
			this.createMediaStatusTags(group, width, height)
		})

		this.finalizeNode(group)
		this.setupContentUpdateListener(group)
		return group
	}

	/** 缓存后端任务时间回写前的本地兜底起点。 */
	private resolveGenerationStartedAt(contentId: string): number {
		if (this.generationProgressAnchor?.contentId === contentId) {
			return this.generationProgressAnchor.startedAtMs
		}

		const startedAtMs = Date.now()
		this.generationProgressAnchor = { contentId, startedAtMs }
		return startedAtMs
	}

	/** 每秒更新占位文本；胶囊宽度由初始 100% 文本固定。 */
	private attachGenerationProgress(
		group: Konva.Group,
		contentGroup: Konva.Group,
		displayText: string,
		renderToken: number,
	): void {
		const contentId = this.getActiveContentData().contentId
		const textNode = contentGroup.findOne<Konva.Text>(".placeholder-text")
		if (!contentId || !textNode) {
			return
		}
		if (this.consumerVisibility === "far") {
			this.stopGenerationProgress()
			return
		}

		const startedAtMs = this.resolveGenerationStartedAt(contentId)
		const applyProgress = () => {
			// Visibility culling and rerendering both replace the Konva node. Stop the
			// element-local timer before it can keep updating a detached text node.
			if (!this.isCurrentRender(group, renderToken)) {
				this.stopGenerationProgress()
				return
			}
			// 建单回调会在占位图渲染后更新 start_time，因此每次都读当前请求。
			const request = this.getActiveGenerateImageRequest()
			const percent = resolveGenerationProgress({
				status: "processing",
				startedAtMs,
				startedAt: request?.start_time,
				expectedFinishedAt: request?.expected_finished_at,
			})
			textNode.text(`${displayText} ${percent}%`)
			group.getLayer()?.batchDraw()
		}

		this.stopGenerationProgress()
		this.generationProgressTimer = setInterval(
			applyProgress,
			IMAGE_CONFIG.PROGRESS_TICK_INTERVAL,
		)
		applyProgress()
	}

	private stopGenerationProgress(): void {
		if (this.generationProgressTimer === undefined) {
			return
		}
		clearInterval(this.generationProgressTimer)
		this.generationProgressTimer = undefined
	}

	private hasActiveImageGenerationTask(): boolean {
		return (
			!!this.getActiveGenerateImageRequest()?.image_id ||
			!!this.getActiveImageGenerationTaskMeta()?.image_id
		)
	}

	private isActiveGenerationPlaceholder(): boolean {
		if (
			this.hasActiveImageGenerationTask() ||
			this.hasActiveGeneration(this.getActiveContentData().contentId)
		) {
			return true
		}

		// Agent-generated Content is persisted as pending before a task id is
		// available. Upload/paste placeholders remain temporary, so only a
		// persisted pending/processing Content uses the generation copy.
		const status = this.getActiveContentData().status
		return (
			(status === GenerationStatus.Pending || status === GenerationStatus.Processing) &&
			!this.canvas.elementManager.isTemporary(this.data.id)
		)
	}

	private getGeneratingPlaceholderText(state = this.getDisplayState()): string {
		if (state.taskType === ImageGenerationTaskTypeMap.Expand) {
			return this.getText("image.expanding", "正在扩展中...")
		}
		if (state.taskType === ImageGenerationTaskTypeMap.Eraser) {
			return this.getText("image.erasing", "正在擦除中...")
		}
		if (state.taskType === ImageGenerationTaskTypeMap.RemoveBackground) {
			return this.getText("image.removingBackground", "正在去除背景...")
		}
		return this.getText("image.generating", "正在生成中...")
	}

	private getGeneratingNameSuffix(state = this.getDisplayState()): string {
		if (state.taskType === ImageGenerationTaskTypeMap.Expand) {
			return this.getText("image.status.expanding", "扩展中")
		}
		if (state.taskType === ImageGenerationTaskTypeMap.Eraser) {
			return this.getText("image.status.erasing", "擦除中")
		}
		if (state.taskType === ImageGenerationTaskTypeMap.RemoveBackground) {
			return this.getText("image.status.removingBackground", "去背景中")
		}
		return this.getText("image.status.generating", "生成中")
	}

	private getRetryEditingPlaceholderText(): string {
		const taskMeta = this.getImageGenerationTaskMeta()
		if (taskMeta?.type === ImageGenerationTaskTypeMap.Expand) {
			return this.getText("image.retryEditingExpand", "请重新编辑扩展需求")
		}
		if (taskMeta?.type === ImageGenerationTaskTypeMap.Eraser) {
			return this.getText("image.retryEditingEraser", "请重新编辑擦除需求")
		}
		if (taskMeta?.type === ImageGenerationTaskTypeMap.RemoveBackground) {
			return this.getText("image.retryEditingRemoveBackground", "请重新编辑去背景需求")
		}
		return this.getText("image.retryEditing", "请重新编辑图片生成需求")
	}

	/**
	 * 渲染加载中状态占位符
	 */
	private renderLoadingPlaceholder(displayState = this.getDisplayState()): Konva.Group {
		if (!this.data.width || !this.data.height) {
			throw new Error("Image element must have width and height")
		}

		const width = this.data.width
		const height = this.data.height
		const renderToken = this.renderToken

		// 标记为加载中状态
		this.isErrorState = false

		// 创建 Group 容器
		const group = new Konva.Group({
			width,
			height,
			clipFunc: (ctx) => {
				ctx.rect(0, 0, width, height)
			},
		})

		// 创建事件代理 hit 节点
		RenderUtils.createHitNode(group, width, height)

		let displayText = this.getText("image.loading", "正在加载中...")
		if (displayState.status === "generating") {
			displayText = this.getGeneratingPlaceholderText(displayState)
		} else if (displayState.status === "uploading") {
			displayText = this.getText("image.uploading", "正在上传中...")
		}
		const placeholderText =
			displayState.status === "generating"
				? `${displayText} ${IMAGE_CONFIG.PROGRESS_TEXT_PROBE}`
				: displayText

		// 异步加载背景和内容
		this.imageLoader.loadImage(imageBackgroundLoading).then((backgroundImage) => {
			if (!this.isCurrentRender(group, renderToken)) return

			// 创建背景图片节点
			RenderUtils.createBackgroundImage(group, width, height, backgroundImage)

			// 创建居中的图标和文本
			RenderUtils.createCenteredIconText(group, width, height, {
				text: placeholderText,
				textColor: COLORS.LOADING_TEXT,
				iconSrc: imageIcon,
				withBackground: true,
				t: this.canvas.t,
			}).then((contentGroup) => {
				if (!this.isCurrentRender(group, renderToken)) {
					contentGroup.destroy()
					return
				}

				this.contentGroup = contentGroup
				// 这条路径是 Agent 生图的主链路：Content 在任务创建时就已带上 src（产物路径），
				// 图片还没就绪 → displayState.surface 落到 "loading" 而不是 "placeholder"，
				// 只挂在 renderGeneratingPlaceholder 会漏掉它。
				if (displayState.status === "generating") {
					this.attachGenerationProgress(group, contentGroup, displayText, renderToken)
				}
			})

			this.createBorder(group, width, height, true)
			this.createCornerActions(group, width, height)
			this.createMediaStatusTags(group, width, height)
		})

		this.finalizeNode(group)
		this.setupContentUpdateListener(group)
		return group
	}

	/**
	 * 渲染实际图片
	 */
	private renderImage(): Konva.Group {
		if (!this.data.width || !this.data.height) {
			throw new Error("Image element must have width and height")
		}

		const width = this.data.width
		const height = this.data.height

		// 重置状态标记
		this.isErrorState = false

		// 创建 Group 容器
		const group = new Konva.Group({
			width,
			height,
			clipFunc: (ctx) => {
				ctx.rect(0, 0, width, height)
			},
		})

		// 创建事件代理 hit 节点
		RenderUtils.createHitNode(group, width, height)

		// 使用预加载好的图片对象
		if (!this.loadedImage) {
			this.createMediaStatusTags(group, width, height)
			this.finalizeNode(group)
			return group
		}

		const crop = this.getSourceCrop(this.loadedImage)
		const isCropping = this.canvas.cropManager.getCroppingElementId() === this.data.id

		// 创建图片节点
		const imageNode = new Konva.Image({
			image: this.loadedImage,
			width: width,
			height: height,
			x: 0,
			y: 0,
			name: IMAGE_CONTENT_NODE_NAME,
			listening: false,
			crop: isCropping ? undefined : crop,
		})

		group.add(imageNode)
		if (this.getActiveContentData().discarded === true) {
			this.discardedImageDecorator = new DiscardedImageDecorator(
				imageNode,
				this.canvas,
				this.data.id,
			)
		}

		// 创建边框
		this.createBorder(group, width, height, false)

		this.createCornerActions(group, width, height, { fullscreen: true })
		this.createMediaStatusTags(group, width, height)

		this.finalizeNode(group)
		return group
	}

	/**
	 * 渲染错误信息
	 */
	private renderError(errorMessage: string): Konva.Group {
		if (!this.data.width || !this.data.height) {
			throw new Error("Image element must have width and height")
		}

		const width = this.data.width
		const height = this.data.height
		const renderToken = this.renderToken

		// 标记为错误状态
		this.isErrorState = true

		// 创建 Group 容器
		const group = new Konva.Group({
			width,
			height,
			clipFunc: (ctx) => {
				ctx.rect(0, 0, width, height)
			},
		})

		// 创建事件代理 hit 节点
		RenderUtils.createHitNode(group, width, height)

		// 异步加载背景和内容
		this.imageLoader.loadImage(imageBackgroundUnselected).then((backgroundImage) => {
			if (!this.isCurrentRender(group, renderToken)) return

			// 创建背景图片节点
			const backgroundNode = RenderUtils.createBackgroundImage(
				group,
				width,
				height,
				backgroundImage,
			)

			// 创建居中的图标和错误文本
			RenderUtils.createCenteredIconText(group, width, height, {
				text: this.isRetryEditing ? this.getRetryEditingPlaceholderText() : errorMessage,
				textColor: COLORS.ERROR_TEXT,
				iconSrc: imageIconError,
				withBackground: false,
				isErrorState: true,
				t: this.canvas.t,
				onRetry: () => {
					if (this.canvas.mediaReplaceController?.isReplacing?.(this.data.id)) return
					this.isRetryEditing = true
					this.canvas.selectionManager.select(this.data.id, false, false)
					this.rerender()
					this.canvas.eventEmitter.emit({
						type: "element:image:retryClick",
						data: { elementId: this.data.id },
					})
				},
				// 仅文生图失败态展示“重新生成”；去背景/扩展/橡皮/高清放大轮询失败只保留错误提示。
				hasGenerateImageRequest:
					!this.isRetryEditing && !!this.getActiveContentData().generateImageRequest,
				canvas: this.canvas,
			}).then((contentGroup) => {
				if (!this.isCurrentRender(group, renderToken)) {
					contentGroup.destroy()
					return
				}

				this.contentGroup = contentGroup
			})

			// 创建边框
			this.createBorder(group, width, height, false, backgroundNode)
			this.createCornerActions(group, width, height)
			this.createMediaStatusTags(group, width, height)
		})

		this.finalizeNode(group)
		this.setupContentUpdateListener(group)
		return group
	}

	/**
	 * 创建边框
	 */
	private createBorder(
		group: Konva.Group,
		width: number,
		height: number,
		isAnimated: boolean,
		backgroundNode?: Konva.Image,
	): void {
		this.borderDecorator = new BorderDecorator(group, width, height, {
			isAnimated,
			elementId: this.data.id,
			canvas: this.canvas,
		})
		this.borderDecorator.create(backgroundNode)
		this.syncRenderVisibility()
	}

	private createCornerActions(
		group: Konva.Group,
		width: number,
		height: number,
		options?: { fullscreen?: boolean },
	): void {
		const actions: ElementCornerActionConfig[] = []
		if (this.shouldShowInfoButton()) {
			actions.push({
				key: "info",
				placement: "top-right",
				icon: "info",
				onClick: () => {
					this.canvas.eventEmitter.emit({
						type: "element:image:infoButtonClick",
						data: { elementId: this.data.id },
					})
				},
			})
		}
		if (options?.fullscreen && this.shouldShowFullscreenButton()) {
			actions.push({
				key: "fullscreen",
				placement: "bottom-right",
				icon: "fullscreen",
				onClick: () => {
					this.canvas.eventEmitter.emit({
						type: "element:image:fullscreenClick",
						data: { elementId: this.data.id },
					})
				},
			})
		}
		if (!actions.length) return

		this.cornerActionsDecorator = new ElementCornerActionsDecorator(group, {
			showOnSelection:
				this.getDisplayState().status === "generating" ||
				this.getDisplayState().status === "timed-out",
			elementId: this.data.id,
			canvas: this.canvas,
			width,
			height,
			actions,
		})
		this.cornerActionsDecorator.create()
	}

	private shouldShowInfoButton(): boolean {
		return !!this.getActiveGenerateImageRequest() || this.isActiveGenerationPlaceholder()
	}

	private createMediaStatusTags(group: Konva.Group, width: number, height: number): void {
		this.createMainVersionTag(group, width, height)
		// Compliance failures are shown by the name-label shield and its tooltip;
		// keep the media surface free of the redundant red status card.
	}

	private createMainVersionTag(group: Konva.Group, width: number, height: number): void {
		this.mainVersionTagDecorator = new MediaVersionTagDecorator(group, {
			canvas: this.canvas,
			width,
			height,
			data: this.data,
		})
		this.mainVersionTagDecorator.create()
	}

	private shouldShowFullscreenButton(): boolean {
		return !!this.getActiveContentData().src
	}

	/**
	 * 更新内容的反向缩放
	 */
	private updateContentScale(width = this.data.width || 0, height = this.data.height || 0): void {
		if (!this.contentGroup || !(this.node instanceof Konva.Group)) {
			return
		}

		RenderUtils.updateContentScale(this.contentGroup, this.node, width, height)
	}

	private syncImageLayout(width: number, height: number): void {
		if (!(this.node instanceof Konva.Group)) return

		this.node.children?.forEach((child) => {
			const childName = child.name()

			if (child instanceof Konva.Image) {
				if (childName === "background") {
					RenderUtils.updateBackgroundImageLayout(child, width, height)
				} else if (!childName || childName === IMAGE_CONTENT_NODE_NAME) {
					child.width(width)
					child.height(height)
				}
			} else if (child instanceof Konva.Rect) {
				if (
					childName === "hit-area" ||
					childName === "background" ||
					childName === "decorator-border"
				) {
					child.width(width)
					child.height(height)
				}
			}
		})

		this.updateContentScale(width, height)
		this.borderDecorator?.updateSize(width, height)
		this.cornerActionsDecorator?.updateConfig({ width, height })
		this.mainVersionTagDecorator?.updateConfig({ width, height, data: this.data })
		this.updateClipRegion(width, height)
		this.node.getLayer()?.batchDraw()
	}

	/**
	 * 设置内容更新事件监听
	 */
	private setupContentUpdateListener(group: Konva.Group): void {
		if (this.contentUpdateHandler) {
			return
		}

		this.contentUpdateHandler = () => {
			this.updateContentScale()
			this.borderDecorator?.updateViewportScaleLayout()
		}

		this.contentViewportScaleUnsubscribe =
			this.canvas.runtimeScheduler.registerViewportScaleLayout(
				this.data.id,
				this.contentUpdateHandler,
			)
		this.contentLayoutGroup = group

		// 监听 Group 的 transform 事件
		group.on("transform", this.contentUpdateHandler)
	}

	private isCurrentRender(group: Konva.Group, renderToken: number): boolean {
		return this.renderToken === renderToken && this.node === group
	}

	/**
	 * 移除内容更新事件监听
	 */
	private removeContentUpdateListener(): void {
		this.contentViewportScaleUnsubscribe?.()
		this.contentViewportScaleUnsubscribe = undefined

		if (this.contentLayoutGroup && this.contentUpdateHandler) {
			this.contentLayoutGroup.off("transform", this.contentUpdateHandler)
		}

		this.contentUpdateHandler = undefined
		this.contentGroup = undefined
		this.contentLayoutGroup = undefined
	}

	/**
	 * 设置裁剪事件监听
	 */
	private setupCropEventListeners(): void {
		// 监听进入裁剪模式事件
		this.cropEnterHandler = ({ data }) => {
			if (data.elementId === this.data.id) {
				this.rerender()
			}
		}
		this.canvas.eventEmitter.on("crop:enter", this.cropEnterHandler)

		// 监听退出裁剪模式事件
		this.cropExitHandler = ({ data }) => {
			if (data.elementId === this.data.id) {
				this.rerender()
			}
		}
		this.canvas.eventEmitter.on("crop:exit", this.cropExitHandler)
	}

	/**
	 * 移除裁剪事件监听
	 */
	private removeCropEventListeners(): void {
		if (this.cropEnterHandler) {
			this.canvas.eventEmitter.off("crop:enter", this.cropEnterHandler)
			this.cropEnterHandler = undefined
		}
		if (this.cropExitHandler) {
			this.canvas.eventEmitter.off("crop:exit", this.cropExitHandler)
			this.cropExitHandler = undefined
		}
	}

	private setupRetryEditingListeners(): void {
		this.selectionChangeHandler = ({ data }) => {
			if (!this.isRetryEditing) return
			if (!data.elementIds.includes(this.data.id)) {
				this.isRetryEditing = false
				this.rerender()
			}
		}
		this.deselectHandler = ({ data }) => {
			if (!this.isRetryEditing) return
			if (!data?.elementIds || data.elementIds.includes(this.data.id)) {
				this.isRetryEditing = false
				this.rerender()
			}
		}
		this.canvas.eventEmitter.on("element:select", this.selectionChangeHandler)
		this.canvas.eventEmitter.on("element:deselect", this.deselectHandler)
	}

	private removeRetryEditingListeners(): void {
		if (this.selectionChangeHandler) {
			this.canvas.eventEmitter.off("element:select", this.selectionChangeHandler)
			this.selectionChangeHandler = undefined
		}
		if (this.deselectHandler) {
			this.canvas.eventEmitter.off("element:deselect", this.deselectHandler)
			this.deselectHandler = undefined
		}
	}

	/**
	 * 保存参考图信息（单个）
	 * 与 saveReferenceImageInfos 一致：对新项预加载资源，供 Popover 预览立即展示
	 */
	saveReferenceImageInfo(fileInfo: UploadFileResponse): void {
		this.referenceImageInfos = appendReferenceImageInfos(
			this.canvas,
			this.referenceImageInfos,
			[fileInfo],
		)
	}

	/**
	 * 批量保存参考图信息（追加模式，性能优化版本）
	 */
	saveReferenceImageInfos(fileInfos: UploadFileResponse[]): void {
		this.referenceImageInfos = appendReferenceImageInfos(
			this.canvas,
			this.referenceImageInfos,
			fileInfos,
		)
	}

	/**
	 * 完全替换参考图信息列表（用于重新排序或批量更新）
	 */
	setReferenceImageInfos(fileInfos: UploadFileResponse[]): void {
		this.referenceImageInfos = replaceReferenceImageInfos(this.canvas, fileInfos)

		// 触发资源回收事件
		this.canvas.eventEmitter.emit({
			type: "referenceImages:changed",
			data: { elementId: this.data.id },
		})
	}

	/**
	 * 获取参考图信息列表
	 */
	getReferenceImageInfos(): UploadFileResponse[] {
		return [...this.referenceImageInfos]
	}

	/**
	 * 移除参考图信息
	 * 触发资源回收：ImageResourceManager 会检查 usedPaths，释放不再被引用的资源
	 */
	removeReferenceImageInfo(path: string): void {
		this.referenceImageInfos = removeReferenceImageInfosByPath(
			this.canvas,
			this.referenceImageInfos,
			path,
		)
		this.canvas.eventEmitter.emit({
			type: "referenceImages:changed",
			data: { elementId: this.data.id },
		})
	}

	/**
	 * 清除所有参考图信息
	 * 触发资源回收（与 removeReferenceImageInfo 一致）
	 */
	clearReferenceImageInfos(): void {
		this.referenceImageInfos = []
		this.canvas.eventEmitter.emit({
			type: "referenceImages:changed",
			data: { elementId: this.data.id },
		})
	}

	/**
	 * Image 在 transformend 时将 scale 应用到尺寸
	 */
	public override getTransformBehavior(): TransformBehavior {
		return TransformBehavior.APPLY_TO_SIZE
	}

	/**
	 * 应用变换到图片元素
	 * APPLY_TO_SIZE 行为：在实时缩放和 transformend 时将 scale 应用到 width/height
	 */
	public override applyTransform(
		updates: LayerElement,
		context: TransformContext,
	): Partial<LayerElement> {
		// 在实时缩放时应用到尺寸
		if (context.isRealtime && context.isScaling) {
			const scaleX = updates.scaleX ?? 1
			const scaleY = updates.scaleY ?? 1

			if (scaleX !== 1 || scaleY !== 1) {
				const newSize = this.applyScaleToSize(updates, context)

				// 更新裁剪区域
				this.updateClipRegion(newSize.width, newSize.height)

				return {
					x: updates.x,
					y: updates.y,
					width: newSize.width,
					height: newSize.height,
					scaleX: 1,
					scaleY: 1,
				}
			}
		}

		// transformend 时应用到尺寸
		if (!context.isRealtime) {
			const scaleX = updates.scaleX ?? 1
			const scaleY = updates.scaleY ?? 1

			if (scaleX !== 1 || scaleY !== 1) {
				const newSize = this.applyScaleToSize(updates, context)

				// 更新裁剪区域
				this.updateClipRegion(newSize.width, newSize.height)

				return {
					x: updates.x,
					y: updates.y,
					width: newSize.width,
					height: newSize.height,
					scaleX: 1,
					scaleY: 1,
				}
			}
		}

		// 其他情况（纯拖拽）
		return {
			x: updates.x,
			y: updates.y,
		}
	}

	/**
	 * 更新裁剪区域
	 */
	private updateClipRegion(width: number, height: number): void {
		if (this.node instanceof Konva.Group) {
			this.node.clipFunc((ctx) => {
				ctx.rect(0, 0, width, height)
			})
		}
	}

	/**
	 * 在 transform 过程中更新裁剪区域
	 * @deprecated 使用 applyTransform 替代
	 */
	public override onTransformResize(width: number, height: number): void {
		this.syncImageLayout(width, height)
	}
}
