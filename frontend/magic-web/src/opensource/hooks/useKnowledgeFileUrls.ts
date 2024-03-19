import { useState, useEffect } from "react"
import {
	KnowledgeFileService,
	type KnowledgeFileCacheData,
} from "@/opensource/services/file/KnowledgeFile"

/**
 * 使用知识库文件 URLs 的 Hook
 * @param fileKeys 文件key数组
 * @returns 文件信息和加载状态
 */
function useKnowledgeFileUrls(fileKeys?: string[]) {
	const [data, setData] = useState<Record<string, KnowledgeFileCacheData | null>>({})
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<Error | null>(null)

	useEffect(() => {
		if (!fileKeys || fileKeys.length === 0) {
			setData({})
			setLoading(false)
			setError(null)
			return
		}

		setLoading(true)
		setError(null)

		KnowledgeFileService.fetchFileUrls(fileKeys)
			.then((result) => {
				setData(result)
			})
			.catch((err) => {
				console.error("useKnowledgeFileUrls: 获取文件URLs失败", err)
				setError(err)
			})
			.finally(() => {
				setLoading(false)
			})
	}, [fileKeys?.join(",")])

	return {
		data,
		loading,
		error,
	}
}

/**
 * 使用单个知识库文件 URL 的 Hook
 * @param fileKey 文件key
 * @returns 文件信息和加载状态
 */
function useKnowledgeFileUrl(fileKey?: string) {
	const [data, setData] = useState<KnowledgeFileCacheData | null>(null)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<Error | null>(null)

	useEffect(() => {
		if (!fileKey) {
			setData(null)
			setLoading(false)
			setError(null)
			return
		}

		// 先检查缓存
		const cached = KnowledgeFileService.getFileInfoCache(fileKey)
		if (cached && !KnowledgeFileService.checkFileExpired(fileKey)) {
			setData(cached)
			setLoading(false)
			setError(null)
			return
		}

		setLoading(true)
		setError(null)

		KnowledgeFileService.fetchFileUrl(fileKey)
			.then((result) => {
				setData(result)
			})
			.catch((err) => {
				console.error("useKnowledgeFileUrl: 获取文件URL失败", err)
				setError(err)
			})
			.finally(() => {
				setLoading(false)
			})
	}, [fileKey])

	return {
		data,
		loading,
		error,
	}
}

export { useKnowledgeFileUrls, useKnowledgeFileUrl }
