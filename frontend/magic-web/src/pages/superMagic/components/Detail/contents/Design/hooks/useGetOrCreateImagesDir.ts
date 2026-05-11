import { useCallback, useRef } from "react"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import {
	getOrCreateImagesDirFileId,
	type GetOrCreateImagesDirFileIdResult,
} from "../utils/calculateUploadDirectory"

export type GetOrCreateImagesDirFn = () => Promise<GetOrCreateImagesDirFileIdResult | null>

interface UseGetOrCreateImagesDirParams {
	currentFile?: { id: string; name: string }
	flatAttachments?: FileItem[]
	projectId?: string
	updateAttachments: () => void
}

/**
 * 获取或创建 images 目录的 Hook
 * 在顶层（如 useDesignMethods）调用一次，将返回的函数向下传递
 * 首次调用创建并存储 promise，同参数下的后续调用复用同一 promise
 */
export function useGetOrCreateImagesDir(
	params: UseGetOrCreateImagesDirParams,
): GetOrCreateImagesDirFn {
	const { currentFile, flatAttachments, projectId, updateAttachments } = params
	const currentRelativePath =
		flatAttachments?.find((item) => item.file_id === currentFile?.id)?.relative_file_path ?? ""
	const cacheKey = `${projectId ?? ""}-${currentFile?.id ?? ""}-${currentRelativePath}`
	const cacheRef = useRef<{
		key: string
		promise: Promise<GetOrCreateImagesDirFileIdResult | null>
		result?: GetOrCreateImagesDirFileIdResult | null
	} | null>(null)

	const getOrCreateImagesDir =
		useCallback(async (): Promise<GetOrCreateImagesDirFileIdResult | null> => {
			if (!projectId) return null

			const cached = cacheRef.current
			if (cached && cached.key === cacheKey) {
				if (cached.result !== undefined) {
					return cached.result
				}
				return cached.promise
			}

			const promise = getOrCreateImagesDirFileId({
				currentFile,
				flatAttachments,
				projectId,
				updateAttachments,
			})

			cacheRef.current = { key: cacheKey, promise }

			promise
				.then((result) => {
					if (cacheRef.current && cacheRef.current.key === cacheKey) {
						cacheRef.current.result = result
					}
				})
				.catch(() => {
					if (cacheRef.current?.key === cacheKey) {
						cacheRef.current = null
					}
				})

			return promise
		}, [cacheKey, currentFile, flatAttachments, projectId, updateAttachments])

	return getOrCreateImagesDir
}
