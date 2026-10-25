import { useMemoizedFn } from "ahooks"
import { useEffect, useRef, useState } from "react"
import { useFileAccess } from "@/pages/superMagic/fileAccess/FileAccessProvider"
import { useFileApi } from "@/pages/superMagic/fileAccess/fileApi"
import { shouldWaitForShareAccess } from "@/pages/superMagic/fileAccess/fileAccessContext"
import type { ProjectImageUrlResolver } from "@/components/tiptap-node/project-image-node/project-image-node-extension"
import {
	type AttachmentFile,
	type ImageUrlMap,
	parseImageSize,
	normalizeImagePath,
	resolveSingleImageUrl,
} from "@/pages/superMagic/utils/image-url-resolver"

interface UseImageUrlResolverProps {
	attachments?: AttachmentFile[]
	relativeFilePath?: string
	initialImageUrlMap?: ImageUrlMap
	isReady?: boolean
	resolveUrl?: (path: string) => Promise<string>
}

interface UseImageUrlResolverReturn {
	imageUrlMap: ImageUrlMap
	setImageUrlMap: React.Dispatch<React.SetStateAction<ImageUrlMap>>
	urlResolver: ProjectImageUrlResolver
}

/**
 * Hook for resolving image URLs in markdown content
 * Handles caching and URL resolution for relative image paths
 */
export function useImageUrlResolver({
	attachments = [],
	relativeFilePath,
	initialImageUrlMap = new Map(),
	isReady = true,
	resolveUrl,
}: UseImageUrlResolverProps): UseImageUrlResolverReturn {
	const [imageUrlMap, setImageUrlMap] = useState<ImageUrlMap>(initialImageUrlMap)
	const fileAccess = useFileAccess()
	const fileApi = useFileApi()
	const listenersRef = useRef(new Set<() => void>())
	const isReadyRef = useRef(isReady)
	isReadyRef.current = isReady

	/** Registers image nodes that need to retry when attachment context changes. */
	const subscribe = useMemoizedFn((listener: () => void) => {
		listenersRef.current.add(listener)
		return () => {
			listenersRef.current.delete(listener)
		}
	})

	const urlResolver = useMemoizedFn(async (relativePath: string) => {
		try {
			if (shouldWaitForShareAccess(fileAccess)) return relativePath
			// Use the shared utility function for resolving single image URLs
			const resolvedUrl = resolveUrl
				? await resolveUrl(normalizeImagePath(relativePath))
				: await resolveSingleImageUrl(
						relativePath,
						attachments,
						relativeFilePath,
						imageUrlMap,
						fileApi,
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
	}) as ProjectImageUrlResolver
	urlResolver.isReady = () => isReadyRef.current
	urlResolver.subscribe = subscribe

	/** Notifies mounted image nodes after attachment readiness or path context changes. */
	useEffect(() => {
		listenersRef.current.forEach((listener) => listener())
	}, [attachments, isReady, relativeFilePath])

	return {
		imageUrlMap,
		setImageUrlMap,
		urlResolver,
	}
}
