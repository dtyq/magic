import { useEffect, useState } from "react"
import { SuperMagicApi } from "@/opensource/apis"

/**
 * 根据 file_ids 获取文件详情配置
 * @param fileIds 文件ID列表
 * @returns fileDisplayConfig 和 loading 状态
 */
export function useFileDisplayConfig(fileIds?: string[]) {
	const [fileDisplayConfig, setFileDisplayConfig] = useState<
		{ type?: string; [key: string]: any } | undefined
	>()
	const [loading, setLoading] = useState(false)

	useEffect(() => {
		// 只有单文件分享时才查询
		if (!fileIds || fileIds.length !== 1) {
			setFileDisplayConfig(undefined)
			return
		}

		const fetchFileDetails = async () => {
			try {
				setLoading(true)
				const response = await SuperMagicApi.batchGetFileDetails({ file_ids: fileIds })
				const file = response?.files?.[0]
				setFileDisplayConfig(file?.metadata)
			} catch (error) {
				console.error("Failed to fetch file details:", error)
				setFileDisplayConfig(undefined)
			} finally {
				setLoading(false)
			}
		}

		fetchFileDetails()
	}, [fileIds])

	return { fileDisplayConfig, loading }
}
