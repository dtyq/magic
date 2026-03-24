import MagicButton from "@/components/base/MagicButton"
import MagicIcon from "@/components/base/MagicIcon"
import { IconDots } from "@tabler/icons-react"
import { getUserName } from "@/utils/modules/chat"
import { Flex } from "antd"
import { formatRelativeTime } from "@/utils/string"
import MagicMemberAvatar from "@/components/business/MagicMemberAvatar"
import { cx } from "antd-style"
import conversationStore from "@/stores/chatNew/conversation"
import { observer } from "mobx-react-lite"
import type Conversation from "@/models/chat/conversation"
import { useStyles } from "../ConversationItem/styles"
import ConversationBadge from "../ConversationBadge"
import LastMessageRender from "../LastMessageRender"
import { useGlobalLanguage } from "@/models/config/hooks"
import userInfoStore from "@/stores/userInfo"

interface UserConversationItemProps {
	conversationId: string
	onClick: (conversation: Conversation) => void
	enableMenu?: boolean
	onMenuToggle?: () => void
	onContextMenu?: (e: React.MouseEvent) => void
	/** 用于 DOM id 前缀，避免 Message / AiBots 列表同 id 重复导致菜单定位错误 */
	domIdPrefix?: string
}

const UserConversationItem = observer(
	({
		conversationId,
		onClick,
		enableMenu = true,
		onMenuToggle,
		onContextMenu,
		domIdPrefix,
	}: UserConversationItemProps) => {
		const conversation = conversationStore.getConversation(conversationId)
		const userInfo = userInfoStore.get(conversation.receive_id)

		const active = conversationStore.currentConversation?.id === conversationId

		const { styles } = useStyles()

		const lastMessage = conversation.last_receive_message
		const language = useGlobalLanguage(false)

		const Avatar = <MagicMemberAvatar uid={userInfo?.user_id} showAvatar showPopover={false} />

		const handleMenuClick = (e: React.MouseEvent) => {
			e.stopPropagation()
			onMenuToggle?.()
		}

		return (
			<Flex
				id={domIdPrefix ? `${domIdPrefix}-${conversation.id}` : conversation.id}
				className={cx(
					styles.container,
					active ? "active" : undefined,
					conversation.is_top ? styles.topFlag : undefined,
				)}
				gap={8}
				align="center"
				onClick={() => onClick(conversation)}
				onContextMenu={onContextMenu}
			>
				{/* 头像 */}
				<ConversationBadge count={conversation.unread_dots}>{Avatar}</ConversationBadge>
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
				<div className={styles.extra} onClick={handleMenuClick}>
					{enableMenu && (
						<MagicButton
							type="text"
							className={styles.moreButton}
							onClick={handleMenuClick}
							icon={<MagicIcon color="currentColor" component={IconDots} size={18} />}
						/>
					)}
				</div>
			</Flex>
		)
	},
)

export default UserConversationItem
