import MagicButton from "@/opensource/components/base/MagicButton"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import { IconDots } from "@tabler/icons-react"
import { useRef } from "react"
import { Flex } from "antd"
import { formatRelativeTime } from "@/utils/string"
import MagicGroupAvatar from "@/opensource/components/business/MagicGroupAvatar"
import useGroupInfo from "@/opensource/hooks/chat/useGroupInfo"
import { useBoolean, useHover } from "ahooks"
import conversationStore from "@/opensource/stores/chatNew/conversation"
import { observer } from "mobx-react-lite"
import type Conversation from "@/opensource/models/chat/conversation"
import ChatMenu from "../../../ChatMenu"
import { useStyles } from "../ConversationItem/styles"
import ConversationBadge from "../ConversationBadge"
import LastMessageRender from "../LastMessageRender"
import { useGlobalLanguage } from "@/opensource/models/config/hooks"

interface GroupConversationItemProps {
	conversationId: string
	onClick: (conversation: Conversation) => void
}

const GroupConversationItem = observer(
	({ conversationId, onClick }: GroupConversationItemProps) => {
		const conversation = conversationStore.getConversation(conversationId)
		const { groupInfo } = useGroupInfo(conversation.receive_id)

		const unreadDots = conversation.unread_dots
		const active = conversationStore.currentConversation?.id === conversationId

		const { styles, cx } = useStyles()
		const ref = useRef<HTMLDivElement>(null)
		const isHover = useHover(ref)

		// const onClick = useMemoizedFn(() => {
		// 	conversationService.switchConversation(conversation)
		// })

		const [contextMenuOpen, { toggle }] = useBoolean(false)

		const lastMessage = conversation.last_receive_message
		const language = useGlobalLanguage(false)

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
					ref={ref}
					className={cx(
						styles.container,
						active ? "active" : undefined,
						conversation.is_top ? styles.topFlag : undefined,
					)}
					gap={8}
					align="center"
					onClick={() => onClick(conversation)}
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
						onClick={(e) => e.stopPropagation()}
					>
						<MagicButton
							type="text"
							className={styles.moreButton}
							icon={<MagicIcon component={IconDots} size={18} />}
							onClick={toggle}
						/>
					</div>
				</Flex>
			</ChatMenu>
		)
	},
)

export default GroupConversationItem
