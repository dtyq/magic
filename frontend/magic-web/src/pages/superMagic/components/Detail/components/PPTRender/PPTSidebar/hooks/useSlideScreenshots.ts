/**
 * @deprecated This hook is deprecated. Screenshot generation is now managed by PPTStore.
 *
 * Screenshots are now part of the SlideItem interface and managed centrally in the store:
 * - SlideItem.thumbnailUrl - The screenshot blob URL
 * - SlideItem.thumbnailLoading - Loading state
 * - SlideItem.thumbnailError - Error state
 *
 * Use PPTStore methods instead:
 * - store.generateSlideScreenshot(index) - Generate screenshot for a specific slide
 * - store.generateAllScreenshots() - Generate screenshots for all slides
 * - store.clearSlideScreenshot(index) - Clear screenshot for a specific slide
 *
 * @example
 * // Old way (deprecated)
 * const { getScreenshot } = useSlideScreenshots({ slideContents, slideUrls })
 * const screenshot = getScreenshot(index)
 *
 * // New way (recommended)
 * const slide = store.slides[index]
 * const screenshot = {
 *   thumbnailUrl: slide.thumbnailUrl,
 *   isLoading: slide.thumbnailLoading,
 *   error: slide.thumbnailError
 * }
 */

import { useState, useEffect, useRef } from "react"
import { getScreenshotService } from "../../services"

interface UseSlideScreenshotsOptions {
	slideContents: Map<number, string>
	slideUrls?: string[] // URLs for cache keys
	enabled?: boolean
}

interface SlideScreenshot {
	index: number
	thumbnailUrl: string
	isLoading: boolean
	error?: Error
}

/**
 * @deprecated Use PPTStore screenshot methods instead
 * Hook to generate screenshots for PPT slides using SlideScreenshotService
 * Leverages service layer caching for performance optimization
 */
export function useSlideScreenshots({
	slideContents,
	slideUrls = [],
	enabled = true,
}: UseSlideScreenshotsOptions) {
	const [screenshots, setScreenshots] = useState<Map<number, SlideScreenshot>>(new Map())
	const [isGenerating, setIsGenerating] = useState(false)
	const serviceRef = useRef(getScreenshotService())

	useEffect(() => {
		if (!enabled || slideContents.size === 0) return

		const generateScreenshots = async () => {
			setIsGenerating(true)

			// Initialize loading state for all slides
			const initialScreenshots = new Map<number, SlideScreenshot>()
			slideContents.forEach((_, index) => {
				initialScreenshots.set(index, {
					index,
					thumbnailUrl: "",
					isLoading: true,
				})
			})
			setScreenshots(initialScreenshots)

			const service = serviceRef.current

			// Generate screenshots for each slide
			const entries = Array.from(slideContents.entries())
			for (const [index, content] of entries) {
				if (!content) continue

				// Use URL as cache key if available, otherwise use index
				const cacheKey = slideUrls[index] || `slide-${index}`

				try {
					// Check cache first
					const cachedUrl = service.getCachedScreenshot(cacheKey)
					if (cachedUrl && service.hasCachedScreenshot(cacheKey, content)) {
						// Use cached screenshot
						setScreenshots((prev) => {
							const next = new Map(prev)
							next.set(index, {
								index,
								thumbnailUrl: cachedUrl,
								isLoading: false,
							})
							return next
						})
						continue
					}

					// Generate new screenshot with caching
					const thumbnailUrl = await service.generateScreenshot(cacheKey, content)

					// Update screenshot state
					setScreenshots((prev) => {
						const next = new Map(prev)
						next.set(index, {
							index,
							thumbnailUrl,
							isLoading: false,
						})
						return next
					})
				} catch (error) {
					console.error(`Failed to generate screenshot for slide ${index}:`, error)

					// Update error state
					setScreenshots((prev) => {
						const next = new Map(prev)
						next.set(index, {
							index,
							thumbnailUrl: "",
							isLoading: false,
							error: error instanceof Error ? error : new Error("Unknown error"),
						})
						return next
					})
				}
			}

			setIsGenerating(false)
		}

		generateScreenshots()

		// Cleanup: Note that we don't revoke URLs here because they're cached in the service
		// The service manages URL lifecycle
	}, [slideContents, slideUrls, enabled])

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			// Optional: Clear old cache entries on unmount
			const service = serviceRef.current
			service.clearOldCache(300000) // Clear entries older than 5 minutes
		}
	}, [])

	return {
		screenshots,
		isGenerating,
		getScreenshot: (index: number) => screenshots.get(index),
		clearCache: (index: number) => {
			const cacheKey = slideUrls[index] || `slide-${index}`
			serviceRef.current.clearCache(cacheKey)
		},
		getCacheStats: () => serviceRef.current.getCacheStats(),
	}
}
