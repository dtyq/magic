import { Node } from "@/opensource/pages/superMagic/components/MessageList/components/Nodes"
import { TaskStatus } from "@/opensource/pages/superMagic/pages/Workspace/types"
import { memo, useMemo } from "react"
import { useStyles } from "./style"
import { useTranslation } from "react-i18next"
import { useMemoizedFn } from "ahooks"
import { SuperMagicMessageItem } from "@/opensource/pages/superMagic/components/MessageList/type"
import {
	messagesConverter,
	getMessageNodeKey,
	createCheckIsLastMessage,
} from "@/opensource/pages/superMagic/components/MessageList/helpers"
import { toJS } from "mobx"
import { MessageListProvider } from "@/opensource/pages/superMagic/components/MessageList/context"

function MessageList({
	topicId,
	messageList,
	onSelectDetail,
	currentTopicStatus,
}: {
	topicId: string
	messageList: any[]
	onSelectDetail: (detail: any) => void
	currentTopicStatus: TaskStatus
}) {
	const { styles } = useStyles()
	const { t } = useTranslation("super")

	// useEffect(() => {
	// 	if (Array.isArray(messageList) && topicId) {
	// 		// // 分享页不显示已撤销的消息
	// 		// const _revokedMessageIndex = messageList.findIndex(
	// 		// 	(item: any) => item?.im_status === MessageStatus.REVOKED,
	// 		// )
	// 		// const revokedMessageIndex =
	// 		// 	_revokedMessageIndex !== -1 ? _revokedMessageIndex : messageList.length
	// 		superMagicStore.setShareMessage(topicId, messageList)
	// 	}
	// }, [messageList.length, topicId])

	// const messages = superMagicStore.messages.get(topicId) || []
	const messages = messageList

	const checkIsLastMessage = useMemoizedFn(createCheckIsLastMessage(messagesConverter(messages)))

	const renderList = useMemoizedFn((list: Array<SuperMagicMessageItem>) => {
		return list?.map((node: SuperMagicMessageItem, index: number) => {
			// const nodeType = node?.[node?.type]?.type
			// const NodeComponent = NodeMap?.[nodeType] || Node
			// if (index > 4) {
			// 	return null
			// }
			return (
				<Node
					key={getMessageNodeKey(node)}
					node={node}
					// prevNode={index > 0 ? data[index - 1] : undefined}
					// selectedTopic={selectedTopic}
					// checkIsLastNode={checkIsLastNode}
					onSelectDetail={onSelectDetail}
					isSelected
					currentTopicStatus={TaskStatus.FINISHED}
					role={node?.role || "user"}
					isFirst={list?.[index - 1]?.role === "user"}
					checkIsLastMessage={checkIsLastMessage}
					selectedTopic={null}
					isShare={true}
				/>
			)
		})
	})

	const value = useMemo(() => {
		return {
			allowRevoke: false,
		}
	}, [])

	return (
		<MessageListProvider value={value}>
			<div
				onClick={() =>
					console.log(
						/** keep-console */ "---->",
						toJS(messages),
						messagesConverter(messages),
						messageList,
					)
				}
			>
				{renderList(messagesConverter(messages))}
				{/*{messageList.slice(0, revokedMessageIndex).map((item: any, index: number) => {*/}
				{/*	return (*/}
				{/*		<Node*/}
				{/*			node={item}*/}
				{/*			key={item.message_id}*/}
				{/*			prevNode={index > 0 ? messageList[index - 1] : undefined}*/}
				{/*			onSelectDetail={onSelectDetail}*/}
				{/*			isSelected*/}
				{/*			isShare*/}
				{/*			currentTopicStatus={TaskStatus.FINISHED}*/}
				{/*			checkIsLastNode={(messageId) => {*/}
				{/*				return messageId === messageList[messageList.length - 1].message_id*/}
				{/*			}}*/}
				{/*		/>*/}
				{/*	)*/}
				{/*})}*/}
				{messageList.length > 0 && currentTopicStatus !== TaskStatus.RUNNING && (
					<div className={styles.aiGeneratedTip}>{t("ui.aiGeneratedTip")}</div>
				)}
			</div>
		</MessageListProvider>
	)
}

export default memo(MessageList)
