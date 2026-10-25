import Konva from "konva"
import type {
	CanvasConfig,
	CanvasDeviceInfo,
	CanvasDocument,
	LayerElement,
	ViewportState,
	ToolType,
} from "../document/types"
import type { ElementDetailsProvenance } from "../document/elementDetailsProvenance"
import { ElementTypeEnum, ToolTypeEnum } from "../document/types"
import { getActiveContent } from "../document/elementContent"
import { ViewportController } from "../interaction/viewport/ViewportController"
import { EventEmitter, type CanvasEventMap } from "./EventEmitter"
import { ElementManager } from "../elements/core/ElementManager"
import { SelectionManager } from "../interaction/selection/SelectionManager"
import { TransformManager } from "../interaction/transform/TransformManager"
import { HoverManager } from "../interaction/hover/HoverManager"
import { SelectionHighlightManager } from "../interaction/selection/SelectionHighlightManager"
import { KeyboardManager } from "../interaction/keyboard/KeyboardManager"
import { ToolManager } from "../interaction/tools/ToolManager"
import { getDefaultCanvasDeviceInfo } from "../shared/ids"
import { AlignmentManager } from "../interaction/align/AlignmentManager"
import { FrameManager } from "../interaction/frame/FrameManager"
import { HistoryManager } from "../interaction/history/HistoryManager"
import { MarkerManager } from "../interaction/marker/MarkerManager"
import { SnapGuideManager } from "../interaction/snap/SnapGuideManager"
import { PermissionManager } from "./PermissionManager"
import { NameLabelManager } from "../interaction/labels/NameLabelManager"
import { complianceNameLabelIconResolver } from "../interaction/labels/complianceNameLabelIconResolver"
import { SizeLabelManager } from "../interaction/labels/SizeLabelManager"
import type { TFunction } from "../../public/i18n-types"
import type { CanvasAccessUpdate } from "./CanvasAccessPolicy"
import { MagicConfigManager } from "./MagicConfigManager"
import { ClipboardManager } from "../interaction/clipboard/ClipboardManager"
import { DropOverlayManager } from "../interaction/drop-overlay/DropOverlayManager"
import { CursorManager } from "../interaction/cursor/CursorManager"
import { VideoPlaybackInteractionManager } from "../interaction/video-playback/VideoPlaybackInteractionManager"
import { UserActionRegistry } from "../actions/UserActionRegistry"
import { BackgroundManager } from "../interaction/background/BackgroundManager"
import { CanvasFileUploadManager } from "../resources/upload/CanvasFileUploadManager"
import { GeometryCacheManager } from "../shared/geometry/GeometryCacheManager"
import { CanvasViewportQueryCoordinator } from "../shared/geometry/CanvasViewportQueryCoordinator"
import { ImageResourceManager } from "../resources/image/ImageResourceManager"
import { CanvasImagePresentationScheduler } from "../resources/image/CanvasImagePresentationScheduler"
import { ImageBatchPollingRegistry } from "../resources/polling/ImageBatchPollingRegistry"
import { SubmitImageWorkerManager } from "../resources/upload/SubmitImageWorkerManager"
import { VideoPlaybackManager } from "../resources/video/VideoPlaybackManager"
import { VideoResourceManager } from "../resources/video/VideoResourceManager"
import { VideoCompositionManager } from "../resources/video-composition/VideoCompositionManager"
import { VideoDraftFinalManager } from "../resources/video-draft-final/VideoDraftFinalManager"
import { AudioResourceManager } from "../resources/audio/AudioResourceManager"
import { AudioPlaybackManager } from "../resources/audio/AudioPlaybackManager"
import { AudioWaveformManager } from "../resources/audio/AudioWaveformManager"
import { CanvasAssetResourceManager } from "../resources/asset/CanvasAssetResourceManager"
import { CanvasAssetImportManager } from "../resources/asset/CanvasAssetImportManager"
import { CanvasAssetCompliancePollingManager } from "../resources/asset/CanvasAssetCompliancePollingManager"
import { CanvasAssetComplianceTaskManager } from "../resources/asset/CanvasAssetComplianceTaskManager"
import { reconcileUnverifiedComplianceInDocument } from "../resources/asset/canvasAssetDocumentReconcile"
import { AudioReplaceController } from "../interaction/audio/AudioReplaceController"
import { ImageReplaceController } from "../interaction/image/ImageReplaceController"
import { MediaReplaceController } from "../interaction/media/MediaReplaceController"
import { MediaPlaybackCoordinator } from "../interaction/media-playback/MediaPlaybackCoordinator"
import { MediaResourceOfflineCacheManager } from "../resources/offline-cache/MediaResourceOfflineCacheManager"
import { CanvasVisibilityManager } from "../resources/visibility/CanvasVisibilityManager"
import { CanvasResourceScheduler } from "../resources/scheduler/CanvasResourceScheduler"
import { CanvasResourceUrlWarmupManager } from "../resources/scheduler/CanvasResourceUrlWarmupManager"
import { CanvasRuntimeScheduler } from "./CanvasRuntimeScheduler"
import { CropManager } from "../interaction/crop/CropManager"
import { ExtendManager } from "../interaction/extend/ExtendManager"
import { EraserManager } from "../interaction/eraser/EraserManager"
import { PluginManager } from "../plugins/PluginManager"
import { GenerationRuntimeManager } from "../generation/GenerationRuntimeManager"
import { ElementDetailsRuntimeManager } from "../generation/ElementDetailsRuntimeManager"
import { GenerationAttemptCoordinator } from "../generation/GenerationAttemptCoordinator"
import { CanvasElementToolCommandBus } from "../element-tools/commands/ElementToolCommandBus"
import { ElementRenameManager } from "../interaction/rename/ElementRenameManager"
import { TextEditingManager } from "../interaction/text-editing/TextEditingManager"
import { TextFormattingManager } from "../interaction/text-editing/TextFormattingManager"
import { CanvasInputManager } from "../interaction/input/index"
import { isCanvasUIComponentNode } from "../shared/dom/domGuards"
import {
	buildSharedMediaStorageScope,
	getCanvasHostResourceReferenceResolver,
	resolveCanvasStorageResourceReference,
	type CanvasResourceReferenceResolverChangeOptions,
} from "../shared/path/canvasResourcePath"
import { ConnectionManager } from "../interaction/connection/ConnectionManager"
import { ConnectionDragManager } from "../interaction/connection/ConnectionDragManager"
import { ConnectionHandleOverlayManager } from "../interaction/connection/ConnectionHandleOverlayManager"
import { ConnectionAssociationSeedManager } from "../interaction/connection/ConnectionAssociationSeedManager"
import { StoryboardInteractionManager } from "../interaction/storyboard/StoryboardInteractionManager"
import { VideoEditInteractionManager } from "../interaction/video-edit/VideoEditInteractionManager"
import { VideoEditPlaybackManager } from "../interaction/video-edit/VideoEditPlaybackManager"
import { ImageEditingCoordinator } from "../interaction/image-editing/ImageEditingCoordinator"
import { VideoContinuationManager } from "../interaction/video-continuation/VideoContinuationManager"
import { MediaEditRecoveryManager } from "../interaction/media-edit-recovery/MediaEditRecoveryManager"
import {
	editActions,
	layerActions,
	frameActions,
	elementActions,
	alignActions,
	distributeActions,
	selectionActions,
	viewActions,
	conversationActions,
	downloadActions,
} from "../actions/index"
import { normalizeStoryboardDocument } from "../document/storyboardMigration"

const CANVAS_DOUBLE_CLICK_DISTANCE = 8

function areCanvasDeviceInfoEqual(a: CanvasDeviceInfo, b: CanvasDeviceInfo): boolean {
	return (
		a.formFactor === b.formFactor &&
		a.layout === b.layout &&
		a.input.touch === b.input.touch &&
		a.input.coarsePointer === b.input.coarsePointer &&
		a.input.hover === b.input.hover
	)
}

function getCanvasConnectionComparable(connections: CanvasDocument["connections"]): string {
	return JSON.stringify(
		(connections ?? []).map(({ id, sourceElementId, targetElementId }) => ({
			id,
			sourceElementId,
			targetElementId,
		})),
	)
}

type ContentViewElement = LayerElement & {
	activeContentId?: string | null
	contents?: readonly { contentId: string }[]
}

function resolveEffectiveContentIdForElement(
	element: ContentViewElement | undefined,
	previewContentId?: string,
): { contentId?: string; previewMatched: boolean } {
	if (!element || !Array.isArray(element.contents)) {
		return { contentId: undefined, previewMatched: false }
	}

	const previewMatched = Boolean(
		previewContentId &&
		element.contents.some((content) => content.contentId === previewContentId),
	)
	return {
		contentId: previewMatched
			? previewContentId
			: (element.activeContentId ?? element.contents[0]?.contentId),
		previewMatched,
	}
}

function getElementResourceReferencePath(
	canvas: Canvas,
	element: LayerElement | undefined,
): string | undefined {
	if (!element) return undefined
	if (element.type === ElementTypeEnum.Image)
		return (canvas.getEffectiveContent(element.id) as { src?: string } | undefined)?.src
	if (element.type === ElementTypeEnum.Video || element.type === ElementTypeEnum.Audio) {
		return (canvas.getEffectiveContent(element.id) as { src?: string } | undefined)?.src
	}
	return undefined
}

/**
 * Canvas类 - 封装Konva画布的初始化和管理
 */
export class Canvas {
	private destroyed = false

	public container: HTMLDivElement
	public stage: Konva.Stage

	// 五层架构的 Layer 管理（从底到顶）
	public contentLayer: Konva.Layer // 1. 内容层：用户创建的所有元素
	public connectionGroup: Konva.Group // 内容层底部 Group：元素之间的业务关联线
	public selectionLayer: Konva.Layer // 2. 选择层：框选矩形和选中高亮效果
	public controlsLayer: Konva.Layer // 3. 控制层：Transformer 和 Hover 边框
	public markersLayer: Konva.Layer // 4. 标记层：图片上的 Marker 标记（在最上层，不被遮挡）
	public overlayLayer: Konva.Layer // 5. 辅助层：吸附辅助线、名称标签、尺寸标签；仅名称标签接收命中

	public viewportController: ViewportController
	public eventEmitter: EventEmitter<CanvasEventMap>

	public permissionManager: PermissionManager
	public imageEditingCoordinator: ImageEditingCoordinator
	public mediaEditRecoveryManager: MediaEditRecoveryManager
	public elementManager: ElementManager
	public selectionManager: SelectionManager
	public transformManager: TransformManager
	public hoverManager: HoverManager
	public selectionHighlightManager: SelectionHighlightManager
	public videoPlaybackInteractionManager: VideoPlaybackInteractionManager
	public inputManager: CanvasInputManager
	public connectionManager: ConnectionManager
	public connectionAssociationSeedManager: ConnectionAssociationSeedManager
	public connectionDragManager: ConnectionDragManager
	public connectionHandleOverlayManager: ConnectionHandleOverlayManager
	public storyboardInteractionManager: StoryboardInteractionManager
	public videoEditInteractionManager: VideoEditInteractionManager
	public videoEditPlaybackManager: VideoEditPlaybackManager
	public videoContinuationManager: VideoContinuationManager
	public toolManager: ToolManager
	public keyboardManager: KeyboardManager
	public alignmentManager: AlignmentManager
	public frameManager: FrameManager
	public historyManager: HistoryManager
	public markerManager: MarkerManager
	public snapGuideManager: SnapGuideManager
	public nameLabelManager: NameLabelManager
	public elementRenameManager: ElementRenameManager
	public sizeLabelManager: SizeLabelManager
	public magicConfigManager: MagicConfigManager
	public clipboardManager: ClipboardManager
	public dropOverlayManager: DropOverlayManager
	public cursorManager: CursorManager
	public userActionRegistry: UserActionRegistry
	public elementToolCommandBus: CanvasElementToolCommandBus
	public backgroundManager: BackgroundManager
	public canvasFileUploadManager: CanvasFileUploadManager
	public geometryCacheManager: GeometryCacheManager
	public viewportQueryCoordinator: CanvasViewportQueryCoordinator
	public imageResourceManager: ImageResourceManager
	public imagePresentationScheduler: CanvasImagePresentationScheduler
	public imageBatchPollingRegistry: ImageBatchPollingRegistry
	public submitImageWorkerManager: SubmitImageWorkerManager
	public videoResourceManager: VideoResourceManager
	public videoCompositionManager: VideoCompositionManager
	/** 当前图片和视频标签是否常驻显示；默认按 hover/选中状态显示。 */
	private mediaLabelsAlwaysVisible = false
	public videoDraftFinalManager: VideoDraftFinalManager
	/** Seedance 合规能力关闭时，画布不展示合规 UI，也不恢复合规轮询。 */
	private seedanceComplianceEnabled = false
	public videoPlaybackManager: VideoPlaybackManager
	public audioResourceManager: AudioResourceManager
	public audioPlaybackManager: AudioPlaybackManager
	public audioWaveformManager: AudioWaveformManager
	public assetResourceManager: CanvasAssetResourceManager
	public assetCompliancePollingManager: CanvasAssetCompliancePollingManager
	public assetComplianceTaskManager: CanvasAssetComplianceTaskManager
	public assetImportManager: CanvasAssetImportManager
	public audioReplaceController: AudioReplaceController
	public imageReplaceController: ImageReplaceController
	public mediaReplaceController: MediaReplaceController
	public mediaPlaybackCoordinator: MediaPlaybackCoordinator
	public mediaResourceOfflineCacheManager: MediaResourceOfflineCacheManager
	public visibilityManager: CanvasVisibilityManager
	public resourceScheduler: CanvasResourceScheduler
	public resourceUrlWarmupManager: CanvasResourceUrlWarmupManager
	public runtimeScheduler: CanvasRuntimeScheduler
	public cropManager: CropManager
	public extendManager: ExtendManager
	public eraserManager: EraserManager
	public textEditingManager: TextEditingManager
	public textFormattingManager: TextFormattingManager
	public pluginManager: PluginManager
	public generationRuntimeManager: GenerationRuntimeManager
	public generationAttemptCoordinator: GenerationAttemptCoordinator
	public elementDetailsRuntimeManager: ElementDetailsRuntimeManager

	private readonly previewContentIds = new Map<string, string>()
	public deviceInfo: CanvasDeviceInfo
	public id: string

	public get isDestroyed(): boolean {
		return this.destroyed
	}

	public t?: TFunction
	private scopeElement: HTMLElement

	// 宽高比锁定修饰键状态（Shift 或 Meta/Command）
	private keepRatioModifierPressed: boolean = false

	// window 点击事件处理函数引用（用于移除监听器）
	private handleWindowClick: ((e: MouseEvent) => void) | null = null
	private resizeObserver: ResizeObserver | null = null
	private containerContextMenuHandler: ((e: MouseEvent) => void) | null = null
	private stageContextMenuHandler: ((e: Konva.KonvaEventObject<MouseEvent>) => void) | null = null
	private stageBlankClickHandler: ((e: Konva.KonvaEventObject<MouseEvent>) => void) | null = null
	private stageDoubleClickHandler: ((e: Konva.KonvaEventObject<MouseEvent>) => void) | null = null
	private previousBlankClickPoint: { x: number; y: number } | null = null
	private lastBlankClickPoint: { x: number; y: number } | null = null

	/**
	 * 构造函数
	 * @param config - Canvas配置
	 */
	constructor(options: CanvasConfig) {
		this.container = options.element
		this.scopeElement = options.scopeElement ?? options.element

		this.t = options.t
		this.id = options.id

		this.deviceInfo = options.getDevice ? options.getDevice() : getDefaultCanvasDeviceInfo()

		// 设置容器可以获得焦点
		this.container.tabIndex = 0
		this.container.style.outline = "none"
		// 自动获得焦点
		this.container.focus()

		// 获取容器尺寸
		const width = this.container.offsetWidth || window.innerWidth
		const height = this.container.offsetHeight || window.innerHeight

		// 创建Konva Stage
		this.stage = new Konva.Stage({
			container: this.container,
			width: width,
			height: height,
		})

		// Register before the shared input layer so Canvas takes focus before
		// selection handlers publish the new selection.
		this.setupCanvasFocusHandler()

		// 创建五层架构的 Layer
		this.contentLayer = new Konva.Layer({ name: "content", listening: true })
		this.connectionGroup = new Konva.Group({ name: "canvas-connections", listening: true })
		this.contentLayer.add(this.connectionGroup)
		this.selectionLayer = new Konva.Layer({ name: "selection", listening: false })
		this.markersLayer = new Konva.Layer({ name: "markers", listening: true })
		this.controlsLayer = new Konva.Layer({ name: "controls", listening: true })
		// 名称标签需要命中；尺寸标签、吸附线等子节点保持 listening: false，空白处仍穿透到下层。
		this.overlayLayer = new Konva.Layer({ name: "overlay", listening: true })

		// 按顺序添加到 Stage（从底到顶）
		this.stage.add(this.contentLayer)
		this.stage.add(this.selectionLayer)
		this.stage.add(this.controlsLayer)
		this.stage.add(this.markersLayer)
		this.stage.add(this.overlayLayer)

		// 创建事件发射器
		this.eventEmitter = new EventEmitter()
		// Permission is initialized before all runtime managers so every module
		// observes the same access context during construction.
		this.permissionManager = new PermissionManager({
			canvas: this,
			accessMode: options.accessMode,
			capabilities: options.capabilities,
		})
		this.mediaEditRecoveryManager = new MediaEditRecoveryManager()
		this.eventEmitter.on("element:deleted", ({ data }) => {
			this.previewContentIds.delete(data.elementId)
			this.mediaEditRecoveryManager.clearElement(data.elementId)
		})
		this.eventEmitter.on("element:batchdeleted", ({ data }) => {
			data.elementIds.forEach((elementId) => {
				this.previewContentIds.delete(elementId)
				this.mediaEditRecoveryManager.clearElement(elementId)
			})
		})
		this.eventEmitter.on("element:updated", ({ data }) => {
			if (!data.previousData) return
			const previousContent = getActiveContent(data.previousData)
			const nextContent = getActiveContent(data.data)
			const previousSource =
				previousContent && "src" in previousContent ? previousContent.src : undefined
			const nextSource = nextContent && "src" in nextContent ? nextContent.src : undefined
			if (
				previousContent?.contentId === nextContent?.contentId &&
				previousContent?.contentId &&
				previousSource !== nextSource
			) {
				this.mediaEditRecoveryManager.clearContent(
					data.elementId,
					previousContent.contentId,
				)
			}
		})
		this.generationRuntimeManager = new GenerationRuntimeManager({ canvas: this })
		this.elementDetailsRuntimeManager = new ElementDetailsRuntimeManager()

		this.pluginManager = new PluginManager()
		this.pluginManager.registerMany(options.plugins?.builtin ?? [])
		void this.pluginManager.loadUserPluginsFromCanvasResources({
			rootPath: options.plugins?.user?.rootPath,
			directories: options.plugins?.user?.directories,
			getFileInfo: options.magic?.methods?.getFileInfo,
			resolveResourceReference: options.magic?.methods?.resolveResourceReference,
		})

		// 初始化 MagicConfigManager
		this.magicConfigManager = new MagicConfigManager({
			canvas: this,
			config: options.magic,
		})
		// asset:// paths resolve through the asset service and must stay separate from
		// workspace attachment resolution and its persistent media cache.
		this.assetResourceManager = new CanvasAssetResourceManager(this)
		this.assetCompliancePollingManager = new CanvasAssetCompliancePollingManager(this)
		this.assetComplianceTaskManager = new CanvasAssetComplianceTaskManager(this)

		// 初始化 CanvasFileUploadManager（全局文件上传管理器）
		this.canvasFileUploadManager = new CanvasFileUploadManager({
			canvas: this,
		})

		this.mediaResourceOfflineCacheManager = new MediaResourceOfflineCacheManager({
			getResolveResourceReference: () =>
				this.magicConfigManager.config?.methods?.resolveResourceReference,
			getVirtualResourceScope: () =>
				buildSharedMediaStorageScope(
					this.magicConfigManager.config?.methods?.getVirtualResourceScope?.(),
					this.id,
				),
		})
		this.resourceScheduler = new CanvasResourceScheduler()
		this.resourceUrlWarmupManager = new CanvasResourceUrlWarmupManager({
			canvas: this,
		})
		this.runtimeScheduler = new CanvasRuntimeScheduler({ canvas: this })

		// 初始化 ImageResourceManager（图片资源管理器，每个 Canvas 实例独立）
		this.imageResourceManager = new ImageResourceManager({
			canvas: this,
		})

		this.imageBatchPollingRegistry = new ImageBatchPollingRegistry()

		this.submitImageWorkerManager = new SubmitImageWorkerManager({
			canvas: this,
		})

		// 初始化 VideoResourceManager（视频 path → ossSrc，每个 Canvas 实例独立）
		this.videoResourceManager = new VideoResourceManager({
			canvas: this,
		})
		this.videoCompositionManager = new VideoCompositionManager({ canvas: this })

		this.videoPlaybackManager = new VideoPlaybackManager({
			canvas: this,
		})

		this.audioResourceManager = new AudioResourceManager({ canvas: this })
		this.audioPlaybackManager = new AudioPlaybackManager({ canvas: this })
		this.videoEditPlaybackManager = new VideoEditPlaybackManager({ canvas: this })
		this.audioWaveformManager = new AudioWaveformManager({ canvas: this })
		this.audioReplaceController = new AudioReplaceController({ canvas: this })
		this.imageReplaceController = new ImageReplaceController({ canvas: this })
		this.mediaReplaceController = new MediaReplaceController({ canvas: this })

		// 初始化 ClipboardManager
		this.clipboardManager = new ClipboardManager({
			canvas: this,
		})

		// 初始化 DropOverlayManager
		this.dropOverlayManager = new DropOverlayManager({
			canvas: this,
		})

		// 初始化 CursorManager（需要较早初始化，工具管理器依赖它）
		this.cursorManager = new CursorManager({
			canvas: this,
		})

		this.imageEditingCoordinator = new ImageEditingCoordinator({
			canvas: this,
		})

		// 初始化 ElementManager（使用 Content Layer）
		this.elementManager = new ElementManager({
			canvas: this,
		})
		this.generationAttemptCoordinator = new GenerationAttemptCoordinator(this)

		this.imagePresentationScheduler = new CanvasImagePresentationScheduler({
			canvas: this,
		})

		// 初始化几何缓存管理器（统一提供边界缓存与后续空间索引扩展点）
		this.geometryCacheManager = new GeometryCacheManager({
			canvas: this,
		})
		this.viewportQueryCoordinator = new CanvasViewportQueryCoordinator({ canvas: this })

		// 初始化关联线管理器（使用 contentLayer 内的 connectionGroup 绘制元素业务因果关系）
		this.connectionManager = new ConnectionManager({
			canvas: this,
		})
		this.connectionAssociationSeedManager = new ConnectionAssociationSeedManager({
			canvas: this,
		})
		this.assetImportManager = new CanvasAssetImportManager(this)

		// 初始化 SelectionManager（使用 Content Layer 用于查询节点）
		this.selectionManager = new SelectionManager({
			canvas: this,
		})

		this.mediaPlaybackCoordinator = new MediaPlaybackCoordinator({ canvas: this })

		// 初始化 TransformManager（使用 Controls Layer）
		this.transformManager = new TransformManager({
			canvas: this,
		})

		// 初始化 HoverManager（使用 Controls Layer）
		this.hoverManager = new HoverManager({
			canvas: this,
		})

		// 初始化 SelectionHighlightManager（使用 Selection Layer）
		this.selectionHighlightManager = new SelectionHighlightManager({
			canvas: this,
		})

		// 初始化视口控制器
		this.viewportController = new ViewportController({
			canvas: this,
		})

		// 初始化统一输入层（工具与手势仲裁共享）
		this.inputManager = new CanvasInputManager({
			canvas: this,
		})

		this.textEditingManager = new TextEditingManager({
			canvas: this,
		})
		this.textFormattingManager = new TextFormattingManager({
			canvas: this,
		})

		// 初始化快捷键管理器
		this.keyboardManager = new KeyboardManager({
			canvas: this,
			container: this.container,
		})

		// 初始化对齐管理器
		this.alignmentManager = new AlignmentManager({
			canvas: this,
		})

		// 初始化画框管理器
		this.frameManager = new FrameManager({
			canvas: this,
		})

		// 初始化历史管理器
		this.historyManager = new HistoryManager({
			canvas: this,
		})
		// 正片转正需要同时提交临时元素与运行时连线，因此在元素、连线和历史管理器
		// 都准备完成后再初始化该生命周期管理器。
		this.videoDraftFinalManager = new VideoDraftFinalManager({ canvas: this })

		// 初始化标记管理器（使用 Markers Layer）
		this.markerManager = new MarkerManager({
			canvas: this,
		})

		// 初始化吸附引导线管理器（使用 Overlay Layer 绘制，Content Layer 获取坐标）
		this.snapGuideManager = new SnapGuideManager({
			canvas: this,
		})

		// 初始化名称标签管理器（使用共享的 Overlay Layer）
		this.nameLabelManager = new NameLabelManager({
			canvas: this,
			iconResolver: options.nameLabelIconResolver ?? complianceNameLabelIconResolver,
		})

		this.elementRenameManager = new ElementRenameManager({
			canvas: this,
		})

		// 初始化尺寸标签管理器（使用共享的 Overlay Layer）
		this.sizeLabelManager = new SizeLabelManager({
			canvas: this,
		})

		// 初始化工具管理器（负责创建所有工具，使用 Content Layer）
		this.toolManager = new ToolManager({
			canvas: this,
		})

		this.videoContinuationManager = new VideoContinuationManager(this)

		// 分镜内部控件依赖选择工具、权限与 CursorManager，统一在工具初始化后接入。
		this.storyboardInteractionManager = new StoryboardInteractionManager({
			canvas: this,
		})

		this.videoEditInteractionManager = new VideoEditInteractionManager({
			canvas: this,
		})

		// 初始化视频播放交互协调器
		this.videoPlaybackInteractionManager = new VideoPlaybackInteractionManager({
			canvas: this,
		})

		this.visibilityManager = new CanvasVisibilityManager({
			canvas: this,
		})

		// 初始化用户动作注册表
		this.userActionRegistry = new UserActionRegistry({
			canvas: this,
		})
		this.userActionRegistry.registerAll([
			...editActions,
			...layerActions,
			...frameActions,
			...elementActions,
			...alignActions,
			...distributeActions,
			...selectionActions,
			...viewActions,
			...conversationActions,
			...downloadActions,
		])
		this.elementToolCommandBus = new CanvasElementToolCommandBus(this)

		// 初始化背景管理器（使用 Content Layer 的最底层）
		this.backgroundManager = new BackgroundManager({
			canvas: this,
		})

		// 初始化裁剪管理器
		this.cropManager = new CropManager({
			canvas: this,
		})

		// 初始化扩展管理器
		this.extendManager = new ExtendManager({
			canvas: this,
		})

		// 初始化橡皮擦管理器
		this.eraserManager = new EraserManager({
			canvas: this,
		})

		// 初始化关联线拖拽管理器（依赖统一 inputManager，使用 Controls Layer 绘制 preview）
		this.connectionDragManager = new ConnectionDragManager({
			canvas: this,
		})

		// 初始化关联线 handle overlay（使用 Controls Layer，不新增 Konva Layer）
		this.connectionHandleOverlayManager = new ConnectionHandleOverlayManager({
			canvas: this,
		})

		// 设置键盘事件监听
		this.setupKeyboardListeners()

		// 设置文本元素双击编辑监听
		this.setupTextDoubleClickListener()

		// 监听窗口大小变化
		this.setupResizeHandler()

		// 设置 window 点击监听（点击窗口其他地方取消选中）
		this.setupWindowClickHandler()

		// 禁用右键菜单
		this.setupContextMenuHandler()

		// 设置画布空白区域双击监听
		this.setupCanvasDoubleClickHandler()

		// 发布画布就绪事件
		this.eventEmitter.emit({ type: "canvas:ready", data: undefined })
	}

	/**
	 * 设置元素双击监听
	 */
	private setupTextDoubleClickListener(): void {
		this.eventEmitter.on("element:dblclick", ({ data }) => {
			const { elementId, elementType, clientX, clientY } = data

			if (elementType === "text") {
				this.textEditingManager.editElement(elementId, {
					clientX,
					clientY,
				})
			}
		})
	}

	/**
	 * 设置窗口大小变化监听
	 */
	private setupResizeHandler(): void {
		this.resizeObserver = new ResizeObserver(() => {
			this.resize()
		})

		this.resizeObserver.observe(this.container)
	}

	/**
	 * 设置画布点击时获得焦点
	 */
	private setupCanvasFocusHandler(): void {
		this.stage.on("pointerdown mousedown", () => {
			this.container.focus()
		})
	}

	/**
	 * 禁用右键菜单
	 */
	private setupContextMenuHandler(): void {
		// 在容器上禁用右键菜单
		this.containerContextMenuHandler = (e) => {
			e.preventDefault()
			return false
		}
		this.container.addEventListener("contextmenu", this.containerContextMenuHandler)

		// 在 stage 上处理右键菜单
		this.stageContextMenuHandler = (e) => {
			e.evt.preventDefault()

			// 如果点击的是 stage 本身（空白区域），触发画布右键菜单事件
			if (e.target === this.stage) {
				const pos = this.stage.getPointerPosition()
				if (pos) {
					// 转换为画布坐标（考虑视口缩放和平移）
					const transform = this.stage.getAbsoluteTransform().copy().invert()
					const canvasPos = transform.point(pos)

					this.eventEmitter.emit({
						type: "canvas:contextmenu",
						data: {
							x: e.evt.clientX,
							y: e.evt.clientY,
							canvasX: canvasPos.x,
							canvasY: canvasPos.y,
						},
					})
				}
			}
		}
		this.stage.on("contextmenu", this.stageContextMenuHandler)
	}

	/**
	 * 设置画布空白区域双击监听
	 */
	private setupCanvasDoubleClickHandler(): void {
		this.stageBlankClickHandler = (e) => {
			if (e.target !== this.stage) {
				this.previousBlankClickPoint = null
				this.lastBlankClickPoint = null
				return
			}

			this.previousBlankClickPoint = this.lastBlankClickPoint
			this.lastBlankClickPoint = {
				x: e.evt.clientX,
				y: e.evt.clientY,
			}
		}

		this.stageDoubleClickHandler = (e) => {
			if (e.target !== this.stage) return

			const previousPoint = this.previousBlankClickPoint
			const lastPoint = this.lastBlankClickPoint
			if (!previousPoint || !lastPoint) return

			const distance = Math.max(
				Math.abs(lastPoint.x - previousPoint.x),
				Math.abs(lastPoint.y - previousPoint.y),
			)
			if (distance > CANVAS_DOUBLE_CLICK_DISTANCE) return

			const pos = this.stage.getPointerPosition()
			if (!pos) return

			const transform = this.stage.getAbsoluteTransform().copy().invert()
			const canvasPos = transform.point(pos)
			this.previousBlankClickPoint = null
			this.lastBlankClickPoint = null

			this.eventEmitter.emit({
				type: "canvas:dblclick",
				data: {
					x: e.evt.clientX,
					y: e.evt.clientY,
					canvasX: canvasPos.x,
					canvasY: canvasPos.y,
				},
			})
		}

		this.stage.on("mousedown", this.stageBlankClickHandler)
		this.stage.on("dblclick", this.stageDoubleClickHandler)
	}

	/**
	 * 设置 window 点击监听（点击窗口其他地方取消选中）
	 */
	private setupWindowClickHandler(): void {
		this.handleWindowClick = (e: MouseEvent) => {
			const target = e.target as Node

			if (!target) return

			// 仅处理当前 CanvasDesign 范围内的点击，避免点击页面其他区域时误清选中
			if (!this.scopeElement.contains(target)) return

			// 检查点击的目标是否在画布容器内
			if (this.container.contains(target)) {
				// 点击在画布内，不处理（由 SelectionTool 处理）
				return
			}

			// 点击在UI组件内，不取消选中
			if (isCanvasUIComponentNode(target, { stopAt: this.scopeElement })) {
				return
			}

			// 点击在画布外且不在UI组件内，取消选中
			this.connectionManager.deselectConnection()
			if (this.selectionManager.hasSelection()) {
				this.selectionManager.deselectAll()
			}
		}

		// 使用捕获阶段，确保在其他事件处理之前执行
		window.addEventListener("click", this.handleWindowClick, true)
	}

	/**
	 * 设置键盘事件监听
	 */
	private setupKeyboardListeners(): void {
		// 监听删除快捷键
		this.eventEmitter.on("keyboard:delete", () => {
			this.userActionRegistry.execute("edit.delete")
		})

		// 工具快捷键映射配置
		const toolKeyMap = new Map<string, { toolType: ToolType; isTemporary: boolean }>([
			["v", { toolType: ToolTypeEnum.Select, isTemporary: false }],
			["h", { toolType: ToolTypeEnum.Hand, isTemporary: false }],
			["t", { toolType: ToolTypeEnum.Text, isTemporary: false }],
			["f", { toolType: ToolTypeEnum.Frame, isTemporary: true }],
			["a", { toolType: ToolTypeEnum.ImageGenerator, isTemporary: false }],
			["m", { toolType: ToolTypeEnum.Marker, isTemporary: false }],
		])

		// 监听工具快捷键
		this.eventEmitter.on("keyboard:tool", ({ data }) => {
			const { key } = data

			// 处理按键释放
			if (key.endsWith("-up")) {
				const baseKey = key.replace("-up", "")

				// 空格键松开时恢复之前的工具
				if (baseKey === "space") {
					if (
						this.videoPlaybackInteractionManager.consumeSpaceKeyupAfterPlaybackToggle()
					) {
						return
					}
					this.toolManager.restorePreviousTool()
					return
				}

				// 其他工具键：只有临时工具才在松开时切换
				const config = toolKeyMap.get(baseKey)
				if (config?.isTemporary) {
					this.toolManager.switchToSelection()
				}
				return
			}

			// 处理 Space 键（特殊临时工具）
			if (key === "space") {
				if (this.videoPlaybackInteractionManager.toggleSelectedVideoPlaybackByKeyboard()) {
					return
				}
				this.toolManager.savePreviousTool()
				this.toolManager.setActiveToolByType(ToolTypeEnum.Hand, "keyboard")
				return
			}

			// 处理其他工具快捷键
			const config = toolKeyMap.get(key)
			if (config) {
				if (config.isTemporary) {
					// 临时工具：保存当前工具
					this.toolManager.savePreviousTool()
				}
				this.toolManager.setActiveToolByType(config.toolType, "keyboard")
			}
		})

		// 监听 ESC 键（切换回选择工具）
		this.eventEmitter.on("keyboard:escape", () => {
			this.toolManager.switchToSelection()
		})

		// 监听缩放快捷键
		this.eventEmitter.on("keyboard:zoom:in", () => {
			this.userActionRegistry.execute("view.zoom-in")
		})

		this.eventEmitter.on("keyboard:zoom:out", () => {
			this.userActionRegistry.execute("view.zoom-out")
		})

		this.eventEmitter.on("keyboard:zoom:fit", () => {
			this.userActionRegistry.execute("view.zoom-fit")
		})

		// 监听 Shift 键（宽高比锁定修饰键，影响 Transformer、裁剪框等）
		this.eventEmitter.on("keyboard:shift:down", () => {
			this.setKeepRatioModifier(true)
		})

		this.eventEmitter.on("keyboard:shift:up", () => {
			this.setKeepRatioModifier(false)
		})

		// 监听 Meta/Command 键（宽高比锁定修饰键）
		this.eventEmitter.on("keyboard:meta:down", () => {
			this.setKeepRatioModifier(true)
		})

		this.eventEmitter.on("keyboard:meta:up", () => {
			this.setKeepRatioModifier(false)
		})

		// 修饰键按下期间，选区变化后需要实时刷新拖拽能力：
		// 仅允许“已选中元素”可拖拽，未选中元素不可直接按下拖动
		this.eventEmitter.on("element:select", () => {
			this.elementManager.updateAllElementsDraggable()
		})
		this.eventEmitter.on("element:deselect", () => {
			this.elementManager.updateAllElementsDraggable()
		})

		// 监听全选快捷键
		this.eventEmitter.on("keyboard:select:all", () => {
			this.userActionRegistry.execute("selection.select-all")
		})

		this.eventEmitter.on("keyboard:duplicate", () => {
			void this.userActionRegistry.execute("edit.duplicate")
		})

		// 监听复制快捷键
		this.eventEmitter.on("keyboard:copy", () => {
			this.userActionRegistry.execute("edit.copy")
		})

		// 监听复制为 PNG 快捷键
		this.eventEmitter.on("keyboard:copy-png", () => {
			this.userActionRegistry.execute("edit.copy-png")
		})

		// Ctrl/Cmd+V 路径：KeyboardManager 会把原始 ClipboardEvent 传进来。
		// 与菜单粘贴不同，这条路径可在后续解析中读取 clipboardData.files/items。
		this.eventEmitter.on("keyboard:paste", async (event) => {
			await this.userActionRegistry.execute("edit.paste", {
				clipboardEvent: event.data,
				pasteSource: "keyboard",
			})
		})

		// 监听画框快捷键
		this.eventEmitter.on("keyboard:frame:create", () => {
			this.userActionRegistry.execute("frame.create")
		})

		this.eventEmitter.on("keyboard:frame:remove", () => {
			this.userActionRegistry.execute("frame.remove")
		})

		// 监听层级移动快捷键
		this.eventEmitter.on("keyboard:layer:move-up", () => {
			this.userActionRegistry.execute("layer.move-up")
		})

		this.eventEmitter.on("keyboard:layer:move-down", () => {
			this.userActionRegistry.execute("layer.move-down")
		})

		this.eventEmitter.on("keyboard:layer:move-to-top", () => {
			this.userActionRegistry.execute("layer.move-to-top")
		})

		this.eventEmitter.on("keyboard:layer:move-to-bottom", () => {
			this.userActionRegistry.execute("layer.move-to-bottom")
		})

		// 监听可见性和锁定快捷键
		this.eventEmitter.on("keyboard:element:toggle-visible", () => {
			this.userActionRegistry.execute("element.toggle-visible")
		})

		this.eventEmitter.on("keyboard:element:toggle-lock", () => {
			this.userActionRegistry.execute("element.toggle-lock")
		})

		// 监听添加至当前对话快捷键
		this.eventEmitter.on("keyboard:conversation:add-to-current", () => {
			this.userActionRegistry.execute("conversation.add-to-current")
		})

		// 监听对齐快捷键
		this.eventEmitter.on("keyboard:align:left", () => {
			this.userActionRegistry.execute("align.left")
		})
		this.eventEmitter.on("keyboard:align:horizontal-center", () => {
			this.userActionRegistry.execute("align.horizontal-center")
		})
		this.eventEmitter.on("keyboard:align:right", () => {
			this.userActionRegistry.execute("align.right")
		})
		this.eventEmitter.on("keyboard:align:top", () => {
			this.userActionRegistry.execute("align.top")
		})
		this.eventEmitter.on("keyboard:align:vertical-center", () => {
			this.userActionRegistry.execute("align.vertical-center")
		})
		this.eventEmitter.on("keyboard:align:bottom", () => {
			this.userActionRegistry.execute("align.bottom")
		})

		// 监听分布快捷键
		this.eventEmitter.on("keyboard:distribute:horizontal", () => {
			this.userActionRegistry.execute("distribute.horizontal")
		})
		this.eventEmitter.on("keyboard:distribute:vertical", () => {
			this.userActionRegistry.execute("distribute.vertical")
		})
		this.eventEmitter.on("keyboard:distribute:auto-layout", () => {
			this.userActionRegistry.execute("distribute.auto-layout")
		})
	}

	/**
	 * 设置宽高比锁定修饰键状态（Shift 或 Meta/Command 按下时调用）
	 * @param pressed - 是否按下
	 */
	public setKeepRatioModifier(pressed: boolean): void {
		if (this.keepRatioModifierPressed === pressed) {
			return
		}

		this.keepRatioModifierPressed = pressed
		this.refreshKeepRatioModifierConsumers()
	}

	/**
	 * 重置宽高比锁定修饰键状态（窗口失焦/页面隐藏/跨焦点 keyup 时兜底）
	 */
	public resetKeepRatioModifier(): void {
		this.setKeepRatioModifier(false)
	}

	/**
	 * 检查宽高比锁定修饰键是否按下
	 * @returns 是否按下 Shift 或 Meta/Command
	 */
	public isKeepRatioModifierPressed(): boolean {
		return this.keepRatioModifierPressed
	}

	private refreshKeepRatioModifierConsumers(): void {
		this.elementManager.updateAllElementsDraggable()
		this.transformManager.setKeepRatio()
		this.cropManager.setKeepRatio()
		this.extendManager.setKeepRatio()
	}

	/**
	 * 调整画布大小
	 */
	public resize(): void {
		const previousWidth = this.stage.width()
		const previousHeight = this.stage.height()
		const width = this.container.offsetWidth
		const height = this.container.offsetHeight

		if (
			previousWidth > 0 &&
			previousHeight > 0 &&
			width > 0 &&
			height > 0 &&
			(previousWidth !== width || previousHeight !== height)
		) {
			this.viewportController.preserveViewportCenterDuringLayoutChange(
				() => {
					this.stage.width(width)
					this.stage.height(height)
				},
				{
					source: "resize",
					reason: "canvas-resize",
				},
			)
		} else {
			this.stage.width(width)
			this.stage.height(height)
		}

		this.runtimeScheduler.requestLayerDraw("stage", {
			source: "Canvas",
			reason: "resize",
			priority: "normal",
		})

		// 发布画布大小变化事件
		this.eventEmitter.emit({ type: "canvas:resize", data: { width, height } })
	}

	/**
	 * 获取Stage实例
	 */
	public getStage(): Konva.Stage {
		return this.stage
	}

	/**
	 * 加载文档数据
	 * @param doc - 画布文档
	 */
	public loadDocument(
		doc: CanvasDocument,
		options?: { elementDetailsProvenance?: ElementDetailsProvenance },
	): void {
		this.clearPreviewContent()
		const normalizedDoc = normalizeStoryboardDocument(doc)
		// Start the asset batch request before URL warmup so legacy asset:// entries
		// can share the same Canvas-level detail request instead of issuing one call
		// per media element.
		void this.assetResourceManager.preloadDocumentAssets(normalizedDoc).finally(() => {
			this.assetComplianceTaskManager.resumeDocumentCompliancePolling()
			this.refreshNameLabelIcons()
			this.refreshMediaComplianceFailedTags()
		})
		this.resourceUrlWarmupManager.warmupDocument(normalizedDoc, "loadDocument")
		this.elementDetailsRuntimeManager.replace(options?.elementDetailsProvenance)

		// 禁用历史记录，避免在加载时记录
		this.historyManager.disable()
		try {
			this.elementManager.loadDocument(normalizedDoc)
			this.connectionManager.loadDocument(normalizedDoc)
			this.connectionManager.normalizeVideoEditInputs?.()
		} finally {
			// 即使某个加载阶段出现未预期异常，也不能让历史记录永久保持禁用。
			this.historyManager.enable()
		}

		reconcileUnverifiedComplianceInDocument(this)

		// 记录初始状态
		this.historyManager.recordHistoryImmediate()

		// 初始化所有元素的名称标签
		this.nameLabelManager.initializeAllLabels()

		// 初始化所有元素的尺寸标签
		this.sizeLabelManager.initializeAllLabels()

		// 发布文档加载完成事件，通知UI层数据已更新
		this.eventEmitter.emit({ type: "document:loaded", data: undefined })
	}

	/**
	 * 智能加载文档数据
	 * @param doc - 画布文档
	 */
	public loadDocumentSmart(
		doc: CanvasDocument,
		options?: { elementDetailsProvenance?: ElementDetailsProvenance },
	): void {
		this.clearPreviewContent()
		const normalizedDoc = normalizeStoryboardDocument(doc)
		void this.assetResourceManager.preloadDocumentAssets(normalizedDoc).finally(() => {
			this.assetComplianceTaskManager.resumeDocumentCompliancePolling()
			this.refreshNameLabelIcons()
			this.refreshMediaComplianceFailedTags()
		})
		this.resourceUrlWarmupManager.warmupDocument(normalizedDoc, "loadDocumentSmart")
		if (options?.elementDetailsProvenance) {
			this.elementDetailsRuntimeManager.replace(options.elementDetailsProvenance)
		}
		const previousConnections = this.connectionManager.exportConnections()
		let didEmitDocumentRestored = false
		const unsubscribeDocumentRestored = this.eventEmitter.on("document:restored", () => {
			didEmitDocumentRestored = true
		})
		let didChangeElements = false
		try {
			didChangeElements = this.elementManager.loadDocumentSmart(normalizedDoc)
		} finally {
			unsubscribeDocumentRestored()
		}
		this.connectionManager.loadDocument(normalizedDoc)
		this.connectionManager.normalizeVideoEditInputs?.()
		const nextConnections = this.connectionManager.exportConnections()
		const didChangeConnections =
			getCanvasConnectionComparable(previousConnections) !==
			getCanvasConnectionComparable(nextConnections)
		if (!didEmitDocumentRestored && (didChangeElements || didChangeConnections)) {
			this.eventEmitter.emit({ type: "document:restored", data: undefined })
		}
		reconcileUnverifiedComplianceInDocument(this)
	}

	/**
	 * Keeps the compliance refresh entry point used by asset workflows while the
	 * failure state is represented by the name-label shield instead of an in-element card.
	 */
	public refreshMediaComplianceFailedTags(): void {
		this.refreshNameLabelIcons()
	}

	public isSeedanceComplianceEnabled(): boolean {
		return this.seedanceComplianceEnabled
	}

	public setSeedanceComplianceEnabled(enabled: boolean): void {
		if (this.seedanceComplianceEnabled === enabled) return
		this.seedanceComplianceEnabled = enabled
		if (!enabled) {
			this.assetComplianceTaskManager.stopAllComplianceWatching()
		} else {
			this.assetComplianceTaskManager.resumeDocumentCompliancePolling()
		}
		this.refreshNameLabelIcons()
		this.refreshMediaComplianceFailedTags()
	}

	/** Refreshes label icon/text state after runtime asset compliance changes. */
	public refreshNameLabelIcons(elementIds?: readonly string[]): void {
		this.nameLabelManager?.refreshIcons(elementIds)
	}

	/**
	 * 导出文档数据
	 * @param options 导出选项
	 * @param options.includeTemporary 是否包含允许进入历史的临时元素（默认 false）
	 * @returns 画布文档
	 */
	public exportDocument(options?: { includeTemporary?: boolean }): CanvasDocument {
		const doc = this.elementManager.exportDocument(options)
		const connections = this.connectionManager.exportConnections()
		return connections.length > 0 ? { ...doc, connections } : doc
	}

	/**
	 * 导出视口状态
	 * @returns 视口状态
	 */
	public exportViewport(): ViewportState {
		return {
			scale: this.viewportController.getScale(),
			x: this.stage.x(),
			y: this.stage.y(),
		}
	}

	/**
	 * 加载视口状态
	 * @param viewport 视口状态
	 */
	public loadViewport(viewport: ViewportState): void {
		this.viewportController.setScale(viewport.scale)
		this.viewportController.setPosition({ x: viewport.x, y: viewport.y })
	}

	/**
	 * 清空画布
	 */
	public clear(): void {
		// A document reset must also discard session-only Content previews. Keeping
		// the map across clear() could pin a reused element id to a Content from the
		// previous document until the next effective-content lookup happens.
		this.clearPreviewContent()
		this.elementManager.clear()
		this.connectionManager.clear({ emitChange: false })
		this.markerManager.clear()

		// 发布画布清空事件
		this.eventEmitter.emit({ type: "canvas:clear", data: undefined })
	}

	/**
	 * 批量切换元素可见性
	 * @param visible - 目标可见性状态
	 */
	public toggleElementsVisibility(visible: boolean): void {
		const selectedIds = this.selectionManager.getSelectedIds()
		const changedIds = selectedIds.filter((id) => {
			const element = this.elementManager.getElementData(id)
			return element !== undefined && (element.visible ?? true) !== visible
		})
		if (changedIds.length === 0) return

		// 批量更新
		const updates = changedIds.map((id) => ({
			id,
			data: { visible },
		}))

		this.historyManager.runTransaction(() => {
			this.elementManager.batchUpdate(updates)
			if (!visible) this.deselectHiddenElements()
		})
	}

	/**
	 * 自动切换元素可见性（根据当前状态）
	 */
	public autoToggleElementsVisibility(): void {
		const selectedIds = this.selectionManager.getSelectedIds()
		if (selectedIds.length === 0) return

		// 获取所有选中元素
		const selectedElements = selectedIds
			.map((id) => this.elementManager.getElementData(id))
			.filter((el) => el !== undefined)

		// 判断是否全部可见
		const allVisible = selectedElements.every((el) => el.visible !== false)

		// 切换到相反状态
		this.toggleElementsVisibility(!allVisible)
	}

	/**
	 * 批量切换元素锁定状态
	 * @param locked - 目标锁定状态
	 */
	public toggleElementsLock(locked: boolean): void {
		const selectedIds = this.selectionManager.getSelectedIds()
		if (selectedIds.length === 0) return

		// 批量更新
		const updates = selectedIds.map((id) => ({
			id,
			data: { locked },
		}))

		this.elementManager.batchUpdate(updates)
	}

	/**
	 * 自动切换元素锁定状态（根据当前状态）
	 */
	public autoToggleElementsLock(): void {
		const selectedIds = this.selectionManager.getSelectedIds()
		if (selectedIds.length === 0) return

		// 获取所有选中元素
		const selectedElements = selectedIds
			.map((id) => this.elementManager.getElementData(id))
			.filter((el) => el !== undefined)

		// 判断是否全部未锁定
		const allUnlocked = selectedElements.every((el) => el.locked !== true)

		// 切换到相反状态
		this.toggleElementsLock(allUnlocked)
	}

	/**
	 * 设置单个元素的锁定状态
	 * @param elementId - 元素ID
	 * @param locked - 锁定状态
	 */
	public setElementLock(elementId: string, locked: boolean): void {
		this.elementManager.update(elementId, { locked })
	}

	/**
	 * 设置单个元素的可见性
	 * @param elementId - 元素ID
	 * @param visible - 可见性状态
	 */
	public setElementVisible(elementId: string, visible: boolean): void {
		const element = this.elementManager.getElementData(elementId)
		if (!element || (element.visible ?? true) === visible) return

		// 图层眼睛的一次点击立即形成历史，不等待普通连续更新的防抖。
		this.historyManager.runTransaction(() => {
			this.elementManager.setElementVisible(elementId, visible)
			if (!visible) this.deselectHiddenElements()
		})
	}

	private deselectHiddenElements(): void {
		// 隐藏父容器也会让已选择的子项不可见；以后仍可从图层面板主动选择它们。
		for (const id of this.selectionManager.getSelectedIds()) {
			if (!this.elementManager.isElementVisibleInDataTree(id)) {
				this.selectionManager.deselect(id)
			}
		}
	}

	/**
	 * 删除所有选中的元素
	 */
	public deleteSelectedElements(): void {
		const selectedIds = this.selectionManager.getSelectedIds()
		if (selectedIds.length === 0) return

		// 使用 PermissionManager 过滤可删除的元素
		const deletableElementIds = selectedIds.filter((id) => {
			const elementData = this.elementManager.getElementData(id)
			return this.permissionManager.canDelete(elementData)
		})

		if (deletableElementIds.length === 0) {
			// 所有选中的元素都不可删除，不执行删除
			return
		}

		// 先统一清空选区，避免批量删除过程中对剩余选区重复重建 Transformer/高亮
		this.selectionManager.deselectAll()

		// 使用批量删除方法
		this.elementManager.batchDelete(deletableElementIds)
	}

	/**
	 * 删除当前选区。元素选区和业务关联线选区相互独立，但删除操作需要合并成一次用户意图。
	 */
	public deleteSelection(): void {
		const selectedConnectionIds = this.connectionManager.getSelectedConnectionIds()
		const selectedElementIds = this.selectionManager.getSelectedIds()
		const deletableElementIds = selectedElementIds.filter((id) => {
			const elementData = this.elementManager.getElementData(id)
			return this.permissionManager.canDelete(elementData)
		})

		if (selectedConnectionIds.length === 0 && deletableElementIds.length === 0) {
			return
		}

		if (selectedConnectionIds.length > 0 && deletableElementIds.length > 0) {
			this.historyManager.disable()
			try {
				this.connectionManager.deleteSelectedConnections()
			} finally {
				this.historyManager.enable()
			}
			this.deleteSelectedElements()
			return
		}

		if (selectedConnectionIds.length > 0) {
			this.connectionManager.deleteSelectedConnections()
			return
		}

		this.deleteSelectedElements()
	}

	public setAccessContext(update: CanvasAccessUpdate): void {
		const accessChanged = this.permissionManager.setAccessContext(update)
		if (!accessChanged) return
		const canWrite = this.permissionManager.can("document.write")
		const canGenerate = this.permissionManager.can("sideEffect.generate")
		if (canWrite) this.clearPreviewContent()
		if (!this.permissionManager.can("interaction.playback")) {
			this.mediaPlaybackCoordinator.pauseAll()
		}
		if (!canWrite) {
			this.cropManager.cancelCrop()
			this.mediaReplaceController.cancel()
			this.elementRenameManager.cancelRename()
			this.toolManager.setActiveToolByType(ToolTypeEnum.Select)
		}
		if (!canWrite || !canGenerate) {
			this.extendManager.cancelExtend()
			this.eraserManager.cancelEraser()
		}
		if (!this.permissionManager.can("interaction.select")) {
			this.selectionManager.deselectAll()
		}
		this.elementManager.updateAllElementsDraggable()
		this.eventEmitter.emit({
			type: "permission:changed",
			data: this.permissionManager.getContext(),
		})
	}

	public getEffectiveContentId(elementId: string): string | undefined {
		const element = this.elementManager.getElementData(elementId) as
			ContentViewElement | undefined
		const previewContentId = this.previewContentIds.get(elementId)
		const resolution = resolveEffectiveContentIdForElement(element, previewContentId)
		if (previewContentId && !resolution.previewMatched) {
			this.previewContentIds.delete(elementId)
		}
		return resolution.contentId
	}

	public getEffectiveContent<T extends { contentId: string }>(elementId: string): T | undefined {
		const element = this.elementManager.getElementData(elementId) as
			(LayerElement & { contents?: readonly T[] }) | undefined
		if (!element || !Array.isArray(element.contents)) return undefined
		const contentId = this.getEffectiveContentId(elementId)
		return element.contents.find((content) => content.contentId === contentId) as T | undefined
	}

	/**
	 * 为只读 Content 预览构造一个临时的元素数据投影。
	 * 返回值只供下载、复制等外部读取路径使用，不会交给 ElementManager 写回文档。
	 */
	public getElementForContentView<T extends LayerElement>(element: T): T {
		const previewContentId = this.previewContentIds.get(element.id)
		const { contentId: effectiveContentId } = resolveEffectiveContentIdForElement(
			element as ContentViewElement,
			previewContentId,
		)
		if (
			!effectiveContentId ||
			effectiveContentId === element.activeContentId ||
			!("contents" in element) ||
			!element.contents?.some((content) => content.contentId === effectiveContentId)
		) {
			return element
		}
		return { ...element, activeContentId: effectiveContentId } as T
	}

	public setPreviewContent(elementId: string, contentId: string): boolean {
		if (
			!this.permissionManager.can("interaction.switchContent") ||
			this.permissionManager.can("document.write")
		)
			return false
		const element = this.elementManager.getElementData(elementId)
		if (
			!element ||
			!("contents" in element) ||
			!element.contents?.some((c) => c.contentId === contentId)
		) {
			return false
		}
		if (this.getEffectiveContentId(elementId) === contentId) return true
		this.previewContentIds.set(elementId, contentId)
		this.eventEmitter.emit({ type: "content:previewChanged", data: { elementId, contentId } })
		this.elementManager.getElementInstance(elementId)?.rerender()
		return true
	}

	public clearPreviewContent(elementId?: string): void {
		const affectedElementIds = elementId
			? this.previewContentIds.has(elementId)
				? [elementId]
				: []
			: [...this.previewContentIds.keys()]
		if (elementId) this.previewContentIds.delete(elementId)
		else this.previewContentIds.clear()
		for (const affectedElementId of affectedElementIds) {
			this.elementManager.getElementInstance(affectedElementId)?.rerender()
		}
		if (affectedElementIds.length > 0) {
			this.eventEmitter.emit({
				type: "content:previewChanged",
				data: { elementId, contentId: undefined },
			})
		}
	}

	/**
	 * 设置翻译函数
	 * @param t - 翻译函数
	 */
	public setT(t?: TFunction): void {
		this.t = t
		this.elementManager.rerenderAllElementsForLocale()
		this.nameLabelManager.refreshAfterLocaleChange()
		this.sizeLabelManager.refreshAfterLocaleChange()
		this.runtimeScheduler.requestLayerDraw("stage", {
			source: "Canvas",
			reason: "locale-change",
			priority: "normal",
		})
	}

	/** 清空生图/生视频工具内的模型列表缓存（与 Magic 配置或语言切换对齐） */
	public invalidateMagicModelListCaches(): void {
		this.toolManager.invalidateMagicModelListCaches()
	}

	/**
	 * 设置设备形态、布局和输入能力
	 */
	public updateDeviceInfo(getDevice?: () => CanvasDeviceInfo): void {
		const previous = this.deviceInfo
		const current = getDevice ? getDevice() : getDefaultCanvasDeviceInfo()
		if (areCanvasDeviceInfoEqual(previous, current)) {
			return
		}

		this.deviceInfo = current
		this.eventEmitter.emit({
			type: "canvas:devicechange",
			data: { previous, current },
		})
	}

	/**
	 * 收集指定 Layer 中的所有节点
	 * @param layer - 要收集的 Layer 实例
	 * @returns 所有节点的数组（排除背景和运行时辅助节点）
	 */
	public collectLayerNodes(layer: Konva.Layer): Konva.Node[] {
		const nodes: Konva.Node[] = []
		const collectRecursive = (node: Konva.Node): void => {
			// 排除背景和运行时辅助节点
			if (node.name() === "canvas-background" || node.name() === "canvas-connections") {
				return
			}
			nodes.push(node)
			if (node instanceof Konva.Group) {
				node.getChildren().forEach((child) => collectRecursive(child))
			}
		}
		layer.getChildren().forEach((child) => collectRecursive(child))
		return nodes
	}

	/**
	 * 获取所有 Layer 的映射
	 * @returns Layer 名称到 Layer 实例的映射
	 */
	public getAllLayers(): Map<string, Konva.Layer> {
		return new Map([
			["content", this.contentLayer],
			["selection", this.selectionLayer],
			["markers", this.markersLayer],
			["controls", this.controlsLayer],
			["overlay", this.overlayLayer],
		])
	}

	/**
	 * 确保连接线 Group 存在于 contentLayer 底部：背景之上，元素之下。
	 */
	public ensureConnectionGroup(): Konva.Group {
		if (this.connectionGroup.getParent() !== this.contentLayer) {
			this.connectionGroup = new Konva.Group({
				name: "canvas-connections",
				listening: true,
			})
			this.contentLayer.add(this.connectionGroup)
		}

		// 连线组层级稳定后不再触发重排，也避免在每次连线渲染时遍历整棵内容树。
		if (this.connectionGroup.zIndex() !== 0) {
			this.connectionGroup.moveToBottom()
		}
		return this.connectionGroup
	}

	public handleResourceReferenceResolverChanged(options?: {
		changedWorkspacePaths?: readonly string[]
	}): void {
		const changedWorkspacePaths = options?.changedWorkspacePaths
		this.canvasFileUploadManager?.reconcilePendingResourcePaths(changedWorkspacePaths)
		let affectedElementIds: Set<string> | undefined
		let changedResourceIdentities: Set<string> | undefined
		if (changedWorkspacePaths !== undefined) {
			const resolver = getCanvasHostResourceReferenceResolver(this)
			const resolvedResourceIdentities = new Set<string>()
			let canScopeChange = Boolean(resolver)
			if (resolver) {
				for (const path of changedWorkspacePaths) {
					const resolution = resolver({ namespace: "workspace-path", path })
					if (resolution.status !== "resolved") {
						canScopeChange = false
						break
					}
					resolvedResourceIdentities.add(resolution.identity)
				}
			}

			if (canScopeChange && resolver) {
				changedResourceIdentities = resolvedResourceIdentities
				affectedElementIds = new Set<string>()
				for (const elementId of this.elementManager.getAllElementIds()) {
					const path = getElementResourceReferencePath(
						this,
						this.elementManager.getElementData?.(elementId) as LayerElement | undefined,
					)
					if (!path) continue
					const resolution = resolveCanvasStorageResourceReference(path, resolver)
					if (resolution.status !== "resolved") {
						// 无法证明元素不受影响时必须回退全量重绑，禁止路径后缀猜测。
						affectedElementIds = undefined
						break
					}
					if (changedResourceIdentities.has(resolution.identity)) {
						affectedElementIds.add(elementId)
					}
				}
			}
		}
		if (affectedElementIds?.size === 0) {
			return
		}
		const resolverChangeOptions: CanvasResourceReferenceResolverChangeOptions | undefined =
			changedResourceIdentities ? { changedResourceIdentities } : undefined
		this.imageResourceManager.handleResourceReferenceResolverChanged(resolverChangeOptions)
		this.audioResourceManager.handleResourceReferenceResolverChanged(resolverChangeOptions)
		this.audioWaveformManager.handleResourceReferenceResolverChanged(resolverChangeOptions)
		this.imagePresentationScheduler.handleResourceReferenceResolverChanged(
			resolverChangeOptions,
		)
		this.visibilityManager.handleResourceReferenceResolverChanged(resolverChangeOptions)
		this.resourceUrlWarmupManager.handleResourceReferenceResolverChanged(resolverChangeOptions)
		this.elementManager.getAllElementIds().forEach((elementId) => {
			if (affectedElementIds && !affectedElementIds.has(elementId)) return
			this.elementManager.getElementInstance(elementId)?.onResourceReferenceResolverChanged()
		})
	}

	/**
	 * 统一切换图片和视频的标题、分辨率标签显示模式，确保两个标签管理器保持一致。
	 */
	public setMediaLabelsAlwaysVisible(alwaysVisible: boolean): void {
		if (this.mediaLabelsAlwaysVisible === alwaysVisible) return
		this.mediaLabelsAlwaysVisible = alwaysVisible
		// 两种标签会互相通知；先统一模式，关闭时不再按另一管理器的旧常驻状态布局。
		this.nameLabelManager.setMediaLabelsAlwaysVisible(alwaysVisible, false)
		this.sizeLabelManager.setMediaLabelsAlwaysVisible(alwaysVisible, false)
		this.nameLabelManager.syncMediaLabelsVisibility()
		this.sizeLabelManager.syncMediaLabelsVisibility()
	}

	public isMediaLabelsAlwaysVisible(): boolean {
		return this.mediaLabelsAlwaysVisible
	}

	/**
	 * 销毁画布
	 */
	public destroy(): void {
		if (this.destroyed) return
		this.destroyed = true

		this.mediaEditRecoveryManager.clearAll()
		this.visibilityManager.destroy()
		this.imagePresentationScheduler.destroy()
		this.resourceUrlWarmupManager.destroy()
		this.audioWaveformManager.destroy()
		this.resourceScheduler.destroy()
		this.runtimeScheduler.destroy()

		if (this.resizeObserver) {
			this.resizeObserver.disconnect()
			this.resizeObserver = null
		}
		if (this.containerContextMenuHandler) {
			this.container.removeEventListener("contextmenu", this.containerContextMenuHandler)
			this.containerContextMenuHandler = null
		}
		if (this.stageContextMenuHandler) {
			this.stage.off("contextmenu", this.stageContextMenuHandler)
			this.stageContextMenuHandler = null
		}
		if (this.stageBlankClickHandler) {
			this.stage.off("mousedown", this.stageBlankClickHandler)
			this.stageBlankClickHandler = null
		}
		if (this.stageDoubleClickHandler) {
			this.stage.off("dblclick", this.stageDoubleClickHandler)
			this.stageDoubleClickHandler = null
		}
		this.previousBlankClickPoint = null
		this.lastBlankClickPoint = null

		// 移除 window 点击监听器
		if (this.handleWindowClick) {
			window.removeEventListener("click", this.handleWindowClick, true)
			this.handleWindowClick = null
		}

		// 图片特殊编辑退出依赖事件系统、元素、选择、Marker 和 Cursor Manager。
		// 必须在拆除这些依赖前结束会话，否则活动裁剪恢复元素时会访问已清空的 ElementManager。
		this.cropManager.destroy()
		this.extendManager.destroy()
		this.eraserManager.destroy()
		this.imageEditingCoordinator.destroy()
		this.videoCompositionManager?.destroy()
		this.videoDraftFinalManager?.destroy()
		this.generationRuntimeManager.destroy()
		this.elementDetailsRuntimeManager?.setOnChange(undefined)
		this.mediaPlaybackCoordinator.destroy()
		this.videoEditPlaybackManager.destroy()
		this.audioPlaybackManager.destroy()
		this.audioReplaceController.destroy()
		this.imageReplaceController.destroy()
		this.mediaReplaceController?.destroy()
		this.storyboardInteractionManager.destroy()
		this.videoEditInteractionManager.destroy()
		this.videoContinuationManager.destroy()
		this.assetCompliancePollingManager.destroy()
		this.assetImportManager.destroy()

		// 清理所有事件监听器, 切断 Manager 之间的通信
		this.eventEmitter.removeAllListeners()

		this.dropOverlayManager.destroy()
		this.cursorManager.destroy()
		this.permissionManager.destroy()
		this.imageBatchPollingRegistry.destroy()
		this.viewportQueryCoordinator.destroy()
		this.elementManager.destroy()
		this.geometryCacheManager.destroy()
		this.connectionManager.destroy()
		this.connectionAssociationSeedManager?.destroy()
		this.connectionDragManager.destroy()
		this.connectionHandleOverlayManager.destroy()
		this.viewportController.destroy()
		this.selectionManager.destroy()
		this.transformManager.destroy()
		this.hoverManager.destroy()
		this.videoPlaybackInteractionManager.destroy()
		this.toolManager.destroy()
		this.inputManager.destroy()
		this.keyboardManager.destroy()
		this.alignmentManager.destroy()
		this.frameManager.destroy()
		this.historyManager.destroy()
		this.markerManager.destroy()
		this.snapGuideManager.destroy()
		this.elementRenameManager.destroy()
		this.textEditingManager.destroy()
		this.textFormattingManager.destroy()
		this.nameLabelManager.destroy()
		this.sizeLabelManager.destroy()
		this.backgroundManager.destroy()
		this.canvasFileUploadManager.destroy()

		// 清理图片资源管理器
		this.imageResourceManager.destroy()
		this.submitImageWorkerManager.destroy()
		this.videoPlaybackManager.destroy()
		this.videoResourceManager.destroy()
		this.audioResourceManager.destroy()
		this.assetResourceManager.destroy()
		this.mediaResourceOfflineCacheManager.destroy()
		this.pluginManager.destroy()
		this.stage.destroy()
	}
}
