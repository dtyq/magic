import { cn } from "@/utils/cn"

export const USER_MESSAGE_STICKY_MASK_CLASS = cn(
	"isolate overflow-visible",
	"before:pointer-events-none before:absolute before:inset-0 before:z-0 before:bg-[var(--sticky-message-mask-bg,var(--message-list-surface,rgb(var(--background-rgb))))] before:content-['']",
	"after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:z-0 after:h-[var(--message-list-sticky-fade-height,1rem)] after:bg-gradient-to-b after:from-[var(--sticky-message-mask-fade-from,var(--message-list-surface,rgb(var(--background-rgb))))] after:to-transparent after:content-['']",
	"[&>*]:relative [&>*]:z-[1]",
)

/** Extra classes applied to the row wrapper when the message is from the user */
export const USER_MESSAGE_ROW_CLASS = "flex min-w-0 justify-end"

/**
 * Assistant content keeps a timeline gutter, while terminal status badges cancel only that
 * gutter through the inherited CSS variable so they align with top-level Tool statuses.
 */
export const ASSISTANT_MESSAGE_ROW_CLASS =
	"pb-2 pl-6 [--message-status-offset:-1.5rem] after:absolute after:left-[11px] after:top-0 after:z-[-1] after:h-full after:w-px after:border-l after:border-dashed after:border-border after:content-['']"
