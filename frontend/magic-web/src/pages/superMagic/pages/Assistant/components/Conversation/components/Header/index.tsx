import topicStore from "@/stores/chatNew/topic"
import ConversationStore from "@/stores/chatNew/conversation"
import { useMemo } from "react"
import { observer } from "mobx-react-lite"
import { computed } from "mobx"
import { useTranslation } from "react-i18next"
import FlexBox from "@/components/base/FlexBox"
import { useStyles } from "./styles"
import MagicButton from "@/components/base/MagicButton"
import { IconHistory, IconMessageCirclePlus } from "@tabler/icons-react"
import MagicIcon from "@/components/base/MagicIcon"
import { useMemoizedFn } from "ahooks"
import chatTopicService from "@/services/chat/topic"
import conversationService from "@/services/chat/conversation/ConversationService"

function Header() {
	const { styles } = useStyles()
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
		<FlexBox gap={16} align="center" justify="space-between" className={styles.container}>
			<div className={styles.topicName}>{topicName}</div>
			<div className={styles.actions}>
				<MagicButton
					className={styles.actionButton}
					icon={<MagicIcon component={IconMessageCirclePlus} size={18} />}
					size="small"
					onClick={onCreateTopic}
				>
					{t("chat.topic.newTopic")}
				</MagicButton>
				<MagicButton
					className={styles.actionButton}
					icon={<MagicIcon component={IconHistory} size={18} />}
					size="small"
					onClick={openTopicHistory}
				>
					{t("chat.topic.historyTopic")}
				</MagicButton>
			</div>
		</FlexBox>
	)
}

export default observer(Header)
