import { memo } from "react"
import { IconDots } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { useMemoizedFn } from "ahooks"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/types"
import StatusIcon from "@/pages/superMagic/components/MessageHeader/components/StatusIcon"
import ModeTag from "./components/ModeTag/index"
import { topicStore } from "@/pages/superMagic/stores/core"
import type { TopicItemProps } from "./types"

function TopicItem({ topic, onClose, onOpenActionsPopup }: TopicItemProps) {
	const { t } = useTranslation("super")

	const handleClick = useMemoizedFn(() => {
		// Mobile: Only update selected topic, popup will handle display
		topicStore.setSelectedTopic(topic)
		onClose()
	})

	const handleMenuClick = useMemoizedFn((e: React.MouseEvent) => {
		e.stopPropagation()
		// TODO: Open topic actions menu
		onOpenActionsPopup(topic)
	})

	return (
		<div
			onClick={handleClick}
			className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 transition-colors hover:bg-accent/50 active:bg-accent"
		>
			{/* Status Icon */}
			<StatusIcon status={topic.task_status} size={16} className="shrink-0" />

			{/* Mode Tag */}
			<ModeTag mode={topic.topic_mode || TopicMode.General} />

			{/* Topic Title */}
			<span className="flex-1 truncate text-sm font-normal leading-none text-sidebar-foreground">
				{topic.topic_name || t("topic.unnamedTopic")}
			</span>

			{/* More Actions Button */}
			<button
				onClick={handleMenuClick}
				className="flex size-4 shrink-0 items-center justify-center text-sidebar-foreground/60 transition-colors hover:text-sidebar-foreground"
			>
				<IconDots size={16} />
			</button>
		</div>
	)
}

export default memo(TopicItem)
