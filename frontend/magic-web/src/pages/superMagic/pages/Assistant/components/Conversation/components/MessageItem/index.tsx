import { Flex } from "antd"
import { cx } from "antd-style"
import type {
	ConversationMessage,
	ConversationMessageSend,
} from "@/types/chat/conversation_message"
import { ConversationMessageType } from "@/types/chat/conversation_message"
import MessageContent from "@/pages/chatNew/components/ChatMessageList/components/MessageItem/components/MessageContent"
import { default as useChatMessageItemStyles } from "@/pages/chatNew/components/ChatMessageList/components/MessageItem/style"
import useInfoStore from "@/stores/userInfo"
import { observer } from "mobx-react-lite"
import { EditMessageOptions } from "@/types/request"
import MessageSendStatus from "@/pages/chatNew/components/ChatMessageList/components/MessageSendStatus"
import RevokeTip from "@/pages/chatNew/components/ChatMessageList/components/RevokeTip"
import { formatTime } from "@/utils/string"
import { useStyles } from "./styles"
import UserAvatarRender from "@/components/business/UserAvatarRender"
import { User } from "@/types/user"
import { useAssistantData } from "../../../DataProvider"

interface MessageItemProps {
	message_id: string
	sender_id: string
	name: string
	avatar: string
	is_self: boolean
	message: ConversationMessage | ConversationMessageSend["message"]
	status?: string
	unread_count?: number
	conversation?: any
	className?: string
	refer_message_id?: string
	revoked?: boolean
	edit_message_options?: EditMessageOptions
}

// 头像独立，避免重复渲染
const Avatar = observer(function Avatar({
	avatar,
	size,
	uid,
}: {
	name: string
	avatar: string
	size: number
	uid: string
}) {
	// 使用 useMemo 缓存 info 对象，避免每次渲染都创建新对象
	const info = useInfoStore.get(uid)
	const { selectedAgent } = useAssistantData()

	return (
		<UserAvatarRender
			userInfo={
				{
					avatar: selectedAgent?.agent_avatar || avatar || info?.avatar_url || "",
				} as User.UserInfo
			}
			size={size}
			style={{
				borderRadius: "50%",
			}}
		/>
	)
})

const timeFormat = (time: number) => {
	const currentYear = new Date().getFullYear()
	const messageYear = new Date(time).getFullYear()

	// If message is from different year, show year
	if (messageYear !== currentYear) {
		return formatTime(time, "YYYY/MM/DD HH:mm")
	}

	// Same year, use current format
	return formatTime(time, "MM/DD HH:mm")
}

const MessageItem = observer(function MessageItem({
	message_id,
	name,
	avatar,
	is_self,
	message,
	className,
	sender_id,
	refer_message_id,
	revoked = false,
	edit_message_options,
}: MessageItemProps) {
	const isBlockMessage = message.type === ConversationMessageType.RecordingSummary
	const { styles: chatMessageItemStyles } = useChatMessageItemStyles({
		fontSize: 16,
		isMultipleCheckedMode: false,
	})
	const { styles } = useStyles()

	// 如果消息被撤回，显示撤回提示
	if (revoked) {
		return <RevokeTip key={message_id} senderUid={sender_id} />
	}

	// 使用 useMemo 缓存头像组件
	const avatarComponent = <Avatar name={name} avatar={avatar} size={24} uid={sender_id} />

	return (
		<div
			// id={message_id}
			className={cx(
				chatMessageItemStyles.flexContainer,
				chatMessageItemStyles.container,
				isBlockMessage && chatMessageItemStyles.blockContainer,
				styles.messageItem,
				className,
			)}
			style={{ justifyContent: is_self ? "flex-end" : "flex-start" }}
			data-message-id={message_id}
		>
			{/* 头像 - 非本人消息显示在左侧 */}
			{!is_self && avatarComponent}

			{/* 消息内容和状态 */}
			<Flex
				vertical
				gap={4}
				className={chatMessageItemStyles.contentWrapper}
				align={is_self ? "flex-end" : "flex-start"}
			>
				<MessageContent
					message_id={message_id}
					message={message}
					edit_message_options={edit_message_options}
					is_self={is_self}
					refer_message_id={refer_message_id}
					name={name}
					timeFormat={timeFormat}
					classNames={{
						messageContent: is_self ? styles.selfMessageContent : undefined,
						messageHeader: styles.messageHeader,
						messageWrapper: styles.messageWrapper,
					}}
					showUserName={!is_self}
				/>
				{is_self && (
					<>
						<MessageSendStatus messageId={message_id} />
					</>
				)}
			</Flex>
		</div>
	)
})

export default MessageItem
