import ImageWrapper from "@/components/base/MagicImagePreview/components/ImageWrapper"
import { useConversationMessage } from "@/pages/chatNew/components/ChatMessageList/components/MessageItem/components/ConversationMessageProvider/hooks"
import type { ConversationMessageAttachment } from "@/types/chat/conversation_message"
import { createStyles } from "antd-style"
import { memo } from "react"

interface MagicSingleImageProps {
	data: ConversationMessageAttachment
}

const useStyles = createStyles(({ css }) => ({
	container: css`
		border: 1px solid #d9d9d9;
		border-radius: 6px;
		overflow: hidden;
		width: fit-content;
		user-select: none;
	`,
}))

const MagicSingleImage = memo(({ data }: MagicSingleImageProps) => {
	const { styles } = useStyles()
	const { messageId } = useConversationMessage()

	return (
		<ImageWrapper
			containerClassName={styles.container}
			fileId={data.file_id}
			alt={data.file_name}
			messageId={messageId}
			imgExtension={data.file_extension}
			fileSize={data.file_size}
		/>
	)
})

export default MagicSingleImage
