/** 设置 Sheet 在 MagicPopup 全局栈中的起始基准，嵌套层由栈自动递增（步长 10）。 */
export const MOBILE_SETTINGS_SHEET_Z_INDEX = 1100

export const MOBILE_SETTINGS_SHEET_CLASSNAME =
	"flex max-h-[calc(100dvh-0.5rem)] flex-col overflow-hidden rounded-t-2xl border-0 bg-muted p-0 shadow-2xl shadow-black/10"

/**
 * Root settings sheet height: use most of the viewport and only reserve top safe area.
 * Overrides MagicPopup bottom drawer default `mt-24`, which leaves a large empty band above the sheet.
 */
export const MOBILE_SETTINGS_ROOT_SHEET_CLASSNAME =
	"h-[min(92dvh,calc(100dvh-var(--safe-area-inset-top)-0.5rem))] max-h-[calc(100dvh-var(--safe-area-inset-top)-0.5rem)] data-[vaul-drawer-direction=bottom]:!mt-[max(0.5rem,var(--safe-area-inset-top))]"

export const MOBILE_SETTINGS_HEADER_ICON_BUTTON_CLASSNAME =
	"absolute top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full shadow-lg shadow-black/10"

export const MOBILE_SETTINGS_SECTION_CLASSNAME = "rounded-xl bg-card"

export const MOBILE_SETTINGS_CARD_CLASSNAME = "rounded-xl border border-border bg-card p-4"

/** Root sheet header info button; flip to true when the about entry should be visible again. */
export const MOBILE_SETTINGS_SHOW_INFO_HEADER = false
