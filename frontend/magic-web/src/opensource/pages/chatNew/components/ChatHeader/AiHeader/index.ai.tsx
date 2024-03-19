import { Flex } from "antd"
import MagicButton from "@/opensource/components/base/MagicButton"
import type { HTMLAttributes } from "react"
import { getUserName } from "@/opensource/utils/modules/chat"
import { cx } from "antd-style"
import conversationStore from "@/opensource/stores/chatNew/conversation"
import MagicMemberAvatar from "@/opensource/components/business/MagicMemberAvatar"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import { useTranslation } from "react-i18next"
import { useMemoizedFn } from "ahooks"
import useUserInfo from "@/opensource/hooks/chat/useUserInfo"
import { observer } from "mobx-react-lite"
import useCurrentTopic from "@/opensource/pages/chatNew/hooks/useCurrentTopic"
import { IconDots } from "@tabler/icons-react"
import { IconMessageTopic } from "@/opensource/enhance/tabler/icons-react"
import conversationService from "@/opensource/services/chat/conversation/ConversationService"
import type Conversation from "@/opensource/models/chat/conversation"
import useStyles from "../styles"
import MagicAvatar from "@/opensource/components/base/MagicAvatar"

interface HeaderProps extends HTMLAttributes<HTMLDivElement> {
	conversation: Conversation
}

const CurrentTopic = observer(() => {
	const { styles } = useStyles()
	const { t } = useTranslation("interface")

	const currentTopic = useCurrentTopic()

	return (
		<span className={styles.headerTopic}>
			# {currentTopic?.name || t("chat.topic.newTopic")} #
		</span>
	)
})

const AiHeader = observer(({ conversation, className }: HeaderProps) => {
	const { styles } = useStyles()
	const { t } = useTranslation("interface")

	// const imStyle = useAppearanceStore((state) => state.imStyle)
	const { userInfo: conversationUser } = useUserInfo(conversation?.receive_id)

	const { settingOpen, topicOpen } = conversationStore
	const topicIconClick = useMemoizedFn(() => {
		conversationService.updateTopicOpen(conversation, !topicOpen)
	})

	const onSettingClick = useMemoizedFn(() => {
		conversationStore.toggleSettingOpen()
	})

	return (
		<Flex
			gap={8}
			align="center"
			justify="space-between"
			className={cx(styles.header, className)}
		>
			<Flex gap={8} align="center" flex={1}>
				<MagicAvatar src={conversationUser?.avatar_url} size={40}>
					{getUserName(conversationUser)}
				</MagicAvatar>
				<Flex vertical flex={1}>
					<span className={styles.headerTitle}>{getUserName(conversationUser)}</span>
					<CurrentTopic />
				</Flex>
			</Flex>
			<Flex gap={2}>
				<MagicButton
					className={cx({
						[styles.extraSectionButtonActive]: topicOpen,
					})}
					tip={t("chat.topic.topic")}
					type="text"
					icon={<MagicIcon size={20} color="currentColor" component={IconMessageTopic} />}
					onClick={topicIconClick}
				/>
				<MagicButton
					className={cx({
						[styles.extraSectionButtonActive]: settingOpen,
					})}
					tip={t("chat.setting")}
					type="text"
					icon={<MagicIcon size={20} color="currentColor" component={IconDots} />}
					onClick={onSettingClick}
				/>
			</Flex>
		</Flex>
	)
})

export default AiHeader
