import { makeAutoObservable, runInAction } from "mobx"
import type { PPTLoggerService, SlideScreenshotService } from "../services"
import type { SlideItem } from "../PPTSidebar/types"

/**
 * PPTScreenshotManager - Manages screenshot operations
 * Responsibilities:
 * - Generate screenshots for slides
 * - Cache screenshot data
 * - Handle screenshot loading states
 */
export class PPTScreenshotManager {
	private logger: PPTLoggerService
	private screenshotService: SlideScreenshotService

	constructor(logger: PPTLoggerService, screenshotService: SlideScreenshotService) {
		this.logger = logger
		this.screenshotService = screenshotService

		makeAutoObservable(this, {}, { autoBind: true })
	}

	/**
	 * Generate screenshot for a specific slide
	 * @param slide - Slide item
	 * @param index - Slide index
	 * @param slides - All slides array (for updating state)
	 */
	async generateSlideScreenshot(
		slide: SlideItem,
		index: number,
		slides: SlideItem[],
		targetContent?: string,
	): Promise<void> {
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
				if (slides[index]) {
					slides[index].thumbnailLoading = true
					slides[index].thumbnailError = undefined
				}
			})

			// Use URL as cache key if available
			const cacheKey = slide.url || `slide-${index}`

			// Use targetContent if provided, otherwise use slide.content for cache check
			const contentForCacheCheck = targetContent || slide.content

			// Check cache first
			const cachedUrl = this.screenshotService.getCachedScreenshot(cacheKey)
			if (
				cachedUrl &&
				this.screenshotService.hasCachedScreenshot(cacheKey, contentForCacheCheck)
			) {
				this.logger.debug("使用缓存的截图", {
					operation: "generateSlideScreenshot",
					slideIndex: index,
				})

				runInAction(() => {
					if (slides[index]) {
						slides[index].thumbnailUrl = cachedUrl
						slides[index].thumbnailLoading = false
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
				targetContent || slide.content,
			)

			runInAction(() => {
				if (slides[index]) {
					slides[index].thumbnailUrl = thumbnailUrl
					slides[index].thumbnailLoading = false
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
				if (slides[index]) {
					slides[index].thumbnailLoading = false
					slides[index].thumbnailError =
						error instanceof Error ? error : new Error("Unknown error")
				}
			})
		}
	}

	/**
	 * Generate screenshots for all loaded slides
	 * @param slides - All slides array
	 */
	async generateAllScreenshots(slides: SlideItem[]): Promise<void> {
		const loadedSlides = slides.filter(
			(slide) => slide.loadingState === "loaded" && slide.content,
		)

		this.logger.logOperationStart("generateAllScreenshots", {
			metadata: {
				totalSlides: slides.length,
				loadedSlides: loadedSlides.length,
			},
		})

		try {
			// Generate screenshots in parallel
			await Promise.all(
				slides.map((slide, index) => {
					if (slide.loadingState === "loaded" && slide.content) {
						return this.generateSlideScreenshot(slide, index, slides)
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
	 * @param slide - Slide item
	 * @param index - Slide index
	 * @param slides - All slides array (for updating state)
	 */
	clearSlideScreenshot(slide: SlideItem, index: number, slides: SlideItem[]): void {
		this.logger.debug("清除幻灯片截图", {
			operation: "clearSlideScreenshot",
			slideIndex: index,
		})

		const cacheKey = slide.url || `slide-${index}`

		// Clear cache
		this.screenshotService.clearCache(cacheKey)

		// Clear slide data
		runInAction(() => {
			if (slides[index]) {
				slides[index].thumbnailUrl = undefined
				slides[index].thumbnailLoading = false
				slides[index].thumbnailError = undefined
			}
		})
	}

	/**
	 * Clear all screenshot cache
	 * @param slides - All slides array
	 */
	clearAllScreenshots(slides: SlideItem[]): void {
		this.logger.info("清除所有截图缓存", {
			operation: "clearAllScreenshots",
			metadata: { slideCount: slides.length },
		})

		slides.forEach((slide, index) => {
			this.clearSlideScreenshot(slide, index, slides)
		})
	}

	/**
	 * Get screenshot cache statistics
	 */
	getCacheStats() {
		return this.screenshotService.getCacheStats()
	}
}
