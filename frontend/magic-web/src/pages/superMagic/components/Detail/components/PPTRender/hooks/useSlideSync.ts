import { useEffect } from "react"
import type { PPTStore } from "../stores/PPTStore"

interface UseSlideSync {
	store: PPTStore
	slidePaths: string[]
	initialActiveIndex?: number
}

/**
 * 管理幻灯片激活索引恢复。
 * 幻灯片初始化和增量同步统一由 PPTStore.updateConfig() 处理（单一通道），
 * 避免双通道竞争导致的更新不及时问题。
 */
export function useSlideSync({ store, slidePaths: _slidePaths, initialActiveIndex }: UseSlideSync) {
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
