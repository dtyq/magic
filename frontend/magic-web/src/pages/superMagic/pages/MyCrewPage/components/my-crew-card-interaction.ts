import type { MouseEvent } from "react"

/** Stops anchor-style navigation when clicking interactive controls. */
export function preventMyCrewCardInteractiveClick(event: MouseEvent<HTMLElement>) {
	event.preventDefault()
	event.stopPropagation()
}

export function isInsideMyCrewCardInteractiveTarget(target: EventTarget | null) {
	if (!(target instanceof Element)) return false
	return Boolean(
		target.closest(
			"button,a,[role='button'],[role='menuitem'],input,select,textarea,[data-slot='dropdown-menu-trigger']",
		),
	)
}
