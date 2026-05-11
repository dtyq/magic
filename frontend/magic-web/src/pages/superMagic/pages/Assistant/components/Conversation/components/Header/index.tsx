import topicStore from "@/stores/chatNew/topic"
import ConversationStore from "@/stores/chatNew/conversation"
import { useMemo } from "react"
import { observer } from "mobx-react-lite"
import { computed } from "mobx"
import { useTranslation } from "react-i18next"
import { History, MessageCirclePlus } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { useMemoizedFn } from "ahooks"
import chatTopicService from "@/services/chat/topic"
import conversationService from "@/services/chat/conversation/ConversationService"
import { cn } from "@/lib/utils"

const headerRootClass = cn(
	"flex h-full items-center justify-between gap-4 px-3",
	"backdrop-blur-[50px]",
)

const topicNameClass = cn(
	"min-w-0 flex-1 overflow-hidden text-ellipsis text-sm font-normal leading-5 text-foreground/80",
)

const actionsClass = "flex shrink-0 items-center gap-2"

const headerActionButtonClass = cn(
	"gap-1 text-xs font-normal text-foreground/80",
	"hover:bg-fill hover:text-foreground",
	"active:bg-fill-secondary",
)

function Header() {
	const { t } = useTranslation("interface")
	const { currentConversation, topicOpen } = ConversationStore

	const currentTopicId = currentConversation?.current_topic_id

	const topicName = useMemo(() => {
		return computed(() => {
			if (!currentTopicId) return ""
			return topicStore.getTopicName(currentTopicId) || t("chat.topic.newTopic")
		}).get()
	}, [currentTopicId, t])

	const onCreateTopic = useMemoizedFn(() => {
		chatTopicService.createTopic()
	})

	const openTopicHistory = useMemoizedFn(() => {
		if (!currentConversation) return
		conversationService.updateTopicOpen(currentConversation, !topicOpen)
	})

	return (
		<div className={headerRootClass}>
			<div className={topicNameClass}>{topicName}</div>
			<div className={actionsClass}>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className={headerActionButtonClass}
					onClick={onCreateTopic}
				>
					<MessageCirclePlus className="size-[18px] shrink-0" />
					{t("chat.topic.newTopic")}
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className={headerActionButtonClass}
					onClick={openTopicHistory}
				>
					<History className="size-[18px] shrink-0" />
					{t("chat.topic.historyTopic")}
				</Button>
			</div>
		</div>
	)
}

export default observer(Header)
