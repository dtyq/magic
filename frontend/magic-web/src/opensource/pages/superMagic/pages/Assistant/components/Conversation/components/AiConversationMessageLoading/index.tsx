import { Flex } from "antd"
import type { HTMLAttributes } from "react"
import { useMemo } from "react"
import { getUserName } from "@/opensource/utils/modules/chat"
import TextAnimation from "@/opensource/components/animations/TextAnimation"
import { useTranslation } from "react-i18next"
import useUserInfo from "@/opensource/hooks/chat/useUserInfo"
import { observer } from "mobx-react-lite"
import ConversationStore from "@/opensource/stores/chatNew/conversation"
import SearchAnimation from "@/opensource/components/animations/SearchAnimation"
import useChatMessageStyles from "@/opensource/pages/chatNew/components/ChatMessageList/components/AiConversationMessageLoading/style"
import { useFontSize } from "@/opensource/providers/AppearanceProvider/hooks"
import MessageStore from "@/opensource/stores/chatNew/message"
import UserAvatarRender from "@/opensource/components/business/UserAvatarRender"
import { User } from "@/opensource/types/user"
import { useAssistantData } from "../../../DataProvider"

interface AiConversationMessageLoadingProps extends HTMLAttributes<HTMLDivElement> {
	atBottom?: boolean
	onScrollToBottom?: () => void
}

const AiConversationMessageLoading = observer(
	({ className }: AiConversationMessageLoadingProps) => {
		const { fontSize } = useFontSize()
		const { t } = useTranslation("interface")
		const { selectedAgent } = useAssistantData()

		const { styles, cx } = useChatMessageStyles(
			useMemo(
				() => ({
					self: false,
					fontSize,
					isMultipleCheckedMode: false,
				}),
				[fontSize],
			),
		)

		const { userInfo } = useUserInfo(ConversationStore.currentConversation?.receive_id)

		const currentConversation = ConversationStore.getConversation(MessageStore.conversationId)

		if (!currentConversation?.isAiConversation || !currentConversation?.isReceiveInputting)
			return null

		return (
			<Flex
				className={cx(styles.container, styles.reverse, className)}
				gap={6}
				data-message-id="ai-conversation-message-loading"
				style={{ willChange: "transform" }}
			>
				<UserAvatarRender
					size={24}
					userInfo={
						{
							avatar: selectedAgent?.agent_avatar || userInfo?.avatar_url,
						} as User.UserInfo
					}
					style={{
						borderRadius: "50%",
					}}
				/>
				<Flex vertical className={cx(styles.message)} gap={10}>
					<Flex className={styles.messageTop} gap={12}>
						{/* 用户名称 */}
						<span className={styles.name}>{getUserName(userInfo)}</span>
					</Flex>
					<Flex
						className={cx(styles.contentInnerWrapper, styles.defaultTheme)}
						gap={8}
						align="center"
						style={{
							width: "126px",
						}}
					>
						<SearchAnimation size={20} />
						<TextAnimation dotwaveAnimation gradientAnimation>
							{t("chat.message.BeThinking")}
						</TextAnimation>
					</Flex>
				</Flex>
			</Flex>
		)
	},
)

export default AiConversationMessageLoading
