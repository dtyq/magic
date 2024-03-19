import ChatFileService, { FileCacheData } from "@/opensource/services/chat/file/ChatFileService"
import { computed } from "mobx"
import { useMemo } from "react"

interface FileUrlsData {
	file_id: string
	message_id: string
}

interface UseChatFileUrlsReturn {
	data: Record<string, FileCacheData | undefined>
	isLoading: boolean
}

/**
 * 批量获取文件信息
 * @param data 文件信息数组
 * @returns 文件信息映射和加载状态
 */
const useChatFileUrls = (data?: FileUrlsData[]): UseChatFileUrlsReturn => {
	// 使用 computed 创建响应式计算，确保能够响应 ChatFileService.fileInfoCache 的变化
	const fileUrlsComputed = useMemo(() => {
		return computed(() => {
			if (!data || data.length === 0) {
				return {}
			}

			return data.reduce(
				(prev, item) => {
					// 确保 file_id 存在且有效
					if (item.file_id) {
						prev[item.file_id] = ChatFileService.getFileInfoCache(item.file_id)
					}
					return prev
				},
				{} as Record<string, FileCacheData | undefined>,
			)
		})
	}, [data])

	// 返回 computed 的值，这样组件在 observer 包裹下会自动响应 ChatFileService.fileInfoCache 的变化
	return {
		data: fileUrlsComputed.get(),
		isLoading: false,
	}
}

export default useChatFileUrls
