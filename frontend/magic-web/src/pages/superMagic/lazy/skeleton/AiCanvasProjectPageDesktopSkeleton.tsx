import { useState } from "react"
import { Skeleton } from "@/components/shadcn-ui/skeleton"
import { MagicSpin } from "@/components/base"
import { TopicLayoutStore } from "../../pages/TopicPage/stores/TopicLayoutStore"
import { TopicConversationSkeleton } from "./TopicPageDesktopSkeleton"

/**
 * Loading placeholder of an AI canvas project (`/super/ai-canvas/:projectId`), shaped like the
 * loaded page: no project sidebar, a framed canvas (rounded outline, dotted board) with the back
 * button and project pill at its top-left, the tool bar at the bottom and zoom controls at the
 * bottom-right, and the conversation column at the width the user last left it (none when
 * collapsed).
 */
function AiCanvasProjectPageDesktopSkeleton() {
	// Read-only use: the store restores the persisted conversation width and collapsed state.
	const [layout] = useState(() => new TopicLayoutStore())
	const conversationWidth = layout.isConversationPanelCollapsed ? 0 : layout.messagePanelWidthPx

	return (
		<div
			className="flex h-full w-full min-w-0 gap-1"
			data-testid="ai-canvas-project-desktop-skeleton"
		>
			<div className="relative h-full min-w-0 flex-1 overflow-hidden rounded-xl border border-border bg-background">
				<div
					aria-hidden="true"
					className="absolute inset-0"
					style={{
						backgroundImage:
							"radial-gradient(oklch(var(--foreground) / 0.12) 1px, transparent 1.2px)",
						backgroundSize: "20px 20px",
					}}
				/>
				<div className="absolute left-3 top-3 flex items-center gap-2">
					<Skeleton className="size-[42px] rounded-full" />
					<Skeleton className="h-[42px] w-60 rounded-full" />
				</div>
				<div className="absolute inset-0 flex items-center justify-center">
					<MagicSpin spinning />
				</div>
				<Skeleton className="absolute bottom-3 left-1/2 h-11 w-[440px] max-w-[60%] -translate-x-1/2 rounded-full" />
				<div className="absolute bottom-3 right-3 flex items-center gap-2">
					<Skeleton className="h-9 w-28 rounded-full" />
					<Skeleton className="size-9 rounded-full" />
					<Skeleton className="size-9 rounded-full" />
				</div>
			</div>
			{conversationWidth > 0 ? (
				<div
					className="h-full shrink-0 overflow-hidden"
					style={{ width: conversationWidth }}
				>
					<TopicConversationSkeleton />
				</div>
			) : null}
		</div>
	)
}

export default AiCanvasProjectPageDesktopSkeleton
