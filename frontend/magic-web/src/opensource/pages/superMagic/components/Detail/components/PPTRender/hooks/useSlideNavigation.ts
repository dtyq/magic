import { useMemoizedFn } from "ahooks"
import type { PPTStore } from "../stores/PPTStore"

interface UseSlideNavigation {
	store: PPTStore
	checkBeforeNavigate: (
		type: "prev" | "next" | "first" | "jump",
		targetIndex?: number,
	) => Promise<boolean>
}

interface UseSlideNavigationReturn {
	changeSlide: (direction: "prev" | "next") => Promise<void>
	goToFirstSlide: () => Promise<void>
	handleJumpToPage: (targetIndex: number) => Promise<void>
}

/**
 * 返回稳定的幻灯片导航回调函数（上一张/下一张/跳转）。
 * 键盘和 iframe 事件监听器保留在组件内，因为它们依赖
 * useFullscreen、usePPTSidebar 等后续 hook 的返回值。
 */
export function useSlideNavigation({
	store,
	checkBeforeNavigate,
}: UseSlideNavigation): UseSlideNavigationReturn {
	const changeSlide = useMemoizedFn(async (direction: "prev" | "next") => {
		const canNavigate = await checkBeforeNavigate(direction)
		if (!canNavigate) return

		if (direction === "next") store.nextSlide()
		else store.prevSlide()
	})

	const goToFirstSlide = useMemoizedFn(async () => {
		const canNavigate = await checkBeforeNavigate("first")
		if (!canNavigate) return

		store.goToFirstSlide()
	})

	const handleJumpToPage = useMemoizedFn(async (targetIndex: number) => {
		const canNavigate = await checkBeforeNavigate("jump", targetIndex)
		if (!canNavigate) return

		store.setIsTransitioning(true)
		store.setActiveIndex(targetIndex)
		store.setIsTransitioning(false)
	})

	return { changeSlide, goToFirstSlide, handleJumpToPage }
}
