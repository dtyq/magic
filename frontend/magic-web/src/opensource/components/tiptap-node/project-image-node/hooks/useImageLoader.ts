import * as React from "react"
import { IMAGE_LOADING_CONFIG } from "../constants"
import { calculateBackoffDelay, isAbsoluteUrl } from "../utils/url-utils"
import { isTempPath } from "../temp-path-utils"
import { useMemoizedFn, useWhyDidYouUpdate } from "ahooks"

interface UseImageLoaderOptions {
	/** Source path or URL of the image */
	src: string
	/** Whether to start loading */
	shouldLoad: boolean
	/** Function to resolve URL from source path */
	urlResolver: (src: string) => Promise<string | null>
	/** Error handler callback */
	onError?: (error: Error) => void
	/** Retry configuration override */
	retryConfig?: Partial<typeof IMAGE_LOADING_CONFIG>
}

interface UseImageLoaderResult {
	/** Resolved image URL */
	imageUrl: string | null
	/** Loading state */
	loading: boolean
	/** Error state */
	error: Error | null
	/** Reset and retry loading */
	retry: () => void
	/** Handle image load error */
	handleImageError: () => void
}

/**
 * Custom hook for loading images with retry mechanism
 * Handles direct URLs and URL resolution with exponential backoff
 */
export function useImageLoader(options: UseImageLoaderOptions): UseImageLoaderResult {
	const { src, shouldLoad, urlResolver, onError, retryConfig } = options

	const [imageUrl, setImageUrl] = React.useState<string | null>(null)
	const [loading, setLoading] = React.useState(false)
	const [error, setError] = React.useState<Error | null>(null)
	const [retryTrigger, setRetryTrigger] = React.useState(0)

	// Track the last loaded src to prevent reloading the same image
	const loadedSrcRef = React.useRef<string | null>(null)

	// Memoize config to prevent unnecessary re-renders
	// Use IMAGE_LOADING_CONFIG directly if no retryConfig provided
	const config = React.useMemo(
		() => (retryConfig ? { ...IMAGE_LOADING_CONFIG, ...retryConfig } : IMAGE_LOADING_CONFIG),
		[retryConfig],
	)

	useWhyDidYouUpdate("useImageLoader", { src, shouldLoad, retryTrigger, config })

	React.useEffect(() => {
		if (!shouldLoad || !src || isTempPath(src)) return

		// If this src was already loaded successfully, don't reload
		if (loadedSrcRef.current === src) return

		let aborted = false

		const loadImage = async () => {
			try {
				setLoading(true)
				setError(null)

				// If src is already a direct URL, use it immediately
				if (isAbsoluteUrl(src)) {
					if (!aborted) {
						setImageUrl(src)
						loadedSrcRef.current = src
					}
					return
				}

				// Otherwise, resolve URL with retry mechanism
				const startTime = Date.now()

				for (let attempt = 0; attempt < config.MAX_RETRIES; attempt++) {
					if (aborted) return

					// Check total timeout
					if (Date.now() - startTime > config.TOTAL_TIMEOUT) {
						throw new Error("Image loading timeout exceeded")
					}

					try {
						// Calculate delay with exponential backoff
						const delay = calculateBackoffDelay(
							attempt,
							config.INITIAL_DELAY,
							config.MAX_DELAY,
						)

						// Wait before attempting to resolve URL
						if (delay > 0) {
							await new Promise((resolve) => setTimeout(resolve, delay))
						}

						if (aborted) return

						const url = await urlResolver(src)

						// If URL not found or the same as the original src, continue
						if (!url || url === src) {
							if (attempt < config.MAX_RETRIES - 1) {
								continue
							}
							throw new Error("Image URL not found after multiple attempts")
						}

						// Successfully got URL
						if (!aborted) {
							setImageUrl(url)
							loadedSrcRef.current = src
						}
						return
					} catch (err) {
						// If this is the last attempt, throw the error
						if (attempt === config.MAX_RETRIES - 1) {
							throw err
						}
						// Otherwise, continue to next retry
					}
				}
			} catch (err) {
				if (!aborted) {
					const errorObj = err instanceof Error ? err : new Error("Failed to load image")
					setError(errorObj)
					onError?.(errorObj)
				}
			} finally {
				if (!aborted) {
					setLoading(false)
				}
			}
		}

		loadImage()

		// Cleanup function to prevent state updates after unmount
		return () => {
			aborted = true
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [src, shouldLoad, retryTrigger, config])

	const retry = useMemoizedFn(() => {
		setError(null)
		setImageUrl(null)
		loadedSrcRef.current = null
		setRetryTrigger((prev) => prev + 1)
	})

	// Handle image load error
	const handleImageError = useMemoizedFn(() => {
		const errorObj = new Error("Failed to load image")
		setError(errorObj)
	})

	return { imageUrl, loading, error, retry, handleImageError }
}
