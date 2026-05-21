/** 设置 Sheet 固定档位，不参与全局栈自增，避免挤占交易层（PaidPackage ≥ 1400）。 */
export const MOBILE_SETTINGS_SHEET_Z_INDEX = 1100

export const MOBILE_SETTINGS_SHEET_CLASSNAME =
	"flex max-h-[calc(100dvh-0.5rem)] flex-col overflow-hidden rounded-t-2xl border-0 bg-muted p-0 shadow-2xl shadow-black/10"

export const MOBILE_SETTINGS_HEADER_ICON_BUTTON_CLASSNAME =
	"absolute top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full shadow-lg shadow-black/10"

export const MOBILE_SETTINGS_SECTION_CLASSNAME = "rounded-xl bg-card"

export const MOBILE_SETTINGS_CARD_CLASSNAME = "rounded-xl border border-border bg-card p-4"
