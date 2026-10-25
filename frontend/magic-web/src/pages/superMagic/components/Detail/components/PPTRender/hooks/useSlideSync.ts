import { useEffect, useRef } from "react"
import type { PPTStore } from "../stores/PPTStore"

interface UseSlideSync {
	store: PPTStore
	slidePaths: string[]
	deckKey?: string
	initialActiveIndex?: number
}

/**
 * 管理幻灯片激活索引恢复。
 * 幻灯片初始化和增量同步统一由 PPTStore.updateConfig() 处理（单一通道），
 * 避免双通道竞争导致的更新不及时问题。
 */
export function useSlideSync({
	store,
	slidePaths: _slidePaths,
	deckKey,
	initialActiveIndex,
}: UseSlideSync) {
	const hasRestoredActiveIndexRef = useRef(false)
	const previousDeckKeyRef = useRef(deckKey)
	const latestDeckKeyRef = useRef(deckKey)
	const restoreGenerationRef = useRef(0)
	latestDeckKeyRef.current = deckKey

	// 幻灯片初始化完成后恢复缓存的 activeIndex
	useEffect(() => {
		if (previousDeckKeyRef.current !== deckKey) {
			previousDeckKeyRef.current = deckKey
			hasRestoredActiveIndexRef.current = false
			restoreGenerationRef.current += 1
		}
		if (store.isInitializing || store.slides.length === 0) {
			hasRestoredActiveIndexRef.current = false
			restoreGenerationRef.current += 1
			return
		}
		if (hasRestoredActiveIndexRef.current) return

		// Only restore during deck hydration; incremental slide insertion must keep the newly selected page.
		// The generation also invalidates cache reads that finish after a deck switch.
		hasRestoredActiveIndexRef.current = true
		const restoreGeneration = ++restoreGenerationRef.current
		const activeIndexBeforeRestore = store.activeIndex
		store.restoreCachedActiveIndex({
			shouldApply: () =>
				restoreGenerationRef.current === restoreGeneration &&
				latestDeckKeyRef.current === deckKey &&
				previousDeckKeyRef.current === deckKey &&
				store.activeIndex === activeIndexBeforeRestore &&
				!store.isInitializing,
		})
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [deckKey, store.isInitializing, store.slides.length])

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
