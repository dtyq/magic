import { useState, useEffect, useRef } from "react"
import { getTemporaryDownloadUrl } from "@/pages/superMagic/utils/api"

/**
 * Hook for lazy loading image URLs using Intersection Observer
 * Only fetches the image URL when the element is visible in the viewport
 * @param fileId - The file ID to fetch the URL for
 * @returns Object containing ref, url, and loading state
 */
export function useLazyImage(fileId: string) {
	const [url, setUrl] = useState<string | null>(null)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<Error | null>(null)
	const ref = useRef<HTMLDivElement>(null)

	useEffect(() => {
		// Don't fetch if we already have the URL or are currently loading
		if (url || loading) return

		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting && !url && !loading) {
					setLoading(true)
					setError(null)

					getTemporaryDownloadUrl({ file_ids: [fileId] })
						.then((result) => {
							if (result?.[0]?.url) {
								setUrl(result[0].url)
							} else {
								setError(new Error("Failed to get image URL"))
							}
						})
						.catch((err) => {
							console.error("Failed to load image:", err)
							setError(err instanceof Error ? err : new Error("Unknown error"))
						})
						.finally(() => {
							setLoading(false)
						})
				}
			},
			{
				rootMargin: "50px", // Start loading slightly before element is visible
			},
		)

		if (ref.current) {
			observer.observe(ref.current)
		}

		return () => {
			observer.disconnect()
		}
	}, [fileId, url, loading])

	return { ref, url, loading, error }
}
