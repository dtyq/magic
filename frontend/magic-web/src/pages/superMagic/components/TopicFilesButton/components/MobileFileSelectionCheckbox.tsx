import { Check, Minus } from "lucide-react"
import { memo } from "react"
import type { AttachmentNodeSelectionState } from "../utils/mobileAttachmentTreeSelection"

interface MobileFileSelectionCheckboxProps {
	state: AttachmentNodeSelectionState
	ariaLabel: string
	onClick: () => void
	"data-testid"?: string
}

/** Render the circular indicator for none / partial / all selection states. */
function SelectionIndicator({ state }: { state: AttachmentNodeSelectionState }) {
	if (state === "all") {
		return (
			<span className="flex size-[22px] items-center justify-center rounded-full bg-primary text-primary-foreground">
				<Check className="size-3.5" strokeWidth={2.5} />
			</span>
		)
	}

	if (state === "partial") {
		return (
			<span className="flex size-[22px] items-center justify-center rounded-full bg-primary text-primary-foreground">
				<Minus className="size-3.5" strokeWidth={2.5} />
			</span>
		)
	}

	return <span className="size-[22px] rounded-full border-2 border-muted-foreground/35" />
}

/**
 * Prototype-aligned circular checkbox used in mobile topic file multi-select rows and toolbar.
 */
function MobileFileSelectionCheckbox({
	state,
	ariaLabel,
	onClick,
	"data-testid": dataTestId,
}: MobileFileSelectionCheckboxProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="flex size-9 shrink-0 items-center justify-center rounded-full active:bg-foreground/[0.06]"
			aria-label={ariaLabel}
			data-testid={dataTestId}
		>
			<SelectionIndicator state={state} />
		</button>
	)
}

export default memo(MobileFileSelectionCheckbox)
