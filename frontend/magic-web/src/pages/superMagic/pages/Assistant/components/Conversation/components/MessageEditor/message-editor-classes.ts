import { cn } from "@/lib/utils"

/** TipTap / ProseMirror editor surface + mention / suggestion styling */
export const messageEditorEditorBase = cn(
	"max-h-[100px] min-h-[42px] flex-1 overflow-y-auto text-sm leading-5",
	"[&_.ProseMirror]:m-0 [&_.ProseMirror]:border-none [&_.ProseMirror]:bg-transparent [&_.ProseMirror]:outline-none",
	"[&_.ProseMirror]:font-inherit [&_.ProseMirror]:break-words [&_.ProseMirror]:font-normal [&_.ProseMirror]:not-italic [&_.ProseMirror]:text-inherit",
	"[&_.ProseMirror]:min-h-10",
	"[&_.ProseMirror_p]:m-0 [&_.ProseMirror_p]:break-all [&_.ProseMirror_p]:p-0",
	"[&_.ProseMirror_.is-editor-empty:first-child]:before:pointer-events-none [&_.ProseMirror_.is-editor-empty:first-child]:before:float-left [&_.ProseMirror_.is-editor-empty:first-child]:before:h-0 [&_.ProseMirror_.is-editor-empty:first-child]:before:text-foreground/35 [&_.ProseMirror_.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]",
	"[&_.magic-mention]:mx-0.5 [&_.magic-mention]:inline [&_.magic-mention]:overflow-hidden [&_.magic-mention]:text-ellipsis [&_.magic-mention]:rounded-[4px] [&_.magic-mention]:bg-blue-500/10 [&_.magic-mention]:px-1 [&_.magic-mention]:py-px [&_.magic-mention]:align-top [&_.magic-mention]:text-xs [&_.magic-mention]:!leading-5 [&_.magic-mention]:text-foreground",
	"[&_.ProseMirror_p[data-suggestion]:not([data-suggestion=''])]:relative [&_.ProseMirror_p[data-suggestion]:not([data-suggestion=''])]:overflow-visible",
	"[&_.ProseMirror_p[data-suggestion]:not([data-suggestion=''])]:after:pointer-events-none [&_.ProseMirror_p[data-suggestion]:not([data-suggestion=''])]:after:inline-block [&_.ProseMirror_p[data-suggestion]:not([data-suggestion=''])]:after:h-0 [&_.ProseMirror_p[data-suggestion]:not([data-suggestion=''])]:after:text-muted-foreground [&_.ProseMirror_p[data-suggestion]:not([data-suggestion=''])]:after:content-[attr(data-suggestion)]",
	"md:[&_.ProseMirror_p[data-suggestion]:not([data-suggestion=''])]:after:hidden",
	"[&_.ProseMirror:focus]:outline-none",
	"[&_.ProseMirror::selection]:bg-primary-10",
)

export const messageEditorToolBarButton = cn(
	"flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-border text-foreground/80",
	"hover:bg-fill active:bg-fill-secondary",
	"focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
)

export const messageEditorSendButton = cn(
	"flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border-0 text-white",
	"bg-primary",
	"hover:opacity-90 active:opacity-80",
	"focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
)

export const messageEditorSendButtonDisabled = cn(
	"cursor-not-allowed bg-primary/50 hover:opacity-100 active:opacity-100 dark:bg-white/10",
)

export const messageEditorFooterLeft = cn(
	"h-[42px] translate-y-0.5 !gap-2.5 overflow-x-auto overflow-y-hidden whitespace-nowrap pb-3",
	"[&]:empty:block",
	"[&_.magic-btn]:px-1.5 [&_.magic-btn]:text-xs [&_.magic-btn]:font-normal [&_.magic-btn]:leading-4",
	"[&_.magic-btn_.magic-btn-icon]:!me-0.5",
)

export const messageEditorFooterRight = cn("flex items-center gap-1.5")

export const messageEditorQuickInstructionButton = cn(
	"flex-shrink-0 cursor-pointer rounded-md border border-border px-2 py-1 text-sm font-normal leading-5 text-foreground transition-all duration-200 ease-in-out",
	"hover:bg-fill hover:text-foreground",
	"active:bg-fill-secondary",
	"focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
)

export const messageEditorReferSection = "w-full"

export const messageEditorReferMessage = cn(
	"w-full text-xs font-normal text-muted-foreground opacity-80",
)
