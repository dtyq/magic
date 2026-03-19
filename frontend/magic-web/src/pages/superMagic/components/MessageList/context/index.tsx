import { Topic } from "@/pages/superMagic/pages/Workspace/types"
import { createContext, PropsWithChildren, useContext } from "react"

interface MessageListContextState {
	/** 是否允许撤回 */
	allowRevoke?: boolean
	/** 是否允许用户消息复制 */
	allowUserMessageCopy?: boolean
	/** 是否允许创建定时任务 */
	allowScheduleTaskCreate?: boolean
	/** 是否允许悬浮消息节点显示时间 */
	allowMessageTooltip?: boolean
	/** 是否允许话题会话记录复制至新话题 */
	allowConversationCopy?: boolean
	/** 切换当前话题 */
	onTopicSwitch?: (topic: Topic) => void
}

const MessageListContext = createContext<MessageListContextState>({
	allowRevoke: false,
	allowUserMessageCopy: false,
	allowScheduleTaskCreate: false,
	allowMessageTooltip: false,
	allowConversationCopy: false,
	onTopicSwitch: undefined,
})

export function useMessageListContext(): MessageListContextState {
	return useContext(MessageListContext)
}

export function MessageListProvider(props: PropsWithChildren<{ value: MessageListContextState }>) {
	const { value, children } = props
	return <MessageListContext.Provider value={value}>{children}</MessageListContext.Provider>
}
