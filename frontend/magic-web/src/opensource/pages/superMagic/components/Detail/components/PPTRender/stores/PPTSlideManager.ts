import { makeAutoObservable, runInAction } from "mobx"
import type { SlideItem } from "../PPTSidebar/types"
import type { PPTLoggerService } from "../services"
import type { PPTPathMappingService } from "../services/PPTPathMappingService"
import type { SlideScreenshotService } from "../services/SlideScreenshotService"
import { PPTSyncManager } from "../services/PPTSyncManager"

/**
 * PPTSlideManager - Manages slide data and CRUD operations
 * Responsibilities:
 * - Slide data storage and access
 * - Slide insertion, deletion, sorting
 * - Active slide index management
 * - Slide content updates
 */
export class PPTSlideManager {
	/** Complete slide items with path, url, content, and metadata */
	slides: SlideItem[] = []

	/** Current active slide index */
	activeIndex: number = 0

	/** Whether a slide transition is in progress */
	isTransitioning: boolean = false

	/**
	 * Flag to skip next external sync (from parent prop changes)
	 * Used to prevent circular updates when notifying parent via onSortSave
	 */
	private skipNextExternalSync: boolean = false

	private logger: PPTLoggerService
	/** Path mapping service - public for optimistic updates */
	pathMappingService: PPTPathMappingService
	private screenshotService: SlideScreenshotService
	private autoLoadAndGenerate: boolean
	/** Sync manager for unified state synchronization - public for hook access */
	syncManager: PPTSyncManager

	constructor(
		logger: PPTLoggerService,
		pathMappingService: PPTPathMappingService,
		screenshotService: SlideScreenshotService,
		autoLoadAndGenerate: boolean = true,
	) {
		this.logger = logger
		this.pathMappingService = pathMappingService
		this.screenshotService = screenshotService
		this.autoLoadAndGenerate = autoLoadAndGenerate
		this.syncManager = new PPTSyncManager(logger, {
			debounceDelay: 500,
			autoSync: true,
		})

		makeAutoObservable(this, {}, { autoBind: true })
	}

	// ==================== Computed Values ====================
	/** Get slide URLs array */
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

	/** Get total slides count */
	get totalSlides(): number {
		return this.slides.length
	}

	// ==================== Helper Methods ====================
	/**
	 * Check if a slide is loaded
	 */
	private isSlideLoaded(slide: SlideItem | undefined): boolean {
		return slide?.loadingState === "loaded"
	}

	/** Check if can go to previous slide */
	get canGoPrev(): boolean {
		if (this.activeIndex <= 0 || this.isTransitioning) return false
		return true
	}

	/** Check if can go to next slide */
	get canGoNext(): boolean {
		if (this.activeIndex >= this.slides.length - 1 || this.isTransitioning) return false
		return true
	}

	/** Get loading percentage */
	get loadingPercentage(): number {
		if (this.slides.length === 0) return 0
		const loadedCount = this.slides.filter((slide) => this.isSlideLoaded(slide)).length
		return Math.round((loadedCount / this.slides.length) * 100)
	}

	// ==================== Sync Control Methods ====================
	/**
	 * Mark to skip the next external sync from parent prop changes
	 * This prevents circular updates when we notify parent via onSortSave
	 */
	markSkipNextExternalSync(): void {
		this.skipNextExternalSync = true
	}

	/**
	 * Check and consume the skip flag
	 * Returns true if should skip, and automatically resets the flag
	 */
	shouldSkipExternalSync(): boolean {
		if (this.skipNextExternalSync) {
			this.skipNextExternalSync = false
			return true
		}
		return false
	}

	// ==================== Basic Actions ====================
	/**
	 * Initialize slides from slide items (full reset)
	 * @param slideItems - Array of slide items
	 */
	initializeSlides(slideItems: SlideItem[]): void {
		this.logger.debug("初始化幻灯片数据", {
			operation: "PPTSlideManager.initializeSlides",
			metadata: { slideCount: slideItems.length },
		})

		runInAction(() => {
			this.slides = slideItems
			this.activeIndex = 0
			this.isTransitioning = false
		})
	}

	/**
	 * Sync slides with external slide paths (incremental update)
	 * Only updates when there are actual changes, preserves existing state
	 * @param newSlidePaths - New slide paths array
	 * @returns Sync result with change type and affected indices
	 */
	syncSlides(newSlidePaths: string[]): {
		hasChanges: boolean
		changeType?: "insert" | "delete" | "reorder" | "mixed" | "replace"
		affectedIndices?: number[]
	} {
		const currentPaths = this.slidePaths

		// Check if paths are identical
		if (this.arePathsEqual(currentPaths, newSlidePaths)) {
			this.logger.debug("幻灯片路径未变化，跳过同步", {
				operation: "syncSlides",
				metadata: { pathCount: newSlidePaths.length },
			})
			return { hasChanges: false }
		}

		this.logger.debug("检测到幻灯片路径变化，开始增量同步", {
			operation: "syncSlides",
			metadata: {
				oldCount: currentPaths.length,
				newCount: newSlidePaths.length,
			},
		})

		// Detect change type
		const changeType = this.detectChangeType(currentPaths, newSlidePaths)
		let affectedIndices: number[] = []

		switch (changeType) {
			case "insert":
				affectedIndices = this.handleIncrementalInsert(currentPaths, newSlidePaths)
				break
			case "delete":
				affectedIndices = this.handleIncrementalDelete(currentPaths, newSlidePaths)
				break
			case "reorder":
				this.handleReorder(newSlidePaths)
				break
			case "mixed":
				affectedIndices = this.handleMixedOperations(currentPaths, newSlidePaths)
				break
			case "replace":
				this.handleFullReplace(newSlidePaths)
				break
		}

		return {
			hasChanges: true,
			changeType,
			affectedIndices,
		}
	}

	/**
	 * Check if two path arrays are equal
	 */
	private arePathsEqual(paths1: string[], paths2: string[]): boolean {
		if (paths1.length !== paths2.length) return false
		return paths1.every((path, index) => path === paths2[index])
	}

	/**
	 * Detect the type of change between old and new paths
	 */
	private detectChangeType(
		oldPaths: string[],
		newPaths: string[],
	): "insert" | "delete" | "reorder" | "mixed" | "replace" {
		const oldSet = new Set(oldPaths)
		const newSet = new Set(newPaths)

		// Check for inserts (new paths added)
		const hasInserts = newPaths.some((path) => !oldSet.has(path))
		// Check for deletes (old paths removed)
		const hasDeletes = oldPaths.some((path) => !newSet.has(path))

		// Pure insert: only new paths added, no deletions
		if (hasInserts && !hasDeletes) {
			return "insert"
		}
		// Pure delete: only old paths removed, no insertions
		if (hasDeletes && !hasInserts) {
			return "delete"
		}
		// Pure reorder: same set of paths, different order
		if (!hasInserts && !hasDeletes && oldSet.size === newSet.size) {
			return "reorder"
		}
		// Mixed: both inserts and deletes, but some slides are preserved
		// This can be handled incrementally without full reload
		if (hasInserts && hasDeletes) {
			// Check if there are any common slides
			const commonSlides = oldPaths.filter((path) => newSet.has(path))
			if (commonSlides.length > 0) {
				return "mixed"
			}
		}
		// Replace: complete replacement, no common slides
		return "replace"
	}

	/**
	 * Handle incremental insert (preserve existing slides)
	 * @returns Array of inserted slide indices
	 */
	private handleIncrementalInsert(oldPaths: string[], newPaths: string[]): number[] {
		this.logger.debug("处理增量插入", {
			operation: "handleIncrementalInsert",
		})

		// Find all inserted paths and their indices
		const oldPathsSet = new Set(oldPaths)
		const insertedIndices: number[] = []
		const insertedPaths: string[] = []

		newPaths.forEach((path, idx) => {
			if (!oldPathsSet.has(path)) {
				insertedIndices.push(idx)
				insertedPaths.push(path)
			}
		})

		this.logger.info("检测到新插入的幻灯片", {
			operation: "handleIncrementalInsert",
			metadata: {
				insertedPaths,
				insertedIndices,
				count: insertedIndices.length,
			},
		})

		runInAction(() => {
			// Create a map of existing slides by path for quick lookup
			const existingSlidesMap = new Map(this.slides.map((slide) => [slide.path, slide]))

			// Build new slides array following the new paths order
			const newSlides: SlideItem[] = newPaths.map((path, idx) => {
				const existingSlide = existingSlidesMap.get(path)
				if (existingSlide) {
					// Reuse existing slide, update index
					return { ...existingSlide, index: idx }
				} else {
					// Create new slide for inserted path
					return {
						id: `slide-${Date.now()}-${idx}`,
						path,
						url: this.pathMappingService.getUrlByPath(path) || "",
						index: idx,
						loadingState: "idle",
					}
				}
			})

			this.slides = newSlides

			// Adjust active index if necessary
			const insertedBefore = insertedIndices.filter((idx) => idx <= this.activeIndex).length
			if (insertedBefore > 0) {
				this.activeIndex = this.activeIndex + insertedBefore
			}
		})

		return insertedIndices
	}

	/**
	 * Handle incremental delete (preserve existing slides)
	 * @returns Array of deleted slide indices (in old array)
	 */
	private handleIncrementalDelete(oldPaths: string[], newPaths: string[]): number[] {
		this.logger.debug("处理增量删除", {
			operation: "handleIncrementalDelete",
		})

		// Find all deleted paths and their indices
		const newPathsSet = new Set(newPaths)
		const deletedIndices: number[] = []
		const deletedPaths: string[] = []

		oldPaths.forEach((path, idx) => {
			if (!newPathsSet.has(path)) {
				deletedIndices.push(idx)
				deletedPaths.push(path)
			}
		})

		this.logger.info("检测到删除的幻灯片", {
			operation: "handleIncrementalDelete",
			metadata: {
				deletedPaths,
				deletedIndices,
				count: deletedIndices.length,
			},
		})

		runInAction(() => {
			// Remove deleted slides by path (more reliable than by index)
			const deletedPathsSet = new Set(deletedPaths)
			const newSlides = this.slides.filter((slide) => !deletedPathsSet.has(slide.path))

			// Update indices for all remaining slides
			newSlides.forEach((slide, idx) => {
				slide.index = idx
			})

			this.slides = newSlides

			// Adjust active index if necessary
			const currentActiveSlide = oldPaths[this.activeIndex]
			if (deletedPathsSet.has(currentActiveSlide)) {
				// Active slide was deleted, move to nearest slide
				// Count how many slides before the active were deleted
				const deletedBefore = deletedIndices.filter((idx) => idx < this.activeIndex).length
				// New active index: move back by the number of deleted slides before it
				this.activeIndex = Math.max(
					0,
					Math.min(this.activeIndex - deletedBefore, newSlides.length - 1),
				)
			} else {
				// Active slide still exists, calculate its new index
				const deletedBefore = deletedIndices.filter((idx) => idx < this.activeIndex).length
				this.activeIndex = Math.max(0, this.activeIndex - deletedBefore)
			}
		})

		return deletedIndices
	}

	/**
	 * Handle mixed operations (both inserts and deletes)
	 * @returns Array of affected slide indices (newly inserted)
	 */
	private handleMixedOperations(oldPaths: string[], newPaths: string[]): number[] {
		this.logger.info("检测到混合操作（新增+删除），执行智能增量更新", {
			operation: "handleMixedOperations",
			metadata: {
				oldCount: oldPaths.length,
				newCount: newPaths.length,
			},
		})

		// Find inserted and deleted paths
		const oldPathsSet = new Set(oldPaths)
		const newPathsSet = new Set(newPaths)

		const insertedPaths = newPaths.filter((path) => !oldPathsSet.has(path))
		const deletedPaths = oldPaths.filter((path) => !newPathsSet.has(path))
		const commonPaths = oldPaths.filter((path) => newPathsSet.has(path))

		this.logger.debug("混合操作详情", {
			operation: "handleMixedOperations",
			metadata: {
				insertedCount: insertedPaths.length,
				deletedCount: deletedPaths.length,
				commonCount: commonPaths.length,
				insertedPaths,
				deletedPaths,
			},
		})

		const affectedIndices: number[] = []

		runInAction(() => {
			// Store current active slide path for later restoration
			const currentActiveSlide = oldPaths[this.activeIndex]

			// Create a map of existing slides by path for quick lookup
			const existingSlidesMap = new Map(this.slides.map((slide) => [slide.path, slide]))

			// Build new slides array following the new paths order
			const newSlides: SlideItem[] = newPaths.map((path, idx) => {
				const existingSlide = existingSlidesMap.get(path)
				if (existingSlide) {
					// Reuse existing slide, update index
					return { ...existingSlide, index: idx }
				} else {
					// Create new slide for inserted path
					affectedIndices.push(idx)
					return {
						id: `slide-${Date.now()}-${idx}`,
						path,
						url: this.pathMappingService.getUrlByPath(path) || "",
						index: idx,
						loadingState: "idle",
					}
				}
			})

			this.slides = newSlides

			// Adjust active index intelligently
			if (newPathsSet.has(currentActiveSlide)) {
				// Current active slide still exists, find its new position
				const newActiveIndex = newPaths.indexOf(currentActiveSlide)
				this.activeIndex = newActiveIndex
			} else {
				// Current active slide was deleted
				// Try to maintain position or move to nearest available slide
				const newActiveIndex = Math.min(this.activeIndex, newSlides.length - 1)
				this.activeIndex = Math.max(0, newActiveIndex)
			}
		})

		return affectedIndices
	}

	/**
	 * Handle reorder (preserve slide content and state)
	 */
	private handleReorder(newPaths: string[]): void {
		this.logger.debug("处理幻灯片重新排序", {
			operation: "handleReorder",
		})

		runInAction(() => {
			// Create a map of path to slide for quick lookup
			const pathToSlide = new Map<string, SlideItem>()
			this.slides.forEach((slide) => {
				pathToSlide.set(slide.path, slide)
			})

			// Rebuild slides array in new order, preserving existing slide data
			const newSlides = newPaths.map((path, index) => {
				const existingSlide = pathToSlide.get(path)
				if (existingSlide) {
					return {
						...existingSlide,
						index,
					}
				}
				// Fallback for unexpected case
				return {
					id: `slide-${Date.now()}-${index}`,
					path,
					url: this.pathMappingService.getUrlByPath(path),
					index,
					loadingState: "idle" as const,
				}
			})

			// Find new active index based on current slide's path
			const currentSlidePath = this.slides[this.activeIndex]?.path
			const newActiveIndex = newSlides.findIndex((slide) => slide.path === currentSlidePath)

			this.slides = newSlides
			if (newActiveIndex !== -1) {
				this.activeIndex = newActiveIndex
			}
		})
	}

	/**
	 * Handle full replace (complete refresh needed)
	 */
	private handleFullReplace(newPaths: string[]): void {
		this.logger.info("检测到幻灯片完全替换，执行完整初始化", {
			operation: "handleFullReplace",
			metadata: { newCount: newPaths.length },
		})

		const newSlides = newPaths.map((path, index) => ({
			id: `slide-${Date.now()}-${index}`,
			path,
			url: this.pathMappingService.getUrlByPath(path),
			index,
			loadingState: "idle" as const,
		}))

		runInAction(() => {
			this.slides = newSlides
			this.activeIndex = 0
			this.isTransitioning = false
		})
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
	 * @param skipSync - Whether to skip sync recording (for internal use)
	 */
	setSlides(newSlides: SlideItem[] | string[], skipSync: boolean = false): void {
		this.logger.debug("更新幻灯片列表", {
			operation: "setSlides",
			metadata: {
				newSlideCount: newSlides.length,
				previousSlideCount: this.slides.length,
				skipSync,
			},
		})

		if (newSlides.length === 0) {
			this.slides = []
			if (!skipSync) {
				this.syncManager.recordChange(this.slides)
			}
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

		// Record change for sync
		if (!skipSync) {
			this.syncManager.recordChange(this.slides)
		}
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

	// ==================== CRUD Operations ====================
	/**
	 * Insert a new slide at the specified position
	 * @param index - Position to insert at
	 * @param direction - Insert before or after the position
	 * @param newSlideData - New slide data including path, url, fileId
	 * @param onLoad - Optional callback to load the new slide content
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
		onLoad?: (url: string, index: number) => Promise<void>,
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

			// Record change for sync
			this.syncManager.recordChange(this.slides)

			// Automatically load the new slide content if enabled and callback provided
			if (this.autoLoadAndGenerate && onLoad) {
				await onLoad(newSlideData.url, insertIndex)
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

			// Record change for sync
			this.syncManager.recordChange(this.slides)

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
			// Save current active slide identifier and index
			const previousActiveIndex = this.activeIndex
			const currentActiveSlide = this.slides[previousActiveIndex]
			const currentActiveSlideId = currentActiveSlide?.id

			// Update indices for all slides
			const updatedSlides = newSlides.map((slide, idx) => ({
				...slide,
				index: idx,
			}))

			// Find which slide was moved (the one with the largest position change)
			let movedSlideId: string | undefined
			let maxPositionChange = 0

			for (let i = 0; i < this.slides.length; i++) {
				const oldSlide = this.slides[i]
				const newIndex = updatedSlides.findIndex((slide) => slide.id === oldSlide.id)
				if (newIndex !== -1 && newIndex !== i) {
					const positionChange = Math.abs(newIndex - i)
					if (positionChange > maxPositionChange) {
						maxPositionChange = positionChange
						movedSlideId = oldSlide.id
					}
				}
			}

			// CRITICAL FIX: Always track the currently active slide to its new position
			// This ensures the active slide stays active even when other slides move around it
			let newActiveIndex = previousActiveIndex

			if (currentActiveSlideId) {
				const activeSlideNewIndex = updatedSlides.findIndex(
					(slide) => slide.id === currentActiveSlideId,
				)
				if (activeSlideNewIndex !== -1) {
					newActiveIndex = activeSlideNewIndex
				}
			}

			// Update store state
			runInAction(() => {
				this.slides = updatedSlides
				this.activeIndex = newActiveIndex
			})

			this.logger.logOperationSuccess("sortSlides", {
				metadata: {
					slideCount: this.slides.length,
					movedSlideId,
					movedSlideWasActive: movedSlideId === currentActiveSlideId,
					previousActiveIndex:
						previousActiveIndex !== newActiveIndex ? previousActiveIndex : undefined,
					newActiveIndex,
				},
			})

			// Record change for sync
			this.syncManager.recordChange(this.slides)
		} catch (error) {
			this.logger.logOperationError("sortSlides", error)
			throw error
		}
	}

	/**
	 * Rename a slide at the specified index
	 * @param index - Index of the slide to rename
	 * @param newPath - New file path for the slide
	 */
	renameSlide(index: number, newPath: string): void {
		this.logger.logOperationStart("renameSlide", {
			slideIndex: index,
			metadata: { newPath },
		})

		// Validate index
		if (index < 0 || index >= this.slides.length) {
			this.logger.warn("无效的幻灯片索引", {
				operation: "renameSlide",
				metadata: { index, totalSlides: this.slides.length },
			})
			throw new Error("Invalid slide index")
		}

		try {
			const slide = this.slides[index]
			const oldPath = slide.path

			// Update path mappings
			const fileId = this.pathMappingService.getFileIdByPath(oldPath)
			const url = this.pathMappingService.getUrlByPath(oldPath)

			if (fileId) {
				this.pathMappingService.setPathFileIdMapping(newPath, fileId)
			}
			if (url) {
				this.pathMappingService.setPathUrlMapping(newPath, url)
			}

			// Update slide path
			runInAction(() => {
				this.slides[index].path = newPath
			})

			this.logger.logOperationSuccess("renameSlide", {
				slideIndex: index,
				metadata: { oldPath, newPath },
			})

			// Record change for sync
			this.syncManager.recordChange(this.slides)
		} catch (error) {
			this.logger.logOperationError("renameSlide", error, {
				slideIndex: index,
				metadata: { newPath },
			})
			throw error
		}
	}

	/**
	 * Reset to initial state
	 */
	reset(): void {
		this.logger.debug("重置 PPTSlideManager", {
			operation: "PPTSlideManager.reset",
		})

		// Clear sync manager
		this.syncManager.clear()

		runInAction(() => {
			this.slides = []
			this.activeIndex = 0
			this.isTransitioning = false
		})
	}
}
