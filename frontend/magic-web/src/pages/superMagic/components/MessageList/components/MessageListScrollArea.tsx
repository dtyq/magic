import type { ReactNode, Ref } from "react"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { cn } from "@/utils/cn"

interface MessageListScrollAreaProps {
	children: ReactNode
	viewportRef: Ref<HTMLDivElement>
	contentClassName?: string
}

/** Keep messages and their scrollbar in one viewport on every supported browser. */
export function MessageListScrollArea({
	children,
	viewportRef,
	contentClassName,
}: MessageListScrollAreaProps) {
	return (
		<ScrollArea
			className="h-full min-h-0 w-full"
			viewportRef={viewportRef}
			viewportProps={{
				"data-message-list-viewport": "true",
				"data-testid": "message-list-viewport",
			}}
			// Radix hides native scrollbars; virtua remains the sole owner of compensation.
			// Flex constrains the default table wrapper and fills empty states while letting
			// the message column grow beyond the viewport as virtual rows are measured.
			viewportClassName="[overflow-anchor:none] [&>div]:!flex [&>div]:min-h-full [&>div]:flex-col"
		>
			<div
				className={cn(
					// Leave 12px for the shared 10px scrollbar even when messages fill a narrow panel.
					"mx-auto block min-h-full w-full min-w-0 max-w-3xl flex-1 pb-2 pr-3",
					// Caller spacing stays on the column, so prepended rows cannot carry it away.
					contentClassName,
				)}
				// Onboarding frames the centered conversation, separately from the full-width viewport.
				data-guide-anchor="message-list-column"
			>
				{children}
			</div>
		</ScrollArea>
	)
}
