import { useMemo } from "react"
import { Flex } from "antd"
import { cx } from "antd-style"
import type {
	AIImagesMessage,
	ConversationMessage,
	ConversationMessageSend,
	RichTextConversationMessage,
	TextConversationMessage,
} from "@/opensource/types/chat/conversation_message"
import {
	AIImagesDataType,
	ConversationMessageType,
} from "@/opensource/types/chat/conversation_message"
import { DomClassName } from "@/opensource/constants/dom"
import MessageStore from "@/opensource/stores/chatNew/message"
import { observer } from "mobx-react-lite"
import { useFontSize } from "@/opensource/providers/AppearanceProvider/hooks"
import MessageFactory from "../../../MessageFactory"
import { useStyles } from "./style"
import MessageHeader from "./MessageHeader"
import MessageTextRender from "../../../MessageTextRender"
import { useTranslation } from "react-i18next"
import { EditMessageOptions } from "@/opensource/types/request"
import ReGenerate from "../../../MessageFactory/components/AiImageBase/componnents/ReGenerate"
import ConversationStore from "@/opensource/stores/chatNew/conversation"
import userInfoStore from "@/opensource/stores/userInfo"
import { computed } from "mobx"
import { getUserName } from "@/opensource/utils/modules/chat"
import { useIsMobile } from "@/opensource/hooks/useIsMobile"
import MobileMessageMenu from "@/opensource/pages/chatMobile/components/CurrentConversation/components/MessageMenu"
import { isUndefined } from "lodash-es"

// import EmojiItem from "../EmojiItem"

// import RichText from "../../../MessageFactory/components/RichText"

interface MessageContentProps {
	message_id: string
	message: ConversationMessage | ConversationMessageSend["message"]
	is_self: boolean
	name: string
	refer_message_id?: string
	edit_message_options?: EditMessageOptions
	timeFormat?: (time: number) => string
	classNames?: {
		messageContent?: string
		messageHeader?: string
		messageWrapper?: string
	}
	showUserName?: boolean
}

type MessageReferContentProps = {
	referMessageId?: string
	aiImageFileId?: string
}

const MessageReferContent = observer(
	({ referMessageId, aiImageFileId }: MessageReferContentProps) => {
		const { fontSize } = useFontSize()
		const isMobile = useIsMobile()
		const { styles } = useStyles({ fontSize, isMobile })

		const message = useMemo(() => {
			return referMessageId ? MessageStore.getMessage(referMessageId) : undefined
		}, [referMessageId])

		const user = useMemo(() => {
			return computed(() => {
				if (!message) return undefined
				return userInfoStore.get(message?.sender_id)
			})
		}, [message]).get()

		const { currentConversation } = ConversationStore

		if (!message) return null
		return (
			<div className={styles.referContent}>
				{currentConversation?.isGroupConversation && user && (
					<div className={styles.referUserName}>{getUserName(user)}</div>
				)}
				<MessageTextRender
					messageId={referMessageId}
					message={message.message}
					aiImageFileId={aiImageFileId}
				/>
			</div>
		)
	},
)

const MessageEditStatus = ({ options }: { options?: EditMessageOptions }) => {
	const { t } = useTranslation("interface")
	const { fontSize } = useFontSize()
	const isMobile = useIsMobile()
	const { styles } = useStyles({ fontSize, isMobile })

	if (!options) return null

	return <div className={styles.editStatus}>{t("chat.message.edited")}</div>
}

const MessageContent = observer(
	({
		message_id,
		message,
		is_self,
		name,
		refer_message_id,
		edit_message_options,
		timeFormat,
		classNames,
		showUserName: showUserNameProp,
	}: MessageContentProps) => {
		const { fontSize } = useFontSize()
		const isMobile = useIsMobile()
		const { t } = useTranslation("interface")

		const { styles } = useStyles({ fontSize, isMobile })

		const aiImageReferMsgId = useMemo(() => {
			return message?.type === ConversationMessageType.AiImage ||
				message?.type === ConversationMessageType.HDImage
				? refer_message_id
				: ""
		}, [message, refer_message_id])

		const aiImageReferFileId = useMemo(() => {
			if (
				aiImageReferMsgId &&
				[ConversationMessageType.Text, ConversationMessageType.RichText].includes(
					message?.type as ConversationMessageType,
				)
			) {
				if (
					message?.type === ConversationMessageType.RichText &&
					(message as RichTextConversationMessage)?.rich_text?.attachments?.length
				) {
					return (message as RichTextConversationMessage)?.rich_text?.attachments?.[0]
						?.file_id
				}

				if (
					message?.type === ConversationMessageType.Text &&
					(message as TextConversationMessage)?.text?.attachments?.length
				) {
					return (message as TextConversationMessage)?.text?.attachments?.[0]?.file_id
				}
			}
			return undefined
		}, [message, aiImageReferMsgId])

		const showUserName = useMemo(() => {
			if (isUndefined(showUserNameProp)) {
				if (ConversationStore.currentConversation?.isGroupConversation) {
					return !is_self
				}
				return false
			}
			return showUserNameProp
		}, [showUserNameProp, is_self])

		return (
			<Flex
				vertical
				gap={4}
				align={is_self ? "flex-end" : "flex-start"}
				className={cx(styles.contentWrapper, classNames?.messageWrapper)}
			>
				{/* 发送时间和用户名 */}
				<MessageHeader
					isSelf={is_self}
					name={name}
					sendTime={message.send_time}
					timeFormat={timeFormat}
					showUserName={showUserName}
					className={classNames?.messageHeader}
				/>
				{/* 消息气泡 */}
				<Flex gap={4} className={cx(is_self ? styles.selfMessage : styles.otherMessage)}>
					<div
						className={cx(
							styles.content,
							is_self ? styles.selfMessageStyle : styles.otherMessageStyle,
							DomClassName.MESSAGE_ITEM,
							classNames?.messageContent,
						)}
						data-ai-generated={t("chat.message.aiGenerated")}
					>
						{refer_message_id && (
							<MessageReferContent
								referMessageId={refer_message_id}
								aiImageFileId={aiImageReferFileId}
							/>
						)}
						{isMobile ? (
							<MobileMessageMenu messageId={message_id}>
								<MessageFactory
									type={message.type as ConversationMessageType}
									message={message}
									isSelf={is_self}
									messageId={message_id}
									aiImageReferMessageId={aiImageReferMsgId}
									aiImageReferFileId={aiImageReferFileId}
								/>
							</MobileMessageMenu>
						) : (
							<MessageFactory
								type={message.type as ConversationMessageType}
								message={message}
								isSelf={is_self}
								messageId={message_id}
								aiImageReferMessageId={aiImageReferMsgId}
								aiImageReferFileId={aiImageReferFileId}
							/>
						)}
						{is_self && <MessageEditStatus options={edit_message_options} />}
					</div>
					{message.type === ConversationMessageType.AiImage &&
						(message as AIImagesMessage)?.ai_image_card?.type ===
							AIImagesDataType.GenerateComplete && (
							<ReGenerate messageId={message_id} />
						)}
				</Flex>
			</Flex>
		)
	},
)

export default MessageContent
