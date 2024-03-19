import { makeAutoObservable, runInAction } from "mobx"
import {
	SlideLoaderService,
	SlideProcessorService,
	getScreenshotService,
	createPPTLogger,
	PPTPathMappingService,
	PPTIncrementalUpdateService,
} from "../services"
import type { SlideProcessorConfig, PPTLoggerConfig, IncrementalUpdateContext } from "../services"
import { getTemporaryDownloadUrl } from "@/opensource/pages/superMagic/utils/api"
import type { SlideItem } from "../PPTSidebar/types"

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
}

/**
 * PPTStore - Manages PPT presentation state and operations
 * Uses MobX for reactive state management
 */
export class PPTStore {
	// ==================== Core Data State ====================
	/** Complete slide items with path, url, content, and metadata */
	slides: SlideItem[] = []

	/** Current active slide index */
	activeIndex: number = 0

	// ==================== Loading State ====================
	/** Whether all slides have been loaded */
	isAllSlidesLoaded: boolean = false

	/** Whether a slide transition is in progress */
	isTransitioning: boolean = false

	/** Loading progress (0-100) */
	loadingProgress: number = 0

	// ==================== View State (Internal) ====================
	/** Scale ratio for zoom */
	scaleRatio: number = 1

	/** Vertical offset for panning */
	verticalOffset: number = 0

	/** Horizontal offset for panning */
	horizontalOffset: number = 0

	/** Fullscreen state */
	isFullscreen: boolean = false

	// ==================== File Version State ====================
	/** 每页 PPT 的文件版本记录 */
	slidesFileVersions: Record<string, number | undefined> = {}

	// ==================== Dependencies ====================
	private config: PPTStoreConfig
	private loaderService: SlideLoaderService
	private processorService: SlideProcessorService
	private screenshotService: ReturnType<typeof getScreenshotService>
	private logger: ReturnType<typeof createPPTLogger>
	private pathMappingService: PPTPathMappingService
	private incrementalUpdateService: PPTIncrementalUpdateService

	constructor(config: PPTStoreConfig) {
		this.config = config
		this.loaderService = new SlideLoaderService()
		this.processorService = new SlideProcessorService({
			attachments: config.attachments,
			attachmentList: config.attachmentList,
			mainFileId: config.mainFileId,
			mainFileName: config.mainFileName,
			metadata: config.metadata,
		})
		this.screenshotService = getScreenshotService()
		this.logger = createPPTLogger(config.logger)
		this.pathMappingService = new PPTPathMappingService(config, this.logger)
		this.incrementalUpdateService = new PPTIncrementalUpdateService(
			this.pathMappingService,
			this.screenshotService,
			this.logger,
		)

		this.logger.info("PPTStore 已初始化", {
			operation: "constructor",
			metadata: {
				autoLoadAndGenerate: config.autoLoadAndGenerate,
				hasAttachments: !!config.attachments,
				hasAttachmentList: !!config.attachmentList,
				mainFileId: config.mainFileId,
			},
		})

		// @ts-ignore
		window.pptStore = this

		makeAutoObservable(this, {}, { autoBind: true })
	}

	// ==================== Computed Values ====================
	/** Get slide URLs array (for backward compatibility) */
	get slideUrls(): string[] {
		return this.slides.map((slide) => slide.url || "")
	}

	/** Get slide paths array */
	get slidePaths(): string[] {
		return this.slides.map((slide) => slide.path)
	}

	/** Get slide titles array */
	get slideTitles(): string[] {
		return this.slides.map((slide) => slide.title || `Slide ${slide.index + 1}`)
	}

	/** Get current slide item */
	get currentSlide(): SlideItem | undefined {
		return this.slides[this.activeIndex]
	}

	/** Get current slide URL */
	get currentSlideUrl(): string {
		return this.currentSlide?.url || ""
	}

	/** Get current slide path */
	get currentSlidePath(): string {
		return this.currentSlide?.path || ""
	}

	/** Get current slide title */
	get currentSlideTitle(): string {
		return this.currentSlide?.title || `Slide ${this.activeIndex + 1}`
	}

	/** Get current slide content */
	get currentSlideContent(): string {
		return this.currentSlide?.content || ""
	}

	/** Get current file ID from path mapping */
	get currentFileId(): string {
		const path = this.currentSlidePath
		return this.pathMappingService.getFileIdByPath(path) || ""
	}

	// ==================== Helper Methods ====================

	/**
	 * Check if a slide is loaded
	 */
	private isSlideLoaded(slide: SlideItem | undefined): boolean {
		return slide?.loadingState === "loaded"
	}

	/**
	 * Check if a slide is ready to view (loaded or loading)
	 */
	private isSlideReady(slide: SlideItem | undefined): boolean {
		return slide?.loadingState !== "idle"
	}

	/** Check if can go to previous slide */
	get canGoPrev(): boolean {
		if (this.activeIndex <= 0 || this.isTransitioning) return false
		// Allow navigation to previous slide if it's loaded or loading
		const prevSlide = this.slides[this.activeIndex - 1]
		return this.isSlideReady(prevSlide)
	}

	/** Check if can go to next slide */
	get canGoNext(): boolean {
		if (this.activeIndex >= this.slides.length - 1 || this.isTransitioning) return false
		// Allow navigation to next slide if it's loaded or loading
		const nextSlide = this.slides[this.activeIndex + 1]
		return this.isSlideReady(nextSlide)
	}

	/** Get loading percentage */
	get loadingPercentage(): number {
		if (this.slides.length === 0) return 0
		const loadedCount = this.slides.filter((slide) => this.isSlideLoaded(slide)).length
		return Math.round((loadedCount / this.slides.length) * 100)
	}

	/** Get total slides count */
	get totalSlides(): number {
		return this.slides.length
	}

	// ==================== Actions ====================
	/**
	 * Initialize slides from original paths
	 * Automatically converts paths to URLs by fetching temporary download URLs
	 * @param slidePaths - Array of original file paths
	 *
	 * When autoLoadAndGenerate is enabled (default), this will automatically:
	 * 1. Initialize slides with paths
	 * 2. Fetch temporary URLs for all paths
	 * 3. Load all slide contents
	 * 4. Generate screenshots for all slides
	 */
	async initializeSlides(slidePaths: string[]): Promise<void> {
		this.logger.logOperationStart("initializeSlides", {
			metadata: { slideCount: slidePaths?.length || 0 },
		})

		if (!slidePaths || slidePaths.length === 0) {
			this.logger.warn("未提供幻灯片路径，初始化为空幻灯片")
			this.slides = []
			return
		}

		try {
			// 1. Extract file IDs from paths using attachmentList
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

			this.logger.debug("已从路径提取文件 ID", {
				operation: "initializeSlides",
				metadata: { fileIdCount: fileIds.length, totalPaths: slidePaths.length },
			})

			// 2. Fetch temporary download URLs in batch
			if (fileIds.length > 0) {
				try {
					this.logger.debug("正在获取临时下载 URL", {
						operation: "initializeSlides",
						metadata: { fileIdCount: fileIds.length },
					})

					const response = await getTemporaryDownloadUrl({
						file_ids: fileIds,
					})

					response?.forEach((item: any) => {
						if (item.file_id && item.url) {
							// Find corresponding path
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

			runInAction(() => {
				this.slides = slideItems
				this.isAllSlidesLoaded = false
				this.isTransitioning = false
				this.loadingProgress = 0
				this.activeIndex = 0
			})

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
			throw error
		}
	}

	/**
	 * Get file ID by original path
	 * @param path - Original file path
	 * @returns File ID or undefined
	 */
	getFileIdByPath(path: string): string | undefined {
		return this.pathMappingService.getFileIdByPath(path)
	}

	/**
	 * Load all slides in parallel with optimized resource loading
	 * Uses two-phase loading to avoid duplicate URL requests:
	 * 1. Collect all file IDs from all slides
	 * 2. Fetch all URLs in a single batch
	 * 3. Process all slides with the pre-fetched URLs
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
			this.isAllSlidesLoaded = false
			this.loadingProgress = 0
			// Reset all slides' loading state
			this.slides.forEach((slide) => {
				slide.loadingState = "idle"
				slide.content = undefined
				slide.loadingError = undefined
			})
		})

		try {
			this.logger.debug("开始两阶段加载过程", {
				operation: "loadAllSlides",
			})
			// ===== Phase 1: Load raw content and collect all file IDs =====
			const allFileIds = new Set<string>()
			const slideRawData: Array<{
				url: string
				index: number
				content: string
				relativeFilePath?: string
			}> = []

			// 1.1 Load all raw HTML contents in parallel
			await Promise.all(
				this.slides.map(async (slide, index) => {
					try {
						const url = slide.url || ""
						if (!url) {
							this.logger.warn("幻灯片没有可用的 URL", {
								operation: "loadAllSlides",
								slideIndex: index,
							})

							// Mark slide as error if no URL is available
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

						this.logger.debug("加载原始内容", {
							operation: "loadAllSlides",
							slideIndex: index,
						})

						const rawContent = await this.loaderService.loadSlide(url)

						// Get file metadata using path from slides
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

						// 1.2 Collect file IDs needed for this slide
						const fileIds = this.processorService.collectFileIds(
							rawContent,
							index,
							relativeFilePath,
						)
						fileIds.forEach((id) => allFileIds.add(id))

						this.logger.debug("原始内容加载成功", {
							operation: "loadAllSlides",
							slideIndex: index,
							metadata: { collectedFileIds: fileIds.size },
						})
					} catch (error) {
						this.logger.error("加载原始内容失败", error, {
							operation: "loadAllSlides",
							slideIndex: index,
						})

						// Mark slide as error if loading failed
						runInAction(() => {
							if (this.slides[index]) {
								this.slides[index].loadingState = "error"
								this.slides[index].loadingError = error as Error
							}
						})
					}
				}),
			)

			this.logger.info("阶段 1 完成", {
				operation: "loadAllSlides",
				metadata: {
					loadedSlides: slideRawData.length,
					totalSlides: this.slides.length,
					collectedFileIds: allFileIds.size,
				},
			})

			// ===== Phase 2: Fetch all resource URLs in a single batch =====
			this.logger.debug("阶段 2：获取资源 URL", {
				operation: "loadAllSlides",
				metadata: { fileIdCount: allFileIds.size },
			})

			const urlMapping: Map<string, string> = new Map()
			if (allFileIds.size > 0) {
				try {
					const response = await getTemporaryDownloadUrl({
						file_ids: Array.from(allFileIds),
					})
					// Build fileId -> url mapping
					response?.forEach((item: any) => {
						if (item.file_id && item.url) {
							urlMapping.set(item.file_id, item.url)
						}
					})

					this.logger.info("阶段 2 完成", {
						operation: "loadAllSlides",
						metadata: {
							requestedUrls: allFileIds.size,
							receivedUrls: urlMapping.size,
						},
					})
				} catch (error) {
					this.logger.error("获取临时下载 URL 失败", error, {
						operation: "loadAllSlides",
						metadata: { fileIdCount: allFileIds.size },
					})
				}
			}

			// ===== Phase 3: Process all slides with the shared URL mapping =====
			this.logger.debug("阶段 3：使用 URL 映射处理幻灯片", {
				operation: "loadAllSlides",
			})

			// Process slides asynchronously without blocking - allows progressive loading
			// Priority: current slide first, then adjacent slides, then rest
			const currentIndex = this.activeIndex
			const priorityIndices = [
				currentIndex,
				currentIndex - 1,
				currentIndex + 1,
				...slideRawData.map((_, i) => i).filter((i) => Math.abs(i - currentIndex) > 1),
			].filter((i) => i >= 0 && i < slideRawData.length)

			this.logger.debug("已确定处理优先级", {
				operation: "loadAllSlides",
				metadata: {
					currentIndex,
					priorityIndices: priorityIndices.slice(0, 5),
				},
			})

			// Track all processing promises for completion tracking
			const processingPromises: Promise<void>[] = []

			// Process slides in priority order
			for (const priorityIndex of priorityIndices) {
				const slideData = slideRawData.find((s) => s.index === priorityIndex)
				if (!slideData) continue

				const { index, content, relativeFilePath } = slideData

				const promise = (async () => {
					try {
						this.logger.debug("正在处理幻灯片", {
							operation: "loadAllSlides",
							slideIndex: index,
						})

						// Mark as loading
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
								this.slides[index].content = processedContent
								this.slides[index].loadingState = "loaded"
								this.loadingProgress = this.loadingPercentage
							}
						})

						this.logger.debug("幻灯片处理成功", {
							operation: "loadAllSlides",
							slideIndex: index,
							metadata: { progress: this.loadingPercentage },
						})
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

			// Don't await - let slides load in background
			// Track completion in background without blocking
			Promise.allSettled(processingPromises).then(() => {
				const loaded = this.slides.filter((s) => s.loadingState === "loaded").length
				const errors = this.slides.filter((s) => s.loadingState === "error").length

				runInAction(() => {
					this.isAllSlidesLoaded = true
					this.loadingProgress = 100
				})

				this.logger.logOperationSuccess("loadAllSlides", {
					metadata: {
						totalSlides: this.slides.length,
						loadedSlides: loaded,
						failedSlides: errors,
					},
				})

				// Automatically generate screenshots if enabled
				if (this.config.autoLoadAndGenerate !== false) {
					this.generateAllScreenshots()
				}
			})
		} catch (error) {
			this.logger.logOperationError("loadAllSlides", error, {
				metadata: { slideCount: this.slides.length },
			})

			// Set loaded even on error so user can see what was loaded
			runInAction(() => {
				this.isAllSlidesLoaded = true
			})
		}
	}

	/**
	 * Load single slide content
	 * @param url - Slide URL
	 * @param index - Slide index
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
			// Mark as loading
			runInAction(() => {
				if (this.slides[index]) {
					this.slides[index].loadingState = "loading"
				}
			})

			// Load raw content
			const rawContent = await this.loaderService.loadSlide(url)

			// Get file metadata for processing using path
			const slidePath = this.slides[index]?.path
			const fileId = this.pathMappingService.getFileIdByPath(slidePath)
			const fileItem = this.config.attachmentList?.find(
				(item: any) => item.file_id === fileId,
			)
			const relativeFilePath = fileItem?.relative_file_path?.replace(fileItem?.file_name, "")

			// Process content
			const processedContent = await this.processorService.processSlide(
				rawContent,
				index,
				relativeFilePath,
			)

			// Update store
			runInAction(() => {
				if (this.slides[index]) {
					this.slides[index].content = processedContent
					this.slides[index].loadingState = "loaded"
					this.loadingProgress = this.loadingPercentage
				}
			})

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
	 * Navigate to specific slide index
	 * @param index - Target slide index
	 */
	setActiveIndex(index: number): void {
		if (index < 0 || index >= this.slides.length) {
			this.logger.warn("无效的幻灯片索引", {
				operation: "setActiveIndex",
				metadata: { requestedIndex: index, totalSlides: this.slides.length },
			})
			return
		}
		if (index === this.activeIndex) return

		this.logger.debug("切换到幻灯片", {
			operation: "setActiveIndex",
			slideIndex: index,
			metadata: { previousIndex: this.activeIndex },
		})

		this.activeIndex = index
	}

	/**
	 * Go to next slide
	 */
	nextSlide(): void {
		if (!this.canGoNext) {
			this.logger.debug("无法前往下一张幻灯片", {
				operation: "nextSlide",
				metadata: { currentIndex: this.activeIndex, isTransitioning: this.isTransitioning },
			})
			return
		}

		this.logger.debug("前往下一张幻灯片", {
			operation: "nextSlide",
			slideIndex: this.activeIndex + 1,
		})

		this.isTransitioning = true
		this.activeIndex = this.activeIndex + 1
		this.isTransitioning = false
	}

	/**
	 * Go to previous slide
	 */
	prevSlide(): void {
		if (!this.canGoPrev) {
			this.logger.debug("无法前往上一张幻灯片", {
				operation: "prevSlide",
				metadata: { currentIndex: this.activeIndex, isTransitioning: this.isTransitioning },
			})
			return
		}

		this.logger.debug("前往上一张幻灯片", {
			operation: "prevSlide",
			slideIndex: this.activeIndex - 1,
		})

		this.isTransitioning = true
		this.activeIndex = this.activeIndex - 1
		this.isTransitioning = false
	}

	/**
	 * Go to first slide
	 */
	goToFirstSlide(): void {
		if (this.activeIndex === 0) return
		if (this.isTransitioning) return
		// Allow navigation to first slide if it's ready (loaded or loading)
		const firstSlide = this.slides[0]
		if (!this.isSlideReady(firstSlide)) {
			this.logger.debug("第一张幻灯片尚未准备就绪", {
				operation: "goToFirstSlide",
				metadata: { loadingState: firstSlide?.loadingState },
			})
			return
		}

		this.logger.debug("前往第一张幻灯片", {
			operation: "goToFirstSlide",
			metadata: { previousIndex: this.activeIndex },
		})

		this.isTransitioning = true
		this.activeIndex = 0
		this.isTransitioning = false
	}

	/**
	 * Set transition state
	 * @param isTransitioning - Transition state
	 */
	setIsTransitioning(isTransitioning: boolean): void {
		this.isTransitioning = isTransitioning
	}

	/**
	 * Update slides (for sorting/reordering)
	 * @param newSlides - New slides array (SlideItem[] or string[] for backward compatibility)
	 */
	setSlides(newSlides: SlideItem[] | string[]): void {
		this.logger.debug("更新幻灯片列表", {
			operation: "setSlides",
			metadata: {
				newSlideCount: newSlides.length,
				previousSlideCount: this.slides.length,
			},
		})

		if (newSlides.length === 0) {
			this.slides = []
			return
		}

		// Check if input is already SlideItem[]
		if (typeof newSlides[0] === "object" && "path" in newSlides[0]) {
			this.slides = newSlides as SlideItem[]
		} else {
			// Convert string[] to SlideItem[] for backward compatibility
			const urls = newSlides as string[]
			this.slides = urls.map((url, index) => ({
				id: this.slides[index]?.id || `slide-${index}`,
				path: this.slides[index]?.path || url,
				url,
				index,
				title: this.slides[index]?.title,
			}))
		}

		this.logger.info("幻灯片列表更新成功", {
			operation: "setSlides",
			metadata: { slideCount: this.slides.length },
		})
	}

	/**
	 * @deprecated Use setSlides() instead
	 * Update slide URLs (for backward compatibility)
	 */
	setSlideUrls(newUrls: string[]): void {
		this.setSlides(newUrls)
	}

	/**
	 * Update slide content at specific index
	 * @param index - Slide index
	 * @param content - New content
	 */
	updateSlideContent(index: number, content: string): void {
		if (index < 0 || index >= this.slides.length) {
			this.logger.warn("无效的幻灯片索引", {
				operation: "updateSlideContent",
				metadata: { index, totalSlides: this.slides.length },
			})
			return
		}

		this.logger.debug("更新幻灯片内容", {
			operation: "updateSlideContent",
			slideIndex: index,
			metadata: { contentLength: content.length },
		})

		this.slides[index].content = content
		this.slides[index].loadingState = "loaded"
	}

	/**
	 * Update multiple slide contents
	 * @param updates - Map of index to content
	 */
	updateSlideContents(updates: Map<number, string>): void {
		this.logger.debug("批量更新幻灯片内容", {
			operation: "updateSlideContents",
			metadata: { updateCount: updates.size },
		})

		updates.forEach((content, index) => {
			this.updateSlideContent(index, content)
		})

		this.logger.info("批量更新完成", {
			operation: "updateSlideContents",
			metadata: { updatedSlides: updates.size },
		})
	}

	/**
	 * Update slide item at specific index
	 * @param index - Slide index
	 * @param updates - Partial SlideItem to update
	 */
	updateSlideItem(index: number, updates: Partial<Omit<SlideItem, "index">>): void {
		if (index < 0 || index >= this.slides.length) return

		this.slides[index] = {
			...this.slides[index],
			...updates,
		}
	}

	/**
	 * Update slide title at specific index
	 * @param index - Slide index
	 * @param title - New title
	 */
	updateSlideTitle(index: number, title: string): void {
		this.logger.debug("更新幻灯片标题", {
			operation: "updateSlideTitle",
			slideIndex: index,
			metadata: { title },
		})

		this.updateSlideItem(index, { title })
	}

	/**
	 * Batch update slide titles
	 * @param titles - Array of titles
	 */
	updateSlideTitles(titles: string[]): void {
		this.logger.debug("批量更新幻灯片标题", {
			operation: "updateSlideTitles",
			metadata: { titleCount: titles.length },
		})

		titles.forEach((title, index) => {
			if (index < this.slides.length) {
				this.updateSlideTitle(index, title)
			}
		})

		this.logger.info("批量标题更新完成", {
			operation: "updateSlideTitles",
			metadata: { updatedCount: Math.min(titles.length, this.slides.length) },
		})
	}

	// ==================== View State Actions ====================
	/**
	 * Set scale ratio
	 * @param ratio - New scale ratio
	 */
	setScaleRatio(ratio: number): void {
		this.scaleRatio = ratio
	}

	/**
	 * Set vertical offset
	 * @param offset - New vertical offset
	 */
	setVerticalOffset(offset: number): void {
		this.verticalOffset = offset
	}

	/**
	 * Set horizontal offset
	 * @param offset - New horizontal offset
	 */
	setHorizontalOffset(offset: number): void {
		this.horizontalOffset = offset
	}

	/**
	 * Set fullscreen state
	 * @param isFullscreen - Fullscreen state
	 */
	setFullscreen(isFullscreen: boolean): void {
		this.isFullscreen = isFullscreen
	}

	// ==================== File Version Management ====================
	/**
	 * Set single slide's file version
	 * @param fileId - File ID
	 * @param version - File version
	 */
	setSlideFileVersion(fileId: string, version: number | undefined): void {
		this.logger.debug("设置文件版本", {
			operation: "setSlideFileVersion",
			metadata: { fileId, version },
		})

		this.slidesFileVersions[fileId] = version
	}

	/**
	 * Batch set file versions
	 * @param versions - Record of fileId to version
	 */
	setSlidesFileVersions(versions: Record<string, number | undefined>): void {
		this.logger.debug("批量设置文件版本", {
			operation: "setSlidesFileVersions",
			metadata: { versionCount: Object.keys(versions).length },
		})

		this.slidesFileVersions = { ...this.slidesFileVersions, ...versions }
	}

	// ==================== Configuration Updates ====================
	/**
	 * Update store configuration
	 * @param config - Partial configuration to update
	 */
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

		this.logger.info("配置更新成功", {
			operation: "updateConfig",
		})
	}

	/**
	 * Handle incremental update of slides based on config changes
	 */
	private async handleIncrementalUpdate(
		config: Partial<PPTStoreConfig>,
		previousMetadata: any,
		previousAttachmentList: any[] | undefined,
	): Promise<void> {
		// If no metadata or attachmentList change, skip update
		if (!config.metadata && !config.attachmentList) {
			return
		}

		const previousSlidePaths = this.extractSlidePathsFromMetadata(previousMetadata)
		const newSlidePaths = this.extractSlidePathsFromMetadata(config.metadata)

		// If no previous slides, initialize from scratch
		if (previousSlidePaths.length === 0 && newSlidePaths.length > 0) {
			await this.initializeSlides(newSlidePaths)
			return
		}

		// Detect changes
		const changes = this.incrementalUpdateService.detectSlideChanges(
			previousSlidePaths,
			newSlidePaths,
		)
		const updatedFiles = this.incrementalUpdateService.detectUpdatedFiles(
			previousAttachmentList,
			config.attachmentList,
		)

		// Apply incremental updates via service
		if (changes.hasChanges || updatedFiles.size > 0) {
			const context: IncrementalUpdateContext = {
				slides: this.slides,
				activeIndex: this.activeIndex,
				autoLoadAndGenerate: this.config.autoLoadAndGenerate !== false,
				loadSlideContent: this.loadSlideContent.bind(this),
				generateSlideScreenshot: this.generateSlideScreenshot.bind(this),
				setSlides: (slides) => {
					this.slides = slides
				},
				setActiveIndex: (index) => {
					this.activeIndex = index
				},
			}

			await this.incrementalUpdateService.applyIncrementalUpdates(
				changes,
				updatedFiles,
				newSlidePaths,
				context,
			)
		}
	}

	/**
	 * Extract slide paths from metadata
	 */
	private extractSlidePathsFromMetadata(metadata: any): string[] {
		if (!metadata || !metadata.slides || !Array.isArray(metadata.slides)) {
			return []
		}
		return metadata.slides.map((slide: any) => slide.file || slide.path || "").filter(Boolean)
	}

	/**
	 * Reset store to initial state
	 */
	reset(): void {
		this.logger.info("重置 Store 到初始状态", {
			operation: "reset",
			metadata: {
				previousSlideCount: this.slides.length,
				previousActiveIndex: this.activeIndex,
			},
		})

		this.slides = []
		this.activeIndex = 0
		this.isAllSlidesLoaded = false
		this.isTransitioning = false
		this.loadingProgress = 0
		this.scaleRatio = 1
		this.verticalOffset = 0
		this.horizontalOffset = 0
		this.isFullscreen = false
		this.slidesFileVersions = {}
		this.pathMappingService.clear()

		this.logger.clearTimings()
	}

	// ==================== Screenshot Management ====================
	/**
	 * Generate screenshot for a specific slide
	 * @param index - Slide index
	 */
	async generateSlideScreenshot(index: number): Promise<void> {
		const slide = this.slides[index]
		if (!slide || !slide.content) {
			this.logger.debug("跳过截图生成：幻灯片或内容不存在", {
				operation: "generateSlideScreenshot",
				slideIndex: index,
			})
			return
		}

		this.logger.logOperationStart("generateSlideScreenshot", {
			slideIndex: index,
		})

		try {
			// Mark as loading
			runInAction(() => {
				if (this.slides[index]) {
					this.slides[index].thumbnailLoading = true
					this.slides[index].thumbnailError = undefined
				}
			})

			// Use URL as cache key if available
			const cacheKey = slide.url || `slide-${index}`

			// Check cache first
			const cachedUrl = this.screenshotService.getCachedScreenshot(cacheKey)
			if (cachedUrl && this.screenshotService.hasCachedScreenshot(cacheKey, slide.content)) {
				this.logger.debug("使用缓存的截图", {
					operation: "generateSlideScreenshot",
					slideIndex: index,
				})

				runInAction(() => {
					if (this.slides[index]) {
						this.slides[index].thumbnailUrl = cachedUrl
						this.slides[index].thumbnailLoading = false
					}
				})
				return
			}

			// Generate new screenshot
			this.logger.debug("生成新的截图", {
				operation: "generateSlideScreenshot",
				slideIndex: index,
			})

			const thumbnailUrl = await this.screenshotService.generateScreenshot(
				cacheKey,
				slide.content,
			)

			runInAction(() => {
				if (this.slides[index]) {
					this.slides[index].thumbnailUrl = thumbnailUrl
					this.slides[index].thumbnailLoading = false
				}
			})

			this.logger.logOperationSuccess("generateSlideScreenshot", {
				slideIndex: index,
			})
		} catch (error) {
			this.logger.logOperationError("generateSlideScreenshot", error, {
				slideIndex: index,
			})

			runInAction(() => {
				if (this.slides[index]) {
					this.slides[index].thumbnailLoading = false
					this.slides[index].thumbnailError =
						error instanceof Error ? error : new Error("Unknown error")
				}
			})
		}
	}

	/**
	 * Generate screenshots for all loaded slides
	 */
	async generateAllScreenshots(): Promise<void> {
		const loadedSlides = this.slides.filter(
			(slide) => slide.loadingState === "loaded" && slide.content,
		)

		this.logger.logOperationStart("generateAllScreenshots", {
			metadata: {
				totalSlides: this.slides.length,
				loadedSlides: loadedSlides.length,
			},
		})

		try {
			// Generate screenshots in parallel
			await Promise.all(
				this.slides.map((slide, index) => {
					if (slide.loadingState === "loaded" && slide.content) {
						return this.generateSlideScreenshot(index)
					}
					// 跳过未加载或未处理的幻灯片
					return Promise.resolve()
				}),
			)

			this.logger.logOperationSuccess("generateAllScreenshots", {
				metadata: { generatedCount: loadedSlides.length },
			})
		} catch (error) {
			this.logger.logOperationError("generateAllScreenshots", error, {
				metadata: { loadedSlides: loadedSlides.length },
			})
		}
	}

	/**
	 * Clear screenshot for a specific slide
	 * @param index - Slide index
	 */
	clearSlideScreenshot(index: number): void {
		if (index < 0 || index >= this.slides.length) {
			this.logger.warn("无效的幻灯片索引", {
				operation: "clearSlideScreenshot",
				metadata: { index, totalSlides: this.slides.length },
			})
			return
		}

		this.logger.debug("清除幻灯片截图", {
			operation: "clearSlideScreenshot",
			slideIndex: index,
		})

		const slide = this.slides[index]
		const cacheKey = slide.url || `slide-${index}`

		// Clear cache
		this.screenshotService.clearCache(cacheKey)

		// Clear slide data
		runInAction(() => {
			if (this.slides[index]) {
				this.slides[index].thumbnailUrl = undefined
				this.slides[index].thumbnailLoading = false
				this.slides[index].thumbnailError = undefined
			}
		})
	}

	/**
	 * Clear all screenshot cache
	 */
	clearAllScreenshots(): void {
		this.logger.info("清除所有截图缓存", {
			operation: "clearAllScreenshots",
			metadata: { slideCount: this.slides.length },
		})

		this.slides.forEach((_, index) => {
			this.clearSlideScreenshot(index)
		})
	}

	/**
	 * Get screenshot cache statistics
	 */
	getScreenshotCacheStats() {
		return this.screenshotService.getCacheStats()
	}

	// ==================== Slide Management Actions ====================
	/**
	 * Insert a new slide at the specified position
	 * @param index - Position to insert at
	 * @param direction - Insert before or after the position
	 * @param newSlideData - New slide data including path, url, fileId
	 * @returns The index where the slide was inserted
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
		this.logger.logOperationStart("insertSlide", {
			slideIndex: index,
			metadata: { direction, path: newSlideData.path },
		})

		try {
			// Calculate insertion index
			const insertIndex = direction === "before" ? index : index + 1

			// Update path mappings first
			this.pathMappingService.setPathFileIdMapping(newSlideData.path, newSlideData.fileId)
			this.pathMappingService.setPathUrlMapping(newSlideData.path, newSlideData.url)

			// Create new slide item
			const newSlide: SlideItem = {
				id: `slide-${newSlideData.fileId}`,
				path: newSlideData.path,
				url: newSlideData.url,
				index: insertIndex,
				loadingState: "idle",
			}

			// Build new slides array
			const newSlides = [...this.slides]
			newSlides.splice(insertIndex, 0, newSlide)

			// Update indices for all slides
			newSlides.forEach((slide, idx) => {
				slide.index = idx
			})

			// Update store state
			runInAction(() => {
				this.slides = newSlides
			})

			this.logger.logOperationSuccess("insertSlide", {
				slideIndex: insertIndex,
				metadata: { totalSlides: this.slides.length },
			})

			// Automatically load the new slide content if enabled
			if (this.config.autoLoadAndGenerate !== false) {
				this.loadSlideContent(newSlideData.url, insertIndex)
			}

			return insertIndex
		} catch (error) {
			this.logger.logOperationError("insertSlide", error, {
				slideIndex: index,
				metadata: { direction },
			})
			throw error
		}
	}

	/**
	 * Delete a slide at the specified index
	 * @param index - Index of the slide to delete
	 * @param adjustActiveIndex - Whether to adjust active index after deletion
	 * @returns New active index if adjusted, undefined otherwise
	 */
	deleteSlide(index: number, adjustActiveIndex: boolean = true): number | undefined {
		this.logger.logOperationStart("deleteSlide", {
			slideIndex: index,
			metadata: { totalSlides: this.slides.length },
		})

		// Validate minimum slides count
		if (this.slides.length <= 1) {
			this.logger.warn("无法删除最后一张幻灯片", {
				operation: "deleteSlide",
				slideIndex: index,
			})
			throw new Error("Cannot delete the last slide")
		}

		// Validate index
		if (index < 0 || index >= this.slides.length) {
			this.logger.warn("无效的幻灯片索引", {
				operation: "deleteSlide",
				metadata: { index, totalSlides: this.slides.length },
			})
			throw new Error("Invalid slide index")
		}

		try {
			const deletedSlide = this.slides[index]

			// Build new slides array
			const newSlides = this.slides.filter((_, idx) => idx !== index)

			// Update indices for all slides
			newSlides.forEach((slide, idx) => {
				slide.index = idx
			})

			// Clear screenshot cache for deleted slide
			const cacheKey = deletedSlide.url || `slide-${index}`
			this.screenshotService.clearCache(cacheKey)

			let newActiveIndex: number | undefined

			// Adjust active index if needed
			if (adjustActiveIndex) {
				if (index === this.activeIndex) {
					// If deleting current slide, go to previous or first
					newActiveIndex = Math.max(0, index - 1)
				} else if (index < this.activeIndex) {
					// If deleting a slide before current, adjust index
					newActiveIndex = this.activeIndex - 1
				}
			}

			// Update store state
			runInAction(() => {
				this.slides = newSlides
				if (newActiveIndex !== undefined) {
					this.activeIndex = newActiveIndex
				}
			})

			this.logger.logOperationSuccess("deleteSlide", {
				slideIndex: index,
				metadata: {
					totalSlides: this.slides.length,
					newActiveIndex,
				},
			})

			return newActiveIndex
		} catch (error) {
			this.logger.logOperationError("deleteSlide", error, {
				slideIndex: index,
			})
			throw error
		}
	}

	/**
	 * Sort/reorder slides
	 * @param newSlides - New slides array in the desired order
	 */
	sortSlides(newSlides: SlideItem[]): void {
		this.logger.logOperationStart("sortSlides", {
			metadata: {
				previousCount: this.slides.length,
				newCount: newSlides.length,
			},
		})

		if (newSlides.length !== this.slides.length) {
			this.logger.warn("新幻灯片数量与当前不匹配", {
				operation: "sortSlides",
				metadata: {
					currentCount: this.slides.length,
					newCount: newSlides.length,
				},
			})
			throw new Error("Slide count mismatch during sort")
		}

		try {
			// Update indices for all slides
			const updatedSlides = newSlides.map((slide, idx) => ({
				...slide,
				index: idx,
			}))

			// Update store state
			runInAction(() => {
				this.slides = updatedSlides
			})

			this.logger.logOperationSuccess("sortSlides", {
				metadata: { slideCount: this.slides.length },
			})
		} catch (error) {
			this.logger.logOperationError("sortSlides", error)
			throw error
		}
	}
}

/**
 * Factory function to create a new PPTStore instance
 */
export function createPPTStore(config: PPTStoreConfig): PPTStore {
	return new PPTStore(config)
}
