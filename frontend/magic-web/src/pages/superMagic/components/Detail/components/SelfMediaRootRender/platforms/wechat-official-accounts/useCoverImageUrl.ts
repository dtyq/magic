import { useEffect, useMemo, useState } from "react"
import { getTemporaryDownloadUrl } from "@/pages/superMagic/utils/api"
import type { ImageProcessOptions } from "@/utils/image-processing"
import { buildImageProcessQuery } from "@/utils/image-processing"

const urlCache = new Map<string, Promise<string>>()

function buildCacheKey(fileId: string, imageProcess?: ImageProcessOptions): string {
	if (!imageProcess) return fileId
	return `${fileId}::${buildImageProcessQuery(imageProcess)}`
}

function fetchUrlOnce(fileId: string, imageProcess?: ImageProcessOptions): Promise<string> {
	const cacheKey = buildCacheKey(fileId, imageProcess)
	const cached = urlCache.get(cacheKey)
	if (cached) return cached
	const pending = getTemporaryDownloadUrl({
		file_ids: [fileId],
		...(imageProcess && { options: { xMagicImageProcess: imageProcess } }),
	})
		.then((items) => {
			const url = items?.[0]?.url
			if (!url) throw new Error("noCoverUrl")
			return url
		})
		.catch((err) => {
			urlCache.delete(cacheKey)
			throw err
		})
	urlCache.set(cacheKey, pending)
	return pending
}

/** Resolve a temporary download URL for a cover-image fileId. */
export function useCoverImageUrl(
	fileId: string | undefined,
	enabled = true,
	imageProcess?: ImageProcessOptions,
) {
	const [url, setUrl] = useState<string | null>(null)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const stableImageProcess = useMemo(
		() => imageProcess,
		[
			// eslint-disable-next-line react-hooks/exhaustive-deps
			imageProcess && buildImageProcessQuery(imageProcess),
		],
	)

	useEffect(() => {
		if (!enabled || !fileId) {
			setUrl(null)
			setError(null)
			setLoading(false)
			return
		}
		let cancelled = false
		setLoading(true)
		setError(null)
		fetchUrlOnce(fileId, stableImageProcess)
			.then((resolved) => {
				if (cancelled) return
				setUrl(resolved)
			})
			.catch((err) => {
				if (cancelled) return
				setError(err instanceof Error ? err.message : "unknownError")
			})
			.finally(() => {
				if (!cancelled) setLoading(false)
			})
		return () => {
			cancelled = true
		}
	}, [fileId, enabled, stableImageProcess])

	return { url, loading, error }
}
