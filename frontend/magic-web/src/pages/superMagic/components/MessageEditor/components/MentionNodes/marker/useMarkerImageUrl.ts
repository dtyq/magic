import { useEffect, useState, useRef } from "react"
import { reaction } from "mobx"
import { getFileInfoByPath } from "@/pages/superMagic/components/Detail/contents/Design/utils/designFileInfoCache"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import { resolveDesignProjectBasePathFromAttachments } from "@/pages/superMagic/components/Detail/contents/Design/utils/utils"
import projectFilesStore from "@/stores/projectFiles"

function normalizePath(path: string) {
	if (!path) return ""
	return path.replace(/^\/+|\/+$/g, "")
}

function mapWorkspaceFilesToFileItems(): FileItem[] {
	return projectFilesStore.workspaceFilesList
		.filter((item): item is typeof item & { file_id: string } => Boolean(item.file_id))
		.map((item) => ({
			file_id: item.file_id,
			file_name: item.file_name ?? item.name ?? item.filename ?? "",
			display_filename: item.display_filename,
			filename: item.filename,
			file_extension: item.file_extension,
			relative_file_path: item.relative_file_path,
			is_directory: item.is_directory,
			parent_id: item.parent_id ?? undefined,
			source: item.source,
		}))
}

function resolveCurrentDesignProjectBasePath(designProjectId?: string) {
	// 刷新首屏时 workspaceFilesList 可能尚未加载，必须在每次换链前用最新附件列表重新计算 base path。
	return resolveDesignProjectBasePathFromAttachments({
		currentFile: designProjectId ? { id: designProjectId } : undefined,
		flatAttachments: mapWorkspaceFilesToFileItems(),
	})
}

export function useMarkerImageUrl(
	imagePath: string | undefined,
	designProjectId?: string,
): {
	imageUrl: string | null
	loading: boolean
} {
	const [imageUrl, setImageUrl] = useState<string | null>(null)
	const [loading, setLoading] = useState(false)
	const cancelledRef = useRef(false)
	const designProjectBasePath = resolveCurrentDesignProjectBasePath(designProjectId)

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
		getFileInfoByPath(imagePath, undefined, {
			useImageProcess: true,
			designProjectId,
			designProjectBasePath,
		})
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
	}, [designProjectBasePath, designProjectId, imagePath])

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
					const latestDesignProjectBasePath =
						resolveCurrentDesignProjectBasePath(designProjectId)
					// MobX reaction 不会触发当前组件重新 render，不能复用首次 render 闭包里的 designProjectBasePath。
					setLoading(true)
					getFileInfoByPath(imagePath, undefined, {
						useImageProcess: true,
						designProjectId,
						designProjectBasePath: latestDesignProjectBasePath,
					})
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
	}, [designProjectBasePath, designProjectId, imagePath])

	return { imageUrl, loading }
}
