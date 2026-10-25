/** Shared desktop conversation bounds used by every resize entry point. */
/**
 * Keep standard composer controls inside the smallest supported panel.
 * Add a mode-specific constant below when a new composer contains extra or specialized UI;
 * do not raise this shared value unless every consumer has the same layout contract.
 */
/** Minimum height for the ordinary composer. */
export const DEFAULT_COMPOSER_MIN_INPUT_HEIGHT = 220
/**
 * Editor card height of the ordinary default-size composer: the 220px floor minus its 8px padding
 * and 1px border on both sides, the 30px mode switcher row and the 8px gap below it. Composers that
 * hide the switcher row (locked modes such as the AI canvas) keep their card at this height at
 * every editor size instead of stretching into the row's space.
 */
export const ORDINARY_COMPOSER_CARD_HEIGHT = 164
/** Padding and border of the composer shell around the card, per editor size (editor_span_map). */
export const COMPOSER_SHELL_CHROME_HEIGHT = { default: 18, small: 13.2 } as const
/** Keep specialized composer controls readable at their larger fixed height. */
export const SPECIALIZED_COMPOSER_MIN_INPUT_HEIGHT = 260
/** Reserve enough space for video production controls. */
export const VIDEO_PRODUCTION_COMPOSER_MIN_INPUT_HEIGHT = 274
/** Reserve enough vertical space for the PPT editor and its template controls. */
export const PPT_COMPOSER_MIN_INPUT_HEIGHT = 274

/** Resolve the shared minimum height while keeping PPT's larger control set explicit. */
export function resolveComposerMinInputHeight({
	isPptMode,
	isVideoProductionMode,
	isSpecializedMode,
	isLockedMode = false,
	editorSize = "default",
}: {
	isPptMode: boolean
	isVideoProductionMode: boolean
	isSpecializedMode: boolean
	/** The mode is fixed by the page, so the composer renders no header row. */
	isLockedMode?: boolean
	editorSize?: keyof typeof COMPOSER_SHELL_CHROME_HEIGHT
}) {
	// PPT has the most vertically demanding controls and must win if multiple flags are true.
	if (isPptMode) return PPT_COMPOSER_MIN_INPUT_HEIGHT
	// Video production needs additional room for its configuration controls.
	if (isVideoProductionMode) return VIDEO_PRODUCTION_COMPOSER_MIN_INPUT_HEIGHT
	// Keep existing specialized controls above the ordinary composer floor.
	if (isSpecializedMode) return SPECIALIZED_COMPOSER_MIN_INPUT_HEIGHT
	// A locked mode hides the mode switcher row, so its space returns to the conversation.
	if (isLockedMode)
		return ORDINARY_COMPOSER_CARD_HEIGHT + COMPOSER_SHELL_CHROME_HEIGHT[editorSize]
	return undefined
}

export const CONVERSATION_INPUT_HEIGHT_CONFIG = {
	/** Keep content-driven growth conservative by default. */
	maxRatio: 0.5,
	/** Allow an intentional drag to occupy more space than automatic growth. */
	manualMaxRatio: 0.7,
	/** Keep a readable message area while the input is manually expanded. */
	manualMinAvailableHeight: 240,
} as const
