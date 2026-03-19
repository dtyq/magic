import { makeAutoObservable, reaction, runInAction } from "mobx"
import {
	SlideLoaderService,
	SlideProcessorService,
	getScreenshotService,
	createPPTLogger,
	PPTPathMappingService,
	PPTIncrementalUpdateService,
} from "../services"
import type { SlideProcessorConfig, PPTLoggerConfig, IncrementalUpdateContext } from "../services"
import { getTemporaryDownloadUrl } from "@/pages/superMagic/utils/api"
import type { SlideItem } from "../PPTSidebar/types"
import { PPTSlideManager } from "./PPTSlideManager"
import { PPTLoadingManager } from "./PPTLoadingManager"
import { PPTViewStateManager } from "./PPTViewStateManager"
import { PPTScreenshotManager } from "./PPTScreenshotManager"
import { PPTActiveIndexCacheManager } from "./PPTActiveIndexCacheManager"
import { AttachmentItem } from "../../../../TopicFilesButton/hooks"

/**
 * Configuration for PPTStore
 */
export interface PPTStoreConfig {
	attachments?: any[]
	attachmentList?: any[]
	mainFileId?: string
	mainFileName?: string
	metadata?: any
	/**
	 * Whether to automatically load slides and generate screenshots
	 * when slides are initialized
	 * @default true
	 */
	autoLoadAndGenerate?: boolean
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
}

export interface PPTExportConfig extends PPTStoreConfig { }

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
	private loaderService: SlideLoaderService
	private processorService: SlideProcessorService
	private logger: ReturnType<typeof createPPTLogger>
	/** Path mapping service - public for optimistic updates */
	pathMappingService: PPTPathMappingService
	private incrementalUpdateService: PPTIncrementalUpdateService

	// ==================== Optimization Fields ====================
	private initializingPromise: Promise<void> | null = null
	/**
	 * Render window size - number of slides to render before/after active slide
	 * 渲染窗口大小 - 在当前幻灯片前后渲染的幻灯片数量
	 */
	private renderWindowSize = 2
	/**
	 * Track manually saved slides by fileId to skip loading indicator
	 * 追踪手动保存的幻灯片（通过 fileId），用于跳过加载指示器
	 */
	private manuallySavedSlides: Set<string> = new Set()
	/**
	 * Screenshot window size - number of slides to preload screenshots before/after active slide
	 * 截图窗口大小 - 在当前幻灯片前后预加载截图的幻灯片数量
	 */
	private screenshotWindowSize = 3
	/**
	 * Track slides that have screenshot generation in progress
	 * 追踪正在生成截图的幻灯片索引
	 */
	private generatingScreenshots: Set<number> = new Set()
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

		// Initialize services
		this.loaderService = new SlideLoaderService()
		this.processorService = new SlideProcessorService({
			attachments: config.attachments,
			attachmentList: config.attachmentList,
			mainFileId: config.mainFileId,
			mainFileName: config.mainFileName,
			metadata: config.metadata,
		})
		const screenshotService = getScreenshotService()
		this.logger = createPPTLogger(config.logger)
		this.pathMappingService = new PPTPathMappingService(config, this.logger)
		this.incrementalUpdateService = new PPTIncrementalUpdateService(
			this.pathMappingService,
			screenshotService,
			this.logger,
		)

		// Initialize managers
		this.slideManager = new PPTSlideManager(
			this.logger,
			this.pathMappingService,
			screenshotService,
			config.autoLoadAndGenerate !== false,
		)
		this.loadingManager = new PPTLoadingManager(this.logger)
		this.viewStateManager = new PPTViewStateManager(this.logger)
		this.screenshotManager = new PPTScreenshotManager(this.logger, screenshotService)
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

		// @ts-ignore
		window.pptStore = this

		makeAutoObservable(this, {}, { autoBind: true })

		// Setup auto-save for activeIndex when cache is enabled
		if (config.enableCache !== false) {
			this.setupAutoSave()
		}
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
		return { ...this.config }
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
	 * - Non-fullscreen: current only (1 slide)
	 * - 全屏：渲染当前幻灯片周围的窗口以实现流畅切换（预渲染）
	 * - 非全屏：仅当前页（1 页）
	 */
	get visibleSlides(): Array<{ slide: SlideItem; index: number }> {
		// Non-fullscreen: only render current slide
		if (!this.isFullscreen) {
			return this.slides[this.activeIndex]
				? [{ slide: this.slides[this.activeIndex], index: this.activeIndex }]
				: []
		}

		// Fullscreen: render only slides within the window (prerendering for smooth transitions)
		// This significantly improves performance when there are many slides
		const startIndex = Math.max(0, this.activeIndex - this.renderWindowSize)
		const endIndex = Math.min(this.slides.length - 1, this.activeIndex + this.renderWindowSize)

		const result: Array<{ slide: SlideItem; index: number }> = []
		for (let i = startIndex; i <= endIndex; i++) {
			result.push({ slide: this.slides[i], index: i })
		}
		return result
	}

	// ==================== Slide Initialization & Loading ====================
	/**
	 * Initialize slides from original paths
	 */
	async initializeSlides(slidePaths: string[]): Promise<void> {
		// Prevent duplicate concurrent calls
		if (this.initializingPromise) {
			this.logger.warn("initializeSlides already in progress, returning existing promise")
			return this.initializingPromise
		}

		this.logger.logOperationStart("initializeSlides", {
			metadata: { slideCount: slidePaths?.length || 0 },
		})

		if (!slidePaths || slidePaths.length === 0) {
			this.logger.warn("未提供幻灯片路径，初始化为空幻灯片")
			this.slideManager.initializeSlides([])
			return
		}

		// Set initializing state
		this.loadingManager.setInitializing(true)

		// Create and store the promise
		this.initializingPromise = (async () => {
			try {
				// 1. Extract file IDs from paths
				const fileIds: string[] = []
				const slideItems: SlideItem[] = slidePaths.map((path, index) => {
					const fileId = this.pathMappingService.extractFileIdFromPath(path)
					if (fileId) {
						fileIds.push(fileId)
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
					}
				})

				// 2. Fetch temporary download URLs in batch
				if (fileIds.length > 0) {
					try {
						const response = await getTemporaryDownloadUrl({
							file_ids: fileIds,
						})

						response?.forEach((item: any) => {
							if (item.file_id && item.url) {
								const path = Array.from(
									this.pathMappingService.getAllFileIdMappings().entries(),
								).find(([, id]) => id === item.file_id)?.[0]
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
						this.logger.error("获取临时 URL 失败", error, {
							operation: "initializeSlides",
							metadata: { fileIdCount: fileIds.length },
						})
					}
				}

				// Initialize slide manager
				this.slideManager.initializeSlides(slideItems)

				// Reset loading state
				this.loadingManager.resetLoadingState()

				this.logger.logOperationSuccess("initializeSlides", {
					metadata: {
						slideCount: this.slides.length,
						autoLoadAndGenerate: this.config.autoLoadAndGenerate,
					},
				})

				// Automatically load slides if enabled
				if (this.config.autoLoadAndGenerate !== false) {
					this.loadAllSlides()
				}
			} catch (error) {
				this.logger.logOperationError("initializeSlides", error, {
					metadata: { slidePathCount: slidePaths.length },
				})
				this.loadingManager.setInitializing(false)
				throw error
			} finally {
				this.initializingPromise = null
			}
		})()

		return this.initializingPromise
	}

	/**
	 * Get file ID by original path
	 */
	getFileIdByPath(path: string): string | undefined {
		return this.pathMappingService.getFileIdByPath(path)
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
				slide.loadingError = undefined
			})
		})

		try {
			// Phase 1: Load raw content and collect file IDs
			const allFileIds = new Set<string>()
			const slideRawData: Array<{
				url: string
				index: number
				content: string
				relativeFilePath?: string
			}> = []

			await Promise.all(
				this.slides.map(async (slide, index) => {
					try {
						const url = slide.url || ""
						if (!url) {
							this.logger.warn("幻灯片没有可用的 URL", {
								operation: "loadAllSlides",
								slideIndex: index,
							})

							runInAction(() => {
								if (this.slides[index]) {
									this.slides[index].loadingState = "error"
									this.slides[index].loadingError = new Error(
										"No URL available for slide",
									)
								}
							})
							return
						}

						const rawContent = await this.loaderService.loadSlide(url)

						const slidePath = this.slides[index]?.path
						const fileId = this.pathMappingService.getFileIdByPath(slidePath)
						const fileItem = this.config.attachmentList?.find(
							(item: any) => item.file_id === fileId,
						)
						const relativeFilePath = fileItem?.relative_file_path?.replace(
							fileItem?.file_name,
							"",
						)

						slideRawData.push({ url, index, content: rawContent, relativeFilePath })

						const fileIds = this.processorService.collectFileIds(
							rawContent,
							index,
							relativeFilePath,
						)
						fileIds.forEach((id) => allFileIds.add(id))
					} catch (error) {
						this.logger.error("加载原始内容失败", error, {
							operation: "loadAllSlides",
							slideIndex: index,
						})

						runInAction(() => {
							if (this.slides[index]) {
								this.slides[index].loadingState = "error"
								this.slides[index].loadingError = error as Error
							}
						})
					}
				}),
			)

			// Phase 2: Fetch resource URLs in batch
			const urlMapping: Map<string, string> = new Map()
			if (allFileIds.size > 0) {
				try {
					const response = await getTemporaryDownloadUrl({
						file_ids: Array.from(allFileIds),
					})
					response?.forEach((item: any) => {
						if (item.file_id && item.url) {
							urlMapping.set(item.file_id, item.url)
						}
					})
				} catch (error) {
					this.logger.error("获取临时下载 URL 失败", error, {
						operation: "loadAllSlides",
						metadata: { fileIdCount: allFileIds.size },
					})
				}
			}

			// Phase 3: Process slides with URL mapping
			const currentIndex = this.activeIndex
			// Use actual slide indices from slideRawData, not array positions
			const allIndices = slideRawData.map((s) => s.index)
			const priorityIndices = [
				currentIndex,
				currentIndex - 1,
				currentIndex + 1,
				...allIndices.filter((i) => Math.abs(i - currentIndex) > 1),
			].filter((i) => allIndices.includes(i))

			const processingPromises: Promise<void>[] = []

			for (const priorityIndex of priorityIndices) {
				const slideData = slideRawData.find((s) => s.index === priorityIndex)
				if (!slideData) continue

				const { index, content, relativeFilePath } = slideData

				const promise = (async () => {
					try {
						runInAction(() => {
							if (this.slides[index]) {
								this.slides[index].loadingState = "loading"
							}
						})

						const processedContent =
							await this.processorService.processSlideWithUrlMapping(
								content,
								index,
								relativeFilePath,
								urlMapping,
							)

						runInAction(() => {
							if (this.slides[index]) {
								this.slides[index].rawContent = content
								this.slides[index].content = processedContent
								this.slides[index].loadingState = "loaded"
								this.slides[index].lastLoadedAt = Date.now()
							}
						})

						// Update progress
						this.loadingManager.updateProgress(this.slides)
					} catch (error) {
						this.logger.error("处理幻灯片失败", error, {
							operation: "loadAllSlides",
							slideIndex: index,
						})

						runInAction(() => {
							if (this.slides[index]) {
								this.slides[index].loadingState = "error"
								this.slides[index].loadingError = error as Error
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

				// Generate screenshots for visible slides only (lazy loading)
				if (this.config.autoLoadAndGenerate !== false) {
					this.ensureVisibleScreenshots()
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
	async loadSlideContent(url: string, index: number): Promise<string> {
		this.logger.logOperationStart("loadSlideContent", {
			slideIndex: index,
			metadata: { url },
		})

		if (!url || !this.slides[index]) {
			this.logger.warn("无效的 URL 或幻灯片索引", {
				operation: "loadSlideContent",
				slideIndex: index,
				metadata: { hasUrl: !!url, hasSlide: !!this.slides[index] },
			})
			return ""
		}

		try {
			runInAction(() => {
				if (this.slides[index]) {
					this.slides[index].loadingState = "loading"
				}
			})

			const rawContent = await this.loaderService.loadSlide(url)

			const slidePath = this.slides[index]?.path
			const fileId = this.pathMappingService.getFileIdByPath(slidePath)
			const fileItem = this.config.attachmentList?.find(
				(item: any) => item.file_id === fileId,
			)
			const relativeFilePath = fileItem?.relative_file_path?.replace(fileItem?.file_name, "")

			const processedContent = await this.processorService.processSlide(
				rawContent,
				index,
				relativeFilePath,
			)

			runInAction(() => {
				if (this.slides[index]) {
					this.slides[index].rawContent = rawContent
					this.slides[index].content = processedContent
					this.slides[index].loadingState = "loaded"
					this.slides[index].lastLoadedAt = Date.now()
				}
			})

			this.loadingManager.updateProgress(this.slides)

			this.logger.logOperationSuccess("loadSlideContent", {
				slideIndex: index,
			})

			return processedContent
		} catch (error) {
			this.logger.logOperationError("loadSlideContent", error, {
				slideIndex: index,
			})

			runInAction(() => {
				if (this.slides[index]) {
					this.slides[index].loadingState = "error"
					this.slides[index].loadingError = error as Error
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
	async refreshSlideByFileId(fileId: string): Promise<void> {
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

			// Fetch latest URL from server
			const urlMap = await this.pathMappingService.fetchUrlsForFileIds([fileId])
			const latestUrl = urlMap.get(fileId)

			if (!latestUrl) {
				this.logger.warn("未能获取最新 URL", {
					operation: "refreshSlideByFileId",
					metadata: { fileId, slideIndex },
				})
				return
			}

			// Update URL mapping
			this.pathMappingService.setPathUrlMapping(slide.path, latestUrl)

			// Update slide URL if different
			if (slide.url !== latestUrl) {
				runInAction(() => {
					if (this.slides[slideIndex]) {
						this.slides[slideIndex].url = latestUrl
					}
				})
			}

			// Reload slide content with latest URL
			await this.loadSlideContent(latestUrl, slideIndex)

			// Regenerate screenshot after content refresh
			const refreshedSlide = this.slides[slideIndex]
			if (refreshedSlide?.content) {
				this.generateSlideScreenshot(slideIndex, refreshedSlide.content)
			}

			this.logger.logOperationSuccess("refreshSlideByFileId", {
				metadata: { fileId, slideIndex, latestUrl, screenshotRegenerated: true },
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
			const rawContent = await this.loaderService.loadSlide(url)

			const slidePath = this.slides[index]?.path
			const fileId = this.pathMappingService.getFileIdByPath(slidePath)
			const fileItem = this.config.attachmentList?.find(
				(item: any) => item.file_id === fileId,
			)
			const relativeFilePath = fileItem?.relative_file_path?.replace(fileItem?.file_name, "")

			// Process content without modifying slide state
			const processedContent = await this.processorService.processSlide(
				rawContent,
				index,
				relativeFilePath,
			)

			this.logger.logOperationSuccess("loadSlideContentSilently", {
				slideIndex: index,
			})

			return processedContent
		} catch (error) {
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

	setActiveIndex(index: number): void {
		this.slideManager.setActiveIndex(index)

		const slide = this.slides[index]

		if (slide.loadingState === "idle") {
			const fileId = this.pathMappingService.getFileIdByPath(slide.path)
			if (fileId) {
				this.refreshSlideByFileId(fileId)
			}
		} else {
			// Check for expiration
			this.checkAndRefreshExpiredSlide(index)
		}

		// Trigger lazy loading of visible screenshots when active slide changes
		if (this.config.autoLoadAndGenerate !== false) {
			this.ensureVisibleScreenshots()
		}
	}

	nextSlide(): void {
		this.slideManager.nextSlide()
		// Trigger lazy loading of visible screenshots
		if (this.config.autoLoadAndGenerate !== false) {
			this.ensureVisibleScreenshots()
		}
	}

	prevSlide(): void {
		this.slideManager.prevSlide()
		// Trigger lazy loading of visible screenshots
		if (this.config.autoLoadAndGenerate !== false) {
			this.ensureVisibleScreenshots()
		}
	}

	goToFirstSlide(): void {
		this.slideManager.goToFirstSlide()
		// Trigger lazy loading of visible screenshots
		if (this.config.autoLoadAndGenerate !== false) {
			this.ensureVisibleScreenshots()
		}
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

		// For replace, reload everything
		if (result.changeType === "replace") {
			if (this.config.autoLoadAndGenerate !== false) {
				await this.loadAllSlides()
			}
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
					const response = await getTemporaryDownloadUrl({
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
					this.logger.error("获取新幻灯片临时 URL 失败", error, {
						operation: "handleNewSlideInsertion",
						metadata: { fileIdCount: fileIds.length },
					})
				}
			}

			// 3. Load content for new slides (if auto mode enabled)
			// Screenshots will be generated lazily when slides become visible
			if (this.config.autoLoadAndGenerate !== false) {
				// Iterate over paths instead of stale indices
				for (const pathInfo of slidePathsToFetch) {
					const index = this.slides.findIndex((s) => s.path === pathInfo.path)
					if (index === -1) {
						this.logger.warn("Slide path not found during content loading", {
							operation: "handleNewSlideInsertion",
							metadata: { path: pathInfo.path },
						})
						continue
					}

					const slide = this.slides[index]
					// Check URL existence (it should have been updated in step 2)
					if (!slide || !slide.url) {
						this.logger.warn("跳过没有 URL 的新幻灯片", {
							operation: "handleNewSlideInsertion",
							slideIndex: index,
							metadata: { path: slide?.path },
						})
						continue
					}

					try {
						// Load slide content only
						await this.loadSlideContent(slide.url, index)

						this.logger.info("新幻灯片加载成功", {
							operation: "handleNewSlideInsertion",
							slideIndex: index,
						})
					} catch (error) {
						this.logger.error("新幻灯片加载失败", error, {
							operation: "handleNewSlideInsertion",
							slideIndex: index,
						})
					}
				}

				// Generate screenshots for visible slides (lazy loading)
				await this.ensureVisibleScreenshots()
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

	async updateSlideContent(index: number, content: string): Promise<void> {
		const processedContent = await this.processorService.processSlide(content, index)
		// Save both raw and processed content
		this.slideManager.updateSlideItem(index, {
			rawContent: content,
			content: processedContent,
			loadingState: "loaded",
			lastLoadedAt: Date.now(),
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
				await this.loadSlideContent(url, index)
			},
		)

		// Generate screenshots for visible slides (lazy loading)
		if (this.config.autoLoadAndGenerate !== false) {
			await this.ensureVisibleScreenshots()
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
		this.viewStateManager.setFullscreen(isFullscreen)
	}

	// ==================== File Version (Delegated to LoadingManager) ====================
	setSlideFileVersion(fileId: string, version: number | undefined): void {
		this.loadingManager.setSlideFileVersion(fileId, version)
	}

	setSlidesFileVersions(versions: Record<string, number | undefined>): void {
		this.loadingManager.setSlidesFileVersions(versions)
	}

	// ==================== Screenshot Management (Delegated to ScreenshotManager) ====================
	async generateSlideScreenshot(index: number, targetContent?: string): Promise<void> {
		const slide = this.slides[index]
		if (!slide) return
		await this.screenshotManager.generateSlideScreenshot(
			slide,
			index,
			this.slides,
			targetContent,
		)
	}

	async generateAllScreenshots(): Promise<void> {
		await this.screenshotManager.generateAllScreenshots(this.slides)
	}

	/**
	 * Ensure screenshot is generated for a specific slide (lazy loading)
	 * 确保为特定幻灯片生成截图（懒加载）
	 * - Skips if screenshot already exists or is being generated
	 * - 如果截图已存在或正在生成则跳过
	 */
	async ensureSlideScreenshot(index: number): Promise<void> {
		const slide = this.slides[index]
		if (!slide) return

		// Skip if screenshot already exists
		if (slide.thumbnailUrl) {
			this.logger.debug("截图已存在，跳过生成", {
				operation: "ensureSlideScreenshot",
				slideIndex: index,
			})
			return
		}

		// Skip if already generating (check both tracking set and slide state)
		if (this.generatingScreenshots.has(index) || slide.thumbnailLoading) {
			this.logger.debug("截图正在生成中，跳过", {
				operation: "ensureSlideScreenshot",
				slideIndex: index,
				metadata: {
					inTrackingSet: this.generatingScreenshots.has(index),
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

		try {
			this.generatingScreenshots.add(index)
			this.logger.debug("开始懒加载截图", {
				operation: "ensureSlideScreenshot",
				slideIndex: index,
			})
			await this.generateSlideScreenshot(index)
		} finally {
			this.generatingScreenshots.delete(index)
		}
	}

	/**
	 * Ensure screenshots are generated for visible slides (lazy loading)
	 * 确保为可见幻灯片生成截图（懒加载）
	 * - Generates screenshots for current slide and nearby slides within window
	 * - 为当前幻灯片及窗口范围内的相邻幻灯片生成截图
	 */
	async ensureVisibleScreenshots(): Promise<void> {
		if (this.slides.length === 0) return

		const currentIndex = this.activeIndex
		const startIndex = Math.max(0, currentIndex - this.screenshotWindowSize)
		const endIndex = Math.min(this.slides.length - 1, currentIndex + this.screenshotWindowSize)

		this.logger.debug("开始懒加载可见截图", {
			operation: "ensureVisibleScreenshots",
			metadata: {
				currentIndex,
				startIndex,
				endIndex,
				windowSize: this.screenshotWindowSize,
			},
		})

		// Generate screenshots in priority order: current, then neighbors
		const indices: number[] = []
		indices.push(currentIndex)
		for (let i = 1; i <= this.screenshotWindowSize; i++) {
			if (currentIndex - i >= startIndex) indices.push(currentIndex - i)
			if (currentIndex + i <= endIndex) indices.push(currentIndex + i)
		}

		// Generate screenshots in parallel with limited concurrency
		await Promise.all(indices.map((index) => this.ensureSlideScreenshot(index)))
	}

	clearSlideScreenshot(index: number): void {
		const slide = this.slides[index]
		if (!slide) return
		this.screenshotManager.clearSlideScreenshot(slide, index, this.slides)
	}

	clearAllScreenshots(): void {
		this.screenshotManager.clearAllScreenshots(this.slides)
	}

	getScreenshotCacheStats() {
		return this.screenshotManager.getCacheStats()
	}

	// ==================== Configuration Updates ====================
	async updateConfig(config: Partial<PPTStoreConfig>): Promise<void> {
		this.logger.debug("更新配置", {
			operation: "updateConfig",
			metadata: { configKeys: Object.keys(config) },
		})

		const previousMetadata = this.config.metadata
		const previousAttachmentList = this.config.attachmentList

		this.config = { ...this.config, ...config }

		// Update processor service config
		const processorConfig: Partial<SlideProcessorConfig> = {}
		if (config.attachments !== undefined) processorConfig.attachments = config.attachments
		if (config.attachmentList !== undefined)
			processorConfig.attachmentList = config.attachmentList
		if (config.mainFileId !== undefined) processorConfig.mainFileId = config.mainFileId
		if (config.mainFileName !== undefined) processorConfig.mainFileName = config.mainFileName
		if (config.metadata !== undefined) processorConfig.metadata = config.metadata

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
		await this.handleIncrementalUpdate(config, previousMetadata, previousAttachmentList)

		// Update cache manager config if cache-related fields changed
		if (
			config.organizationCode !== undefined ||
			config.selectedProjectId !== undefined ||
			config.mainFileId !== undefined
		) {
			this.cacheManager.updateConfig({
				organizationCode: config.organizationCode ?? this.config.organizationCode,
				selectedProjectId: config.selectedProjectId ?? this.config.selectedProjectId,
				mainFileId: config.mainFileId ?? this.config.mainFileId,
			})
		}

		this.logger.info("配置更新成功", {
			operation: "updateConfig",
		})
	}

	/**
	 * Handle incremental update of slides
	 */
	private async handleIncrementalUpdate(
		config: Partial<PPTStoreConfig>,
		previousMetadata: { slides: string[] },
		previousAttachmentList: AttachmentItem[] | undefined,
	): Promise<void> {
		if (!config.metadata && !config.attachmentList) {
			return
		}

		const previousSlidePaths = this.extractSlidePathsFromMetadata(previousMetadata)
		const newSlidePaths = this.extractSlidePathsFromMetadata(config.metadata)
		const currentSlidePaths = this.slidePaths
		const updatedFiles = this.incrementalUpdateService.detectUpdatedFiles(
			previousAttachmentList,
			config.attachmentList,
		)
		// CRITICAL FIX: Check if current state already matches newSlidePaths
		// This means optimistic update has already been applied, skip to prevent double operation
		const areCurrentAndNewEqual =
			currentSlidePaths.length === newSlidePaths.length &&
			currentSlidePaths.every((path, idx) => path === newSlidePaths[idx])

		// If current state matches new state, skip update regardless of previous state
		// This handles both insert (length change) and rename (content change) scenarios.
		// However, when files are generated later, slides might still miss fileId/url even
		// with unchanged paths. In that case, run recovery before skipping.
		if (areCurrentAndNewEqual && updatedFiles.size === 0) {
			await this.recoverPendingSlidesAfterAttachmentUpdate()
			this.logger.debug("跳过增量更新 - 当前状态已与新状态匹配（乐观更新已应用）", {
				operation: "handleIncrementalUpdate",
			})
			return
		}

		if (previousSlidePaths.length === 0 && newSlidePaths.length > 0) {
			await this.initializeSlides(newSlidePaths)
			return
		}

		const changes = this.incrementalUpdateService.detectSlideChanges(
			previousSlidePaths,
			newSlidePaths,
		)

		if (changes.hasChanges || updatedFiles.size > 0) {
			const context: IncrementalUpdateContext = {
				slides: this.slides,
				activeIndex: this.activeIndex,
				autoLoadAndGenerate: this.config.autoLoadAndGenerate !== false,
				loadSlideContent: this.loadSlideContent.bind(this),
				loadSlideContentSilently: this.loadSlideContentSilently.bind(this),
				generateSlideScreenshot: this.generateSlideScreenshot.bind(this),
				setSlides: (slides) => {
					this.slideManager.initializeSlides(slides)
				},
				setActiveIndex: (index) => {
					this.slideManager.setActiveIndex(index)
				},
				isSlideManuallySaved: this.isSlideManuallySaved.bind(this),
				clearManualSaveMark: this.clearManualSaveMark.bind(this),
				getSlideEditingState: this.getSlideEditingState.bind(this),
				notifyServerUpdate: this.notifyServerUpdate.bind(this),
			}

			await this.incrementalUpdateService.applyIncrementalUpdates(
				changes,
				updatedFiles,
				newSlidePaths,
				context,
			)
		}
	}

	private async recoverPendingSlidesAfterAttachmentUpdate(): Promise<number> {
		if (this.slides.length === 0) {
			return 0
		}

		const pendingSlides = this.slides
			.map((slide, index) => ({
				index,
				path: slide.path,
				url: slide.url,
				fileId: this.pathMappingService.getFileIdByPath(slide.path),
				loadingState: slide.loadingState,
				hasContent: Boolean(slide.content),
			}))
			.filter((slide) => !slide.fileId || !slide.url)

		if (pendingSlides.length === 0) {
			return 0
		}

		const fileIdsToFetch: string[] = []
		pendingSlides.forEach((slide) => {
			const fileId = slide.fileId || this.pathMappingService.extractFileIdFromPath(slide.path)
			if (!fileId) return
			this.pathMappingService.setPathFileIdMapping(slide.path, fileId)
			fileIdsToFetch.push(fileId)
		})

		const urlMap = await this.pathMappingService.fetchUrlsForFileIds(fileIdsToFetch)
		const recoveredIndices: number[] = []

		runInAction(() => {
			pendingSlides.forEach((pending) => {
				const fileId =
					this.pathMappingService.getFileIdByPath(pending.path) ||
					this.pathMappingService.extractFileIdFromPath(pending.path)
				if (!fileId) return
				const recoveredUrl = urlMap.get(fileId)
				if (!recoveredUrl) return
				const target = this.slides[pending.index]
				if (!target || target.path !== pending.path) return
				target.url = recoveredUrl
				recoveredIndices.push(pending.index)
			})
		})

		const loadTargets = recoveredIndices.filter((index) => {
			const slide = this.slides[index]
			if (!slide || !slide.url) return false
			return !slide.content && slide.loadingState !== "loading"
		})

		await Promise.all(
			loadTargets.map(async (index) => {
				const slide = this.slides[index]
				if (!slide?.url) return
				try {
					await this.loadSlideContent(slide.url, index)
				} catch (error) {
					this.logger.error("恢复待加载幻灯片失败", error, {
						operation: "recoverPendingSlidesAfterAttachmentUpdate",
						slideIndex: index,
						metadata: { path: slide.path },
					})
				}
			}),
		)

		return recoveredIndices.length
	}

	/**
	 * Extract slide paths from metadata
	 */
	private extractSlidePathsFromMetadata(metadata: { slides: string[] }): string[] {
		if (!metadata || !metadata.slides || !Array.isArray(metadata.slides)) {
			return []
		}
		return metadata.slides
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
		reaction(
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
	async restoreCachedActiveIndex(): Promise<void> {
		try {
			const cachedIndex = await this.cacheManager.restoreActiveIndex()
			if (cachedIndex !== null && cachedIndex >= 0 && cachedIndex < this.slides.length) {
				this.logger.debug("Restoring cached activeIndex", {
					operation: "restoreCachedActiveIndex",
					metadata: { cachedIndex, currentIndex: this.activeIndex },
				})
				this.setActiveIndex(cachedIndex)
			}
		} catch (error) {
			this.logger.error("Failed to restore cached activeIndex", {
				operation: "restoreCachedActiveIndex",
				error,
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
		this.logger.info("重置 Store 到初始状态", {
			operation: "reset",
		})

		this.slideManager.reset()
		this.loadingManager.reset()
		this.viewStateManager.reset()
		this.pathMappingService.clear()
		this.manuallySavedSlides.clear()
		this.generatingScreenshots.clear()
		this.slideEditingStates.clear()
		this.slideServerUpdates.clear()
		this.cacheManager.dispose()
		this.logger.clearTimings()
	}
}

/**
 * Factory function to create a new PPTStore instance
 */
export function createPPTStore(config: PPTStoreConfig): PPTStore {
	return new PPTStore(config)
}
