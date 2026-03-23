import MagicIcon from "@/components/base/MagicIcon"
import { IconMessageTopic } from "@/enhance/tabler/icons-react"
import { IconDots } from "@tabler/icons-react"
import { Badge, Flex } from "antd"
import { useTranslation } from "react-i18next"
import { useMemoizedFn } from "ahooks"
import chatTopicService from "@/services/chat/topic"
import type { ConversationTopic } from "@/types/chat/topic"
import { observer } from "mobx-react-lite"
import ConversationStore from "@/stores/chatNew/conversation"
import TopicMenu from "../TopicMenu"
import { useTopicItemStyles } from "./useTopicItemStyles"

interface NormalTopicItemProps extends ConversationTopic {
	isActive?: boolean
}

const NormalTopicItemComponent = observer((props: NormalTopicItemProps) => {
	const { isActive = false, ...topic } = props
	const { styles, cx } = useTopicItemStyles()
	const { t } = useTranslation("interface")

	const onClick = useMemoizedFn(() => {
		chatTopicService.setCurrentConversationTopic(topic.id)
	})

	return (
		<TopicMenu topic={topic} trigger={["contextMenu"]} placement="bottomRight">
			<Flex
				align="center"
				justify="space-between"
				className={cx(styles.container, isActive && styles.active)}
				onClick={onClick}
				gap={4}
			>
				<Badge
					count={
						ConversationStore.currentConversation?.topic_unread_dots.get(topic.id) ?? 0
					}
					style={{ flex: 0 }}
				>
					<MagicIcon component={IconMessageTopic} size={24} />
				</Badge>
				<span className={styles.topicTitle}>{topic.name || t("chat.topic.newTopic")}</span>
				<div className={styles.menu} onClick={(e) => e.stopPropagation()}>
					<TopicMenu topic={topic} trigger={["click"]} placement="bottomRight">
						<button className={styles.menuButton} type="button">
							<MagicIcon component={IconDots} size={20} />
						</button>
					</TopicMenu>
				</div>
			</Flex>
		</TopicMenu>
	)
})

export default NormalTopicItemComponent
