import type { CSSProperties } from "react"
import type { ElementRect } from "../types"

/** Invisible hit box centered on the selection edge. */
export const RESIZE_HANDLE_HIT_SIZE = 20

const MIN_TICK = 10
const MAX_TICK = 16
const TICK_RATIO = 0.14

function minSide(rect: Pick<ElementRect, "width" | "height">): number {
	return Math.max(0, Math.min(rect.width, rect.height))
}

/** Mid-edge tick length, shorter on small selections. */
export function getResizeHandleTickLength(rect: Pick<ElementRect, "width" | "height">): number {
	return Math.min(MAX_TICK, Math.max(MIN_TICK, Math.round(minSide(rect) * TICK_RATIO)))
}

/** Overlay positions that keep ticks on the frame, not outside it. */
export function getResizeHandleStyles(): Record<string, CSSProperties> {
	return {
		right: {
			top: "50%",
			right: 0,
			transform: "translate(50%, -50%)",
		},
		bottom: {
			left: "50%",
			bottom: 0,
			transform: "translate(-50%, 50%)",
		},
		"bottom-right": {
			right: 0,
			bottom: 0,
			transform: "translate(50%, 50%)",
		},
	}
}
