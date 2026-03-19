import { SwipeAction } from "antd-mobile"
import MagicAvatar from "@/components/base/MagicAvatar"
import { useMemo } from "react"
import { IconDots, IconPin, IconTrash } from "@tabler/icons-react"
import FlexBox from "@/components/base/FlexBox"
import MagicIcon from "@/components/base/MagicIcon"
import MagicBadge from "@/components/base/MagicBadge"
import { useStyles } from "./styles"
import { ChatItemData } from "./type"
import { observer } from "mobx-react-lite"
import ConversationStore from "@/stores/chatNew/conversation"
import { cn } from "@/lib/utils"

interface ChatItemProps {
	data: ChatItemData
	onClick?: () => void
	onMoreClick?: () => void
	onPinClick?: () => void
	onDeleteClick?: () => void
	className?: string
}

const ChatItem = observer(function ChatItem({
	data,
	onClick,
	onMoreClick,
	onPinClick,
	onDeleteClick,
	className,
}: ChatItemProps) {
	const { styles } = useStyles()

	const conversation = ConversationStore.getConversation(data.id)

	const rightActions = useMemo(
		() => [
			{
				key: "more",
				text: (
					<FlexBox
						vertical
						align="center"
						justify="center"
						gap={2}
						className={styles.swipeActionText}
					>
						<MagicIcon component={IconDots} color="currentColor" size={18} />
						更多
					</FlexBox>
				),
				color: "warning",
				onClick: onMoreClick,
			},
			{
				key: "pin",
				text: (
					<FlexBox
						vertical
						align="center"
						justify="center"
						gap={2}
						className={styles.swipeActionText}
					>
						<MagicIcon component={IconPin} color="currentColor" size={18} />
						{conversation?.is_top ? "取消置顶" : "置顶"}
					</FlexBox>
				),
				color: "primary",
				onClick: onPinClick,
			},
			{
				key: "delete",
				text: (
					<FlexBox
						vertical
						align="center"
						justify="center"
						gap={2}
						className={styles.swipeActionText}
					>
						<MagicIcon component={IconTrash} color="currentColor" size={18} />
						移除
					</FlexBox>
				),
				color: "danger",
				onClick: onDeleteClick,
			},
		],
		[conversation?.is_top, onDeleteClick, onMoreClick, onPinClick, styles.swipeActionText],
	)

	return (
		<SwipeAction className={cn(styles.swipeAction, className)} rightActions={rightActions}>
			<div className={styles.chatItem} onClick={onClick}>
				<MagicBadge count={data.unreadCount} className={styles.chatItemBadge}>
					<MagicAvatar size={40} src={data.avatar}>
						{data.name}
					</MagicAvatar>
				</MagicBadge>
				<div className={styles.chatItemContent}>
					<div className={styles.chatItemHeader}>
						<span className={styles.chatItemName}>{data.name}</span>
						<span className={styles.chatItemTime}>{data.time}</span>
					</div>
					<div className={styles.chatItemMessage}>{data.message}</div>
				</div>
			</div>
		</SwipeAction>
	)
})

export default ChatItem
export type { ChatItemData }
