import { useCallback, type MutableRefObject, type ReactNode, type Ref } from "react"

import { cn } from "@/lib/utils"

import { ScrollEdgeFadeOverlays } from "./ScrollEdgeFadeOverlays"
import type { ScrollEdgeFadeColor } from "./scrollEdgeFadeColors"
import { useScrollEdgeFadeMask } from "./useScrollEdgeFadeMask"

interface ScrollEdgeFadeContainerProps {
	children: ReactNode
	/** Layout on the outer frame (e.g. flex-1). Do not pass overflow-y-auto here. */
	className?: string
	/** Extra classes on the inner scroll port (min-h-0 flex-1 overflow-y-auto). */
	scrollClassName?: string
	fadeColor: ScrollEdgeFadeColor
	contentDeps?: readonly unknown[]
	topOverlayClassName?: string
	bottomOverlayClassName?: string
	onScroll?: (event: React.UIEvent<HTMLDivElement>) => void
	/** Optional ref to the inner scroll port (e.g. imperative scrollTop reset in sheets). */
	scrollPortRef?: Ref<HTMLDivElement | null>
}

/**
 * Scroll region with edge fade: flex-col outer frame, in-flow inner scroll port, fade overlays as absolute siblings (not inside the scroll port).
 * Works for both h-auto sheets (content drives height) and fixed-height / flex-1 viewports (inner scrolls within remaining space).
 * Children such as MagicPullToRefresh must set `embedInParentScroll` so the inner port remains the sole scroll node.
 */
export function ScrollEdgeFadeContainer({
	children,
	className,
	scrollClassName,
	fadeColor,
	contentDeps,
	topOverlayClassName,
	bottomOverlayClassName,
	onScroll,
	scrollPortRef,
}: ScrollEdgeFadeContainerProps) {
	const { scrollRef, showTopMask, showBottomMask } = useScrollEdgeFadeMask({
		contentDeps,
	})

	/** Merge hook scroll ref with optional caller ref for sheet scroll reset / measurement. */
	const setScrollPortRef = useCallback(
		(element: HTMLDivElement | null) => {
			scrollRef.current = element
			if (!scrollPortRef) return
			if (typeof scrollPortRef === "function") {
				scrollPortRef(element)
				return
			}
			// RefObject.current is readonly in types; callers pass useRef() which is mutable at runtime.
			;(scrollPortRef as MutableRefObject<HTMLDivElement | null>).current = element
		},
		[scrollRef, scrollPortRef],
	)

	return (
		<div className={cn("relative isolate flex min-h-0 flex-col", className)}>
			<div
				ref={setScrollPortRef}
				className={cn("min-h-0 flex-1 overflow-y-auto", scrollClassName)}
				onScroll={onScroll}
			>
				{children}
			</div>
			<ScrollEdgeFadeOverlays
				fadeColor={fadeColor}
				showTopMask={showTopMask}
				showBottomMask={showBottomMask}
				topClassName={topOverlayClassName}
				bottomClassName={bottomOverlayClassName}
			/>
		</div>
	)
}
