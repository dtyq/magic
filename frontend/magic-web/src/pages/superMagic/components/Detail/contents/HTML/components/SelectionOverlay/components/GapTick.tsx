import type { GapAxis } from "../utils/gapHandleLayout"
import { SELECTION_CHROME_FILL_CLASS } from "./selectionChrome"

export function GapTick({ axis }: { axis: GapAxis }) {
	if (axis === "column") {
		return (
			<span
				data-gap-tick="column"
				className={`pointer-events-none h-3 w-0.5 rounded-full ${SELECTION_CHROME_FILL_CLASS} transition-[width,height] duration-150 group-hover/gap:h-4 group-hover/gap:w-1 group-data-[dragging=true]/gap:h-4 group-data-[dragging=true]/gap:w-1`}
			/>
		)
	}
	return (
		<span
			data-gap-tick="row"
			className={`pointer-events-none h-0.5 w-3 rounded-full ${SELECTION_CHROME_FILL_CLASS} transition-[width,height] duration-150 group-hover/gap:h-1 group-hover/gap:w-4 group-data-[dragging=true]/gap:h-1 group-data-[dragging=true]/gap:w-4`}
		/>
	)
}
