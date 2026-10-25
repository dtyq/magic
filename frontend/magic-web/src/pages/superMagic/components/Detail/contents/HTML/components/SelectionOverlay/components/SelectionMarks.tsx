import { SELECTION_CHROME_BORDER_CLASS } from "./selectionChrome"

const MARK_CLASS = `pointer-events-none absolute h-2.5 w-2.5 ${SELECTION_CHROME_BORDER_CLASS}`

const MARKS = [
	{ id: "tr", className: "-right-px -top-px border-r-[2px] border-t-[2px]" },
	{ id: "bl", className: "-bottom-px -left-px border-b-[2px] border-l-[2px]" },
	{ id: "br", className: "-bottom-px -right-px border-b-[2px] border-r-[2px]" },
] as const

/** Corner ticks; skip the move-handle corner. */
export function SelectionMarks() {
	return (
		<>
			{MARKS.map((mark) => (
				<span
					key={mark.id}
					className={`${MARK_CLASS} ${mark.className}`}
					data-testid="html-editor-selection-mark"
					data-mark-id={mark.id}
				/>
			))}
		</>
	)
}
