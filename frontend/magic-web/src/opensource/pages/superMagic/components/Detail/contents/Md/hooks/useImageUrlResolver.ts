import { useMemoizedFn } from "ahooks"
import { useState } from "react"
import {
	type AttachmentFile,
	type ImageUrlMap,
	parseImageSize,
	normalizeImagePath,
	resolveSingleImageUrl,
} from "@/opensource/pages/superMagic/utils/image-url-resolver"

interface UseImageUrlResolverProps {
	attachments?: AttachmentFile[]
	relativeFilePath?: string
	initialImageUrlMap?: ImageUrlMap
}

interface UseImageUrlResolverReturn {
	imageUrlMap: ImageUrlMap
	setImageUrlMap: React.Dispatch<React.SetStateAction<ImageUrlMap>>
	urlResolver: (relativePath: string) => Promise<string>
}

/**
 * Hook for resolving image URLs in markdown content
 * Handles caching and URL resolution for relative image paths
 */
export function useImageUrlResolver({
	attachments = [],
	relativeFilePath,
	initialImageUrlMap = new Map(),
}: UseImageUrlResolverProps): UseImageUrlResolverReturn {
	const [imageUrlMap, setImageUrlMap] = useState<ImageUrlMap>(initialImageUrlMap)

	const urlResolver = useMemoizedFn(async (relativePath: string) => {
		try {
			// Use the shared utility function for resolving single image URLs
			const resolvedUrl = await resolveSingleImageUrl(
				relativePath,
				attachments,
				relativeFilePath,
				imageUrlMap,
			)

			// Update cache if URL was resolved successfully
			if (resolvedUrl !== relativePath && !imageUrlMap.has(relativePath)) {
				const normalizedPath = normalizeImagePath(relativePath)
				const { width, height } = parseImageSize(relativePath)

				setImageUrlMap((prev) => {
					const newMap = new Map(prev)
					newMap.set(relativePath, {
						fileId: "", // File ID not available in this context
						url: resolvedUrl,
						width,
						height,
						rawPath: relativePath,
					})
					newMap.set(normalizedPath, {
						fileId: "",
						url: resolvedUrl,
						width,
						height,
						rawPath: relativePath,
					})
					return newMap
				})
			}

			return resolvedUrl
		} catch (error) {
			console.error("Error resolving image URL:", error)
			return relativePath
		}
	})

	return {
		imageUrlMap,
		setImageUrlMap,
		urlResolver,
	}
}
