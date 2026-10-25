import type { AttachmentLoadState } from "@/stores/projectFiles/types"
import { makeAutoObservable, observable, reaction, runInAction } from "mobx"
import {
	SlideLoaderService,
	SlideProcessorService,
	createScreenshotService,
	createPPTLogger,
	PPTPathMappingService,
	PPTIncrementalUpdateService,
	PPTSlideContentScheduler,
} from "../services"
import type {
	SlideProcessorConfig,
	PPTLoggerConfig,
	IncrementalUpdateContext,
	PPTSlideContentPriority,
	SlideScreenshotRequestKind,
	SlideScreenshotService,
} from "../services"
import { getTemporaryDownloadUrl } from "@/pages/superMagic/utils/api"
import {
	getFileSaveQueue,
	peekUnsyncedDraft,
	stringifySaveContent,
} from "../../../services/fileSaveQueue"
import type { FileApi } from "@/pages/superMagic/fileAccess/fileApi"
import type { SlideItem } from "../PPTSidebar/types"
import { getPPTPreviewOverscan } from "../PPTSidebar/utils/devicePerformance"
import { PPTSlideManager } from "./PPTSlideManager"
import { PPTLoadingManager } from "./PPTLoadingManager"
import { PPTViewStateManager } from "./PPTViewStateManager"
import { PPTScreenshotManager } from "./PPTScreenshotManager"
import { PPTActiveIndexCacheManager } from "./PPTActiveIndexCacheManager"
import type { AttachmentItem } from "../../../../TopicFilesButton/hooks"
import type {
	PPTThumbnailCacheContext,
	PPTThumbnailCacheMode,
	PPTThumbnailCacheScope,
} from "../services/PPTThumbnailCache"

/**
 * Configuration for PPTStore
 */
export interface PPTStoreConfig {
	/** 已授权预览的稳定身份；匿名或归属不完整时不使用持久缓存。 */
	thumbnailCacheScope?: PPTThumbnailCacheScope
	attachmentLoadState?: AttachmentLoadState
	projectId?: string
	attachments?: any[]
	attachmentList?: any[]
	mainFileId?: string
	mainFileName?: string
	displayConfig?: any
	/**
	 * Whether to automatically load slides and generate screenshots
	 * when slides are initialized
	 * @default true
	 */
	autoLoadAndGenerate?: boolean
	/**
	 * Maximum number of slide HTML download/processing tasks allowed at once.
	 * @default 4
	 */
	contentLoadConcurrency?: number
	/**
	 * Number of slide HTML files to preload on each side while fullscreen.
	 * Defaults to the adaptive 5/10/15-page device tier window.
	 */
	fullscreenContentPreloadRadius?: number
	/**
	 * Preferred initial slide before the first HTML request is scheduled.
	 * Cached restoration may still override it after initialization.
	 */
	initialActiveIndex?: number
	/**
	 * Logger configuration
	 */
	logger?: PPTLoggerConfig
	/**
	 * Cache configuration for activeIndex persistence
	 * 缓存配置，用于持久化 activeIndex
	 */
	organizationCode?: string
	selectedProjectId?: string
	/**
	 * Whether to enable activeIndex caching
	 * @default true
	 */
	enableCache?: boolean
	/**
	 * Quiet period before reloading slide HTML after file writes.
	 * @default PPT_FILE_UPDATE_DEBOUNCE_MS
	 */
	fileUpdateDebounceMs?: number
	fileApi?: FileApi
}

export const PPT_FILE_UPDATE_DEBOUNCE_MS = 800

function hasOwnConfigField<K extends keyof PPTStoreConfig>(
	config: Partial<PPTStoreConfig>,
	field: K,
): boolean {
	return Object.prototype.hasOwnProperty.call(config, field)
}

function isFileApiOnlyConfig(config: Partial<PPTStoreConfig>): boolean {
	return (
		hasOwnConfigField(config, "fileApi") &&
		Object.keys(config).every((key) => key === "fileApi")
	)
}

function getFileApiIdentityKey(fileApi?: FileApi): string {
	return fileApi?.identityKey ?? "none"
}

export interface PPTExportConfig extends PPTStoreConfig {}

interface SlideLoadTarget {
	url: string
	indexHint?: number
	path?: string
	fileId?: string
}

interface SlideContentLoadOptions {
	signal?: AbortSignal
	generation?: number
}

interface InitializeSlidesOptions {
	configUpdateVersion?: number
}

type FullscreenContentPriority = Extract<
	PPTSlideContentPriority,
	"fullscreen-near" | "fullscreen-far"
>

interface FullscreenContentDemand {
	index: number
	key: string
	priority: FullscreenContentPriority
}

/**
 * PPTStore - Main store that coordinates all managers
 * Provides a unified API for PPT operations
 */
export class PPTStore {
	// ==================== Manager Instances ====================
	private slideManager: PPTSlideManager
	private loadingManager: PPTLoadingManager
	private viewStateManager: PPTViewStateManager
	private screenshotManager: PPTScreenshotManager
	private cacheManager: PPTActiveIndexCacheManager

	// ==================== Service Instances ====================
	private config: PPTStoreConfig
	/** Only visibility needs reactive config reads; attachments remain outside MobX conversion. */
	private hiddenSlidePaths: unknown
	/** Small deck metadata is reactive independently from the large attachment config. */
	transitions: unknown
	private loaderService: SlideLoaderService
	private processorService: SlideProcessorService
	private readonly screenshotService: SlideScreenshotService
	private logger: ReturnType<typeof createPPTLogger>
	/** Path mapping service - public for optimistic updates */
	pathMappingService: PPTPathMappingService
	private incrementalUpdateService: PPTIncrementalUpdateService
	private attachmentListSnapshot: AttachmentItem[] | undefined
	private fileUpdateDebounceTimer: ReturnType<typeof setTimeout> | null = null
	private pendingPreviewFileIds = new Set<string>()
	private readonly fileUpdateDebounceMs: number

	// ==================== Optimization Fields ====================
	private initializingPromise: Promise<void> | null = null
	private initializingKey: string | null = null
	private contentScheduler: PPTSlideContentScheduler
	private contentGeneration = 0
	private contentGenerationController = new AbortController()
	private configUpdateVersion = 0
	private readonly contentLoadConcurrency: number
	private visiblePreviewKeys: Set<string> = new Set()
	private fullscreenContentPriorities = new Map<string, FullscreenContentPriority>()
	private activeContentKey: string | null = null
	private activeIndexAutoSaveDisposer: (() => void) | null = null
	private queueUnsubscribe: (() => void) | null = null
	private disposed = false
	/** Normal viewer keeps the current slide and its immediate neighbors mounted. */
	private readonly normalRenderWindowSize = 1
	/**
	 * Render window size - number of slides to render before/after active slide
	 * 渲染窗口大小 - 在当前幻灯片前后渲染的幻灯片数量
	 */
	private renderWindowSize = 2
	/** HTML is prefetched farther than the iframe render window so fullscreen navigation stays warm. */
	private readonly fullscreenContentPreloadRadius: number
	/**
	 * Track manually saved slides by fileId to skip loading indicator
	 * 追踪手动保存的幻灯片（通过 fileId），用于跳过加载指示器
	 */
	private manuallySavedSlides: Set<string> = new Set()
	/**
	 * Track slides that have screenshot generation in progress
	 * Tokens prevent an old deck's finally block from clearing a newer request with the same key.
	 */
	private generatingScreenshots: Map<string, symbol> = new Map()
	/** Automatic sidebar screenshots can be cancelled independently when fullscreen takes over. */
	private previewScreenshotKeys: Set<string> = new Set()
	/**
	 * Track slide editing states by fileId
	 * 追踪每个幻灯片的编辑状态（通过 fileId）
	 */
	private slideEditingStates: Map<string, boolean> = new Map()
	/**
	 * Track server updated content by fileId
	 * 追踪每个幻灯片的服务端更新内容（通过 fileId）
	 */
	private slideServerUpdates: Map<string, string> = new Map()
	/**
	 * Whether to show button text in toolbar (based on container width)
	 * 是否在工具栏中显示按钮文字（基于容器宽度）
	 */
	shouldShowButtonText: boolean = true

	constructor(config: PPTStoreConfig) {
		this.config = config
		this.hiddenSlidePaths = config.displayConfig?.hidden_slides
		this.transitions = config.displayConfig?.transitions
		this.attachmentListSnapshot = this.snapshotAttachmentList(config.attachmentList)
		this.fileUpdateDebounceMs = Math.max(
			0,
			Math.floor(config.fileUpdateDebounceMs ?? PPT_FILE_UPDATE_DEBOUNCE_MS),
		)
		this.contentLoadConcurrency = Math.max(1, Math.floor(config.contentLoadConcurrency ?? 4))
		const configuredFullscreenRadius = config.fullscreenContentPreloadRadius
		const adaptiveFullscreenRadius = getPPTPreviewOverscan()
		this.fullscreenContentPreloadRadius = Math.max(
			this.renderWindowSize,
			Math.floor(
				typeof configuredFullscreenRadius === "number" &&
					Number.isFinite(configuredFullscreenRadius)
					? configuredFullscreenRadius
					: adaptiveFullscreenRadius,
			),
		)
		this.contentScheduler = new PPTSlideContentScheduler(this.contentLoadConcurrency)

		// Initialize services
		this.loaderService = new SlideLoaderService()
		this.processorService = new SlideProcessorService({
			attachments: config.attachments,
			attachmentList: config.attachmentList,
			mainFileId: config.mainFileId,
			mainFileName: config.mainFileName,
			displayConfig: config.displayConfig,
			fileApi: config.fileApi,
		})
		this.screenshotService = createScreenshotService()
		this.logger = createPPTLogger(config.logger)
		this.pathMappingService = new PPTPathMappingService(config, this.logger)
		this.incrementalUpdateService = new PPTIncrementalUpdateService(
			this.pathMappingService,
			this.screenshotService,
			this.logger,
		)

		// Initialize managers
		this.slideManager = new PPTSlideManager(
			this.logger,
			this.pathMappingService,
			this.screenshotService,
			config.autoLoadAndGenerate !== false,
		)
		this.loadingManager = new PPTLoadingManager(this.logger)
		this.viewStateManager = new PPTViewStateManager(this.logger)
		this.screenshotManager = new PPTScreenshotManager(this.logger, this.screenshotService)
		this.cacheManager = new PPTActiveIndexCacheManager(this.logger, {
			organizationCode: config.organizationCode,
			selectedProjectId: config.selectedProjectId,
			mainFileId: config.mainFileId,
		})

		this.logger.info("PPTStore 已初始化", {
			operation: "constructor",
			metadata: {
				autoLoadAndGenerate: config.autoLoadAndGenerate,
				hasAttachments: !!config.attachments,
				hasAttachmentList: !!config.attachmentList,
				mainFileId: config.mainFileId,
				enableCache: config.enableCache !== false,
			},
		})

		const pptWindow = window as typeof window & { pptStore?: PPTStore }
		pptWindow.pptStore = this

		makeAutoObservable(
			this,
			{
				config: false,
				hiddenSlidePaths: observable.ref,
				transitions: observable.ref,
				attachmentListSnapshot: false,
				initializingPromise: false,
				initializingKey: false,
				contentScheduler: false,
				screenshotService: false,
				contentGeneration: false,
				contentGenerationController: false,
				configUpdateVersion: false,
				contentLoadConcurrency: false,
				visiblePreviewKeys: false,
				fullscreenContentPriorities: false,
				activeContentKey: false,
				fullscreenContentPreloadRadius: false,
				previewScreenshotKeys: false,
				activeIndexAutoSaveDisposer: false,
				queueUnsubscribe: false,
				disposed: false,
				normalRenderWindowSize: false,
			} as Record<string, false | typeof observable.ref>,
			{ autoBind: true },
		)

		this.queueUnsubscribe = getFileSaveQueue().subscribe(() => {
			if (this.disposed) return
			void this.incrementalUpdateService.flushStagedRemoteUpdates(
				this.createIncrementalUpdateContext(this.configUpdateVersion),
			)
		})

		// Setup auto-save for activeIndex when cache is enabled
		if (config.enableCache !== false) {
			this.setupAutoSave()
		}
	}

	private snapshotAttachmentList(
		attachmentList: any[] | undefined,
	): AttachmentItem[] | undefined {
		if (!Array.isArray(attachmentList)) return undefined
		return attachmentList.map((item) => {
			const snapshot = { ...item }
			if (Array.isArray(item?.children)) {
				snapshot.children = this.snapshotAttachmentList(item.children)
			}
			return snapshot
		})
	}

	private findAttachmentByFileId(fileId: string, list: any[] | undefined): any | undefined {
		if (!Array.isArray(list)) return undefined
		for (const item of list) {
			if (item?.file_id === fileId) return item
			const child = this.findAttachmentByFileId(fileId, item?.children)
			if (child) return child
		}
		return undefined
	}

	private hasAttachmentFileId(fileId: string, list: any[] | undefined): boolean {
		if (!this.findAttachmentByFileId(fileId, list)) return false
		const pptFolderFileIds = this.pathMappingService.getPPTFolderFileIds()
		if (pptFolderFileIds.size > 0) return pptFolderFileIds.has(fileId)
		const pptFolderPath = this.pathMappingService.getPPTFolderPath()
		if (!pptFolderPath) return true
		return Boolean(this.findAttachmentByFileIdInFolder(fileId, list, pptFolderPath))
	}

	private findAttachmentByFileIdInFolder(
		fileId: string,
		list: any[] | undefined,
		folderPath: string,
	): any | undefined {
		if (!Array.isArray(list)) return undefined
		for (const item of list) {
			if (
				item?.file_id === fileId &&
				typeof item?.relative_file_path === "string" &&
				item.relative_file_path.startsWith(folderPath)
			) {
				return item
			}
			const child = this.findAttachmentByFileIdInFolder(fileId, item?.children, folderPath)
			if (child) return child
		}
		return undefined
	}

	private getRelativeFilePathByFileId(fileId?: string): string | undefined {
		return this.pathMappingService.getRelativeFilePathByFileId(fileId)
	}

	private getSlideFileId(slide: SlideItem | undefined): string | undefined {
		if (!slide) return undefined
		return (
			this.pathMappingService.getFileIdByPath(slide.path) ||
			this.pathMappingService.extractFileIdFromPath(slide.path)
		)
	}

	/** Raw HTML to render: an unsynced draft wins over what the server returned. */
	private resolveSlideSource(fileId: string | undefined, serverContent: string): string {
		if (!fileId) return serverContent
		const pending = peekUnsyncedDraft(fileId)
		return pending === undefined ? serverContent : stringifySaveContent(pending)
	}

	async applyUnsyncedDraft(fileId: string, content: unknown): Promise<void> {
		const html = stringifySaveContent(content)
		const findIndex = () =>
			this.slides.findIndex((slide) => this.getSlideFileId(slide) === fileId)
		const initialIndex = findIndex()
		if (initialIndex === -1) return
		// Drafts are raw editor HTML; `content` must hold processed HTML.
		const processed = await this.processorService.processSlide(
			html,
			initialIndex,
			this.getRelativeFilePathByFileId(fileId),
		)
		const latest = peekUnsyncedDraft(fileId)
		if (latest !== undefined && stringifySaveContent(latest) !== html) return
		runInAction(() => {
			const index = findIndex()
			if (index === -1) return
			this.slides[index].rawContent = html
			this.slides[index].content = processed.content
			this.slides[index].resourceVersionSignature = processed.resourceVersionSignature
			this.slides[index].loadingState = "loaded"
			this.slides[index].loadingError = undefined
			this.slides[index].lastLoadedAt = Date.now()
		})
	}

	private getSlideStableKey(slide: SlideItem | undefined, fallbackIndex?: number): string {
		if (!slide) return `missing-${fallbackIndex ?? "unknown"}`
		return this.getSlideFileId(slide) || slide.path || slide.url || `slide-${fallbackIndex}`
	}

	private isFullscreenContentPriority(
		priority: PPTSlideContentPriority,
	): priority is FullscreenContentPriority {
		return priority === "fullscreen-near" || priority === "fullscreen-far"
	}

	/** Cancel obsolete work and restore an unfinished slide to a schedulable state. */
	private cancelContentTask(key: string): number | null {
		const index = this.findSlideIndexByStableKey(key)
		this.contentScheduler.cancel(key)

		if (index !== -1) {
			runInAction(() => {
				const slide = this.slides[index]
				if (slide?.loadingState === "loading" && !slide.content) {
					slide.loadingState = "idle"
					slide.loadingError = undefined
				}
			})
		}

		return index === -1 ? null : index
	}

	/** Resume whichever non-active demand still owns a task after active navigation preempts it. */
	private resumeContentDemand(index: number): void {
		const slide = this.slides[index]
		if (!slide) return

		const key = this.getSlideStableKey(slide, index)
		const fullscreenPriority = this.fullscreenContentPriorities.get(key)
		if (fullscreenPriority) {
			void this.ensureSlideContent(index, fullscreenPriority)
		}
		if (this.visiblePreviewKeys.has(key)) {
			void this.ensureSlidePreview(index, "preview")
		}
	}

	/**
	 * Replace fullscreen HTML demand before scheduling the active page. The content window is wider
	 * than the iframe render window, but it never generates thumbnails or mounts extra iframes.
	 */
	private prepareFullscreenContentDemand(): FullscreenContentDemand[] {
		const previousPriorities = this.fullscreenContentPriorities
		const nextPriorities = new Map<string, FullscreenContentPriority>()
		const demands: FullscreenContentDemand[] = []

		if (
			this.isFullscreen &&
			this.config.autoLoadAndGenerate !== false &&
			this.slides.length > 0
		) {
			for (let distance = 1; distance <= this.fullscreenContentPreloadRadius; distance++) {
				// Prefer the next page at equal distance because fullscreen playback usually moves forward.
				const candidateIndices = [this.activeIndex + distance, this.activeIndex - distance]
				candidateIndices.forEach((index) => {
					const slide = this.slides[index]
					if (!slide) return
					const key = this.getSlideStableKey(slide, index)
					if (nextPriorities.has(key)) return
					const priority: FullscreenContentPriority =
						distance <= this.renderWindowSize ? "fullscreen-near" : "fullscreen-far"
					nextPriorities.set(key, priority)
					demands.push({ index, key, priority })
				})
			}
		}

		this.fullscreenContentPriorities = nextPriorities
		// Retained fullscreen work may move from the near band to the far band (or vice versa).
		// Reorder that shared task explicitly; ordinary duplicate demand is upgrade-only.
		nextPriorities.forEach((priority, key) => {
			if (previousPriorities.has(key)) this.contentScheduler.reprioritize(key, priority)
		})
		const activeSlide = this.slides[this.activeIndex]
		const activeKey = activeSlide ? this.getSlideStableKey(activeSlide, this.activeIndex) : null
		// Remove the entire obsolete queue before aborting running tasks. Cancelling one key at a time
		// would pump the next stale item between cancellations and briefly start the whole old window.
		this.contentScheduler.cancelQueued(
			({ key, priority }) =>
				this.isFullscreenContentPriority(priority) &&
				key !== activeKey &&
				!nextPriorities.has(key),
		)

		previousPriorities.forEach((_priority, key) => {
			if (key === activeKey || nextPriorities.has(key)) return
			const index = this.cancelContentTask(key)
			if (index !== null && this.visiblePreviewKeys.has(key)) {
				void this.ensureSlidePreview(index, "preview")
			}
		})

		return demands
	}

	/** Fullscreen hides the sidebar, so keep only overlapping HTML work and drop screenshot demand. */
	private pauseSidebarPreviewDemand(): void {
		const previousPreviewKeys = this.visiblePreviewKeys
		this.visiblePreviewKeys = new Set()
		this.contentScheduler.cancelQueued(
			({ key, priority }) =>
				priority === "preview" &&
				key !== this.activeContentKey &&
				!this.fullscreenContentPriorities.has(key),
		)

		previousPreviewKeys.forEach((key) => {
			if (key === this.activeContentKey || this.fullscreenContentPriorities.has(key)) return
			this.cancelContentTask(key)
		})
		this.screenshotService.cancelPreviewGenerations()
	}

	private findSlideIndexByLoadTarget(target: Omit<SlideLoadTarget, "url">): number {
		if (target.fileId) {
			const index = this.slides.findIndex(
				(slide) => this.getSlideFileId(slide) === target.fileId,
			)
			if (index !== -1) return index
		}

		if (target.path) {
			const index = this.slides.findIndex((slide) => slide.path === target.path)
			if (index !== -1) return index
		}

		if (target.indexHint !== undefined) {
			const slide = this.slides[target.indexHint]
			if (!slide) return -1
			const matchesFileId = target.fileId && this.getSlideFileId(slide) === target.fileId
			const matchesPath = target.path && slide.path === target.path
			if (!target.fileId && !target.path) return target.indexHint
			if (matchesFileId || matchesPath) return target.indexHint
		}

		return -1
	}

	/**
	 * Invalidate deck-scoped work while retaining one physical concurrency budget for the whole
	 * Store lifetime. Cancelled non-cooperative processing keeps its slot until it actually settles,
	 * so a new deck cannot bypass the limit by creating a fresh scheduler.
	 */
	private beginContentGeneration(): number {
		this.contentGeneration++
		this.contentGenerationController.abort()
		this.contentGenerationController = new AbortController()
		this.contentScheduler.cancelAll()
		this.visiblePreviewKeys.clear()
		this.fullscreenContentPriorities.clear()
		this.activeContentKey = null
		return this.contentGeneration
	}

	/**
	 * Replace all deck-scoped work. Screenshot invalidation stays separate from
	 * beginContentGeneration because same-deck file updates must preserve unaffected thumbnails.
	 */
	private beginDeckGeneration(): number {
		this.screenshotManager.reset(this.slides)
		this.screenshotService.reset()
		this.generatingScreenshots.clear()
		return this.beginContentGeneration()
	}

	private isContentLoadCurrent(options: SlideContentLoadOptions): boolean {
		return (
			!this.disposed &&
			!options.signal?.aborted &&
			(options.generation === undefined || options.generation === this.contentGeneration)
		)
	}

	private isConfigUpdateCurrent(version: number): boolean {
		return !this.disposed && version === this.configUpdateVersion
	}

	private isInitializationCurrent(
		generation: number,
		configUpdateVersion: number | undefined,
	): boolean {
		return (
			this.isContentLoadCurrent({ generation }) &&
			(configUpdateVersion === undefined || this.isConfigUpdateCurrent(configUpdateVersion))
		)
	}

	/** Follow active-page changes during initialization until the latest page has settled. */
	private async waitForCurrentActiveSlideToSettle(
		generation: number,
		configUpdateVersion: number | undefined,
	): Promise<boolean> {
		while (this.isInitializationCurrent(generation, configUpdateVersion)) {
			const activeIndex = this.activeIndex
			const activeSlide = this.slides[activeIndex]
			if (
				!activeSlide ||
				activeSlide.loadingState === "loaded" ||
				activeSlide.loadingState === "error"
			) {
				return true
			}

			const loaded = await this.ensureSlideContent(activeIndex, "active")
			// 缺少附件时会立即返回未完成；同一页不能连续重试，否则微任务会阻塞绘制和附件回调。
			// 保留初始化状态，由后续 updateConfig 继续；等待期间切页则跟随新的活动页。
			if (!loaded && this.activeIndex === activeIndex) {
				return this.slides[activeIndex]?.loadingState === "error"
			}
		}
		return false
	}

	private async settlePendingInitialization(configUpdateVersion: number): Promise<void> {
		if (
			!this.loadingManager.isInitializing ||
			!this.isConfigUpdateCurrent(configUpdateVersion)
		) {
			return
		}

		const generation = this.contentGeneration
		// A newer same-deck config update adopts readiness from the stale initializer. Wait for the
		// current active page to settle so the loading overlay cannot remain stuck or close too early.
		if (this.config.autoLoadAndGenerate !== false) {
			const settled = await this.waitForCurrentActiveSlideToSettle(
				generation,
				configUpdateVersion,
			)
			if (!settled) return
		}

		if (
			this.isContentLoadCurrent({ generation }) &&
			this.isConfigUpdateCurrent(configUpdateVersion) &&
			this.loadingManager.isInitializing
		) {
			this.loadingManager.setInitializing(false)
		}
	}

	private createIncrementalUpdateContext(version: number): IncrementalUpdateContext {
		const isCurrent = () => this.isConfigUpdateCurrent(version)

		return {
			slides: this.slides,
			activeIndex: this.activeIndex,
			autoLoadAndGenerate: this.config.autoLoadAndGenerate !== false,
			loadSlideContent: (url, index) =>
				isCurrent() ? this.loadSlideContent(url, index) : Promise.resolve(""),
			loadSlideContentByFileId: (fileId, options) =>
				isCurrent() ? this.loadSlideContentByFileId(fileId, options) : Promise.resolve(""),
			loadSlideContentSilently: (url, index) =>
				isCurrent() ? this.loadSlideContentSilently(url, index) : Promise.resolve(""),
			generateSlideScreenshot: (index, targetContent) =>
				isCurrent()
					? this.generateSlideScreenshot(index, targetContent)
					: Promise.resolve(),
			ensureSlideScreenshot: (index) =>
				isCurrent() ? this.ensureSlideScreenshot(index) : Promise.resolve(),
			setSlides: (slides) => {
				if (isCurrent()) this.slideManager.setSlides(slides, true)
			},
			setActiveIndex: (index) => {
				if (isCurrent()) this.setActiveIndex(index)
			},
			isSlideManuallySaved: (fileId) => isCurrent() && this.isSlideManuallySaved(fileId),
			clearManualSaveMark: (fileId) => {
				if (isCurrent()) this.clearManualSaveMark(fileId)
			},
			getSlideEditingState: (fileId) => isCurrent() && this.getSlideEditingState(fileId),
			notifyServerUpdate: (fileId, content) => {
				if (isCurrent()) this.notifyServerUpdate(fileId, content)
			},
			matchesLocalSave: (fileId, content) =>
				isCurrent() && getFileSaveQueue().matchesLocal(fileId, content),
			hasPendingSave: (fileId) => isCurrent() && getFileSaveQueue().hasPending(fileId),
			isCurrent,
		}
	}

	private isAbortError(error: unknown): boolean {
		return (
			(error instanceof DOMException && error.name === "AbortError") ||
			(error instanceof Error && error.name === "AbortError")
		)
	}

	private findSlideIndexByStableKey(key: string): number {
		return this.slides.findIndex((slide, index) => this.getSlideStableKey(slide, index) === key)
	}

	private getInitialActiveIndex(slideCount: number): number {
		const configuredIndex = this.config.initialActiveIndex
		if (
			typeof configuredIndex === "number" &&
			configuredIndex >= 0 &&
			configuredIndex < slideCount
		) {
			return configuredIndex
		}
		return 0
	}

	// ==================== Computed Values (Delegated to Managers) ====================
	get slides() {
		return this.slideManager.slides
	}

	get activeIndex() {
		return this.slideManager.activeIndex
	}

	get isTransitioning() {
		return this.slideManager.isTransitioning
	}

	get isInitializing() {
		return this.loadingManager.isInitializing
	}

	get isReady() {
		return this.loadingManager.isReady
	}

	get loadingProgress() {
		return this.loadingManager.loadingProgress
	}

	get scaleRatio() {
		return this.viewStateManager.scaleRatio
	}

	get verticalOffset() {
		return this.viewStateManager.verticalOffset
	}

	get horizontalOffset() {
		return this.viewStateManager.horizontalOffset
	}

	get isFullscreen() {
		return this.viewStateManager.isFullscreen
	}

	get slidesFileVersions() {
		return this.loadingManager.slidesFileVersions
	}

	get slideUrls(): string[] {
		return this.slideManager.slideUrls
	}

	get slidePaths(): string[] {
		return this.slideManager.slidePaths
	}

	get slideTitles(): string[] {
		return this.slideManager.slideTitles
	}

	get currentSlide(): SlideItem | undefined {
		return this.slideManager.currentSlide
	}

	get currentSlideUrl(): string {
		return this.slideManager.currentSlideUrl
	}

	get currentSlidePath(): string {
		return this.slideManager.currentSlidePath
	}

	get currentSlideTitle(): string {
		return this.slideManager.currentSlideTitle
	}

	get currentSlideContent(): string {
		return this.slideManager.currentSlideContent
	}

	get currentFileId(): string {
		return this.slideManager.currentFileId
	}

	get canGoPrev(): boolean {
		return this.slideManager.canGoPrev
	}

	get canGoNext(): boolean {
		return this.slideManager.canGoNext
	}

	get loadingPercentage(): number {
		return this.slideManager.loadingPercentage
	}

	get totalSlides(): number {
		return this.slideManager.totalSlides
	}

	getConfigForExport(): PPTExportConfig {
		const hiddenSlidePaths = this.hiddenSlidePaths
		return {
			...this.config,
			displayConfig: this.config.displayConfig
				? { ...this.config.displayConfig, hidden_slides: hiddenSlidePaths }
				: this.config.displayConfig,
		}
	}

	/** Get sync manager for unified state synchronization */
	get syncManager() {
		return this.slideManager.syncManager
	}

	// ==================== Sync Control Methods ====================
	/**
	 * Mark to skip the next external sync from parent prop changes
	 * Delegates to slideManager to prevent circular updates
	 */
	markSkipNextExternalSync(): void {
		this.slideManager.markSkipNextExternalSync()
	}

	/**
	 * Check and consume the skip flag
	 * Returns true if should skip, and automatically resets the flag
	 * Delegates to slideManager
	 */
	shouldSkipExternalSync(): boolean {
		return this.slideManager.shouldSkipExternalSync()
	}

	/**
	 * Get visible slides for rendering
	 * 获取需要渲染的可见幻灯片
	 * - Fullscreen: render window around current slide for smooth transitions (prerendering)
	 * - Non-fullscreen: current slide and its immediate neighbors (up to 3 slides)
	 * - 全屏：渲染当前幻灯片周围的窗口以实现流畅切换（预渲染）
	 * - 非全屏：当前页及前后各一页（最多 3 页）
	 */
	get visibleSlides(): Array<{ slide: SlideItem; index: number }> {
		const renderRadius = this.isFullscreen ? this.renderWindowSize : this.normalRenderWindowSize
		const startIndex = Math.max(0, this.activeIndex - renderRadius)
		const endIndex = Math.min(this.slides.length - 1, this.activeIndex + renderRadius)

		const result: Array<{ slide: SlideItem; index: number }> = []
		for (let i = startIndex; i <= endIndex; i++) {
			result.push({ slide: this.slides[i], index: i })
		}
		return result
	}

	/** Whether automatic neighbor/content preparation is enabled for this deck. */
	get isAutomaticLoadingEnabled(): boolean {
		return this.config.autoLoadAndGenerate !== false
	}

	// ==================== Slide Initialization & Loading ====================
	/**
	 * Initialize slides from original paths
	 */
	async initializeSlides(
		slidePaths: string[],
		options: InitializeSlidesOptions = {},
	): Promise<void> {
		if (this.disposed) return
		const normalizedPaths = slidePaths || []
		const initializingKey = `${this.config.mainFileId || ""}:${normalizedPaths.join(
			"\u0000",
		)}:${options.configUpdateVersion ?? "direct"}`

		// Only identical concurrent initialization can share work. A deck switch must supersede it.
		if (this.initializingPromise && this.initializingKey === initializingKey) {
			this.logger.warn("initializeSlides already in progress, returning existing promise")
			return this.initializingPromise
		}
		const generation = this.beginDeckGeneration()

		this.logger.logOperationStart("initializeSlides", {
			metadata: { slideCount: normalizedPaths.length },
		})

		this.loadingManager.resetLoadingState()

		if (normalizedPaths.length === 0) {
			this.logger.warn("未提供幻灯片路径，初始化为空幻灯片")
			this.slideManager.initializeSlides([])
			this.initializingPromise = null
			this.initializingKey = null
			return
		}

		this.loadingManager.setInitializing(true)

		const initializePromise = Promise.resolve().then(async () => {
			try {
				// 1. Extract file IDs from paths
				const fileIds: string[] = []
				const pathByFileId = new Map<string, string>()
				const slideItems: SlideItem[] = normalizedPaths.map((path, index) => {
					const fileId = this.pathMappingService.extractFileIdFromPath(path)
					if (fileId) {
						fileIds.push(fileId)
						pathByFileId.set(fileId, path)
						this.pathMappingService.setPathFileIdMapping(path, fileId)
					} else {
						this.logger.warn("无法从路径提取文件 ID", {
							operation: "initializeSlides",
							slideIndex: index,
							metadata: { path },
						})
					}
					return {
						id: `slide-${index}`,
						path,
						url: "", // Will be filled after fetching URLs
						index,
						loadingState: "idle",
					}
				})

				// 2. Fetch temporary download URLs in batch
				if (fileIds.length > 0) {
					try {
						const response = await (
							this.config.fileApi?.getTemporaryDownloadUrl ?? getTemporaryDownloadUrl
						)({
							file_ids: fileIds,
						})
						if (!this.isInitializationCurrent(generation, options.configUpdateVersion))
							return

						response?.forEach((item: any) => {
							if (item.file_id && item.url) {
								const path = pathByFileId.get(item.file_id)
								if (path) {
									this.pathMappingService.setPathUrlMapping(path, item.url)
								}
							}
						})

						// 3. Fill URLs into slide items
						slideItems.forEach((slide) => {
							slide.url = this.pathMappingService.getUrlByPath(slide.path) || ""
						})

						this.logger.info("临时 URL 获取成功", {
							operation: "initializeSlides",
							metadata: {
								urlCount: this.pathMappingService.getAllUrlMappings().size,
								slideCount: slideItems.length,
							},
						})
					} catch (error) {
						if (!this.isInitializationCurrent(generation, options.configUpdateVersion))
							return
						this.logger.error({
							eventKey: "get_url_failed",
							errorKind: "render",
							error: error,
							message: "获取临时 URL 失败",
							context: {
								operation: "initializeSlides",
								metadata: { fileIdCount: fileIds.length },
							},
						})
					}
				}
				if (!this.isInitializationCurrent(generation, options.configUpdateVersion)) return

				// Resolve the initial index before the first HTML request to avoid always loading page 1.
				this.slideManager.initializeSlides(slideItems)
				const initialActiveIndex = this.getInitialActiveIndex(slideItems.length)
				this.slideManager.setActiveIndex(initialActiveIndex)

				if (this.config.autoLoadAndGenerate !== false) {
					const settled = await this.waitForCurrentActiveSlideToSettle(
						generation,
						options.configUpdateVersion,
					)
					if (!settled) return
				}
				if (!this.isInitializationCurrent(generation, options.configUpdateVersion)) return

				// Ready means metadata plus the initial active page are settled, not all pages.
				this.loadingManager.setInitializing(false)

				this.logger.logOperationSuccess("initializeSlides", {
					metadata: {
						slideCount: this.slides.length,
						initialActiveIndex,
						autoLoadAndGenerate: this.config.autoLoadAndGenerate,
					},
				})

				// Reconcile the active demand source after initialization. In fullscreen this also warms
				// the adaptive HTML window; otherwise the sidebar remains the wider preload owner.
				if (this.config.autoLoadAndGenerate !== false) {
					this.scheduleActiveSlide()
				}
			} catch (error) {
				if (this.isInitializationCurrent(generation, options.configUpdateVersion)) {
					this.logger.logOperationError("initializeSlides", error, {
						metadata: { slidePathCount: normalizedPaths.length },
					})
					this.loadingManager.setInitializing(false)
					throw error
				}
			} finally {
				if (this.initializingPromise === initializePromise) {
					this.initializingPromise = null
					this.initializingKey = null
				}
			}
		})
		this.initializingPromise = initializePromise
		this.initializingKey = initializingKey

		return initializePromise
	}

	/**
	 * Get file ID by original path
	 */
	getFileIdByPath(path: string): string | undefined {
		return this.pathMappingService.getFileIdByPath(path)
	}

	/**
	 * Get full workspace-relative path from a PPT-folder-relative path
	 */
	getFullRelativePath(path: string): string | undefined {
		return this.pathMappingService.getFullRelativePath(path)
	}

	/**
	 * Try to extract fileId from path and establish mapping.
	 * Useful when attachmentList has been updated and a previously unknown file is now available.
	 */
	tryExtractAndMapFileId(path: string): string | undefined {
		const existing = this.pathMappingService.getFileIdByPath(path)
		if (existing) return existing

		const fileId = this.pathMappingService.extractFileIdFromPath(path)
		if (fileId) {
			this.pathMappingService.setPathFileIdMapping(path, fileId)
		}
		return fileId
	}

	private async fetchLatestSlideUrl(
		target: Omit<SlideLoadTarget, "url">,
		options: SlideContentLoadOptions,
	): Promise<string> {
		if (!target.fileId || !this.isContentLoadCurrent(options)) return ""

		const urlMap = await this.pathMappingService.fetchUrlsForFileIds([target.fileId], {
			shouldCommit: () => this.isContentLoadCurrent(options),
		})
		if (!this.isContentLoadCurrent(options)) return ""
		const latestUrl = urlMap.get(target.fileId)
		if (!latestUrl) return ""

		runInAction(() => {
			const currentIndex = this.findSlideIndexByLoadTarget(target)
			const currentSlide = currentIndex === -1 ? undefined : this.slides[currentIndex]
			if (!currentSlide) return
			currentSlide.url = latestUrl
			this.pathMappingService.setPathUrlMapping(currentSlide.path, latestUrl)
		})

		return latestUrl
	}

	private markSlideLoadError(
		target: Omit<SlideLoadTarget, "url">,
		error: Error,
		options: SlideContentLoadOptions,
	): void {
		if (!this.isContentLoadCurrent(options)) return
		runInAction(() => {
			const currentIndex = this.findSlideIndexByLoadTarget(target)
			const currentSlide = currentIndex === -1 ? undefined : this.slides[currentIndex]
			if (!currentSlide) return
			currentSlide.loadingState = "error"
			currentSlide.loadingError = error
		})
	}

	/** Only the latest current page retains active priority; remaining demand is resumed afterward. */
	private claimActiveContentDemand(key: string): number | null {
		const previousKey = this.activeContentKey
		this.activeContentKey = key
		if (!previousKey || previousKey === key) return null

		return this.cancelContentTask(previousKey)
	}

	/**
	 * Load one slide through the shared priority queue. Active navigation and sidebar previews
	 * converge here, so the same slide has one in-flight pipeline.
	 */
	async ensureSlideContent(
		index: number,
		priority: PPTSlideContentPriority = "preview",
	): Promise<boolean> {
		const slide = this.slides[index]
		if (!slide || this.disposed) return false

		const key = this.getSlideStableKey(slide, index)
		const previousDemandIndex =
			priority === "active" ? this.claimActiveContentDemand(key) : null
		if (slide.loadingState === "loaded") {
			if (previousDemandIndex !== null) this.resumeContentDemand(previousDemandIndex)
			return true
		}

		const generation = this.contentGeneration
		const target = {
			indexHint: index,
			path: slide.path,
			fileId: this.getSlideFileId(slide),
		}

		const attachmentLoadState = this.config.attachmentLoadState
		if (
			!target.fileId &&
			!slide.url &&
			!this.pathMappingService.getUrlByPath(slide.path) &&
			attachmentLoadState &&
			attachmentLoadState.projectId ===
				(this.config.projectId || this.config.selectedProjectId)
		) {
			// 首批可能只有 PPT 配置，页文件尚未到达；等待附件不占用内容下载队列。
			if (attachmentLoadState.status === "idle" || attachmentLoadState.status === "loading") {
				runInAction(() => {
					slide.loadingState = "loading"
					slide.loadingError = undefined
				})
			} else {
				this.markSlideLoadError(
					target,
					new Error(
						attachmentLoadState.status === "ready"
							? "Slide file not found"
							: "Failed to load project files",
					),
					{ generation },
				)
			}
			if (previousDemandIndex !== null) this.resumeContentDemand(previousDemandIndex)
			return false
		}

		const loadPromise = this.contentScheduler.schedule(key, priority, async (signal) => {
			const options = { signal, generation }
			if (!this.isContentLoadCurrent(options)) return false

			const currentIndex = this.findSlideIndexByLoadTarget(target)
			const currentSlide = currentIndex === -1 ? undefined : this.slides[currentIndex]
			if (!currentSlide) return false
			if (currentSlide.loadingState === "loaded") return true

			let url = currentSlide.url || this.pathMappingService.getUrlByPath(currentSlide.path)
			if (!url) {
				url = await this.fetchLatestSlideUrl(target, options)
			}

			if (!url) {
				this.markSlideLoadError(target, new Error("No URL available for slide"), options)
				return false
			}

			let content = await this.loadSlideContentForTarget({ ...target, url }, options)
			if (content || !this.isContentLoadCurrent(options)) return Boolean(content)

			// A temporary URL can expire while the deck stays open. Refresh once before surfacing error.
			const refreshedUrl = await this.fetchLatestSlideUrl(target, options)
			if (!refreshedUrl || refreshedUrl === url || !this.isContentLoadCurrent(options)) {
				return false
			}

			content = await this.loadSlideContentForTarget(
				{ ...target, url: refreshedUrl },
				options,
			)
			return Boolean(content)
		})

		if (previousDemandIndex !== null) this.resumeContentDemand(previousDemandIndex)

		return loadPromise
	}

	/** Load content first, then generate its thumbnail using the slide's stable identity. */
	async ensureSlidePreview(
		index: number,
		priority: PPTSlideContentPriority = "preview",
	): Promise<boolean> {
		const slide = this.slides[index]
		if (!slide) return false
		const key = this.getSlideStableKey(slide, index)
		const loaded = await this.ensureSlideContent(index, priority)
		if (!loaded) return false

		const currentIndex = this.findSlideIndexByStableKey(key)
		if (currentIndex === -1) return false
		const isStillRequested =
			!this.isFullscreen &&
			((priority === "active" && currentIndex === this.activeIndex) ||
				this.visiblePreviewKeys.has(key))
		if (!isStillRequested) return false
		await this.ensureSlideScreenshot(currentIndex, "preview")
		return true
	}

	/**
	 * Synchronize sidebar demand with the virtual range. Queued previews that have already scrolled
	 * away are dropped, while active work is preserved even if it shares the same key.
	 */
	updateVisibleSlidePreviews(indices: number[]): void {
		const nextPreviewKeys = new Set<string>()
		const uniqueIndices: number[] = []
		const requestedIndices = this.isFullscreen ? [] : indices

		requestedIndices.forEach((index) => {
			const slide = this.slides[index]
			if (!slide) return
			const key = this.getSlideStableKey(slide, index)
			if (nextPreviewKeys.has(key)) return
			nextPreviewKeys.add(key)
			uniqueIndices.push(index)
		})

		this.visiblePreviewKeys = nextPreviewKeys
		this.contentScheduler.cancelQueued(
			({ key, priority }) =>
				priority === "preview" &&
				!nextPreviewKeys.has(key) &&
				!this.fullscreenContentPriorities.has(key),
		)

		uniqueIndices.forEach((index) => {
			void this.ensureSlidePreview(index, "preview")
		})
	}

	getContentLoadStats() {
		return this.contentScheduler.getStats()
	}

	/**
	 * Load all slides in parallel
	 */
	async loadAllSlides(): Promise<void> {
		this.logger.logOperationStart("loadAllSlides", {
			metadata: { slideCount: this.slides.length },
		})

		if (this.slides.length === 0) {
			this.logger.warn("没有需要加载的幻灯片")
			return
		}

		runInAction(() => {
			this.loadingManager.resetLoadingState()
			// Reset all slides' loading state
			this.slides.forEach((slide) => {
				slide.loadingState = "idle"
				slide.rawContent = undefined
				slide.content = undefined
				slide.resourceVersionSignature = null
				slide.loadingError = undefined
			})
		})

		try {
			// Phase 1: Load raw content and collect file IDs
			const allFileIds = new Set<string>()
			const slideRawData: Array<{
				url: string
				index: number
				path: string
				fileId?: string
				content: string
				relativeFilePath?: string
			}> = []

			await Promise.all(
				this.slides.map(async (slide, index) => {
					const target = {
						indexHint: index,
						path: slide.path,
						fileId: this.getSlideFileId(slide),
					}
					try {
						const url = slide.url || ""
						if (!url) {
							this.logger.warn("幻灯片没有可用的 URL", {
								operation: "loadAllSlides",
								slideIndex: index,
							})

							runInAction(() => {
								const currentIndex = this.findSlideIndexByLoadTarget(target)
								if (currentIndex !== -1 && this.slides[currentIndex]) {
									this.slides[currentIndex].loadingState = "error"
									this.slides[currentIndex].loadingError = new Error(
										"No URL available for slide",
									)
								}
							})
							return
						}

						const loadedContent = await this.loaderService.loadSlide(url)

						const currentIndex = this.findSlideIndexByLoadTarget(target)
						if (currentIndex === -1) {
							this.logger.warn("幻灯片在原始内容加载后已不存在，丢弃结果", {
								operation: "loadAllSlides",
								slideIndex: index,
								metadata: { path: target.path, fileId: target.fileId },
							})
							return
						}

						const currentSlide = this.slides[currentIndex]
						const fileId = target.fileId || this.getSlideFileId(currentSlide)
						const relativeFilePath = this.getRelativeFilePathByFileId(fileId)
						const rawContent = this.resolveSlideSource(fileId, loadedContent)

						slideRawData.push({
							url,
							index: currentIndex,
							path: target.path,
							fileId,
							content: rawContent,
							relativeFilePath,
						})

						const fileIds = this.processorService.collectFileIds(
							rawContent,
							currentIndex,
							relativeFilePath,
						)
						fileIds.forEach((id) => allFileIds.add(id))
					} catch (error) {
						this.logger.error({
							eventKey: "load_content_failed",
							errorKind: "render",
							error: error,
							message: "加载原始内容失败",
							context: { operation: "loadAllSlides", slideIndex: index },
						})

						runInAction(() => {
							const currentIndex = this.findSlideIndexByLoadTarget(target)
							if (currentIndex !== -1 && this.slides[currentIndex]) {
								this.slides[currentIndex].loadingState = "error"
								this.slides[currentIndex].loadingError = error as Error
							}
						})
					}
				}),
			)

			// Phase 2: Fetch resource URLs in batch
			const urlMapping: Map<string, string> = new Map()
			if (allFileIds.size > 0) {
				try {
					const response = await (
						this.config.fileApi?.getTemporaryDownloadUrl ?? getTemporaryDownloadUrl
					)({
						file_ids: Array.from(allFileIds),
					})
					response?.forEach((item: any) => {
						if (item.file_id && item.url) {
							urlMapping.set(item.file_id, item.url)
						}
					})
				} catch (error) {
					this.logger.error({
						eventKey: "get_download_url_failed",
						errorKind: "render",
						error: error,
						message: "获取临时下载 URL 失败",
						context: {
							operation: "loadAllSlides",
							metadata: { fileIdCount: allFileIds.size },
						},
					})
				}
			}

			// Phase 3: Process slides with URL mapping
			const currentIndex = this.activeIndex
			const prioritizedSlideData = [...slideRawData].sort((a, b) => {
				const aIndex = this.findSlideIndexByLoadTarget({
					indexHint: a.index,
					path: a.path,
					fileId: a.fileId,
				})
				const bIndex = this.findSlideIndexByLoadTarget({
					indexHint: b.index,
					path: b.path,
					fileId: b.fileId,
				})
				const aDistance =
					aIndex === -1 ? Number.MAX_SAFE_INTEGER : Math.abs(aIndex - currentIndex)
				const bDistance =
					bIndex === -1 ? Number.MAX_SAFE_INTEGER : Math.abs(bIndex - currentIndex)
				return aDistance - bDistance
			})

			const processingPromises: Promise<void>[] = []

			for (const slideData of prioritizedSlideData) {
				const { index, path, fileId, content, relativeFilePath } = slideData
				const target = { indexHint: index, path, fileId }

				const promise = (async () => {
					try {
						runInAction(() => {
							const currentIndex = this.findSlideIndexByLoadTarget(target)
							if (currentIndex !== -1 && this.slides[currentIndex]) {
								this.slides[currentIndex].loadingState = "loading"
							}
						})

						const processIndex = this.findSlideIndexByLoadTarget(target)
						if (processIndex === -1) {
							this.logger.warn("幻灯片在内容处理前已不存在，丢弃结果", {
								operation: "loadAllSlides",
								slideIndex: index,
								metadata: { path, fileId },
							})
							return
						}

						const processedContent =
							await this.processorService.processSlideWithUrlMapping(
								content,
								processIndex,
								relativeFilePath,
								urlMapping,
							)

						runInAction(() => {
							const currentIndex = this.findSlideIndexByLoadTarget(target)
							if (currentIndex !== -1 && this.slides[currentIndex]) {
								this.slides[currentIndex].rawContent = content
								this.slides[currentIndex].content = processedContent.content
								this.slides[currentIndex].resourceVersionSignature =
									processedContent.resourceVersionSignature
								this.slides[currentIndex].loadingState = "loaded"
								this.slides[currentIndex].lastLoadedAt = Date.now()
							}
						})

						// Update progress
						this.loadingManager.updateProgress(this.slides)
					} catch (error) {
						this.logger.error({
							eventKey: "process_slide_failed",
							errorKind: "render",
							error: error,
							message: "处理幻灯片失败",
							context: { operation: "loadAllSlides", slideIndex: index },
						})

						runInAction(() => {
							const currentIndex = this.findSlideIndexByLoadTarget(target)
							if (currentIndex !== -1 && this.slides[currentIndex]) {
								this.slides[currentIndex].loadingState = "error"
								this.slides[currentIndex].loadingError = error as Error
							}
						})
					}
				})()

				processingPromises.push(promise)
			}

			// Track completion
			Promise.allSettled(processingPromises).then(() => {
				this.loadingManager.setInitializing(false)

				this.logger.logOperationSuccess("loadAllSlides", {
					metadata: {
						totalSlides: this.slides.length,
					},
				})

				// Reconcile fullscreen/sidebar demand after an explicit all-slide refresh completes.
				if (this.config.autoLoadAndGenerate !== false) {
					this.scheduleActiveSlide()
				}
			})
		} catch (error) {
			this.logger.logOperationError("loadAllSlides", error, {
				metadata: { slideCount: this.slides.length },
			})

			this.loadingManager.setInitializing(false)
		}
	}

	/**
	 * Load single slide content
	 */
	async loadSlideContent(
		url: string,
		index: number,
		options: SlideContentLoadOptions = {},
	): Promise<string> {
		const slide = this.slides[index]
		const fileId = this.getSlideFileId(slide)
		return this.loadSlideContentForTarget(
			{
				url,
				indexHint: index,
				path: slide?.path,
				fileId,
			},
			{
				...options,
				signal: options.signal ?? this.contentGenerationController.signal,
				generation: options.generation ?? this.contentGeneration,
			},
		)
	}

	async loadSlideContentByFileId(
		fileId: string,
		options: {
			path?: string
			url?: string
			indexHint?: number
			signal?: AbortSignal
			generation?: number
		} = {},
	): Promise<string> {
		if (!fileId) return ""
		const loadOptions = {
			signal: options.signal ?? this.contentGenerationController.signal,
			generation: options.generation ?? this.contentGeneration,
		}
		if (!this.isContentLoadCurrent(loadOptions)) return ""

		const path =
			options.path || this.slides.find((slide) => this.getSlideFileId(slide) === fileId)?.path
		let url = options.url || (path ? this.pathMappingService.getUrlByPath(path) : undefined)

		if (!url) {
			const urlMap = await this.pathMappingService.fetchUrlsForFileIds([fileId], {
				shouldCommit: () => this.isContentLoadCurrent(loadOptions),
			})
			if (!this.isContentLoadCurrent(loadOptions)) return ""
			url = urlMap.get(fileId)
			if (path && url) {
				this.pathMappingService.setPathUrlMapping(path, url)
			}
		}

		if (!url) {
			this.logger.warn("未能获取幻灯片 URL", {
				operation: "loadSlideContentByFileId",
				metadata: { fileId, path },
			})
			return ""
		}

		return this.loadSlideContentForTarget(
			{
				url,
				indexHint: options.indexHint,
				path,
				fileId,
			},
			loadOptions,
		)
	}

	private async loadSlideContentForTarget(
		target: SlideLoadTarget,
		options: SlideContentLoadOptions = {},
	): Promise<string> {
		this.logger.logOperationStart("loadSlideContent", {
			slideIndex: target.indexHint,
			metadata: { url: target.url, path: target.path, fileId: target.fileId },
		})

		const initialIndex = this.findSlideIndexByLoadTarget(target)
		if (!target.url || initialIndex === -1 || !this.isContentLoadCurrent(options)) {
			this.logger.warn("无效的 URL 或幻灯片索引", {
				operation: "loadSlideContent",
				slideIndex: target.indexHint,
				metadata: {
					hasUrl: !!target.url,
					hasSlide: initialIndex !== -1,
					path: target.path,
					fileId: target.fileId,
				},
			})
			return ""
		}

		try {
			runInAction(() => {
				if (!this.isContentLoadCurrent(options)) return
				const currentIndex = this.findSlideIndexByLoadTarget(target)
				const slide = currentIndex === -1 ? undefined : this.slides[currentIndex]
				if (!slide) return
				if (!slide.content) {
					slide.loadingState = "loading"
				}
				slide.loadingError = undefined
			})

			const loadedContent = await this.loaderService.loadSlide(target.url, {
				signal: options.signal,
			})
			if (!this.isContentLoadCurrent(options)) return ""

			const processIndex = this.findSlideIndexByLoadTarget(target)
			if (processIndex === -1) {
				this.logger.warn("幻灯片在内容加载后已不存在，丢弃结果", {
					operation: "loadSlideContent",
					metadata: { path: target.path, fileId: target.fileId },
				})
				return ""
			}

			const currentSlide = this.slides[processIndex]
			const currentFileId = target.fileId || this.getSlideFileId(currentSlide)
			const relativeFilePath = this.getRelativeFilePathByFileId(currentFileId)
			const rawContent = this.resolveSlideSource(currentFileId, loadedContent)
			const processedContent = await this.processorService.processSlide(
				rawContent,
				processIndex,
				relativeFilePath,
			)
			if (!this.isContentLoadCurrent(options)) return ""

			runInAction(() => {
				if (!this.isContentLoadCurrent(options)) return
				const currentIndex = this.findSlideIndexByLoadTarget(target)
				if (currentIndex === -1 || !this.slides[currentIndex]) {
					this.logger.warn("幻灯片在内容处理后已不存在，丢弃结果", {
						operation: "loadSlideContent",
						metadata: { path: target.path, fileId: target.fileId },
					})
					return
				}

				this.slides[currentIndex].rawContent = rawContent
				this.slides[currentIndex].content = processedContent.content
				this.slides[currentIndex].resourceVersionSignature =
					processedContent.resourceVersionSignature
				this.slides[currentIndex].loadingState = "loaded"
				this.slides[currentIndex].lastLoadedAt = Date.now()
			})

			this.loadingManager.updateProgress(this.slides)

			this.logger.logOperationSuccess("loadSlideContent", {
				slideIndex: this.findSlideIndexByLoadTarget(target),
			})

			return processedContent.content
		} catch (error) {
			if (this.isAbortError(error) || !this.isContentLoadCurrent(options)) {
				this.logger.debug("幻灯片内容加载已取消，丢弃结果", {
					operation: "loadSlideContent",
					slideIndex: this.findSlideIndexByLoadTarget(target),
				})
				return ""
			}

			this.logger.logOperationError("loadSlideContent", error, {
				slideIndex: this.findSlideIndexByLoadTarget(target),
			})

			runInAction(() => {
				const currentIndex = this.findSlideIndexByLoadTarget(target)
				if (currentIndex !== -1 && this.slides[currentIndex]) {
					this.slides[currentIndex].loadingState = "error"
					this.slides[currentIndex].loadingError = error as Error
				}
			})
			return ""
		}
	}

	/**
	 * Refresh slide content by file ID
	 * Fetches latest URL from server and reloads content
	 * 通过 file_id 刷新幻灯片内容
	 * 从服务器获取最新 URL 并重新加载内容
	 */
	async refreshSlideByFileId(
		fileId: string,
		cacheMode: PPTThumbnailCacheMode = "use",
	): Promise<void> {
		const generation = this.contentGeneration
		this.logger.logOperationStart("refreshSlideByFileId", {
			metadata: { fileId },
		})

		try {
			// Find slide index by fileId
			const slideIndex = this.slides.findIndex((slide) => {
				const slideFileId = this.pathMappingService.getFileIdByPath(slide.path)
				return slideFileId === fileId
			})

			if (slideIndex === -1) {
				this.logger.warn("未找到对应的幻灯片", {
					operation: "refreshSlideByFileId",
					metadata: { fileId },
				})
				return
			}

			const slide = this.slides[slideIndex]
			if (!slide) {
				this.logger.warn("幻灯片不存在", {
					operation: "refreshSlideByFileId",
					metadata: { fileId, slideIndex },
				})
				return
			}
			this.contentScheduler.cancel(this.getSlideStableKey(slide, slideIndex))

			// Fetch latest URL from server
			const urlMap = await this.pathMappingService.fetchUrlsForFileIds([fileId], {
				shouldCommit: () => this.isContentLoadCurrent({ generation }),
			})
			if (!this.isContentLoadCurrent({ generation })) return
			const latestUrl = urlMap.get(fileId)

			if (!latestUrl) {
				this.logger.warn("未能获取最新 URL", {
					operation: "refreshSlideByFileId",
					metadata: { fileId, slideIndex },
				})
				return
			}

			// Update URL mapping
			const slidePath = slide.path
			this.pathMappingService.setPathUrlMapping(slidePath, latestUrl)

			// Update slide URL if different
			runInAction(() => {
				const currentIndex = this.slides.findIndex(
					(candidate) => this.getSlideFileId(candidate) === fileId,
				)
				const currentSlide = currentIndex === -1 ? undefined : this.slides[currentIndex]
				if (currentSlide) {
					if (currentSlide.url !== latestUrl) {
						currentSlide.url = latestUrl
					}
					this.pathMappingService.setPathUrlMapping(currentSlide.path, latestUrl)
				}
			})

			// Reload slide content with latest URL, anchored by fileId to avoid index drift.
			await this.loadSlideContentByFileId(fileId, {
				path: slidePath,
				url: latestUrl,
				indexHint: slideIndex,
				generation,
			})
			if (!this.isContentLoadCurrent({ generation })) return

			// Regenerate screenshot after content refresh. Resolve by fileId again because
			// a slide insertion/removal may have shifted indices while content was loading.
			const refreshedSlideIndex = this.slides.findIndex(
				(candidate) => this.getSlideFileId(candidate) === fileId,
			)
			const refreshedSlide = this.slides[refreshedSlideIndex]
			if (this.config.autoLoadAndGenerate !== false && refreshedSlide?.content) {
				await this.generateSlideScreenshot(
					refreshedSlideIndex,
					refreshedSlide.content,
					"required",
					cacheMode,
				)
			}

			this.logger.logOperationSuccess("refreshSlideByFileId", {
				metadata: {
					fileId,
					slideIndex,
					latestUrl,
					screenshotRegenerated:
						this.config.autoLoadAndGenerate !== false &&
						Boolean(refreshedSlide?.content),
				},
			})
		} catch (error) {
			this.logger.logOperationError("refreshSlideByFileId", error, {
				metadata: { fileId },
			})
			throw error
		}
	}

	/**
	 * Load slide content silently without updating UI state
	 * Used when loading server updates for slides that are currently being edited
	 * 静默加载幻灯片内容，不更新 UI 状态
	 * 用于加载正在编辑的幻灯片的服务端更新
	 */
	async loadSlideContentSilently(url: string, index: number): Promise<string> {
		const generation = this.contentGeneration
		const signal = this.contentGenerationController.signal
		this.logger.logOperationStart("loadSlideContentSilently", {
			slideIndex: index,
			metadata: { url },
		})

		if (!url || !this.slides[index]) {
			this.logger.warn("无效的 URL 或幻灯片索引", {
				operation: "loadSlideContentSilently",
				slideIndex: index,
				metadata: { hasUrl: !!url, hasSlide: !!this.slides[index] },
			})
			return ""
		}

		try {
			// Load raw content without modifying slide state
			const rawContent = await this.loaderService.loadSlide(url, { signal })
			if (!this.isContentLoadCurrent({ generation, signal })) return ""

			const slidePath = this.slides[index]?.path
			const fileId = this.pathMappingService.getFileIdByPath(slidePath)
			const relativeFilePath = this.getRelativeFilePathByFileId(fileId)

			// Process content without modifying slide state
			const processedContent = await this.processorService.processSlide(
				rawContent,
				index,
				relativeFilePath,
			)
			if (!this.isContentLoadCurrent({ generation, signal })) return ""

			this.logger.logOperationSuccess("loadSlideContentSilently", {
				slideIndex: index,
			})

			return processedContent.content
		} catch (error) {
			if (this.isAbortError(error) || !this.isContentLoadCurrent({ generation, signal })) {
				return ""
			}
			this.logger.logOperationError("loadSlideContentSilently", error, {
				slideIndex: index,
			})
			return ""
		}
	}

	// ==================== Slide Management (Delegated to SlideManager) ====================
	/**
	 * Check if slide content is expired and refresh if needed
	 */
	async checkAndRefreshExpiredSlide(index: number): Promise<void> {
		const slide = this.slides[index]
		if (!slide || !slide.lastLoadedAt) return

		const EXPIRATION_TIME = 60 * 60 * 1000 // 1 hour
		const isExpired = Date.now() - slide.lastLoadedAt > EXPIRATION_TIME

		// 如果内容过期或者当前没有在加载，则刷新
		if (isExpired) {
			this.logger.info("Slide content expired, auto refreshing", {
				slideIndex: index,
				metadata: {
					lastLoadedAt: slide.lastLoadedAt,
				},
			})

			const fileId = this.pathMappingService.getFileIdByPath(slide.path)
			if (fileId) {
				await this.refreshSlideByFileId(fileId)
			}
		}
	}

	private scheduleActiveSlide(): void {
		const fullscreenDemands = this.prepareFullscreenContentDemand()
		const activeIndex = this.activeIndex
		const slide = this.slides[activeIndex]
		if (!slide) return

		if (slide.loadingState === "loaded") {
			void this.checkAndRefreshExpiredSlide(activeIndex)
		}
		// Always claim active priority, even when content is cached, so rapid navigation can safely
		// demote/cancel the previous active request before the fullscreen window is refilled.
		const generation = this.contentGeneration
		const configUpdateVersion = this.configUpdateVersion
		void this.ensureSlideContent(activeIndex, "active").then(() => {
			// 等待附件期间切到可用页，也要结束初始化；复用现有判断，旧请求不能结束新 PPT 的加载。
			if (!this.isInitializationCurrent(generation, configUpdateVersion)) return
			return this.settlePendingInitialization(configUpdateVersion)
		})

		fullscreenDemands.forEach(({ index, priority }) => {
			void this.ensureSlideContent(index, priority)
		})

		// 导航只请求真实正文；缩略图由侧边栏可见范围和保存／插入等明确入口提出需求。
	}

	setActiveIndex(index: number): void {
		this.slideManager.setActiveIndex(index)
		if (this.activeIndex === index) this.scheduleActiveSlide()
	}

	nextSlide(): void {
		const previousIndex = this.activeIndex
		this.slideManager.nextSlide()
		if (this.activeIndex !== previousIndex) this.scheduleActiveSlide()
	}

	prevSlide(): void {
		const previousIndex = this.activeIndex
		this.slideManager.prevSlide()
		if (this.activeIndex !== previousIndex) this.scheduleActiveSlide()
	}

	goToFirstSlide(): void {
		const previousIndex = this.activeIndex
		this.slideManager.goToFirstSlide()
		if (this.activeIndex !== previousIndex) this.scheduleActiveSlide()
	}

	setIsTransitioning(isTransitioning: boolean): void {
		this.slideManager.setIsTransitioning(isTransitioning)
	}

	setSlides(newSlides: SlideItem[] | string[], skipSync: boolean = false): void {
		this.slideManager.setSlides(newSlides, skipSync)
	}

	/**
	 * Sync slides with external slide paths (incremental update)
	 * Handles URL fetching, content loading, and screenshot generation for new slides
	 * @param newSlidePaths - New slide paths array
	 * @returns true if slides were updated, false if no changes
	 */
	async syncSlides(newSlidePaths: string[]): Promise<boolean> {
		const result = this.slideManager.syncSlides(newSlidePaths)
		if (!result.hasChanges) {
			return false
		}

		// Handle new slides insertion
		if (
			result.changeType === "insert" &&
			result.affectedIndices &&
			result.affectedIndices.length > 0
		) {
			await this.handleNewSlideInsertion(result.affectedIndices)
		}

		// A full replacement starts a new generation and only awaits its initial active page.
		if (result.changeType === "replace") {
			await this.initializeSlides(newSlidePaths)
		}

		return true
	}

	/**
	 * Handle new slide insertion: fetch URLs, load content, and generate screenshots
	 * @param insertedIndices - Array of inserted slide indices
	 */
	private async handleNewSlideInsertion(insertedIndices: number[]): Promise<void> {
		this.logger.logOperationStart("handleNewSlideInsertion", {
			metadata: { insertedCount: insertedIndices.length, indices: insertedIndices },
		})

		try {
			// 1. Extract file IDs and fetch URLs for new slides
			const fileIds: string[] = []
			const slidePathsToFetch: Array<{ index: number; path: string; fileId?: string }> = []

			for (const index of insertedIndices) {
				const slide = this.slides[index]
				if (!slide) continue

				const fileId = this.pathMappingService.extractFileIdFromPath(slide.path)
				if (fileId) {
					fileIds.push(fileId)
					this.pathMappingService.setPathFileIdMapping(slide.path, fileId)
					slidePathsToFetch.push({ index, path: slide.path, fileId })
				} else {
					this.logger.warn("无法从路径提取文件 ID", {
						operation: "handleNewSlideInsertion",
						slideIndex: index,
						metadata: { path: slide.path },
					})
				}
			}
			// 2. Fetch temporary download URLs in batch
			if (fileIds.length > 0) {
				try {
					const response = await (
						this.config.fileApi?.getTemporaryDownloadUrl ?? getTemporaryDownloadUrl
					)({
						file_ids: fileIds,
					})

					response?.forEach((item: any) => {
						if (item.file_id && item.url) {
							const pathInfo = slidePathsToFetch.find(
								(p) => p.fileId === item.file_id,
							)
							if (pathInfo) {
								this.pathMappingService.setPathUrlMapping(pathInfo.path, item.url)
								// Update slide URL
								runInAction(() => {
									// Use path to find slide, as indices might have shifted
									const currentSlideIndex = this.slides.findIndex(
										(s) => s.path === pathInfo.path,
									)
									if (
										currentSlideIndex !== -1 &&
										this.slides[currentSlideIndex]
									) {
										this.slides[currentSlideIndex].url = item.url
									} else {
										this.logger.warn("Could not find slide to update URL", {
											operation: "handleNewSlideInsertion",
											metadata: { path: pathInfo.path },
										})
									}
								})
							}
						}
					})

					this.logger.info("新幻灯片临时 URL 获取成功", {
						operation: "handleNewSlideInsertion",
						metadata: { urlCount: response?.length || 0 },
					})
				} catch (error) {
					this.logger.error({
						eventKey: "get_slide_url_failed",
						errorKind: "render",
						error: error,
						message: "获取新幻灯片临时 URL 失败",
						context: {
							operation: "handleNewSlideInsertion",
							metadata: { fileIdCount: fileIds.length },
						},
					})
				}
			}

			// 3. Keep inserted slides idle. Active navigation and the virtual sidebar now own demand.
			if (this.config.autoLoadAndGenerate !== false) {
				this.scheduleActiveSlide()
			}

			this.logger.logOperationSuccess("handleNewSlideInsertion", {
				metadata: { processedCount: insertedIndices.length },
			})
		} catch (error) {
			this.logger.logOperationError("handleNewSlideInsertion", error, {
				metadata: { insertedIndices },
			})
		}
	}

	/**
	 * @deprecated Use setSlides() instead
	 */
	setSlideUrls(newUrls: string[]): void {
		this.setSlides(newUrls)
	}

	/**
	 * Process raw slide HTML with the deck's own resource configuration, without touching the
	 * store. Every render path must go through this so theme and image paths resolve alike.
	 */
	async processSlideSource(index: number, content: string): Promise<string> {
		const slide = this.slides[index]
		const relativeFilePath = this.getRelativeFilePathByFileId(this.getSlideFileId(slide))
		const processed = await this.processorService.processSlide(content, index, relativeFilePath)
		return processed.content
	}

	async updateSlideContent(index: number, content: string): Promise<string> {
		const slide = this.slides[index]
		const relativeFilePath = this.getRelativeFilePathByFileId(this.getSlideFileId(slide))
		const processedContent = await this.processorService.processSlide(
			content,
			index,
			relativeFilePath,
		)
		// Save both raw and processed content
		this.slideManager.updateSlideItem(index, {
			rawContent: content,
			content: processedContent.content,
			resourceVersionSignature: processedContent.resourceVersionSignature,
			loadingState: "loaded",
			lastLoadedAt: Date.now(),
		})
		return processedContent.content
	}

	/** Update inert HTML metadata without reprocessing or remounting the slide iframe. */
	updateSlideNotes(fileId: string, rawContent: string): void {
		if (!fileId) return
		// Resolve at completion: a pending save may outlive a reorder or deck replacement.
		const index = this.slides.findIndex((slide) => this.getSlideFileId(slide) === fileId)
		const slide = this.slides[index]
		if (!slide) return
		// Treat notes save like a local save echo so file-list refresh
		// does not reload the page or clear its thumbnail.
		this.markSlideAsManuallySaved(fileId)
		this.slideManager.updateSlideItem(index, {
			rawContent,
			rawRevision: (slide.rawRevision || 0) + 1,
			resourceVersionSignature: slide.resourceVersionSignature,
		})
	}

	updateSlideContents(updates: Map<number, string>): void {
		this.slideManager.updateSlideContents(updates)
	}

	updateSlideItem(index: number, updates: Partial<Omit<SlideItem, "index">>): void {
		this.slideManager.updateSlideItem(index, updates)
	}

	updateSlideTitle(index: number, title: string): void {
		this.slideManager.updateSlideTitle(index, title)
	}

	updateSlideTitles(titles: string[]): void {
		this.slideManager.updateSlideTitles(titles)
	}

	/**
	 * Insert a new slide
	 */
	async insertSlide(
		index: number,
		direction: "before" | "after",
		newSlideData: {
			path: string
			url: string
			fileId: string
		},
	): Promise<number> {
		const newIndex = await this.slideManager.insertSlide(
			index,
			direction,
			newSlideData,
			async (url: string, index: number) => {
				// Load slide content only
				await this.loadSlideContentByFileId(newSlideData.fileId, {
					path: newSlideData.path,
					url,
					indexHint: index,
				})
			},
		)

		// Reconcile active/fullscreen demand after insertion shifts nearby indices.
		if (this.config.autoLoadAndGenerate !== false) {
			if (this.isFullscreen) this.scheduleActiveSlide()
			else await this.ensureActiveSlidePreview()
		}

		return newIndex
	}

	/**
	 * Delete a slide
	 */
	deleteSlide(index: number, adjustActiveIndex: boolean = true): number | undefined {
		return this.slideManager.deleteSlide(index, adjustActiveIndex)
	}

	/**
	 * Sort/reorder slides
	 * @param newSlides - New slides array in the desired order
	 */
	sortSlides(newSlides: SlideItem[]): void {
		this.slideManager.sortSlides(newSlides)
	}

	/**
	 * Rename a slide
	 */
	renameSlide(index: number, newPath: string): void {
		this.slideManager.renameSlide(index, newPath)
	}

	// ==================== View State (Delegated to ViewStateManager) ====================
	setScaleRatio(ratio: number): void {
		this.viewStateManager.setScaleRatio(ratio)
	}

	setVerticalOffset(offset: number): void {
		this.viewStateManager.setVerticalOffset(offset)
	}

	setHorizontalOffset(offset: number): void {
		this.viewStateManager.setHorizontalOffset(offset)
	}

	setFullscreen(isFullscreen: boolean): void {
		if (this.disposed || this.isFullscreen === isFullscreen) return
		this.viewStateManager.setFullscreen(isFullscreen)
		// Schedule the new demand source first so overlapping sidebar tasks are promoted instead of
		// being cancelled and downloaded again during the fullscreen transition.
		this.scheduleActiveSlide()
		if (isFullscreen) this.pauseSidebarPreviewDemand()
	}

	// ==================== File Version (Delegated to LoadingManager) ====================
	setSlideFileVersion(fileId: string, version: number | undefined): void {
		this.loadingManager.setSlideFileVersion(fileId, version)
	}

	setSlidesFileVersions(versions: Record<string, number | undefined>): void {
		this.loadingManager.setSlidesFileVersions(versions)
	}

	// ==================== Screenshot Management (Delegated to ScreenshotManager) ====================
	async generateSlideScreenshot(
		index: number,
		targetContent?: string,
		requestKind: SlideScreenshotRequestKind = "required",
		cacheMode: PPTThumbnailCacheMode = "use",
	): Promise<void> {
		if (this.disposed) return
		const slide = this.slides[index]
		if (!slide) return
		const generationKey = this.getSlideStableKey(slide, index)
		await this.screenshotManager.generateSlideScreenshot(
			slide,
			index,
			this.slides,
			targetContent,
			() =>
				this.slides.find(
					(candidate, candidateIndex) =>
						this.getSlideStableKey(candidate, candidateIndex) === generationKey,
				),
			requestKind,
			this.getThumbnailCacheContext(slide, targetContent),
			cacheMode,
		)
	}

	async generateAllScreenshots(): Promise<void> {
		if (this.disposed) return
		await this.screenshotManager.generateAllScreenshots(
			this.slides,
			(slide, originalIndex) => {
				const generationKey = this.getSlideStableKey(slide, originalIndex)
				return this.slides.find(
					(candidate, candidateIndex) =>
						this.getSlideStableKey(candidate, candidateIndex) === generationKey,
				)
			},
			(slide) => this.getThumbnailCacheContext(slide),
		)
	}

	private getThumbnailCacheContext(
		slide: SlideItem,
		targetContent?: string,
	): PPTThumbnailCacheContext | undefined {
		const scope = this.config.thumbnailCacheScope
		if (
			!scope ||
			scope.mainFileId !== this.config.mainFileId ||
			!slide.rawContent ||
			typeof slide.resourceVersionSignature !== "string" ||
			(targetContent && targetContent !== slide.content)
		)
			return undefined
		const fileId = this.getSlideFileId(slide)
		const path = this.pathMappingService.getFullRelativePath(slide.path)
		if (!fileId && !path) return undefined
		return {
			scope,
			slideIdentity: fileId ? `file:${fileId}` : `path:${path}`,
			path: path || slide.path,
			rawContent: slide.rawContent,
			resourceVersionSignature: slide.resourceVersionSignature,
		}
	}

	/**
	 * Ensure screenshot is generated for a specific slide (lazy loading)
	 * 确保为特定幻灯片生成截图（懒加载）
	 * - Skips if screenshot already exists or is being generated
	 * - 如果截图已存在或正在生成则跳过
	 */
	async ensureSlideScreenshot(
		index: number,
		requestKind: SlideScreenshotRequestKind = "required",
	): Promise<void> {
		if (this.disposed) return
		const slide = this.slides[index]
		if (!slide) return
		const generationKey = this.getSlideStableKey(slide, index)

		// Skip if screenshot already exists
		if (slide.thumbnailUrl) {
			this.logger.debug("截图已存在，跳过生成", {
				operation: "ensureSlideScreenshot",
				slideIndex: index,
			})
			return
		}

		// Required work may join a preview generation and protect the shared service task from
		// fullscreen cancellation. Duplicate requests of the same kind still remain deduplicated.
		if (this.generatingScreenshots.has(generationKey) || slide.thumbnailLoading) {
			if (
				requestKind === "required" &&
				this.generatingScreenshots.has(generationKey) &&
				this.previewScreenshotKeys.has(generationKey)
			) {
				const requestToken = Symbol(generationKey)
				this.generatingScreenshots.set(generationKey, requestToken)
				this.previewScreenshotKeys.delete(generationKey)
				try {
					await this.generateSlideScreenshot(index, undefined, "required")
				} finally {
					if (this.generatingScreenshots.get(generationKey) === requestToken) {
						this.generatingScreenshots.delete(generationKey)
					}
				}
				return
			}
			this.logger.debug("截图正在生成中，跳过", {
				operation: "ensureSlideScreenshot",
				slideIndex: index,
				metadata: {
					generationKey,
					inTrackingSet: this.generatingScreenshots.has(generationKey),
					thumbnailLoading: slide.thumbnailLoading,
				},
			})
			return
		}

		// Skip if slide content is not loaded yet
		if (slide.loadingState !== "loaded") {
			this.logger.debug("幻灯片内容未加载，跳过截图生成", {
				operation: "ensureSlideScreenshot",
				slideIndex: index,
				metadata: { loadingState: slide.loadingState },
			})
			return
		}

		const requestToken = Symbol(generationKey)
		this.generatingScreenshots.set(generationKey, requestToken)
		if (requestKind === "preview") this.previewScreenshotKeys.add(generationKey)
		try {
			this.logger.debug("开始懒加载截图", {
				operation: "ensureSlideScreenshot",
				slideIndex: index,
				metadata: { generationKey },
			})
			await this.generateSlideScreenshot(index, undefined, requestKind)
		} finally {
			// A late request from the previous deck must not clear a newer task's marker.
			if (this.generatingScreenshots.get(generationKey) === requestToken) {
				this.generatingScreenshots.delete(generationKey)
				this.previewScreenshotKeys.delete(generationKey)
			}
		}
	}

	/** Ensure the current page wins scheduling without creating a second preload window. */
	private async ensureActiveSlidePreview(): Promise<void> {
		if (this.slides.length === 0) return
		await this.ensureSlidePreview(this.activeIndex, "active")
	}

	clearSlideScreenshot(index: number): void {
		if (this.disposed) return
		const slide = this.slides[index]
		if (!slide) return
		this.screenshotManager.clearSlideScreenshot(slide, index, this.slides)
	}

	clearAllScreenshots(): void {
		if (this.disposed) return
		this.screenshotManager.clearAllScreenshots(this.slides)
	}

	getScreenshotCacheStats() {
		return this.screenshotManager.getCacheStats()
	}

	// ==================== Configuration Updates ====================
	async updateConfig(config: Partial<PPTStoreConfig>): Promise<void> {
		if (this.disposed) return
		if (isFileApiOnlyConfig(config)) {
			const previousIdentity = getFileApiIdentityKey(this.config.fileApi)
			const nextIdentity = getFileApiIdentityKey(config.fileApi)
			this.config = { ...this.config, ...config }
			this.pathMappingService.updateConfig(config)
			// Same identity must not bump the config version: host remounts send
			// this payload after deck init and would abort an in-flight load.
			if (previousIdentity === nextIdentity) return
			config = {
				displayConfig: this.config.displayConfig,
				attachmentList: this.config.attachmentList,
				fileApi: this.config.fileApi,
			}
		}
		const configUpdateVersion = ++this.configUpdateVersion
		this.logger.debug("更新配置", {
			operation: "updateConfig",
			metadata: { configKeys: Object.keys(config) },
		})

		const previousAttachmentList = this.attachmentListSnapshot
		const previousMainFileId = this.config.mainFileId
		const hasAttachmentListUpdate = hasOwnConfigField(config, "attachmentList")
		const hasMainFileIdUpdate = hasOwnConfigField(config, "mainFileId")
		const mainFileChanged = hasMainFileIdUpdate && config.mainFileId !== previousMainFileId
		if (mainFileChanged) {
			this.clearPreviewFileUpdates()
			this.beginContentGeneration()
			this.pathMappingService.clear()
		}

		this.config = { ...this.config, ...config }
		if (hasOwnConfigField(config, "displayConfig")) {
			this.hiddenSlidePaths = config.displayConfig?.hidden_slides
			this.transitions = config.displayConfig?.transitions
		}
		const hasCacheConfigUpdate =
			hasOwnConfigField(config, "organizationCode") ||
			hasOwnConfigField(config, "selectedProjectId") ||
			hasMainFileIdUpdate
		if (hasCacheConfigUpdate) {
			// Update identity before asynchronous slide reconciliation so a new deck cannot restore
			// or debounce-save activeIndex state through the previous deck's cache key.
			this.cacheManager.updateConfig({
				organizationCode: this.config.organizationCode,
				selectedProjectId: this.config.selectedProjectId,
				mainFileId: this.config.mainFileId,
			})
		}

		// Update processor service config
		const processorConfig: Partial<SlideProcessorConfig> = {}
		if (hasOwnConfigField(config, "attachments"))
			processorConfig.attachments = config.attachments
		if (hasOwnConfigField(config, "attachmentList"))
			processorConfig.attachmentList = config.attachmentList
		if (hasMainFileIdUpdate) processorConfig.mainFileId = config.mainFileId
		if (hasOwnConfigField(config, "mainFileName"))
			processorConfig.mainFileName = config.mainFileName
		if (hasOwnConfigField(config, "displayConfig"))
			processorConfig.displayConfig = config.displayConfig
		if (hasOwnConfigField(config, "fileApi")) processorConfig.fileApi = config.fileApi

		if (Object.keys(processorConfig).length > 0) {
			this.processorService.updateConfig(processorConfig)
		}

		// Update path mapping service config
		this.pathMappingService.updateConfig(config)

		// Update logger config if provided
		if (config.logger !== undefined) {
			this.logger.updateConfig(config.logger)
		}

		// Check if slides data needs incremental update
		await this.handleIncrementalUpdate(
			config,
			previousAttachmentList,
			mainFileChanged,
			configUpdateVersion,
		)
		if (!this.isConfigUpdateCurrent(configUpdateVersion)) return
		if (hasAttachmentListUpdate) {
			this.attachmentListSnapshot = this.snapshotAttachmentList(config.attachmentList)
		}

		await this.settlePendingInitialization(configUpdateVersion)
		if (!this.isConfigUpdateCurrent(configUpdateVersion)) return

		this.logger.info("配置更新成功", {
			operation: "updateConfig",
		})
	}

	/**
	 * Handle incremental update of slides
	 * This is the single source of truth for slide sync (single-channel design).
	 * Handles initialization, incremental updates, and file content updates.
	 */
	private async handleIncrementalUpdate(
		config: Partial<PPTStoreConfig>,
		previousAttachmentList: AttachmentItem[] | undefined,
		mainFileChanged: boolean,
		configUpdateVersion: number,
	): Promise<void> {
		if (!this.isConfigUpdateCurrent(configUpdateVersion)) return
		if (
			!config.displayConfig &&
			!config.attachmentList &&
			!mainFileChanged &&
			!hasOwnConfigField(config, "attachmentLoadState")
		) {
			return
		}

		const newSlidePaths = this.extractSlidePathsFromDisplayConfig(
			config.displayConfig ?? this.config.displayConfig,
		)
		if (mainFileChanged) {
			await this.initializeSlides(newSlidePaths, { configUpdateVersion })
			return
		}
		const currentSlidePaths = this.slidePaths
		const updatedFiles = this.incrementalUpdateService.detectUpdatedFiles(
			previousAttachmentList,
			config.attachmentList,
		)
		const existingUpdatedFiles = new Set<string>()
		updatedFiles.forEach((fileId) => {
			if (this.hasAttachmentFileId(fileId, previousAttachmentList)) {
				existingUpdatedFiles.add(fileId)
			}
		})
		if (!this.isConfigUpdateCurrent(configUpdateVersion)) return
		const previewUpdatedFiles = this.collectPreviewAffectingFileIds(existingUpdatedFiles)

		// Initialization: store has no slides yet, but config provides paths
		if (this.slides.length === 0 && newSlidePaths.length > 0) {
			await this.initializeSlides(newSlidePaths, { configUpdateVersion })
			return
		}

		// CRITICAL FIX: Check if current state already matches newSlidePaths
		// This means optimistic update has already been applied, skip to prevent double operation
		const areCurrentAndNewEqual =
			currentSlidePaths.length === newSlidePaths.length &&
			currentSlidePaths.every((path, idx) => path === newSlidePaths[idx])

		// If slide paths haven't changed, run recovery for pending/error slides.
		// This handles: new files appearing in attachmentList, files becoming available after error, etc.
		if (areCurrentAndNewEqual) {
			await this.recoverPendingSlidesAfterAttachmentUpdate(configUpdateVersion)
			if (!this.isConfigUpdateCurrent(configUpdateVersion)) return
			if (previewUpdatedFiles.size > 0) {
				await this.queuePreviewFileUpdates(previewUpdatedFiles)
			}
			if (this.isConfigUpdateCurrent(configUpdateVersion)) this.scheduleActiveSlide()

			return
		}

		const changes = this.incrementalUpdateService.detectSlideChanges(
			currentSlidePaths,
			newSlidePaths,
		)

		if (changes.hasChanges) {
			const context = this.createIncrementalUpdateContext(configUpdateVersion)
			await this.incrementalUpdateService.applyIncrementalUpdates(
				changes,
				new Set(),
				newSlidePaths,
				context,
			)
			if (!this.isConfigUpdateCurrent(configUpdateVersion)) return
		}
		if (previewUpdatedFiles.size > 0) {
			await this.queuePreviewFileUpdates(previewUpdatedFiles)
		}
		if (
			(changes.hasChanges || previewUpdatedFiles.size > 0) &&
			this.isConfigUpdateCurrent(configUpdateVersion)
		) {
			this.scheduleActiveSlide()
		}
	}

	private getAttachmentFileName(item: { file_name?: string; filename?: string } | undefined) {
		return item?.file_name || item?.filename || ""
	}

	private collectPreviewAffectingFileIds(updatedFileIds: Set<string>): Set<string> {
		const previewFileIds = new Set<string>()
		const slideFileIds = new Set<string>()
		let themeUpdated = false

		this.slides.forEach((slide) => {
			const fileId =
				this.pathMappingService.getFileIdByPath(slide.path) ||
				this.pathMappingService.extractFileIdFromPath(slide.path)
			if (!fileId) return
			slideFileIds.add(fileId)
			this.pathMappingService.setPathFileIdMapping(slide.path, fileId)
		})

		updatedFileIds.forEach((fileId) => {
			if (slideFileIds.has(fileId)) {
				previewFileIds.add(fileId)
				return
			}
			const item = this.pathMappingService.getAttachmentByFileIdInPPTFolder(fileId)
			if (this.getAttachmentFileName(item).toLowerCase() === "theme.css") {
				themeUpdated = true
			}
		})

		if (themeUpdated) {
			slideFileIds.forEach((fileId) => previewFileIds.add(fileId))
		}

		return previewFileIds
	}

	private async queuePreviewFileUpdates(fileIds: Set<string>): Promise<void> {
		fileIds.forEach((fileId) => this.pendingPreviewFileIds.add(fileId))
		if (this.fileUpdateDebounceMs <= 0) {
			await this.flushPreviewFileUpdates()
			return
		}
		if (this.fileUpdateDebounceTimer) {
			clearTimeout(this.fileUpdateDebounceTimer)
		}
		this.fileUpdateDebounceTimer = setTimeout(() => {
			this.fileUpdateDebounceTimer = null
			void this.flushPreviewFileUpdates()
		}, this.fileUpdateDebounceMs)
	}

	private async flushPreviewFileUpdates(): Promise<void> {
		if (this.disposed) return
		const fileIds = this.pendingPreviewFileIds
		this.pendingPreviewFileIds = new Set()
		if (fileIds.size === 0) return

		const noChanges = {
			hasChanges: false,
			added: [] as Array<{ path: string; index: number }>,
			removed: [] as number[],
			reordered: false,
		}
		await this.incrementalUpdateService.applyIncrementalUpdates(
			noChanges,
			fileIds,
			this.slidePaths,
			this.createIncrementalUpdateContext(this.configUpdateVersion),
		)
	}

	private clearPreviewFileUpdates(): void {
		if (this.fileUpdateDebounceTimer) {
			clearTimeout(this.fileUpdateDebounceTimer)
			this.fileUpdateDebounceTimer = null
		}
		this.pendingPreviewFileIds.clear()
	}

	private async recoverPendingSlidesAfterAttachmentUpdate(
		configUpdateVersion: number,
	): Promise<number> {
		if (this.slides.length === 0 || !this.isConfigUpdateCurrent(configUpdateVersion)) {
			return 0
		}

		// Phase 1: Recover slides missing fileId or URL
		const pendingSlides = this.slides
			.map((slide, index) => ({
				index,
				path: slide.path,
				url: slide.url,
				fileId: this.pathMappingService.getFileIdByPath(slide.path),
				demandKey: this.getSlideStableKey(slide, index),
				loadingState: slide.loadingState,
				hasContent: Boolean(slide.content),
			}))
			.filter((slide) => !slide.fileId || !slide.url)

		let recoveredCount = 0

		if (pendingSlides.length > 0) {
			const fileIdsToFetch: string[] = []
			pendingSlides.forEach((slide) => {
				const fileId =
					slide.fileId || this.pathMappingService.extractFileIdFromPath(slide.path)
				if (!fileId) return
				this.pathMappingService.setPathFileIdMapping(slide.path, fileId)
				fileIdsToFetch.push(fileId)
			})

			if (fileIdsToFetch.length > 0) {
				const urlMap = await this.pathMappingService.fetchUrlsForFileIds(fileIdsToFetch, {
					shouldCommit: () => this.isConfigUpdateCurrent(configUpdateVersion),
				})
				if (!this.isConfigUpdateCurrent(configUpdateVersion)) return recoveredCount

				runInAction(() => {
					if (!this.isConfigUpdateCurrent(configUpdateVersion)) return
					pendingSlides.forEach((pending) => {
						const fileId =
							this.pathMappingService.getFileIdByPath(pending.path) ||
							this.pathMappingService.extractFileIdFromPath(pending.path)
						if (!fileId) return
						const recoveredUrl = urlMap.get(fileId)
						if (!recoveredUrl) return
						const targetIndex = this.slides.findIndex(
							(slide) =>
								this.getSlideFileId(slide) === fileId ||
								slide.path === pending.path,
						)
						const target = targetIndex === -1 ? undefined : this.slides[targetIndex]
						if (!target || target.path !== pending.path) return
						target.url = recoveredUrl
						this.pathMappingService.setPathUrlMapping(pending.path, recoveredUrl)
						recoveredCount++
					})
				})
			}
		}

		if (this.isConfigUpdateCurrent(configUpdateVersion)) {
			// 最终批次可能没有新增页文件；已有可见需求也要重新判断缺失或加载失败。
			this.resumePendingSlideDemand(pendingSlides)
			this.scheduleActiveSlide()
		}

		return recoveredCount
	}

	private resumePendingSlideDemand(
		pendingSlides: Array<{ path: string; fileId?: string; demandKey: string }>,
	): void {
		pendingSlides.forEach((pending) => {
			const index = this.findSlideIndexByLoadTarget(pending)
			const slide = this.slides[index]
			if (!slide) return
			const previousKey = pending.demandKey
			const nextKey = this.getSlideStableKey(slide, index)
			const candidateKeys = [previousKey, nextKey, slide.path, slide.id]
			const wasVisible = candidateKeys.some(
				(key) => !!key && this.visiblePreviewKeys.has(key),
			)
			candidateKeys.forEach((key) => {
				if (key && key !== nextKey && this.visiblePreviewKeys.has(key)) {
					this.visiblePreviewKeys.delete(key)
				}
			})
			if (wasVisible) this.visiblePreviewKeys.add(nextKey)
			if (index === this.activeIndex) {
				void this.ensureSlideContent(index, "active")
				return
			}
			if (wasVisible) void this.ensureSlidePreview(index, "preview")
		})
	}

	/**
	 * Extract slide paths from display_config
	 */
	private extractSlidePathsFromDisplayConfig(displayConfig: { slides: string[] }): string[] {
		if (!displayConfig || !displayConfig.slides || !Array.isArray(displayConfig.slides)) {
			return []
		}
		return displayConfig.slides
	}

	// ==================== Manual Save Tracking ====================
	/**
	 * Mark a slide as manually saved by fileId
	 * 通过 fileId 标记幻灯片为手动保存
	 */
	markSlideAsManuallySaved(fileId: string): void {
		this.manuallySavedSlides.add(fileId)
		this.logger.debug("标记幻灯片为手动保存", {
			operation: "markSlideAsManuallySaved",
			metadata: { fileId },
		})
	}

	/**
	 * Check if a slide was manually saved by fileId
	 * 通过 fileId 检查幻灯片是否为手动保存
	 */
	isSlideManuallySaved(fileId: string): boolean {
		return this.manuallySavedSlides.has(fileId)
	}

	/**
	 * Clear manual save mark for a slide by fileId
	 * 通过 fileId 清除幻灯片的手动保存标记
	 */
	clearManualSaveMark(fileId: string): void {
		this.manuallySavedSlides.delete(fileId)
		this.logger.debug("清除幻灯片手动保存标记", {
			operation: "clearManualSaveMark",
			metadata: { fileId },
		})
	}

	/**
	 * Clear all manual save marks
	 * 清除所有手动保存标记
	 */
	clearAllManualSaveMarks(): void {
		this.manuallySavedSlides.clear()
		this.logger.debug("清除所有手动保存标记", {
			operation: "clearAllManualSaveMarks",
		})
	}

	// ==================== Slide Editing State Management ====================
	/**
	 * Set slide editing state by fileId
	 * 设置幻灯片的编辑状态（通过 fileId）
	 */
	setSlideEditingState(fileId: string, isEditing: boolean): void {
		this.slideEditingStates.set(fileId, isEditing)
		this.logger.debug("设置幻灯片编辑状态", {
			operation: "setSlideEditingState",
			metadata: { fileId, isEditing },
		})
	}

	/**
	 * Get slide editing state by fileId
	 * 获取幻灯片的编辑状态（通过 fileId）
	 */
	getSlideEditingState(fileId: string): boolean {
		return this.slideEditingStates.get(fileId) || false
	}

	/**
	 * Notify slide of server update
	 * 通知幻灯片有服务端更新
	 */
	notifyServerUpdate(fileId: string, content: string): void {
		this.slideServerUpdates.set(fileId, content)
		this.logger.info("通知幻灯片服务端更新", {
			operation: "notifyServerUpdate",
			metadata: { fileId },
		})
	}

	/**
	 * Get server updated content by fileId
	 * 获取幻灯片的服务端更新内容（通过 fileId）
	 */
	getSlideServerUpdate(fileId: string): string | undefined {
		return this.slideServerUpdates.get(fileId)
	}

	/**
	 * Clear server update for a slide
	 * 清除幻灯片的服务端更新标记
	 */
	clearSlideServerUpdate(fileId: string): void {
		this.slideServerUpdates.delete(fileId)
		this.logger.debug("清除幻灯片服务端更新标记", {
			operation: "clearSlideServerUpdate",
			metadata: { fileId },
		})
	}

	/**
	 * Set whether to show button text in toolbar
	 * 设置是否在工具栏中显示按钮文字
	 */
	setShouldShowButtonText(show: boolean): void {
		this.shouldShowButtonText = show
	}

	// ==================== ActiveIndex Cache Management ====================
	/**
	 * Setup auto-save for activeIndex changes
	 * 设置 activeIndex 变化时的自动保存
	 */
	private setupAutoSave(): void {
		this.activeIndexAutoSaveDisposer = reaction(
			() => this.activeIndex,
			(activeIndex) => {
				this.cacheManager.saveActiveIndexDebounced(activeIndex)
			},
		)

		this.logger.debug("ActiveIndex auto-save enabled", {
			operation: "setupAutoSave",
		})
	}

	/**
	 * Restore cached activeIndex from storage
	 * 从存储中恢复缓存的 activeIndex
	 */
	async restoreCachedActiveIndex(options: { shouldApply?: () => boolean } = {}): Promise<void> {
		try {
			const cachedIndex = await this.cacheManager.restoreActiveIndex()
			if (options.shouldApply && !options.shouldApply()) return
			if (cachedIndex !== null && cachedIndex >= 0 && cachedIndex < this.slides.length) {
				this.logger.debug("Restoring cached activeIndex", {
					operation: "restoreCachedActiveIndex",
					metadata: { cachedIndex, currentIndex: this.activeIndex },
				})
				this.setActiveIndex(cachedIndex)
			}
		} catch (error) {
			this.logger.error({
				eventKey: "restore_cached_active_index_failed",
				errorKind: "render",
				error: error,
				message: "Failed to restore cached activeIndex",
				context: { operation: "restoreCachedActiveIndex" },
			})
		}
	}

	/**
	 * Update cache configuration (for organizationCode/projectId changes)
	 * 更新缓存配置（用于 organizationCode/projectId 变化）
	 */
	updateCacheConfig(config: { organizationCode?: string; selectedProjectId?: string }): void {
		this.cacheManager.updateConfig({
			...config,
			mainFileId: this.config.mainFileId,
		})

		this.logger.debug("Cache config updated", {
			operation: "updateCacheConfig",
			metadata: config,
		})
	}

	/**
	 * Reset store to initial state
	 */
	reset(): void {
		if (this.disposed) return
		this.logger.info("重置 Store 到初始状态", {
			operation: "reset",
		})

		this.beginDeckGeneration()
		this.clearPreviewFileUpdates()
		this.configUpdateVersion++
		this.initializingPromise = null
		this.initializingKey = null
		this.slideManager.reset()
		this.loadingManager.reset()
		this.viewStateManager.reset()
		this.pathMappingService.clear()
		this.manuallySavedSlides.clear()
		this.generatingScreenshots.clear()
		this.previewScreenshotKeys.clear()
		this.slideEditingStates.clear()
		this.slideServerUpdates.clear()
		this.cacheManager.dispose()
		this.logger.clearTimings()
	}

	dispose(): void {
		if (this.disposed) return
		this.disposed = true
		this.configUpdateVersion++
		this.clearPreviewFileUpdates()
		this.screenshotManager.dispose(this.slides)
		this.screenshotService.dispose()
		this.generatingScreenshots.clear()
		this.previewScreenshotKeys.clear()
		this.contentGeneration++
		this.contentGenerationController.abort()
		this.contentScheduler.dispose()
		this.visiblePreviewKeys.clear()
		this.fullscreenContentPriorities.clear()
		this.activeContentKey = null
		this.activeIndexAutoSaveDisposer?.()
		this.activeIndexAutoSaveDisposer = null
		this.queueUnsubscribe?.()
		this.queueUnsubscribe = null
		this.cacheManager.dispose()
		this.logger.clearTimings()

		const pptWindow = window as typeof window & { pptStore?: PPTStore }
		if (pptWindow.pptStore === this) delete pptWindow.pptStore
	}
}

/**
 * Factory function to create a new PPTStore instance
 */
export function createPPTStore(config: PPTStoreConfig): PPTStore {
	return new PPTStore(config)
}
