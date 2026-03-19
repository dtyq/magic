import { cn } from "@/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"

export const messageEditorContainerVariants = cva(
	"relative flex w-full flex-col gap-2 rounded-xl border border-transparent bg-background",
	{
		variants: {
			size: {
				default: "max-h-[50vh] min-h-[172px] overflow-hidden rounded-xl p-2.5",
				small: "max-h-[50vh] min-h-[122px] overflow-hidden rounded-lg p-2",
				mobile: "max-h-[50vh] min-h-[122px] overflow-hidden rounded-xl p-2.5",
			},
			focused: {
				true: "border-primary",
				false: "",
			},
			mobile: {
				true: "border-none",
				false: "",
			},
		},
		defaultVariants: {
			size: "default",
			focused: false,
		},
	},
)

export const messageEditorInnerVariants = cva("h-full min-h-0 w-full flex-1", {
	variants: {
		size: {
			default: "gap-2",
			small: "gap-1.5",
			mobile: "gap-2.5",
		},
	},
	defaultVariants: {
		size: "default",
	},
})

export const messageEditorContentVariants = cva(
	cn(
		"h-full w-full resize-none rounded-none border-0 bg-transparent p-0 text-foreground caret-foreground placeholder:text-muted-foreground hover:shadow-none hover:outline-none focus:shadow-none focus:outline-none focus-visible:ring-0",
		"prose prose-sm font-inherit min-h-[50px] max-w-none flex-1 overflow-y-auto text-sm leading-5 [&_.ProseMirror]:m-0 [&_.ProseMirror]:h-full [&_.ProseMirror]:min-h-[40px] [&_.ProseMirror]:break-words [&_.ProseMirror]:border-none [&_.ProseMirror]:bg-transparent [&_.ProseMirror]:font-normal [&_.ProseMirror]:text-inherit [&_.ProseMirror]:outline-none [&_.ProseMirror_.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_.is-editor-empty:first-child::before]:h-0 [&_.ProseMirror_.is-editor-empty:first-child::before]:text-muted-foreground [&_.ProseMirror_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_.magic-mention]:mx-0.5 [&_.ProseMirror_.magic-mention]:inline [&_.ProseMirror_.magic-mention]:cursor-pointer [&_.ProseMirror_.magic-mention]:overflow-hidden [&_.ProseMirror_.magic-mention]:text-ellipsis [&_.ProseMirror_.magic-mention]:rounded [&_.ProseMirror_.magic-mention]:bg-primary/10 [&_.ProseMirror_.magic-mention]:px-1 [&_.ProseMirror_.magic-mention]:py-0.5 [&_.ProseMirror_.magic-mention]:align-top [&_.ProseMirror_.magic-mention]:text-xs [&_.ProseMirror_.magic-mention]:font-normal [&_.ProseMirror_.magic-mention]:leading-5 [&_.ProseMirror_.magic-mention]:text-primary [&_.ProseMirror_p]:m-0 [&_.ProseMirror_p]:break-all [&_.ProseMirror_p]:p-0",
		"[&_.ProseMirror_.magic-mention]:bg-primary-10",
		// Text selection styles
		"[&_.ProseMirror::selection]:bg-blue-200 dark:[&_.ProseMirror::selection]:bg-blue-500/40 [&_.ProseMirror_*::selection]:bg-blue-200 dark:[&_.ProseMirror_*::selection]:bg-blue-500/40",
		// Enable text selection on mobile
		"select-text [&_.ProseMirror]:select-text [&_.ProseMirror]:[-moz-user-select:text] [&_.ProseMirror]:[-ms-user-select:text] [&_.ProseMirror]:[-webkit-user-select:text] [&_.ProseMirror]:[user-select:text]",
		// Enable touch callout on iOS
		"[&_.ProseMirror]:[-webkit-touch-callout:default]",
		// AI completion suggestion styles
		"[&_.ProseMirror_p[data-suggestion]]:relative [&_.ProseMirror_p[data-suggestion]]:overflow-visible",
		"[&_.ProseMirror_p[data-suggestion]::after]:pointer-events-none [&_.ProseMirror_p[data-suggestion]::after]:inline-block [&_.ProseMirror_p[data-suggestion]::after]:h-0 [&_.ProseMirror_p[data-suggestion]::after]:text-muted-foreground [&_.ProseMirror_p[data-suggestion]::after]:content-[attr(data-suggestion)]",
		// Hide AI completion on mobile
		"[&_.ProseMirror_p[data-suggestion]::after]:hidden [&_.ProseMirror_p[data-suggestion]::after]:md:inline-block",
	),
	{
		variants: {
			size: {
				default: "",
				small: "min-h-[100px] text-[13px] leading-4 [&_.ProseMirror]:min-h-[34px]",
				mobile: "min-h-[100px] text-[13px] leading-4 [&_.ProseMirror]:min-h-[34px]",
			},
		},
		defaultVariants: {
			size: "default",
		},
	},
)

export const messageEditorToolbarVariants = cva("flex items-center justify-between gap-1.5", {
	variants: {
		size: {
			default: "",
			small: "",
			mobile: "",
		},
	},
	defaultVariants: {
		size: "default",
	},
})

export const messageEditorToolbarLeftVariants = cva(
	"flex min-w-0 items-center gap-1.5 overflow-hidden",
	{
		variants: {
			size: {
				default: "",
				small: "",
				mobile: "",
			},
		},
		defaultVariants: {
			size: "default",
		},
	},
)

export const messageEditorToolbarRightVariants = cva("flex items-center justify-end", {
	variants: {
		size: {
			default: "gap-2.5",
			small: "gap-1",
			mobile: "gap-1.5",
		},
	},
	defaultVariants: {
		size: "default",
	},
})

export const messageEditorTextContainerVariants = cva(
	"relative flex min-h-0 w-full flex-1 select-text flex-col overflow-hidden",
	{
		variants: {
			size: {
				default: "",
				small: "",
				mobile: "",
			},
		},
		defaultVariants: {
			size: "default",
		},
	},
)

export const messageEditorAtButtonVariants = cva(
	"flex w-fit shrink-0 cursor-pointer items-center justify-center gap-1 overflow-hidden rounded border border-border text-[10px] font-normal leading-[14px] text-muted-foreground transition-all duration-300 hover:bg-accent/50",
	{
		variants: {
			size: {
				default: "p-1",
				small: "p-1",
				mobile: "rounded-lg p-1.5",
			},
		},
		defaultVariants: {
			size: "default",
		},
	},
)

export const messageEditorUploadButtonVariants = cva(
	"h-8 w-8 rounded-md border border-border bg-background p-2 hover:bg-fill",
	{
		variants: {
			size: {
				default: "h-8 w-8",
				small: "h-6 w-6",
				mobile: "h-8 w-8",
			},
		},
		defaultVariants: {
			size: "default",
		},
	},
)

export const messageEditorSendButtonVariants = cva("rounded-md p-2", {
	variants: {
		size: {
			default: "h-8 w-8",
			small: "h-6 w-6",
			mobile: "h-8 w-8",
		},
		disabled: {
			true: "cursor-not-allowed bg-fill opacity-50",
			false: "bg-foreground text-background hover:bg-foreground/90",
		},
	},
	defaultVariants: {
		size: "default",
		disabled: false,
	},
})

export type MessageEditorContainerVariants = VariantProps<typeof messageEditorContainerVariants>
export type MessageEditorInnerVariants = VariantProps<typeof messageEditorInnerVariants>
export type MessageEditorContentVariants = VariantProps<typeof messageEditorContentVariants>
export type MessageEditorToolbarVariants = VariantProps<typeof messageEditorToolbarVariants>
export type MessageEditorToolbarLeftVariants = VariantProps<typeof messageEditorToolbarLeftVariants>
export type MessageEditorToolbarRightVariants = VariantProps<
	typeof messageEditorToolbarRightVariants
>
export type MessageEditorTextContainerVariants = VariantProps<
	typeof messageEditorTextContainerVariants
>
export type MessageEditorAtButtonVariants = VariantProps<typeof messageEditorAtButtonVariants>
export type MessageEditorUploadButtonVariants = VariantProps<
	typeof messageEditorUploadButtonVariants
>
export type MessageEditorSendButtonVariants = VariantProps<typeof messageEditorSendButtonVariants>
