import { Button } from "@/opensource/components/shadcn-ui/button"
import StatusIcon from "@/opensource/pages/superMagic/components/MessageHeader/components/StatusIcon"
import { Topic } from "@/opensource/pages/superMagic/pages/Workspace/types"
import { History, MessageCirclePlus, MoreHorizontal, Share2 } from "lucide-react"
import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"

interface ChatHeaderProps {
	selectedTopic: Topic | null
	openActionsPopup: (topic: Topic) => void
	onNewTopicClick: () => void
	onHistoryClick?: () => void
	onShareClick?: () => void
}

function ChatHeader({
	selectedTopic,
	openActionsPopup,
	onNewTopicClick,
	onHistoryClick,
	onShareClick,
}: ChatHeaderProps) {
	const { t } = useTranslation("super")
	// Store last selected topic for back navigation
	const lastSelectedTopic = useRef<Topic | null>(null)

	useEffect(() => {
		if (selectedTopic) {
			lastSelectedTopic.current = selectedTopic
		}
	}, [selectedTopic])

	const currentTopic = selectedTopic || lastSelectedTopic.current

	return (
		<header className="border-b border-border bg-background">
			{/* Navigation Bar */}
			<div className="flex h-12 items-center justify-between gap-2 p-2.5">
				{/* Left: Back Button + Topic Info */}
				<div className="flex min-w-0 flex-1 items-center gap-1">
					<div className="flex min-w-0 flex-1 items-center gap-1">
						<StatusIcon
							status={currentTopic?.task_status}
							size={16}
							className="shrink-0"
						/>
						<p className="overflow-hidden text-ellipsis whitespace-nowrap text-sm font-normal leading-5 text-foreground">
							{currentTopic?.topic_name || t("topic.unnamedTopic")}
						</p>
					</div>
				</div>

				{/* Right: Action Buttons */}
				<div className="flex shrink-0 items-center gap-1">
					<Button
						variant="ghost"
						size="icon-sm"
						onClick={onNewTopicClick}
						className="size-7 p-1.5"
						aria-label="New topic"
					>
						<MessageCirclePlus className="size-4" />
					</Button>

					<Button
						variant="ghost"
						size="icon-sm"
						onClick={onHistoryClick}
						className="size-7 p-1.5"
						aria-label="History"
					>
						<History className="size-4" />
					</Button>

					<Button
						variant="ghost"
						size="icon-sm"
						onClick={onShareClick}
						className="size-7 p-1.5"
						aria-label="Share"
					>
						<Share2 className="size-4" />
					</Button>

					<Button
						variant="ghost"
						size="icon-sm"
						onClick={() => selectedTopic && openActionsPopup(selectedTopic)}
						className="size-7 p-1.5"
						aria-label="More options"
					>
						<MoreHorizontal className="size-4" />
					</Button>
				</div>
			</div>
		</header>
	)
}

export default ChatHeader
