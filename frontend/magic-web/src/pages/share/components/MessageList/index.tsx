import { Node } from "@/pages/superMagic/components/MessageList/components/Nodes"
import { TaskStatus } from "@/pages/superMagic/pages/Workspace/types"
import { memo, useMemo } from "react"
import { useStyles } from "./style"
import { useTranslation } from "react-i18next"
import { useMemoizedFn } from "ahooks"
import { SuperMagicMessageItem } from "@/pages/superMagic/components/MessageList/type"
import {
	messagesConverter,
	createCheckIsLastMessage,
} from "@/pages/superMagic/components/MessageList/helpers"
import { buildMessageKeysAndTurnGroups } from "@/pages/superMagic/components/MessageList/message-turn-groups"
import { MessageTurnGroupList } from "@/pages/superMagic/components/MessageList/MessageTurnGroupList"
import { MessageListProvider } from "@/pages/superMagic/components/MessageList/context"
import { useIsMobile } from "@/hooks/useIsMobile"

function MessageList({
	messageList,
	onSelectDetail,
	currentTopicStatus,
	stickyMessageClassName,
}: {
	topicId: string
	messageList: any[]
	onSelectDetail: (detail: any) => void
	currentTopicStatus: TaskStatus
	/**
	 * Sticky user-turn mask. Default uses sidebar rgb. Override via:
	 * `[--sticky-message-mask-bg:rgb(var(--background-rgb))]
	 *  [--sticky-message-mask-fade-from:rgb(var(--background-rgb))]`
	 */
	stickyMessageClassName?: string
}) {
	const { styles } = useStyles()
	const { t } = useTranslation("super")
	const isMobile = useIsMobile()

	const messages = messageList

	const convertedMessages = useMemo(
		() => messagesConverter(messages) as Array<SuperMagicMessageItem>,
		[messages],
	)

	const { messageTurnGroups } = useMemo(
		() => buildMessageKeysAndTurnGroups(convertedMessages),
		[convertedMessages],
	)

	const checkIsLastMessage = useMemoizedFn(createCheckIsLastMessage(convertedMessages))

	const value = useMemo(() => {
		return {
			allowRevoke: false,
		}
	}, [])

	return (
		<MessageListProvider value={value}>
			<div className="flex flex-col gap-2">
				<MessageTurnGroupList
					groups={messageTurnGroups}
					isMobile={isMobile}
					stickyMessageClassName={stickyMessageClassName}
					renderNode={({ node, index }) => (
						<Node
							node={node}
							onSelectDetail={onSelectDetail}
							isSelected
							currentTopicStatus={TaskStatus.FINISHED}
							role={node?.role || "user"}
							isFirst={convertedMessages?.[index - 1]?.role === "user"}
							checkIsLastMessage={checkIsLastMessage}
							selectedTopic={null}
							isShare={true}
						/>
					)}
				/>
				{messageList.length > 0 && currentTopicStatus !== TaskStatus.RUNNING && (
					<div className={styles.aiGeneratedTip}>{t("ui.aiGeneratedTip")}</div>
				)}
			</div>
		</MessageListProvider>
	)
}

export default memo(MessageList)
