import type { ReactNode } from "react"
import { cn } from "@/utils/cn"

/**
 * Restyles the shared task-home composer (EditorLayout) for the AI canvas hero without
 * touching the shared component: every rule is scoped to this wrapper and targets the
 * composer's stable data attributes, so other pages keep their look and every control
 * (draft box, @, /, model switch, web search, MCP, upload, voice, send) keeps its behavior.
 *
 * | part                  | shared default                 | AI canvas                             |
 * | outer shell           | grey box around a white editor | 1px light-grey outline, soft shadow   |
 * | editor                | bordered, 12px radius          | borderless, 19px radius, roomier      |
 * | buttons               | square corners                 | round; colors and states unchanged    |
 */
const COMPOSER_STYLES = [
	// Outer shell: a single 1px light-grey outline (theme border token, so it adapts to dark
	// mode) around the editor card, plus a soft light-grey shadow lifting it off the board.
	"[&_[data-guide-anchor='message-composer']]:rounded-[20px]",
	"[&_[data-guide-anchor='message-composer']]:border",
	"[&_[data-guide-anchor='message-composer']]:border-border",
	"[&_[data-guide-anchor='message-composer']]:p-0",
	"[&_[data-guide-anchor='message-composer']]:bg-background",
	"[&_[data-guide-anchor='message-composer']]:shadow-[0_16px_48px_-16px_rgb(15_23_42/0.16)]",
	// Editor surface: borderless card; 1px tighter radius so it nests inside the outline.
	"[&_[data-testid='super-message-editor-container']]:rounded-[19px]",
	"[&_[data-testid='super-message-editor-container']]:border-0",
	"[&_[data-testid='super-message-editor-container']]:p-4",
	"[&_[data-testid='super-message-editor-content']]:text-[15px]",
	// Buttons only change shape; their shared colors and on/off states stay untouched.
	"[&_[data-testid='super-message-editor-header']_button]:rounded-full",
	"[&_[data-testid='super-message-editor-model-switch']]:rounded-full",
	"[&_[data-testid='super-message-editor-toolbar-right']_button]:rounded-full",
]

export default function AiCanvasComposerFrame({
	children,
	className,
}: {
	children: ReactNode
	className?: string
}) {
	return (
		<div className={cn("w-full", COMPOSER_STYLES, className)} data-testid="ai-canvas-composer">
			{children}
		</div>
	)
}
