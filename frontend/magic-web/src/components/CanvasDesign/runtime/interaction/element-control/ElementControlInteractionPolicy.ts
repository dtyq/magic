export const ELEMENT_CONTROL_INTERACTION_LIMITS = {
	desktop: {
		minWidth: 180,
		minHeight: 96,
	},
	coarsePointer: {
		minWidth: 240,
		minHeight: 144,
	},
} as const

export function canInteractWithElementControls(options: {
	screenWidth: number
	screenHeight: number
	coarsePointer: boolean
}): boolean {
	const limits = options.coarsePointer
		? ELEMENT_CONTROL_INTERACTION_LIMITS.coarsePointer
		: ELEMENT_CONTROL_INTERACTION_LIMITS.desktop
	return options.screenWidth >= limits.minWidth && options.screenHeight >= limits.minHeight
}

export interface ElementControlInteractionPolicy<Action> {
	canInteract: (action: Action) => boolean
	prepare?: (action: Action) => void
}
