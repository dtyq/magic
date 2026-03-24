import MagicButton from "@/components/base/MagicButton"
import MagicIcon from "@/components/base/MagicIcon"
import { IconDots } from "@tabler/icons-react"
import { useRef } from "react"
import { Flex } from "antd"
import { formatRelativeTime } from "@/utils/string"
import MagicGroupAvatar from "@/components/business/MagicGroupAvatar"
import useGroupInfo from "@/hooks/chat/useGroupInfo"
import { useHover } from "ahooks"
import conversationStore from "@/stores/chatNew/conversation"
import { observer } from "mobx-react-lite"
import type Conversation from "@/models/chat/conversation"
import { useStyles } from "../ConversationItem/styles"
import ConversationBadge from "../ConversationBadge"
import LastMessageRender from "../LastMessageRender"
import { useGlobalLanguage } from "@/models/config/hooks"

interface GroupConversationItemProps {
	conversationId: string
	onClick: (conversation: Conversation) => void
	enableMenu?: boolean
	onMenuToggle?: () => void
	onContextMenu?: (e: React.MouseEvent) => void
	/** 用于 DOM id 前缀，区分列表同 id 重复导致菜单定位错误 */
	domIdPrefix?: string
}

const GroupConversationItem = observer(
	({
		conversationId,
		onClick,
		enableMenu = true,
		onMenuToggle,
		onContextMenu,
		domIdPrefix,
	}: GroupConversationItemProps) => {
		const conversation = conversationStore.getConversation(conversationId)
		const { groupInfo } = useGroupInfo(conversation.receive_id)

		const unreadDots = conversation.unread_dots
		const active = conversationStore.currentConversation?.id === conversationId

		const { styles, cx } = useStyles()
		const ref = useRef<HTMLDivElement>(null)
		const isHover = useHover(ref)

		const lastMessage = conversation.last_receive_message
		const language = useGlobalLanguage(false)

		const handleClick = () => {
			onClick(conversation)
		}

		const handleMenuClick = (e: React.MouseEvent) => {
			e.stopPropagation()
			onMenuToggle?.()
		}

		return (
			<Flex
				id={domIdPrefix ? `${domIdPrefix}-${conversation.id}` : conversation.id}
				ref={ref}
				className={cx(
					styles.container,
					active ? "active" : undefined,
					conversation.is_top ? styles.topFlag : undefined,
				)}
				gap={8}
				align="center"
				onClick={handleClick}
				onContextMenu={onContextMenu}
			>
				<div style={{ flexShrink: 0 }}>
					<ConversationBadge count={unreadDots}>
						<MagicGroupAvatar gid={conversation.receive_id} />
					</ConversationBadge>
				</div>
				<Flex vertical flex={1} justify="space-between" className={styles.mainWrapper}>
					<Flex vertical flex={1}>
						<Flex align="center" justify="space-between" className={styles.top}>
							<span className={styles.title}>{groupInfo?.group_name}</span>
							<span
								className={styles.time}
								style={{ display: isHover ? "none" : "unset" }}
							>
								{formatRelativeTime(language)(
									conversation.last_receive_message_time,
								)}
							</span>
						</Flex>
						<LastMessageRender message={lastMessage} className={styles.content} />
					</Flex>
				</Flex>
				<div
					style={{ display: isHover ? "block" : "none" }}
					className={styles.extra}
					onClick={handleMenuClick}
				>
					{enableMenu && (
						<MagicButton
							type="text"
							className={styles.moreButton}
							icon={<MagicIcon component={IconDots} size={18} />}
							onClick={handleMenuClick}
						/>
					)}
				</div>
			</Flex>
		)
	},
)

export default GroupConversationItem
