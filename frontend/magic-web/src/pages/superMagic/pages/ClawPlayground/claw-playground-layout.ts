/**
 * Bottom reserve for message list scroll (ConversationPanelScaffold padding).
 * Desktop Topic editor uses 172px; mobile Claw uses pills + BottomInputBar (~100–115px).
 */
export const CLAW_MOBILE_MESSAGE_LIST_RESERVE_PX = 112

/**
 * BackToLatestButton: above ConversationPanelScaffold bottom fade (h-14) + gap.
 * Default bottom-5 would sit inside the gradient band over the junction.
 */
export const CLAW_MOBILE_BACK_TO_LATEST_BUTTON_CLASS = "bottom-[40px]"

/**
 * Min height: visual viewport between safe areas (vh + CSS vars, not dvh).
 * Use with h-full so flex fills parent when % height works.
 */
export const CLAW_MOBILE_VIEWPORT_MIN_HEIGHT_CLASS =
	"!h-[calc(100%-var(--safe-area-inset-top)-var(--safe-area-inset-bottom))]"
