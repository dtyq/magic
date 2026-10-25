import { cn } from "@/utils/cn"

import {
	getScrollEdgeFadeRgb,
	scrollEdgeFadeFromClass,
	type ScrollEdgeFadeColor,
} from "./scrollEdgeFadeColors"

interface ScrollEdgeFadeOverlaysProps {
	/** Use a host CSS surface for both the gradients and the clipping seam. */
	surfaceColor?: string
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
	surfaceColor,
	showTopMask,
	showBottomMask,
	topClassName,
	bottomClassName,
}: ScrollEdgeFadeOverlaysProps) {
	const fromClass = scrollEdgeFadeFromClass[fadeColor]
	const solidColor = surfaceColor ?? getScrollEdgeFadeRgb(fadeColor)

	return (
		<>
			{/* Preserve the original linear fade while isolating the clipped edge treatment. */}
			<div
				className={cn(
					"pointer-events-none absolute left-0 right-0 top-0 z-30 h-10 transition-opacity duration-200",
					showTopMask ? "opacity-100" : "opacity-0",
					topClassName,
				)}
				aria-hidden
			>
				<div
					className={cn("absolute inset-0 bg-gradient-to-b to-transparent", fromClass)}
					style={
						surfaceColor
							? {
									backgroundImage: `linear-gradient(to bottom, ${surfaceColor}, transparent)`,
								}
							: undefined
					}
				/>
				{/* Paint the clipping seam on a separate layer so transformed rows cannot leak a device pixel. */}
				<div
					className="absolute inset-x-0 top-[-1px] h-1 transform-gpu"
					style={{ backgroundColor: solidColor }}
				/>
			</div>
			<div
				className={cn(
					"pointer-events-none absolute bottom-[-1px] left-0 right-0 z-10 h-16 bg-gradient-to-t to-transparent transition-opacity duration-200",
					fromClass,
					showBottomMask ? "opacity-100" : "opacity-0",
					bottomClassName,
				)}
				style={
					surfaceColor
						? {
								backgroundImage: `linear-gradient(to top, ${surfaceColor}, transparent)`,
							}
						: undefined
				}
				aria-hidden
			/>
		</>
	)
}
