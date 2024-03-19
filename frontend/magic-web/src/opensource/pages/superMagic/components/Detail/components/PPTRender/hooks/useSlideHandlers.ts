import { useMemoizedFn } from "ahooks"
import type { PPTStore } from "../stores/PPTStore"

interface UseSlideHandlers {
	store: PPTStore
	setIsAnySlideEditing: (isEditing: boolean) => void
	setIsSidebarCollapsed: (collapsed: boolean) => void
}

interface UseSlideHandlersReturn {
	handleEditModeChange: (fileId: string, isEditing: boolean) => void
	handleRefreshSlide: (index: number) => Promise<void>
	handleRegenerateScreenshot: (index: number) => Promise<void>
	handleSidebarCollapsedChange: (collapsed: boolean) => void
}

/**
 * 提供幻灯片级别操作的处理函数：
 * 编辑模式切换、内容刷新、截图重新生成、侧边栏折叠状态。
 */
export function useSlideHandlers({
	store,
	setIsAnySlideEditing,
	setIsSidebarCollapsed,
}: UseSlideHandlers): UseSlideHandlersReturn {
	const handleEditModeChange = useMemoizedFn((fileId: string, isEditing: boolean) => {
		// 更新全局编辑标志和 store 中特定幻灯片的编辑状态
		setIsAnySlideEditing(isEditing)
		store.setSlideEditingState(fileId, isEditing)
	})

	const handleRefreshSlide = useMemoizedFn(async (index: number) => {
		const slide = store.slides[index]
		if (!slide) {
			console.error("Slide not found at index:", index)
			return
		}

		const fileId = store.getFileIdByPath(slide.path)
		if (!fileId) {
			console.error("File ID not found for slide:", slide.path)
			return
		}

		try {
			// 通过文件 ID 刷新幻灯片（获取最新 URL 并重新加载内容）
			await store.refreshSlideByFileId(fileId)
		} catch (error) {
			console.error("Failed to refresh slide content:", error)
			throw error
		}
	})

	const handleRegenerateScreenshot = useMemoizedFn(async (index: number) => {
		const slide = store.slides[index]
		if (!slide) {
			console.error("Slide not found at index:", index)
			return
		}

		try {
			// 清除旧缓存后重新生成截图
			store.clearSlideScreenshot(index)
			await store.generateSlideScreenshot(index)
		} catch (error) {
			console.error("Failed to regenerate screenshot:", error)
			throw error
		}
	})

	const handleSidebarCollapsedChange = useMemoizedFn((collapsed: boolean) => {
		setIsSidebarCollapsed(collapsed)
	})

	return {
		handleEditModeChange,
		handleRefreshSlide,
		handleRegenerateScreenshot,
		handleSidebarCollapsedChange,
	}
}
