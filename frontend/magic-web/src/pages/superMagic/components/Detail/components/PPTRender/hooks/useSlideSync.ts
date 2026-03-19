import { useEffect } from "react"
import { useDeepCompareEffect } from "ahooks"
import type { PPTStore } from "../stores/PPTStore"

interface UseSlideSync {
	store: PPTStore
	slidePaths: string[]
	initialActiveIndex?: number
}

/**
 * 管理幻灯片初始化、增量同步和激活索引恢复。
 * 使用深比较避免 slidePaths 未变化时的重复同步。
 */
export function useSlideSync({ store, slidePaths, initialActiveIndex }: UseSlideSync) {
	useDeepCompareEffect(() => {
		if (!slidePaths || slidePaths.length === 0) return

		// 如果由 onSortSave 触发则跳过同步，防止循环更新
		if (store.shouldSkipExternalSync()) return

		if (store.slides.length === 0) {
			store.initializeSlides(slidePaths)
		} else {
			// 增量同步：自动处理 URL 获取、加载和截图生成
			store.syncSlides(slidePaths).catch((error) => {
				console.error("Failed to sync slides:", error)
			})
		}
	}, [slidePaths, store])

	// 幻灯片初始化完成后恢复缓存的 activeIndex
	useEffect(() => {
		if (store.slides.length > 0) {
			store.restoreCachedActiveIndex()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [store.slides.length])

	// 回退方案：如果缓存恢复未生效，则使用 initialActiveIndex
	useEffect(() => {
		if (
			initialActiveIndex !== undefined &&
			store.activeIndex === 0 &&
			store.slides.length > 0
		) {
			store.setActiveIndex(initialActiveIndex)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [initialActiveIndex, store.slides.length])
}
