import { useMemo } from "react"
import { Flex } from "antd"
import { cx } from "antd-style"
import type {
	ConversationMessage,
	ConversationMessageSend,
} from "@/types/chat/conversation_message"
import { ConversationMessageType } from "@/types/chat/conversation_message"
import { calculateRelativeSize } from "@/utils/styles"
import { getAvatarUrl } from "@/utils/avatar"
import { useFontSize } from "@/providers/AppearanceProvider/hooks"
import MessageContent from "./components/MessageContent"
import MessageSeenStatus from "../MessageSeenStatus"
import MessageSendStatus from "../MessageSendStatus"
import useStyles from "./style"
import MemberCardStore from "@/stores/display/MemberCardStore"
import useInfoStore from "@/stores/userInfo"
import { useMemoizedFn } from "ahooks"
import { getUserName } from "@/utils/modules/chat"
import { observer } from "mobx-react-lite"
import RevokeTip from "../RevokeTip"
import { EditMessageOptions } from "@/types/request"
import { useIsMobile } from "@/hooks/useIsMobile"
import useNavigate from "@/routes/hooks/useNavigate"
import { navigateToUserDetail } from "@/pages/mobile/user-detail/utils"
import userAvatarIcon from "@/assets/logos/user-avatar.svg"
import AvatarService from "@/services/chat/avatar"

interface MessageItemProps {
	message_id: string
	sender_id: string
	name: string
	avatar: string
	is_self: boolean
	message: ConversationMessage | ConversationMessageSend["message"]
	status?: string
	unread_count?: number
	conversation?: Record<string, unknown>
	className?: string
	refer_message_id?: string
	revoked?: boolean
	edit_message_options?: EditMessageOptions
}

const getTextAvatar = (text: string, backgroundColor?: string, color?: string) => {
	const textString = typeof text === "string" ? text : ""
	if (textString === "") {
		return userAvatarIcon
	}
	return AvatarService.drawTextAvatar(textString, backgroundColor, color) ?? ""
}

// 头像独立，避免重复渲染
const Avatar = observer(function Avatar({
	name,
	avatar,
	size,
	uid,
}: {
	name: string
	avatar: string
	size: number
	uid: string
}) {
	const { styles } = useStyles({ fontSize: 16, isMultipleCheckedMode: false })
	const userInfo = useInfoStore.get(uid)
	const isMobile = useIsMobile()
	const navigate = useNavigate()

	// 使用 useMemo 缓存 info 对象，避免每次渲染都创建新对象
	const info = useMemo(() => {
		if (avatar) {
			return { name, avatar_url: getAvatarUrl(avatar, size) }
		}

		return {
			name: getUserName(userInfo),
			avatar_url: userInfo?.avatar_url
				? getAvatarUrl(userInfo?.avatar_url, size)
				: getTextAvatar(getUserName(userInfo)),
		}
	}, [avatar, name, size, userInfo])

	const handleAvatarClick = useMemoizedFn((e) => {
		if (e) {
			MemberCardStore.openCard(uid, { x: e.clientX, y: e.clientY })
			if (isMobile) {
				navigateToUserDetail(uid, navigate)
			}
		}
		e.stopPropagation()
		e.preventDefault()
	})

	return (
		<img
			className={styles.avatar}
			src={info.avatar_url}
			style={{
				width: size,
				height: size,
			}}
			onClick={handleAvatarClick}
		/>
	)
})

const MessageItem = observer(function MessageItem({
	message_id,
	name,
	avatar,
	is_self,
	message,
	unread_count,
	className,
	sender_id,
	refer_message_id,
	revoked = false,
	edit_message_options,
}: MessageItemProps) {
	const { fontSize } = useFontSize()
	const isBlockMessage = message.type === ConversationMessageType.RecordingSummary
	const { styles } = useStyles({ fontSize: 16, isMultipleCheckedMode: false })

	// 使用 useMemo 缓存头像大小
	const avatarSize = useMemo(() => calculateRelativeSize(40, fontSize), [fontSize])

	// 如果消息被撤回，显示撤回提示
	if (revoked) {
		return <RevokeTip key={message_id} senderUid={sender_id} />
	}

	// 使用 useMemo 缓存头像组件
	const avatarComponent = <Avatar name={name} avatar={avatar} size={avatarSize} uid={sender_id} />

	return (
		<div
			// id={message_id}
			className={cx(
				styles.flexContainer,
				styles.container,
				isBlockMessage && styles.blockContainer,
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
				className={styles.contentWrapper}
				align={is_self ? "flex-end" : "flex-start"}
			>
				<MessageContent
					message_id={message_id}
					message={message}
					edit_message_options={edit_message_options}
					is_self={is_self}
					refer_message_id={refer_message_id}
					name={name}
				/>
				{is_self && (
					<>
						<MessageSeenStatus unreadCount={unread_count ?? 0} messageId={message_id} />
						<MessageSendStatus messageId={message_id} />
					</>
				)}
			</Flex>

			{/* 头像 - 本人消息显示在右侧 */}
			{is_self && avatarComponent}
		</div>
	)
})

export default MessageItem
