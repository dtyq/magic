import type { CSSProperties } from "react"
import "./selectionHandleMotion.css"
import { SELECTION_CHROME_FILL_CLASS } from "./selectionChrome"

const TICK_CLASS = `html-editor-tick pointer-events-none ${SELECTION_CHROME_FILL_CLASS}`

/** Mid-edge drafting ticks. The corner hit uses SelectionMarks. */
export function ResizeTick({ id, length = 12 }: { id: string; length?: number }) {
	if (id === "right") {
		return (
			<span
				className={`${TICK_CLASS} w-0.5`}
				data-resize-tick="right"
				style={{ height: length, "--tick-dx": "1px", "--tick-dy": "0px" } as CSSProperties}
			/>
		)
	}

	if (id === "bottom") {
		return (
			<span
				className={`${TICK_CLASS} h-0.5`}
				data-resize-tick="bottom"
				style={{ width: length, "--tick-dx": "0px", "--tick-dy": "1px" } as CSSProperties}
			/>
		)
	}

	return null
}
