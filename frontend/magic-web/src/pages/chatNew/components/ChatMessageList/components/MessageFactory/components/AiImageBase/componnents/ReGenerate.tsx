import type { HTMLAttributes } from "react"
import { memo } from "react"
import { useTranslation } from "react-i18next"
import { Popover } from "antd"
import { IconRefresh } from "@tabler/icons-react"
import MagicButton from "@/components/base/MagicButton"
import { useMemoizedFn } from "ahooks"
import {
	ConversationMessageType,
	RichTextConversationMessage,
	TextConversationMessage,
} from "@/types/chat/conversation_message"
import { get, findLast, pick } from "lodash-es"
import { createStyles } from "antd-style"
import { userStore } from "@/models/user"
import MessageStore from "@/stores/chatNew/message"
import useSendMessage from "@/pages/chatNew/hooks/useSendMessage"

const useStyles = createStyles(({ css, token }) => ({
	regenerateButton: css`
		width: 32px;
		padding: 4px;
		border-radius: 10px;
		align-self: flex-end;
		color: ${token.magicColorUsages.text[1]};
	`,
}))

interface RevokeTipProps extends HTMLAttributes<HTMLDivElement> {
	messageId: string
}

const ReGenerate = memo(({ messageId }: RevokeTipProps) => {
	const { t } = useTranslation("interface")

	const { styles } = useStyles()

	const sendMessage = useSendMessage()

	const onReGenerate = useMemoizedFn(() => {
		const messages = MessageStore.messages

		if (!messages || !messages.length) return

		const uid = userStore.user.userInfo?.user_id

		// 获取当前消息之前的文本消息的索引
		const lastTextMessage = findLast(
			messages,
			(msg) => {
				if (msg.message_id === messageId) return false
				const userId = get(msg, ["sender_id"], uid)
				const isSelf = userId === uid
				const { type } = msg.message
				return (
					(type === ConversationMessageType.RichText ||
						type === ConversationMessageType.Text) &&
					isSelf
				)
			},
			messages.findIndex((msg) => messageId === msg.message_id),
		)

		if (!lastTextMessage) return

		switch (lastTextMessage.type) {
			case ConversationMessageType.RichText:
				sendMessage(
					pick(lastTextMessage.message as RichTextConversationMessage, [
						"type",
						"rich_text",
					]),
				)
				break
			case ConversationMessageType.Text:
				sendMessage(
					pick(lastTextMessage.message as TextConversationMessage, ["type", "text"]),
				)
				break
			default:
				break
		}
	})

	return (
		<Popover content={t("chat.aiImage.reGenerate")}>
			<MagicButton onClick={onReGenerate} className={styles.regenerateButton}>
				<IconRefresh size={16} color="currentColor" />
			</MagicButton>
		</Popover>
	)
})

export default ReGenerate
