import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

import { ScrollEdgeFadeOverlays } from "./ScrollEdgeFadeOverlays"
import type { ScrollEdgeFadeColor } from "./scrollEdgeFadeColors"
import { useScrollEdgeFadeMask } from "./useScrollEdgeFadeMask"

interface ScrollEdgeFadeContainerProps {
	children: ReactNode
	/** Layout on the outer frame (e.g. flex-1). Do not pass overflow-y-auto here. */
	className?: string
	/** Extra classes on the inner scroll port (absolute inset-0 overflow-y-auto). */
	scrollClassName?: string
	fadeColor: ScrollEdgeFadeColor
	contentDeps?: readonly unknown[]
	topOverlayClassName?: string
	bottomOverlayClassName?: string
}

/**
 * Prototype-aligned scroll region: outer relative frame, inner scroll port, fade overlays as siblings of the scroll port (not inside it).
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
}: ScrollEdgeFadeContainerProps) {
	const { scrollRef, showTopMask, showBottomMask } = useScrollEdgeFadeMask({
		contentDeps,
	})

	return (
		<div className={cn("relative isolate min-h-0", className)}>
			<div
				ref={scrollRef as React.RefObject<HTMLDivElement>}
				className={cn("absolute inset-0 z-0 overflow-y-auto", scrollClassName)}
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
