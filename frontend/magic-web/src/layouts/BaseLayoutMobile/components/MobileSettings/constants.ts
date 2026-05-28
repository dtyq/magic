/** 设置 Sheet 在 MagicPopup 全局栈中的起始基准，嵌套层由栈自动递增（步长 10）。 */
export const MOBILE_SETTINGS_SHEET_Z_INDEX = 1100

export const MOBILE_SETTINGS_SHEET_CLASSNAME =
	"flex max-h-[calc(100dvh-0.5rem)] flex-col overflow-hidden rounded-t-2xl border-0 bg-muted p-0 shadow-2xl shadow-black/10"

/**
 * Root settings sheet height: default 98vh, capped by viewport minus top safe area.
 * Overrides MagicPopup bottom drawer default `mt-24`, which leaves a large empty band above the sheet.
 */
export const MOBILE_SETTINGS_ROOT_SHEET_CLASSNAME =
	"h-[min(98dvh,calc(100dvh-var(--safe-area-inset-top)-0.5rem))] max-h-[calc(100dvh-var(--safe-area-inset-top)-0.5rem)] data-[vaul-drawer-direction=bottom]:!mt-[max(0.5rem,var(--safe-area-inset-top))]"

/** Nested settings sheets (points detail, order history, timezone, etc.) share the same default height. */
export const MOBILE_SETTINGS_SHEET_HEIGHT_CLASSNAME = MOBILE_SETTINGS_ROOT_SHEET_CLASSNAME

export const MOBILE_SETTINGS_HEADER_ICON_BUTTON_CLASSNAME =
	"absolute top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full shadow-lg shadow-black/10"

export const MOBILE_SETTINGS_SECTION_CLASSNAME = "rounded-xl bg-card"

export const MOBILE_SETTINGS_CARD_CLASSNAME = "rounded-xl border border-border bg-card p-4"

/** Temporary mobile root-menu toggle; flip to true when the account security entry should be visible again. */
// TODO: Re-enable this after mobile account-security access is approved again.
export const MOBILE_SETTINGS_SHOW_ACCOUNT_SECURITY_ENTRY = false

/**
 * Plan card min-heights for the root settings sheet scroll area.
 * Cards are flex children; shrink-0 + min-h prevents vertical squashing when the sheet is short.
 */
export const MOBILE_SETTINGS_FREE_PLAN_CARD_MIN_HEIGHT_CLASSNAME = "min-h-[5.5rem]"
export const MOBILE_SETTINGS_FREE_PLAN_CARD_WITH_CTA_MIN_HEIGHT_CLASSNAME = "min-h-[8.25rem]"
export const MOBILE_SETTINGS_PAID_PLAN_CARD_MIN_HEIGHT_CLASSNAME = "min-h-[5rem]"
