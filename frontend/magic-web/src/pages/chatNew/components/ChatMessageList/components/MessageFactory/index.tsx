import { Suspense, useEffect, useState } from "react"
import type {
	ConversationMessage,
	ConversationMessageAttachment,
	ConversationMessageSend,
} from "@/types/chat/conversation_message"
import { ConversationMessageType } from "@/types/chat/conversation_message"
import { observer } from "mobx-react-lite"
import MessageFactory from "./MessageFactory"
import ConversationMessageProvider from "../MessageItem/components/ConversationMessageProvider"
import { createStyles } from "antd-style"
import { autorun } from "mobx"
import AntdSkeleton from "@/components/base/AntdSkeleton"

const useStyles = createStyles(({ token }) => ({
	messageContent: {
		fontSize: token.magicFontUsages.response.text14px,
		width: "auto",
		maxWidth: "100%",
	},
}))

const MessageRenderer = observer(
	({
		type,
		message,
		isSelf,
		messageId,
		aiImageReferFileId,
	}: {
		type: ConversationMessageType
		message: ConversationMessage | ConversationMessageSend["message"]
		isSelf: boolean
		messageId: string
		aiImageReferMessageId?: string
		aiImageReferFileId?: string
	}) => {
		const { styles, cx } = useStyles()
		const [parsedFiles, setParsedFiles] = useState<ConversationMessageAttachment[]>(
			MessageFactory.parseFiles(type, message, aiImageReferFileId) ?? [],
		)

		useEffect(() => {
			return autorun(() => {
				setParsedFiles(MessageFactory.parseFiles(type, message, aiImageReferFileId) ?? [])
			})
		}, [type, message, aiImageReferFileId])

		const MessageComponent = MessageFactory.getComponent(type)

		if (!MessageComponent) {
			return null
		}

		const parsedContent = MessageFactory.parseContent(type, message)
		const parsedReasoningContent = MessageFactory.parseReasoningContent(
			type,
			message as ConversationMessage,
		)
		const isStreaming = MessageFactory.parseIsStreaming(type, message as ConversationMessage)
		const isReasoningStreaming = MessageFactory.parseIsReasoningStreaming(
			type,
			message as ConversationMessage,
		)

		let FileComponent = null
		if (type !== ConversationMessageType.Files) {
			FileComponent = MessageFactory.getFileComponent()
		}

		return (
			<div className={cx(styles.messageContent, "message-content")}>
				<Suspense fallback={<AntdSkeleton.Input active />}>
					<ConversationMessageProvider messageId={messageId}>
						<MessageComponent
							files={parsedFiles}
							content={parsedContent}
							reasoningContent={parsedReasoningContent}
							messageId={messageId}
							isSelf={isSelf}
							isStreaming={isStreaming}
							isReasoningStreaming={isReasoningStreaming}
						/>
						{type !== ConversationMessageType.Files && FileComponent && (
							<FileComponent files={parsedFiles} messageId={messageId} />
						)}
					</ConversationMessageProvider>
				</Suspense>
			</div>
		)
	},
)

export default MessageRenderer
