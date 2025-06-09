import MagicButton from "@/opensource/components/base/MagicButton"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import { IconDots } from "@tabler/icons-react"
import { getUserName } from "@/utils/modules/chat"
import { Flex } from "antd"
import { formatRelativeTime } from "@/utils/string"
import MagicMemberAvatar from "@/opensource/components/business/MagicMemberAvatar"
import useUserInfo from "@/opensource/hooks/chat/useUserInfo"
import { useBoolean } from "ahooks"
import { cx } from "antd-style"
import conversationStore from "@/opensource/stores/chatNew/conversation"
import { observer } from "mobx-react-lite"
import { useMemo } from "react"
import type Conversation from "@/opensource/models/chat/conversation"
import { useStyles } from "../ConversationItem/styles"
import ChatMenu from "../../../ChatMenu"
import ConversationBadge from "../ConversationBadge"
import LastMessageRender from "../LastMessageRender"
import { useGlobalLanguage } from "@/opensource/models/config/hooks"

interface UserConversationItemProps {
	conversationId: string
	onClick: (conversation: Conversation) => void
}

const UserConversationItem = observer(({ conversationId, onClick }: UserConversationItemProps) => {
	const conversation = conversationStore.getConversation(conversationId)
	const { userInfo } = useUserInfo(conversation.receive_id)

	const active = conversationStore.currentConversation?.id === conversationId

	// const onClick = useMemoizedFn(() => {
	// 	conversationService.switchConversation(conversation)
	// })

	const { styles } = useStyles()
	const [contextMenuOpen, { toggle }] = useBoolean(false)

	const lastMessage = conversation.last_receive_message
	const language = useGlobalLanguage(false)

	const Avatar = useMemo(() => {
		return <MagicMemberAvatar uid={userInfo?.user_id} showAvatar showPopover={false} />
	}, [userInfo])

	return (
		<ChatMenu
			open={contextMenuOpen}
			onOpenChange={toggle}
			conversationId={conversationId}
			trigger="contextMenu"
			placement="rightTop"
			key={conversation.id}
		>
			<Flex
				id={conversation.id}
				className={cx(
					styles.container,
					active ? "active" : undefined,
					conversation.is_top ? styles.topFlag : undefined,
				)}
				gap={8}
				align="center"
				onClick={() => onClick(conversation)}
			>
				{/* 头像 */}
				<div style={{ flexShrink: 0 }}>
					<ConversationBadge count={conversation.unread_dots}>{Avatar}</ConversationBadge>
				</div>
				{/* 内容 */}
				<Flex vertical flex={1} justify="space-between" className={styles.mainWrapper}>
					<Flex align="center" justify="space-between" className={styles.top}>
						<span className={styles.title}>{getUserName(userInfo)}</span>
						<span className={styles.time}>
							{formatRelativeTime(language)(conversation.last_receive_message_time)}
						</span>
					</Flex>
					<LastMessageRender message={lastMessage} className={styles.content} />
				</Flex>
				{/* 更多 */}
				<div className={styles.extra} onClick={(e) => e.stopPropagation()}>
					<MagicButton
						type="text"
						className={styles.moreButton}
						onClick={toggle}
						icon={<MagicIcon color="currentColor" component={IconDots} size={18} />}
					/>
				</div>
			</Flex>
		</ChatMenu>
	)
})

export default UserConversationItem
