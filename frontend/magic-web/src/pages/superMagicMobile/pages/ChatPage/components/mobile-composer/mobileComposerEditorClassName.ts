import { cn } from "@/utils/cn"

/**
 * Typography and overflow rules shared by both placeholder states of the mobile composer editor.
 *
 * The placeholder lives in normal flow (a full-width block) instead of being absolutely
 * positioned on top of the empty paragraph, so the composer dock grows with the prompt
 * text and wraps it in full rather than clipping it to a single ellipsized line.
 */
const baseEditorClassName = cn(
	"max-h-[100px] min-h-0 overflow-hidden text-sm text-foreground",
	"[&_.ProseMirror]:m-0 [&_.ProseMirror]:max-h-[100px] [&_.ProseMirror]:overflow-y-auto",
	"[&_.ProseMirror]:break-words [&_.ProseMirror]:text-sm [&_.ProseMirror]:outline-none",
	// overflow-wrap:anywhere (not break-all) still wraps long URLs and CJK text anywhere, but moves
	// whole English words to the next line instead of splitting them mid-letter.
	"[&_.ProseMirror_p]:m-0 [&_.ProseMirror_p]:p-0 [&_.ProseMirror_p]:[overflow-wrap:anywhere]",
	"[&_.ProseMirror_.is-editor-empty:first-child::before]:pointer-events-none",
	"[&_.ProseMirror_.is-editor-empty:first-child::before]:block",
	"[&_.ProseMirror_.is-editor-empty:first-child::before]:w-full",
	"[&_.ProseMirror_.is-editor-empty:first-child::before]:whitespace-normal",
	"[&_.ProseMirror_.is-editor-empty:first-child::before]:break-words",
	"[&_.ProseMirror_.is-editor-empty:first-child::before]:text-muted-foreground",
	"[&_.ProseMirror_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
)

/**
 * ProseMirror keeps an auxiliary `<br class="ProseMirror-trailingBreak">` inside the empty
 * paragraph to size its caret line. While the placeholder occupies real space that line would
 * add a blank row under it, so it is removed from layout (the node stays in the document,
 * matching the WechatChatHistory case).
 */
const placeholderLineClassName =
	"[&_.ProseMirror_.is-editor-empty:first-child>.ProseMirror-trailingBreak]:hidden"

/**
 * With no placeholder text (`TopicMode.CustomAgent` resolves the placeholder to `""`) the
 * in-flow placeholder is a zero-height block. Hiding the trailing break as well would leave the
 * empty paragraph without any line box: the dock collapses to 0px, its height stops tracking
 * the text and the caret has nowhere to render. Keep the break in that case so the editor always
 * holds exactly one text line — the line box itself acts as the minimum height.
 */
const emptyPlaceholderLineClassName =
	"[&_.ProseMirror_.is-editor-empty:first-child>.ProseMirror-trailingBreak]:inline"

/**
 * Build the composer editor classes for the current placeholder state.
 *
 * Placeholders that are missing or whitespace-only behave like an empty one: an all-whitespace
 * `::before` block collapses to zero height in normal white-space handling.
 */
export function getMobileComposerEditorClassName(placeholder?: string | null) {
	const hasPlaceholderText = (placeholder ?? "").trim().length > 0

	return cn(
		baseEditorClassName,
		hasPlaceholderText ? placeholderLineClassName : emptyPlaceholderLineClassName,
	)
}
