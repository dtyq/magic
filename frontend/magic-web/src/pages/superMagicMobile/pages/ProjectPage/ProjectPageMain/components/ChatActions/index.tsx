import { memo } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/lib/utils"
import { HistoryIcon, MessageCirclePlus } from "lucide-react"

export interface Props {
	onNewTopicClick?: () => void
	onHistoryTopicsClick?: () => void
	className?: string
}

const ChatActions = memo(function ChatActions({
	onNewTopicClick,
	onHistoryTopicsClick,
	className,
}: Props) {
	const { t } = useTranslation("super")

	return (
		<div className={cn("flex w-full items-start gap-2 px-2", className)}>
			{onNewTopicClick && (
				<Button
					variant="outline"
					size="sm"
					onClick={onNewTopicClick}
					className="h-7 gap-1 rounded-full px-2.5 py-1 text-xs font-normal"
				>
					<MessageCirclePlus size={16} className="shrink-0" />
					<span className="whitespace-nowrap">{t("chatActions.newTopic")}</span>
				</Button>
			)}
			{onHistoryTopicsClick && (
				<Button
					variant="outline"
					size="sm"
					onClick={onHistoryTopicsClick}
					className="h-7 gap-1 rounded-full px-2.5 py-1 text-xs font-normal"
				>
					<HistoryIcon size={16} className="shrink-0" />
					<span className="whitespace-nowrap">{t("chatActions.historyTopics")}</span>
				</Button>
			)}
		</div>
	)
})

ChatActions.displayName = "ChatActions"

export default ChatActions
