import { SimpleModeGuide } from "@/pages/superMagic/components/MessageHeader/components/SimpleModeGuide"
import { Button } from "@/components/shadcn-ui/button"
import StatusIcon from "@/pages/superMagic/components/MessageHeader/components/StatusIcon"
import { Topic } from "@/pages/superMagic/pages/Workspace/types"
import { Files, History, MessageCirclePlus, MoreHorizontal, Share2 } from "lucide-react"
import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { observer } from "mobx-react-lite"

interface ChatHeaderProps {
	enableSimpleMode?: boolean
	selectedTopic: Topic | null
	openActionsPopup: (topic: Topic) => void
	onNewTopicClick?: () => void
	onHistoryClick?: () => void
	onFilesClick?: () => void
	onShareClick?: () => void
}

function ChatHeader({
	selectedTopic,
	enableSimpleMode = false,
	openActionsPopup,
	onNewTopicClick,
	onHistoryClick,
	onFilesClick,
	onShareClick,
}: ChatHeaderProps) {
	const { t } = useTranslation("super")
	// Store last selected topic for back navigation
	const lastSelectedTopic = useRef<Topic | null>(null)
	const simpleModeAnchorRef = useRef<HTMLSpanElement>(null)

	useEffect(() => {
		if (selectedTopic) {
			lastSelectedTopic.current = selectedTopic
		}
	}, [selectedTopic])

	const currentTopic = selectedTopic || lastSelectedTopic.current

	return (
		<header
			className="border-b border-border bg-mobile-background"
			data-testid="topic-chat-header"
		>
			{/* Navigation Bar */}
			<div
				className="flex h-12 items-center justify-between gap-2 p-2.5"
				data-testid="topic-chat-header-bar"
			>
				{/* Left: Back Button + Topic Info */}
				<div
					className="flex min-w-0 flex-1 items-center gap-1"
					data-testid="topic-chat-header-info"
				>
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
					{onNewTopicClick ? (
						<Button
							variant="ghost"
							size="icon-sm"
							onClick={onNewTopicClick}
							className="size-7 p-1.5"
							aria-label="New topic"
							data-testid="topic-chat-new-topic-button"
						>
							<MessageCirclePlus className="size-4" />
						</Button>
					) : null}

					<Button
						variant="ghost"
						size="icon-sm"
						onClick={onHistoryClick}
						className="size-7 p-1.5"
						aria-label="History"
						data-testid="topic-chat-history-button"
					>
						<History className="size-4" />
					</Button>

					<Button
						variant="ghost"
						size="icon-sm"
						onClick={onFilesClick}
						className="size-7 p-1.5"
						aria-label={t("topicFiles.title")}
						data-testid="topic-chat-files-button"
					>
						<Files className="size-4" />
					</Button>

					<Button
						variant="ghost"
						size="icon-sm"
						onClick={onShareClick}
						className="size-7 p-1.5"
						aria-label="Share"
						data-testid="topic-chat-share-button"
					>
						<Share2 className="size-4" />
					</Button>

					<Button
						variant="ghost"
						size="icon-sm"
						onClick={() => selectedTopic && openActionsPopup(selectedTopic)}
						className="size-7 p-1.5"
						aria-label="More options"
						data-testid="topic-chat-more-button"
					>
						<span ref={simpleModeAnchorRef} className="inline-flex size-4">
							<MoreHorizontal className="size-4" />
						</span>
					</Button>
					<SimpleModeGuide
						anchorRef={simpleModeAnchorRef}
						available={enableSimpleMode && Boolean(selectedTopic)}
					/>
				</div>
			</div>
		</header>
	)
}

export default observer(ChatHeader)
