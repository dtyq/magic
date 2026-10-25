import { makeAutoObservable, runInAction } from "mobx"
import type {
	PPTLoggerService,
	SlideScreenshotRequestKind,
	SlideScreenshotService,
} from "../services"
import type { SlideItem } from "../PPTSidebar/types"
import type { PPTThumbnailCacheContext, PPTThumbnailCacheMode } from "../services/PPTThumbnailCache"

type ResolveSlide = () => SlideItem | undefined
type ResolveCurrentSlide = (slide: SlideItem, originalIndex: number) => SlideItem | undefined

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
	private screenshotRequestVersions = new Map<string, number>()
	private lifecycleGeneration = 0
	private disposed = false

	constructor(logger: PPTLoggerService, screenshotService: SlideScreenshotService) {
		this.logger = logger
		this.screenshotService = screenshotService

		makeAutoObservable(
			this,
			{
				logger: false,
				screenshotService: false,
				screenshotRequestVersions: false,
				lifecycleGeneration: false,
				disposed: false,
			} as Record<string, false>,
			{ autoBind: true },
		)
	}

	private getScreenshotRequestKey(slide: SlideItem): string {
		// Incremental sync may recreate a slide object (and its transient id) while preserving
		// the file path. Version requests by that stable path so old work cannot overwrite it.
		return slide.path || slide.url || slide.id
	}

	private beginScreenshotRequest(requestKey: string): number {
		const requestVersion = (this.screenshotRequestVersions.get(requestKey) ?? 0) + 1
		this.screenshotRequestVersions.set(requestKey, requestVersion)
		return requestVersion
	}

	private isLatestScreenshotRequest(
		requestKey: string,
		requestVersion: number,
		lifecycleGeneration: number,
	): boolean {
		return (
			!this.disposed &&
			this.lifecycleGeneration === lifecycleGeneration &&
			this.screenshotRequestVersions.get(requestKey) === requestVersion
		)
	}

	private invalidateScreenshotRequest(requestKey: string): void {
		this.screenshotRequestVersions.set(
			requestKey,
			(this.screenshotRequestVersions.get(requestKey) ?? 0) + 1,
		)
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
		resolveSlide?: ResolveSlide,
		requestKind: SlideScreenshotRequestKind = "required",
		cacheContext?: PPTThumbnailCacheContext,
		cacheMode: PPTThumbnailCacheMode = "use",
	): Promise<void> {
		if (this.disposed) return

		const contentForScreenshot = targetContent || slide?.content
		if (!slide || !contentForScreenshot) {
			this.logger.debug("跳过截图生成：幻灯片或内容不存在", {
				operation: "generateSlideScreenshot",
				slideIndex: index,
			})
			return
		}

		const requestKey = this.getScreenshotRequestKey(slide)
		const requestVersion = this.beginScreenshotRequest(requestKey)
		const lifecycleGeneration = this.lifecycleGeneration
		const isLatestRequest = () =>
			this.isLatestScreenshotRequest(requestKey, requestVersion, lifecycleGeneration)

		// Sorting replaces slide objects, so every async write must resolve the current object.
		const getTargetSlide = () => (resolveSlide ? resolveSlide() : slides[index])

		this.logger.logOperationStart("generateSlideScreenshot", {
			slideIndex: index,
		})

		try {
			// Use URL as cache key if available
			const cacheKey = slide.url || `slide-${index}`

			// Cache validation performs DOM parsing and full-content hashing, so it is
			// intentionally delegated to generateScreenshot after its main-thread yield.
			runInAction(() => {
				if (!isLatestRequest()) return
				const target = getTargetSlide()
				if (target) {
					target.thumbnailLoading = true
					target.thumbnailError = undefined
				}
			})

			// Generate new screenshot
			this.logger.debug("生成新的截图", {
				operation: "generateSlideScreenshot",
				slideIndex: index,
			})

			const thumbnailUrl = await this.screenshotService.generateScreenshot(
				cacheKey,
				contentForScreenshot,
				requestKind,
				cacheContext,
				cacheMode,
			)

			let accepted = false
			runInAction(() => {
				if (!isLatestRequest()) return
				const target = getTargetSlide()
				if (target) {
					target.thumbnailUrl = thumbnailUrl
					target.thumbnailLoading = false
					target.thumbnailError = undefined
					accepted = true
				}
			})

			if (!accepted) {
				this.screenshotService.releaseScreenshot(thumbnailUrl)
				this.logger.debug("丢弃过期的截图结果", {
					operation: "generateSlideScreenshot",
					slideIndex: index,
					metadata: { requestKey, requestVersion },
				})
				return
			}

			this.logger.logOperationSuccess("generateSlideScreenshot", {
				slideIndex: index,
			})
		} catch (error) {
			if (!isLatestRequest()) {
				this.logger.debug("忽略过期截图请求的错误", {
					operation: "generateSlideScreenshot",
					slideIndex: index,
					metadata: { requestKey, requestVersion },
				})
				return
			}
			if (error instanceof Error && error.name === "AbortError") {
				runInAction(() => {
					const target = getTargetSlide()
					if (target) {
						target.thumbnailLoading = false
						target.thumbnailError = undefined
					}
				})
				return
			}

			this.logger.logOperationError("generateSlideScreenshot", error, {
				slideIndex: index,
			})

			runInAction(() => {
				const target = getTargetSlide()
				if (target) {
					target.thumbnailLoading = false
					target.thumbnailError =
						error instanceof Error ? error : new Error("Unknown error")
				}
			})
		}
	}

	/**
	 * Generate screenshots for all loaded slides
	 * @param slides - All slides array
	 */
	async generateAllScreenshots(
		slides: SlideItem[],
		resolveCurrentSlide?: ResolveCurrentSlide,
		resolveCacheContext?: (slide: SlideItem) => PPTThumbnailCacheContext | undefined,
	): Promise<void> {
		if (this.disposed) return
		const lifecycleGeneration = this.lifecycleGeneration
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
						return this.generateSlideScreenshot(
							slide,
							index,
							slides,
							undefined,
							resolveCurrentSlide
								? () => resolveCurrentSlide(slide, index)
								: undefined,
							"required",
							resolveCacheContext?.(slide),
						)
					}
					// 跳过未加载或未处理的幻灯片
					return Promise.resolve()
				}),
			)

			if (this.disposed || lifecycleGeneration !== this.lifecycleGeneration) return

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
		if (this.disposed) return

		this.logger.debug("清除幻灯片截图", {
			operation: "clearSlideScreenshot",
			slideIndex: index,
		})

		const cacheKey = slide.url || `slide-${index}`
		this.invalidateScreenshotRequest(this.getScreenshotRequestKey(slide))

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
		if (this.disposed) return

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

	/**
	 * Invalidate every request from the previous deck while keeping the manager reusable.
	 * The owning PPTStore resets the screenshot service immediately afterwards so queued
	 * and active browser work is cancelled as well.
	 */
	reset(slides: SlideItem[] = []): void {
		if (this.disposed) return
		this.lifecycleGeneration += 1
		this.screenshotRequestVersions.clear()
		this.clearSlideScreenshotState(slides)
	}

	/** Permanently stop accepting screenshot results after the owning Store is destroyed. */
	dispose(slides: SlideItem[] = []): void {
		if (this.disposed) return
		this.lifecycleGeneration += 1
		this.screenshotRequestVersions.clear()
		this.disposed = true
		this.clearSlideScreenshotState(slides)
	}

	private clearSlideScreenshotState(slides: SlideItem[]): void {
		runInAction(() => {
			slides.forEach((slide) => {
				slide.thumbnailUrl = undefined
				slide.thumbnailLoading = false
				slide.thumbnailError = undefined
			})
		})
	}
}
