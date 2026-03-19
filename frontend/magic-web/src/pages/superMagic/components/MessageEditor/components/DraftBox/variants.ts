import { cva } from "class-variance-authority"

// Trigger button
export const draftBoxTriggerVariants = cva(
	"flex cursor-pointer items-center justify-center rounded-md border p-1 text-[10px] font-normal leading-[14px] text-foreground transition-all hover:bg-secondary hover:text-primary active:bg-muted active:text-foreground",
	{
		variants: {
			size: {
				default: "",
				mobile: "flex cursor-pointer items-center justify-center rounded-md border-0 bg-[#f5f5f5] transition-all hover:opacity-80 active:opacity-60",
				small: "",
			},
		},
		defaultVariants: {
			size: "default",
		},
	},
)

// Container
export const draftBoxContainerVariants = cva(
	"flex h-full w-full flex-col overflow-hidden rounded-2xl bg-white",
)

// Header
export const draftBoxHeaderVariants = cva(
	"flex items-center justify-between gap-4 border-b border-border",
	{
		variants: {
			size: {
				default: "px-6 py-4",
				mobile: "px-4 py-3",
				small: "px-3 py-2",
			},
		},
		defaultVariants: {
			size: "default",
		},
	},
)

export const draftBoxHeaderLeftVariants = cva("flex items-center gap-3")

export const draftBoxIconContainerVariants = cva(
	"flex items-center justify-center rounded-lg bg-primary",
	{
		variants: {
			size: {
				default: "h-12 w-12",
				mobile: "h-10 w-10",
				small: "h-8 w-8",
			},
		},
		defaultVariants: {
			size: "default",
		},
	},
)

export const draftBoxTitleSectionVariants = cva("flex flex-col gap-0.5")

export const draftBoxTitleVariants = cva("text-base font-semibold leading-6 text-foreground")

export const draftBoxSubtitleVariants = cva("text-xs leading-4 text-muted-foreground")

export const draftBoxCloseButtonVariants = cva(
	"flex cursor-pointer items-center justify-center rounded-lg border-0 bg-[#f5f5f5] text-foreground transition-all hover:opacity-80 active:opacity-60",
	{
		variants: {
			size: {
				default: "h-10 w-10",
				mobile: "h-8 w-8",
				small: "h-6 w-6",
			},
		},
		defaultVariants: {
			size: "default",
		},
	},
)

// Content
export const draftBoxContentVariants = cva("flex flex-1 flex-col overflow-hidden")

export const draftBoxScrollContainerVariants = cva("flex-1 overflow-y-auto", {
	variants: {
		size: {
			default: "px-6 py-4",
			mobile: "px-4 py-3",
			small: "px-3 py-2",
		},
	},
	defaultVariants: {
		size: "default",
	},
})

export const draftBoxScrollContentVariants = cva("flex flex-col gap-3")

export const draftBoxEmptyStateVariants = cva(
	"flex items-center justify-center py-12 text-sm text-muted-foreground",
)

// Draft item
export const draftBoxItemVariants = cva(
	"flex flex-col gap-3 rounded-lg border border-border bg-background p-4 transition-all hover:border-primary/50 hover:shadow-sm",
)

export const draftBoxItemContentVariants = cva(
	"flex flex-col gap-2 text-sm leading-5 text-foreground",
)

export const draftBoxItemFooterVariants = cva(
	"flex items-center justify-between gap-4 border-t border-border pt-3",
)

export const draftBoxTimeInfoVariants = cva(
	"flex items-center gap-1.5 text-xs text-muted-foreground",
)

export const draftBoxActionsVariants = cva("flex items-center gap-2")

export const draftBoxActionButtonVariants = cva(
	"flex items-center gap-1 rounded-lg border-0 px-3 py-1.5 text-xs transition-all hover:opacity-90 active:opacity-80",
	{
		variants: {
			variant: {
				delete: "bg-[#f5f5f5] text-foreground",
				use: "bg-primary text-white",
			},
		},
		defaultVariants: {
			variant: "use",
		},
	},
)

// Footer tip
export const draftBoxTipVariants = cva(
	"border-t border-border bg-muted/30 text-center text-xs leading-4 text-muted-foreground",
	{
		variants: {
			size: {
				default: "px-6 py-3",
				mobile: "px-4 py-2",
				small: "px-3 py-2",
			},
		},
		defaultVariants: {
			size: "default",
		},
	},
)

// Modal
export const draftBoxModalBodyVariants = cva("h-[600px] !p-0")
