import { useEffect, useState, useRef } from "react"
import { reaction } from "mobx"
import { getFileInfoByPath } from "@/opensource/pages/superMagic/components/Detail/contents/Design/utils/designFileInfoCache"
import projectFilesStore from "@/opensource/stores/projectFiles"

function normalizePath(path: string) {
	if (!path) return ""
	return path.replace(/^\/+|\/+$/g, "")
}

export function useMarkerImageUrl(imagePath: string | undefined): {
	imageUrl: string | null
	loading: boolean
} {
	const [imageUrl, setImageUrl] = useState<string | null>(null)
	const [loading, setLoading] = useState(false)
	const cancelledRef = useRef(false)

	useEffect(() => {
		cancelledRef.current = false

		if (!imagePath) {
			setImageUrl(null)
			setLoading(false)
			return
		}

		const normalizedPath = normalizePath(imagePath)
		if (!normalizedPath) {
			setImageUrl(null)
			setLoading(false)
			return
		}

		if (
			!projectFilesStore.workspaceFilesList ||
			projectFilesStore.workspaceFilesList.length === 0
		) {
			setImageUrl(null)
			setLoading(true)
			return
		}

		setLoading(true)
		getFileInfoByPath(imagePath)
			.then((fileInfo) => {
				if (!cancelledRef.current) {
					setImageUrl(fileInfo?.src ?? null)
				}
			})
			.catch((error) => {
				console.error("[useMarkerImageUrl] Failed to load image URL:", error)
				if (!cancelledRef.current) {
					setImageUrl(null)
				}
			})
			.finally(() => {
				if (!cancelledRef.current) {
					setLoading(false)
				}
			})

		return () => {
			cancelledRef.current = true
		}
	}, [imagePath])

	useEffect(() => {
		if (!imagePath) return

		const disposer = reaction(
			() => projectFilesStore.workspaceFilesList,
			(attachmentList) => {
				if (
					attachmentList &&
					attachmentList.length > 0 &&
					imagePath &&
					!cancelledRef.current
				) {
					setLoading(true)
					getFileInfoByPath(imagePath)
						.then((fileInfo) => {
							if (!cancelledRef.current) {
								setImageUrl(fileInfo?.src ?? null)
							}
						})
						.catch((error) => {
							console.error("[useMarkerImageUrl] Failed to reload image URL:", error)
							if (!cancelledRef.current) {
								setImageUrl(null)
							}
						})
						.finally(() => {
							if (!cancelledRef.current) {
								setLoading(false)
							}
						})
				}
			},
			{ fireImmediately: false },
		)

		return () => {
			disposer()
		}
	}, [imagePath])

	return { imageUrl, loading }
}
