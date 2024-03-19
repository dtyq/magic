import { ConversationMessageType } from "@/opensource/types/chat/conversation_message"
import { Flex } from "antd"
import { useMemo, type PropsWithChildren } from "react"
import { observer } from "mobx-react-lite"
import ReplyStore from "@/opensource/stores/chatNew/messageUI/Reply"
import MessageTextRender from "../MessageTextRender"
import { useStyles } from "./styles"
import MagicButton from "@/opensource/components/base/MagicButton"
import MessageReplyService from "@/opensource/services/chat/message/MessageReplyService"
import { IconCircleX } from "@tabler/icons-react"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import useUserInfo from "@/opensource/hooks/chat/useUserInfo"
import { getUserName } from "@/opensource/utils/modules/chat"

interface ReferMessageProps extends PropsWithChildren {
	isSelf: boolean
	className?: string
	containerClassName?: string
	onClick?: (e: React.MouseEvent<HTMLDivElement>) => void
}

function MessageReferComponent({
	isSelf,
	className,
	containerClassName,
	onClick,
}: ReferMessageProps) {
	const { styles, cx } = useStyles({ isSelf })
	const referFileId = ReplyStore.replyFile?.fileId
	const referText = ReplyStore.replyFile?.referText
	const referMessage = ReplyStore.replyMessage

	const { userInfo } = useUserInfo(referMessage?.sender_id)

	const userName = useMemo(() => {
		if (!userInfo) return null

		if (referFileId) return null

		return <span className={styles.username}>{getUserName(userInfo)}</span>
	}, [referFileId, styles.username, userInfo])

	if (!referMessage) return null

	if (referMessage.type === ConversationMessageType.AiImage && !referFileId) {
		return null
	}

	return (
		<Flex align="center" justify="space-between" className={containerClassName}>
			<Flex vertical className={cx(styles.container, className)} gap={2} onClick={onClick}>
				{userName}
				<div className={styles.content}>
					<MessageTextRender
						messageId={referMessage.message_id}
						message={referMessage.message}
						aiImageFileId={referFileId}
						referText={referText}
					/>
				</div>
			</Flex>
			<MagicButton
				type="text"
				icon={<MagicIcon size={20} component={IconCircleX} />}
				onClick={MessageReplyService.reset}
			/>
		</Flex>
	)
}

const MessageRefer = observer(MessageReferComponent)

export default MessageRefer
