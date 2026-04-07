import { useEffect, useRef } from "react"
import type { RefObject } from "react"

interface UseAutoLoadMoreSentinelOptions {
	rootRef?: RefObject<HTMLDivElement | null>
	disabled: boolean
	onLoadMore: () => void
	rootMargin?: string
}

export function useAutoLoadMoreSentinel({
	rootRef,
	disabled,
	onLoadMore,
	rootMargin = "160px 0px",
}: UseAutoLoadMoreSentinelOptions) {
	const sentinelRef = useRef<HTMLDivElement | null>(null)

	useEffect(() => {
		const sentinel = sentinelRef.current
		if (!sentinel || disabled) return

		const observer = new IntersectionObserver(
			([entry]) => {
				if (!entry?.isIntersecting) return
				onLoadMore()
			},
			{
				root: rootRef?.current ?? null,
				rootMargin,
			},
		)

		observer.observe(sentinel)

		return () => observer.disconnect()
	}, [disabled, onLoadMore, rootMargin, rootRef])

	return sentinelRef
}
