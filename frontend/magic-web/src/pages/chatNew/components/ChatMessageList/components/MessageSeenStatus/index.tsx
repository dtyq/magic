import { MessageReceiveType } from "@/types/chat"
import { resolveToString } from "@dtyq/es6-template-strings"

import { IconEye, IconEyeCheck } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { SendStatus } from "@/types/chat/conversation_message"
import MessageStore from "@/stores/chatNew/message"
import { observer } from "mobx-react-lite"
import ConversationStore from "@/stores/chatNew/conversation"
import StatusContent from "./components/StatusContent"
import useStyles from "../MessageSendStatus/styles"
import { domClassName as GroupSeenPanelDomClassName } from "@/stores/chatNew/groupSeenPanel"

interface MessageStatusProps {
	unreadCount: number
	messageId: string
	// conversation?: Conversation | null
	// status?: ConversationMessageStatus
}

function MessageSeenStatus({ unreadCount, messageId }: MessageStatusProps) {
	const { t } = useTranslation("interface")
	const { styles, cx } = useStyles()
	const { currentConversation } = ConversationStore

	// 自己发送的消息，发送失败，不显示
	if (
		MessageStore.sendStatusMap.get(messageId) &&
		MessageStore.sendStatusMap.get(messageId) !== SendStatus.Success
	) {
		return null
	}

	switch (currentConversation?.receive_type) {
		case MessageReceiveType.Ai:
		case MessageReceiveType.User:
			switch (true) {
				// 优先判断消息状态
				case unreadCount > 0:
					return <StatusContent icon={IconEye} text={t("chat.unread")} />
				case unreadCount === 0:
					return <StatusContent icon={IconEyeCheck} text={t("chat.read")} />
				default:
					return null
			}
		case MessageReceiveType.Group:
			switch (true) {
				case unreadCount === 0:
					return (
						<StatusContent
							icon={IconEyeCheck}
							text={t("chat.allRead")}
							className={cx(styles.group, GroupSeenPanelDomClassName)}
							messageId={messageId}
						/>
					)
				case unreadCount > 0:
					return (
						<StatusContent
							icon={IconEye}
							text={resolveToString(t("chat.unseenCount"), {
								count: unreadCount,
							})}
							messageId={messageId}
							className={cx(styles.group, GroupSeenPanelDomClassName)}
						/>
					)
				default:
					return null
			}
		default:
			return null
	}
}

export default observer(MessageSeenStatus)
