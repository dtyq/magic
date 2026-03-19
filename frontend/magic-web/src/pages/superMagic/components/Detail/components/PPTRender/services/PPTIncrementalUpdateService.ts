import { runInAction } from "mobx"
import type { SlideItem } from "../PPTSidebar/types"
import type { PPTLoggerService } from "./PPTLoggerService"
import type { PPTPathMappingService } from "./PPTPathMappingService"
import type { SlideScreenshotService } from "./SlideScreenshotService"
import { AttachmentItem } from "../../../../TopicFilesButton/hooks/types"

export interface IncrementalUpdateContext {
	slides: SlideItem[]
	activeIndex: number
	autoLoadAndGenerate: boolean
	loadSlideContent: (url: string, index: number) => Promise<string>
	loadSlideContentSilently?: (url: string, index: number) => Promise<string>
	generateSlideScreenshot: (index: number, targetContent?: string) => Promise<void>
	setSlides: (slides: SlideItem[]) => void
	setActiveIndex: (index: number) => void
	isSlideManuallySaved?: (fileId: string) => boolean
	clearManualSaveMark?: (fileId: string) => void
	getSlideEditingState?: (fileId: string) => boolean
	notifyServerUpdate?: (fileId: string, content: string) => void
}

/**
 * PPTIncrementalUpdateService
 * Handles incremental updates to slides (add, remove, reorder, update)
 */
export class PPTIncrementalUpdateService {
	constructor(
		private pathMappingService: PPTPathMappingService,
		private screenshotService: SlideScreenshotService,
		private logger: PPTLoggerService,
	) {}

	/**
	 * Detect slide changes (added, removed, reordered)
	 */
	detectSlideChanges(
		previousPaths: string[],
		newPaths: string[],
	): {
		hasChanges: boolean
		added: Array<{ path: string; index: number }>
		removed: number[]
		reordered: boolean
	} {
		const added: Array<{ path: string; index: number }> = []
		const removed: number[] = []
		let reordered = false

		// Find added slides
		newPaths.forEach((path, index) => {
			if (!previousPaths.includes(path)) {
				added.push({ path, index })
			}
		})

		// Find removed slides
		previousPaths.forEach((path, index) => {
			if (!newPaths.includes(path)) {
				removed.push(index)
			}
		})

		// Check if reordered (same paths but different order)
		if (
			added.length === 0 &&
			removed.length === 0 &&
			previousPaths.length === newPaths.length
		) {
			reordered = previousPaths.some((path, index) => path !== newPaths[index])
		}

		return {
			hasChanges: added.length > 0 || removed.length > 0 || reordered,
			added,
			removed,
			reordered,
		}
	}

	/**
	 * Detect updated files (by comparing updated_at timestamps)
	 */
	detectUpdatedFiles(
		previousList: AttachmentItem[] | undefined,
		newList: AttachmentItem[] | undefined,
	): Set<string> {
		const updatedFileIds = new Set<string>()

		if (!previousList || !newList || !Array.isArray(previousList) || !Array.isArray(newList)) {
			return updatedFileIds
		}

		const previousMap = new Map(previousList.map((item) => [item.file_id, item]))

		newList.forEach((newItem) => {
			const prevItem = previousMap.get(newItem.file_id)
			if (prevItem && prevItem.updated_at !== newItem.updated_at && newItem.file_id) {
				updatedFileIds.add(newItem.file_id)
				this.logger.debug("检测到文件更新", {
					operation: "detectUpdatedFiles",
					metadata: {
						fileId: newItem.file_id,
						previousUpdatedAt: prevItem.updated_at,
						newUpdatedAt: newItem.updated_at,
					},
				})
			}
		})

		return updatedFileIds
	}

	/**
	 * Apply incremental updates to slides
	 */
	async applyIncrementalUpdates(
		changes: {
			hasChanges: boolean
			added: Array<{ path: string; index: number }>
			removed: number[]
			reordered: boolean
		},
		updatedFileIds: Set<string>,
		newSlidePaths: string[],
		context: IncrementalUpdateContext,
	): Promise<void> {
		this.logger.info("应用增量更新", {
			operation: "applyIncrementalUpdates",
			metadata: {
				added: changes.added.length,
				removed: changes.removed.length,
				reordered: changes.reordered,
				updated: updatedFileIds.size,
			},
		})

		// Handle reordering
		if (changes.reordered) {
			await this.handleReorder(newSlidePaths, context)
			return
		}

		// Handle removals first
		if (changes.removed.length > 0) {
			this.handleRemovals(changes.removed, context)
		}

		// Handle additions
		if (changes.added.length > 0) {
			await this.handleAdditions(changes.added, context)
		}

		// Handle file updates
		if (updatedFileIds.size > 0) {
			await this.handleFileUpdates(updatedFileIds, context)
		}
	}

	/**
	 * Handle slide reordering
	 */
	private async handleReorder(
		newSlidePaths: string[],
		context: IncrementalUpdateContext,
	): Promise<void> {
		this.logger.info("处理幻灯片重排序", {
			operation: "handleReorder",
			metadata: { newPathCount: newSlidePaths.length },
		})

		// Create a map of path to slide
		const pathToSlideMap = new Map<string, SlideItem>()
		context.slides.forEach((slide) => {
			pathToSlideMap.set(slide.path, slide)
		})

		// Reorder slides according to new paths
		const reorderedSlides: SlideItem[] = newSlidePaths.map((path, index) => {
			const existingSlide = pathToSlideMap.get(path)
			if (existingSlide) {
				return { ...existingSlide, index }
			}
			// Fallback: create new slide item
			return {
				id: `slide-${index}`,
				path,
				url: "",
				index,
			}
		})

		runInAction(() => {
			context.setSlides(reorderedSlides)
			context.slides = reorderedSlides
		})
	}

	/**
	 * Handle slide removals
	 */
	private handleRemovals(removedIndices: number[], context: IncrementalUpdateContext): void {
		this.logger.info("处理幻灯片删除", {
			operation: "handleRemovals",
			metadata: { removedCount: removedIndices.length },
		})

		runInAction(() => {
			const slides = [...context.slides]

			// Sort indices in descending order to avoid index shifting issues
			const sortedIndices = [...removedIndices].sort((a, b) => b - a)
			sortedIndices.forEach((index) => {
				if (index >= 0 && index < slides.length) {
					// Clear screenshot cache for removed slide
					const slide = slides[index]
					const cacheKey = slide.url || `slide-${index}`
					this.screenshotService.clearCache(cacheKey)

					// Remove slide
					slides.splice(index, 1)
				}
			})

			// Re-index remaining slides
			slides.forEach((slide, index) => {
				slide.index = index
			})

			context.setSlides(slides)
			context.slides = slides

			// Adjust active index if needed
			if (context.activeIndex >= slides.length) {
				context.setActiveIndex(Math.max(0, slides.length - 1))
			}
		})
	}

	/**
	 * Handle new slide additions
	 */
	private async handleAdditions(
		added: Array<{ path: string; index: number }>,
		context: IncrementalUpdateContext,
	): Promise<void> {
		this.logger.info("处理新增幻灯片", {
			operation: "handleAdditions",
			metadata: { addedCount: added.length },
		})

		// Extract file IDs and fetch URLs
		const fileIds: string[] = []
		const pathToIndexMap = new Map<string, number>()

		added.forEach(({ path, index }) => {
			pathToIndexMap.set(path, index)
			const fileId = this.pathMappingService.extractFileIdFromPath(path)
			if (fileId) {
				fileIds.push(fileId)
				this.pathMappingService.setPathFileIdMapping(path, fileId)
			}
		})

		// Fetch temporary URLs for new slides
		const urlMap = await this.pathMappingService.fetchUrlsForFileIds(fileIds)

		// Insert new slides at appropriate positions
		runInAction(() => {
			const slides = [...context.slides]

			added.forEach(({ path, index }) => {
				const fileId = this.pathMappingService.getFileIdByPath(path)
				const url = fileId ? urlMap.get(fileId) || "" : ""

				const newSlide: SlideItem = {
					id: `slide-${Date.now()}-${index}`,
					path,
					url,
					index,
				}
				slides.splice(index, 0, newSlide)
			})

			// Re-index all slides
			slides.forEach((slide, idx) => {
				slide.index = idx
			})

			context.setSlides(slides)
			context.slides = slides
		})

		// Load new slides if autoLoadAndGenerate is enabled
		if (context.autoLoadAndGenerate) {
			const newSlideIndices = added.map(({ index }) => index)
			await this.loadSpecificSlides(newSlideIndices, context)
		}
	}

	/**
	 * Handle file updates (reload affected slides)
	 */
	private async handleFileUpdates(
		updatedFileIds: Set<string>,
		context: IncrementalUpdateContext,
	): Promise<void> {
		this.logger.info("处理文件更新", {
			operation: "handleFileUpdates",
			metadata: { updatedFileCount: updatedFileIds.size },
		})

		// Find slides that need to be reloaded
		const affectedSlideIndices: number[] = []
		const fileIdsToFetch: string[] = []
		const manuallySavedFileIds: Set<string> = new Set()
		const editingSlides: Array<{ fileId: string; index: number }> = []

		context.slides.forEach((slide, index) => {
			const fileId = this.pathMappingService.getFileIdByPath(slide.path)
			if (fileId && updatedFileIds.has(fileId)) {
				// Check if this slide was manually saved - if so, skip reload entirely
				if (context.isSlideManuallySaved?.(fileId)) {
					manuallySavedFileIds.add(fileId)
					this.logger.info("检测到手动保存的幻灯片，跳过重新加载", {
						operation: "handleFileUpdates",
						metadata: { fileId, index },
					})
				} else if (context.getSlideEditingState?.(fileId)) {
					// Slide is being edited - notify instead of reloading
					editingSlides.push({ fileId, index })
					this.logger.info("检测到正在编辑的幻灯片有更新，通知用户而非自动重新加载", {
						operation: "handleFileUpdates",
						metadata: { fileId, index },
					})
				} else {
					// Not editing, normal reload
					affectedSlideIndices.push(index)
					fileIdsToFetch.push(fileId)
				}
			}
		})

		// Fetch new URLs for all updated files (including editing slides)
		const allFileIdsToFetch = [...fileIdsToFetch, ...editingSlides.map((s) => s.fileId)]
		if (allFileIdsToFetch.length === 0) {
			return
		}

		const urlMap = await this.pathMappingService.fetchUrlsForFileIds(allFileIdsToFetch)

		// Handle editing slides - load content silently without affecting UI state
		for (const { fileId, index } of editingSlides) {
			const slide = context.slides[index]
			const newUrl = urlMap.get(fileId)
			if (newUrl && slide) {
				try {
					// Use silent loading method to avoid triggering UI updates
					const loadMethod = context.loadSlideContentSilently || context.loadSlideContent
					const newContent = await loadMethod(newUrl, index)

					// Notify the slide component about server update
					if (context.notifyServerUpdate && newContent) {
						context.notifyServerUpdate(fileId, newContent)
					}

					// 使用新的内容重新生成截图
					context.generateSlideScreenshot(index, newContent)
				} catch (error) {
					this.logger.error("加载正在编辑的幻灯片的新内容失败", error, {
						operation: "handleFileUpdates",
						metadata: { fileId, index },
					})
				}
			}
		}

		// Update slide URLs and reset loading state for non-editing slides
		runInAction(() => {
			affectedSlideIndices.forEach((index) => {
				const slide = context.slides[index]
				const fileId = this.pathMappingService.getFileIdByPath(slide.path)
				const newUrl = fileId ? urlMap.get(fileId) : undefined

				if (newUrl) {
					slide.url = newUrl
					slide.loadingState = "idle"
					slide.rawContent = undefined
					slide.content = undefined

					// Clear cache for slides that need reload
					const cacheKey = slide.url || `slide-${index}`
					this.screenshotService.clearCache(cacheKey)
					slide.thumbnailUrl = undefined
					slide.thumbnailLoading = false
				}
			})
		})

		// Reload affected slides (only non-editing ones)
		if (affectedSlideIndices.length > 0) {
			await this.loadSpecificSlides(affectedSlideIndices, context)
		}

		// Clear manual save marks for skipped slides
		if (context.clearManualSaveMark && manuallySavedFileIds.size > 0) {
			manuallySavedFileIds.forEach((fileId) => {
				context.clearManualSaveMark?.(fileId)
				this.logger.info("清除手动保存标记", {
					operation: "handleFileUpdates",
					metadata: { fileId },
				})
			})
		}
	}

	/**
	 * Load specific slides by indices
	 */
	private async loadSpecificSlides(
		indices: number[],
		context: IncrementalUpdateContext,
	): Promise<void> {
		if (indices.length === 0) return

		this.logger.info("加载指定幻灯片", {
			operation: "loadSpecificSlides",
			metadata: { slideIndices: indices },
		})

		await Promise.all(
			indices.map(async (index) => {
				const slide = context.slides[index]
				if (!slide || !slide.url) return

				try {
					await context.loadSlideContent(slide.url, index)

					// Generate screenshot if needed
					if (context.autoLoadAndGenerate) {
						await context.generateSlideScreenshot(index)
					}
				} catch (error) {
					this.logger.error("加载幻灯片失败", error, {
						operation: "loadSpecificSlides",
						slideIndex: index,
					})
				}
			}),
		)
	}
}
