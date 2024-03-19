import { useTranslation } from "react-i18next"
import { createStyles, cx } from "antd-style"
import { Flex } from "antd"
import MagicButton from "@/opensource/components/base/MagicButton"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import { IconArrowsExchange, IconLogout2 } from "@tabler/icons-react"
import { type HTMLAttributes } from "react"
import { useMemoizedFn } from "ahooks"
import chatTopicService from "@/opensource/services/chat/topic"
import topicStore from "@/opensource/stores/chatNew/topic"
import { observer } from "mobx-react-lite"
import conversationService from "@/opensource/services/chat/conversation/ConversationService"
import ConversationStore from "@/opensource/stores/chatNew/conversation"

const useStyles = createStyles(({ token, css, isDarkMode }) => ({
	container: css`
		width: 100%;
		padding: 4px 10px;
		background-color: ${isDarkMode ? "#141414" : token.magicColorScales.brand[0]};
	`,
	text: css`
		color: ${token.magicColorScales.grey[5]};
		font-size: 14px;
		font-weight: 400;
		line-height: 20px;
	`,
	button: css`
		padding: 0;
		gap: 2px;
		font-size: 14px;
		font-weight: 400;
		line-height: 20px;
	`,
	topic: css`
		margin-left: 4px;
		color: ${token.colorPrimary};
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		flex: 1;
	`,
}))

interface CurrentTopicProps extends HTMLAttributes<HTMLDivElement> {}

/**
 * 当前话题
 * PS: 只存在于单聊/群聊中, AI 聊天不显示
 */
const CurrentTopic = observer(({ className }: CurrentTopicProps) => {
	const { t } = useTranslation("interface")
	const { styles } = useStyles()

	const { currentConversation: conversation } = ConversationStore
	const currentTopic = topicStore.topicList.find((i) => i.id === conversation?.current_topic_id)

	// store fn

	/** 返回聊天模式 */
	const backChatMode = useMemoizedFn(() => {
		if (!currentTopic) return
		chatTopicService.setCurrentConversationTopic(undefined)
	})

	/** 切换话题 */
	const switchTopic = useMemoizedFn(() => {
		if (!currentTopic || !conversation?.id) return
		// FIXME: 切换话题
		conversationService.switchTopic(conversation?.id, currentTopic?.id)
	})

	if (!currentTopic) {
		return null
	}

	return (
		<Flex
			className={cx(styles.container, className)}
			gap={8}
			align="center"
			justify="space-between"
		>
			<Flex align="center" className={styles.text} flex={1}>
				{t("chat.topic.currentTopic")}
				<span className={styles.topic}>
					# {currentTopic?.name || t("chat.topic.newTopic")} #
				</span>
			</Flex>
			<Flex align="center" gap={20}>
				<MagicButton
					className={styles.button}
					type="link"
					icon={
						<MagicIcon color="currentColor" component={IconArrowsExchange} size={20} />
					}
					onClick={switchTopic}
				>
					{t("chat.topic.switchTopic")}
				</MagicButton>
				<MagicButton
					className={styles.button}
					type="link"
					icon={<MagicIcon color="currentColor" component={IconLogout2} size={20} />}
					onClick={backChatMode}
				>
					{t("chat.topic.backChat")}
				</MagicButton>
			</Flex>
		</Flex>
	)
})

export default CurrentTopic
