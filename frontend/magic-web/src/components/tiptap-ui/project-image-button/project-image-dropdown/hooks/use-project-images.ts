import { useState, useEffect } from "react"
import { filterImageAttachments } from "../utils/image-filters"
import type { ImageAttachment } from "../types"
import projectFilesStore from "@/stores/projectFiles"

/**
 * Hook for fetching and filtering project images
 * @param projectId - The project ID to fetch images from
 * @returns Object containing images, loading state, and error
 */
export function useProjectImages(projectId: string | undefined) {
	const [images, setImages] = useState<ImageAttachment[]>([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<Error | null>(null)

	useEffect(() => {
		if (!projectId) {
			setImages([])
			return
		}

		setLoading(true)
		setError(null)

		Promise.resolve(projectFilesStore.workspaceFilesList)
			.then((result) => {
				const allAttachments = result || []
				const imageAttachments = filterImageAttachments(allAttachments)
				setImages(imageAttachments)
			})
			.catch((err) => {
				console.error("Failed to fetch project images:", err)
				setError(err instanceof Error ? err : new Error("Unknown error"))
				setImages([])
			})
			.finally(() => {
				setLoading(false)
			})
	}, [projectId])

	return { images, loading, error }
}
