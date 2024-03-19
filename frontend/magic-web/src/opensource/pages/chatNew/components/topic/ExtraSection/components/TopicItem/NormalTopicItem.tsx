import MagicIcon from "@/opensource/components/base/MagicIcon"
import { IconMessageTopic } from "@/opensource/enhance/tabler/icons-react"
import { IconDots } from "@tabler/icons-react"
import { Badge, Flex } from "antd"
import { useTranslation } from "react-i18next"
import { useBoolean, useMemoizedFn } from "ahooks"
import chatTopicService from "@/opensource/services/chat/topic"
import type { ConversationTopic } from "@/opensource/types/chat/topic"
import { observer } from "mobx-react-lite"
import ConversationStore from "@/opensource/stores/chatNew/conversation"
import TopicMenu from "../TopicMenu"
import { useTopicItemStyles } from "./useTopicItemStyles"

interface NormalTopicItemProps extends ConversationTopic {
	isActive?: boolean
}

const NormalTopicItemComponent = observer((props: NormalTopicItemProps) => {
	const { isActive = false, ...topic } = props
	const { styles, cx } = useTopicItemStyles()
	const { t } = useTranslation("interface")

	const [menuOpen, { toggle }] = useBoolean(false)

	const onClick = useMemoizedFn(() => {
		chatTopicService.setCurrentConversationTopic(topic.id)
	})

	return (
		<TopicMenu
			open={menuOpen}
			onOpenChange={toggle}
			topic={topic}
			trigger={["contextMenu"]}
			placement="bottomRight"
		>
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
					<MagicIcon component={IconDots} size={20} onClick={toggle} />
				</div>
			</Flex>
		</TopicMenu>
	)
})

export default NormalTopicItemComponent
