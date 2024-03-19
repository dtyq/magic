import { IconChevronDown, IconChevronUp, IconList } from "@tabler/icons-react"
import { ChatItemData } from "../ChatItem"
import { useStyles } from "../../styles"
import MagicIcon from "@/opensource/components/base/MagicIcon"

interface PinnedMessagesProps {
	topChatList: ChatItemData[]
	showPinnedMessages: boolean
	pinnedMessageListHeight: number
	pinnedMessageListRef: React.RefObject<HTMLDivElement>
	onToggle: () => void
	renderChatItem: (item: ChatItemData, index: number) => JSX.Element
}

const OFFSET_TO_HIDDEN_DIV_HEIGHT = 0

function PinnedMessages({
	topChatList,
	showPinnedMessages,
	pinnedMessageListHeight,
	pinnedMessageListRef,
	onToggle,
	renderChatItem,
}: PinnedMessagesProps) {
	const { styles, cx } = useStyles()

	if (topChatList.length === 0) return null

	const hasMessageCount = topChatList.reduce((acc, item) => {
		if (item.unreadCount) {
			return acc + 1
		}

		return acc
	}, 0)

	return (
		<>
			{/* Pinned Messages Content with animated height */}
			<div
				className={cx(styles.pinnedMessageList, "pinnedMessageList")}
				style={{
					// show unread conversation height when hidden
					height: showPinnedMessages ? pinnedMessageListHeight : hasMessageCount * 60,
				}}
			>
				<div
					ref={pinnedMessageListRef}
					className={cx(styles.pinnedMessageListContent)}
					style={{ backgroundColor: "transparent" }}
				>
					{topChatList
						.sort((a, b) => {
							if (a.unreadCount && !b.unreadCount) {
								return -1
							}

							if (!a.unreadCount && b.unreadCount) {
								return 1
							}

							return 0
						})
						.map((item, index) => renderChatItem(item, index))}
				</div>
			</div>

			{/* Sticky Pinned Message Header */}
			<div className={styles.pinnedMessage} onClick={onToggle}>
				<MagicIcon component={IconList} className={styles.pinnedIcon} />
				<span className={styles.pinnedText}>{topChatList.length}个置顶消息</span>
				<MagicIcon
					component={showPinnedMessages ? IconChevronUp : IconChevronDown}
					className={styles.pinnedIcon}
				/>
			</div>
		</>
	)
}

export default PinnedMessages
