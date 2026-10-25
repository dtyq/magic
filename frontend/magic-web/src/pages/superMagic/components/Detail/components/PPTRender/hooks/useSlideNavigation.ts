import { useMemoizedFn } from "ahooks"
import type { PPTStore } from "../stores/PPTStore"
import {
	getPptPresentationStartIndex,
	getPptVisibleSlideIndices,
} from "@/pages/superMagic/utils/pptHiddenSlides"

interface UseSlideNavigation {
	store: PPTStore
	checkBeforeNavigate: (
		type: "prev" | "next" | "first" | "jump",
		targetIndex?: number,
	) => Promise<boolean>
	/** Read callbacks keep iframe listeners current without coupling hook ordering to fullscreen. */
	isPresenting?: () => boolean
	getHiddenSlidePaths?: () => unknown
	hasPendingNavigationGuard?: () => boolean
	onHiddenSlide?: () => void
	onNoVisibleSlides?: () => void
}

interface UseSlideNavigationReturn {
	changeSlide: (direction: "prev" | "next") => Promise<void>
	goToFirstSlide: () => Promise<boolean>
	handleJumpToPage: (targetIndex: number) => Promise<boolean>
	/** Keep the clean, already-visible path synchronous to preserve browser user activation. */
	preparePresentation: () => number | null | Promise<number | null>
}

/** Navigation uses deck indices throughout; only the presentation queue excludes hidden pages. */
export function useSlideNavigation({
	store,
	checkBeforeNavigate,
	isPresenting = () => store.isFullscreen,
	getHiddenSlidePaths = () => store.getConfigForExport().displayConfig?.hidden_slides,
	hasPendingNavigationGuard = () => true,
	onHiddenSlide,
	onNoVisibleSlides,
}: UseSlideNavigation): UseSlideNavigationReturn {
	const visibleIndices = () => getPptVisibleSlideIndices(store.slides, getHiddenSlidePaths())

	const navigate = useMemoizedFn(
		async (type: "prev" | "next" | "first" | "jump", targetIndex: number) => {
			const targetPath = store.slides[targetIndex]?.path
			if (!targetPath) return null
			if (isPresenting() && !visibleIndices().includes(targetIndex)) {
				onHiddenSlide?.()
				return null
			}
			if (!(await checkBeforeNavigate(type, targetIndex))) return null
			// Confirmation can outlive a remote reorder or visibility change. Resolve identity again.
			const resolvedIndex = store.slides.findIndex((slide) => slide.path === targetPath)
			if (resolvedIndex < 0) return null
			if (isPresenting() && !visibleIndices().includes(resolvedIndex)) {
				onHiddenSlide?.()
				return null
			}
			store.setIsTransitioning(true)
			store.setActiveIndex(resolvedIndex)
			store.setIsTransitioning(false)
			return resolvedIndex
		},
	)

	const changeSlide = useMemoizedFn(async (direction: "prev" | "next") => {
		const indices = isPresenting() ? visibleIndices() : store.slides.map((_, index) => index)
		const target =
			direction === "next"
				? indices.find((index) => index > store.activeIndex)
				: indices.filter((index) => index < store.activeIndex).at(-1)
		if (target !== undefined) await navigate(direction, target)
	})

	const goToFirstSlide = useMemoizedFn(async () => {
		const target = isPresenting() ? visibleIndices()[0] : 0
		return target !== undefined && (await navigate("first", target)) !== null
	})

	const handleJumpToPage = useMemoizedFn(async (targetIndex: number) => {
		return (await navigate("jump", targetIndex)) !== null
	})

	const preparePresentation = useMemoizedFn((): number | null | Promise<number | null> => {
		const target = getPptPresentationStartIndex(visibleIndices(), store.activeIndex)
		if (target === null) {
			onNoVisibleSlides?.()
			return null
		}
		if (target === store.activeIndex && !hasPendingNavigationGuard()) return target
		return navigate("jump", target).then((index) => {
			// Visibility can change while the editor confirmation is open, even before presentation.
			return index !== null && visibleIndices().includes(index) ? index : null
		})
	})

	return { changeSlide, goToFirstSlide, handleJumpToPage, preparePresentation }
}
