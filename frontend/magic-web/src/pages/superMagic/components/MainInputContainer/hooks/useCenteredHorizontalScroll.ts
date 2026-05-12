import { useCallback, useLayoutEffect, useRef } from "react"
import type { RefObject } from "react"

interface UseCenteredHorizontalScrollOptions {
	activeKey: string
	itemCount: number
}

interface UseCenteredHorizontalScrollResult {
	scrollContainerRef: RefObject<HTMLDivElement>
	setItemRef: (key: string, element: HTMLDivElement | null) => void
}

export function useCenteredHorizontalScroll({
	activeKey,
	itemCount,
}: UseCenteredHorizontalScrollOptions): UseCenteredHorizontalScrollResult {
	const scrollContainerRef = useRef<HTMLDivElement>(null)
	const itemRefs = useRef<Record<string, HTMLDivElement | null>>({})

	const setItemRef = useCallback((key: string, element: HTMLDivElement | null) => {
		itemRefs.current[key] = element
	}, [])

	const scrollToActiveItem = useCallback(
		(behavior: ScrollBehavior) => {
			const container = scrollContainerRef.current
			const activeItem = itemRefs.current[activeKey]
			if (!container || !activeItem) return

			const containerRect = container.getBoundingClientRect()
			const itemRect = activeItem.getBoundingClientRect()
			const offsetWithinContainer = itemRect.left - containerRect.left
			const targetScrollLeft =
				container.scrollLeft +
				offsetWithinContainer -
				(container.clientWidth - itemRect.width) / 2
			const maxScrollLeft = Math.max(container.scrollWidth - container.clientWidth, 0)
			const nextScrollLeft = Math.min(Math.max(targetScrollLeft, 0), maxScrollLeft)

			container.scrollTo({
				left: nextScrollLeft,
				behavior,
			})
		},
		[activeKey],
	)

	useLayoutEffect(() => {
		scrollToActiveItem("smooth")
	}, [itemCount, scrollToActiveItem])

	useLayoutEffect(() => {
		const activeItem = itemRefs.current[activeKey]
		const container = scrollContainerRef.current
		if (!activeItem || !container) return

		const resizeObserver =
			typeof ResizeObserver !== "undefined"
				? new ResizeObserver(() => scrollToActiveItem("smooth"))
				: null

		resizeObserver?.observe(activeItem)
		resizeObserver?.observe(container)

		return () => {
			resizeObserver?.disconnect()
		}
	}, [activeKey, scrollToActiveItem])

	return {
		scrollContainerRef,
		setItemRef,
	}
}
