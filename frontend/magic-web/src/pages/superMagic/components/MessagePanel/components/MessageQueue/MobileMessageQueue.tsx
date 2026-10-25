import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ChevronDown, Hourglass } from "lucide-react"
import { cn } from "@/utils/cn"
import type { MessageQueueProps } from "./index"
import MessageQueueItems from "./MessageQueueItems"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"

const MOBILE_QUEUE_AUTO_COLLAPSE_THRESHOLD = 3

/** Render the mobile-only queue card while preserving the existing queue operations. */
function MobileMessageQueue({
	queue,
	queueStats,
	onRemoveMessage,
	onSendMessage,
	onStartEdit,
	onWithdraw,
	onMove,
	editorRef,
	isOperationPending,
	className,
}: MessageQueueProps) {
	const { t } = useTranslation("super")
	const shouldAutoCollapse = queue.length >= MOBILE_QUEUE_AUTO_COLLAPSE_THRESHOLD
	const [manualExpanded, setManualExpanded] = useState<boolean | null>(null)
	const isExpanded = manualExpanded ?? !shouldAutoCollapse

	if (queue.length === 0) {
		return null
	}

	const handleToggleExpanded = () => {
		setManualExpanded((current) => !(current ?? !shouldAutoCollapse))
	}

	return (
		<div
			className={cn("flex shrink-0 flex-col overflow-hidden rounded-3xl bg-card", className)}
			style={{ boxShadow: "0px 8px 25px 0px rgba(0,0,0,0.10)" }}
			role="region"
			aria-label={t("messageQueue.mobile.title")}
			data-testid="mobile-message-queue"
		>
			<button
				type="button"
				className="flex h-11 shrink-0 items-center gap-2 px-3 text-left transition-opacity active:opacity-70"
				onClick={handleToggleExpanded}
				aria-expanded={isExpanded}
				aria-label={
					isExpanded ? t("messageQueue.mobile.collapse") : t("messageQueue.mobile.expand")
				}
				data-testid="mobile-message-queue-toggle"
			>
				<Hourglass className="size-4 shrink-0 text-foreground" strokeWidth={2} />
				<span className="shrink-0 text-sm font-medium leading-5 text-foreground">
					{t("messageQueue.mobile.title")}
				</span>
				<span className="shrink-0 text-sm leading-5 text-muted-foreground">
					· {t("messageQueue.mobile.count", { count: queueStats.total })}
				</span>
				<span className="flex-1" aria-hidden />
				<ChevronDown
					className="size-4 shrink-0 text-foreground transition-transform duration-200"
					style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
				/>
			</button>

			{isExpanded && (
				<ScrollArea
					className="border-t border-border"
					viewportClassName="max-h-[35vh] [&>div]:!flex [&>div]:flex-col"
					viewportProps={{ "data-testid": "mobile-message-queue-list" }}
				>
					<MessageQueueItems
						queue={queue}
						onRemoveMessage={onRemoveMessage}
						onSendMessage={onSendMessage}
						onStartEdit={onStartEdit}
						onWithdraw={onWithdraw}
						onMove={onMove}
						editorRef={editorRef}
						isOperationPending={isOperationPending}
						variant="mobile"
					/>
				</ScrollArea>
			)}
		</div>
	)
}

export default MobileMessageQueue
