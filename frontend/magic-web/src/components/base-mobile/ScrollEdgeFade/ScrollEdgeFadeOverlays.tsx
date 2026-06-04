import { cn } from "@/lib/utils"

import { scrollEdgeFadeFromClass, type ScrollEdgeFadeColor } from "./scrollEdgeFadeColors"

interface ScrollEdgeFadeOverlaysProps {
	fadeColor: ScrollEdgeFadeColor
	showTopMask: boolean
	showBottomMask: boolean
	topClassName?: string
	bottomClassName?: string
}

/**
 * Renders absolute top/bottom gradient overlays; must be a sibling of the scroll port under the same relative outer frame.
 */
export function ScrollEdgeFadeOverlays({
	fadeColor,
	showTopMask,
	showBottomMask,
	topClassName,
	bottomClassName,
}: ScrollEdgeFadeOverlaysProps) {
	const fromClass = scrollEdgeFadeFromClass[fadeColor]

	return (
		<>
			<div
				className={cn(
					"pointer-events-none absolute left-0 right-0 top-[-1px] z-10 h-10 bg-gradient-to-b to-transparent transition-opacity duration-200",
					fromClass,
					showTopMask ? "opacity-100" : "opacity-0",
					topClassName,
				)}
				aria-hidden
			/>
			<div
				className={cn(
					"pointer-events-none absolute bottom-[-1px] left-0 right-0 z-10 h-16 bg-gradient-to-t to-transparent transition-opacity duration-200",
					fromClass,
					showBottomMask ? "opacity-100" : "opacity-0",
					bottomClassName,
				)}
				aria-hidden
			/>
		</>
	)
}
