import { SuperMagicMessageItem } from "@/opensource/pages/superMagic/components/MessageList/type"
import { MessageStatus } from "@/opensource/pages/superMagic/pages/Workspace/types"
import { toJS } from "mobx"

export function messagesConverter(
	list: Array<any>,
	isRevoked: boolean = true,
): Array<SuperMagicMessageItem> {
	const map = new Map<string, any>()
	const correlationMap = new Map<string, string>()
	const correlationToMessageMap = new Map<string, Array<any>>()

	// 反向遍历，自动保留最新的 correlation 消息
	for (let i = list.length - 1; i >= 0; i--) {
		const item = list[i]

		// 快速跳过：已撤回消息 或 before_llm_request 事件
		if (
			(isRevoked && item.status === MessageStatus.REVOKED) ||
			item.event === "before_llm_request"
		) {
			continue
		}

		const messageId = item.magic_message_id
		const correlationId = item.correlation_id || item.tool?.id

		// 有 correlation_id 的消息去重处理
		if (correlationId) {
			// 如果已经记录过这个 correlation，跳过当前消息（保留后面的）
			if (correlationMap.has(correlationId)) {
				continue
			}
			correlationMap.set(correlationId, messageId)
		}

		if (item?.parent_correlation_id) {
			const array = correlationToMessageMap.get(item?.parent_correlation_id) || []
			array.push(toJS(item))
			correlationToMessageMap.set(item?.parent_correlation_id, array)
			continue
		}

		// 只在最终确定保留时才添加
		if (!map.has(messageId)) {
			map.set(messageId, toJS(item))
		}
	}

	correlationToMessageMap.forEach((array, correlationId) => {
		array.reverse()
		const messageId = correlationMap.get(correlationId)
		if (messageId) {
			const msg = map.get(messageId)
			msg.childMessages = array
			map.set(messageId, toJS(msg))
		}
	})
	// 反向遍历导致顺序颠倒，需要恢复原始顺序
	return Array.from(map.values()).reverse()
}

export function getMessageNodeKey(node: any): string {
	if (node?.type === "tool_call") {
		return node?.tool?.correlation_id || node?.tool?.id || ""
	}
	return node?.app_message_id || node?.seq_id || ""
}

/**
 * 创建一个检查消息是否为最后一条的函数
 * @param messages 消息列表
 * @returns 检查函数，接收 messageId 返回是否为最后一条消息
 */
export function createCheckIsLastMessage(messages: Array<SuperMagicMessageItem>) {
	return (messageId: string) => {
		const lastMessage = messages[messages.length - 1]
		return lastMessage?.app_message_id === messageId || lastMessage?.message_id === messageId
	}
}
