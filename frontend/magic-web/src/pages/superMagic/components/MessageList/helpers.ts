import { SuperMagicMessageItem } from "@/pages/superMagic/components/MessageList/type"
import { MessageStatus } from "@/pages/superMagic/pages/Workspace/types"
import { toJS } from "mobx"
import { set } from "lodash-es"
import {
	aggregateAskUserMessages,
	type AskUserCardData,
	getAskUserCorrelationId,
	isAskUserMessage,
	isAskUserToolReplyMessage,
} from "./utils/askUser"

export function messagesConverter(
	list: Array<any>,
	isRevoked: boolean = true,
): Array<SuperMagicMessageItem> {
	const map = new Map<string, any>()
	const correlationMap = new Map<string, string>()
	const correlationToMessageMap = new Map<string, Array<any>>()
	const askUserGroups = new Map<string, { firstIndex: number; items: Array<any> }>()

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

		const messageId = item.app_message_id
		const correlationId = item.correlation_id

		// 有 correlation_id 的消息去重处理
		if (correlationId) {
			// 如果已经记录过这个 correlation，跳过当前消息（保留后面的）
			if (correlationMap.has(correlationId)) {
				// 但当协议为V2时，需注意后面消息的类型是否为工具调用，如果是则只保留工具部分内容，其余全部使用前面消息的 assistant 内容
				const isV2Message = item?.type === "super_magic_message"
				const isSuperMagicMessage = item?.role === "tool"
				// 兼容分享场景下的数据结构（raw_content.type、raw_content.super_magic_message）
				const isSuperMagicShareMessage =
					item?.raw_content?.[item?.raw_content?.type]?.role === "tool"
				if (
					!isV2Message ||
					(isV2Message && (isSuperMagicMessage || isSuperMagicShareMessage))
				) {
					continue
				}
			}
			correlationMap.set(correlationId, messageId)
		}

		if (item?.parent_correlation_id) {
			const array = correlationToMessageMap.get(item?.parent_correlation_id) || []
			array.push({
				...toJS(item),
				__sourceIndex: i,
			})
			correlationToMessageMap.set(item?.parent_correlation_id, array)
			continue
		}

		// 只在最终确定保留时才添加
		if (!map.has(messageId)) {
			map.set(messageId, {
				...toJS(item),
				__sourceIndex: i,
			})
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
	const items = Array.from(map.values()).reverse()
	const askUserItems = Array.from(askUserGroups.values()).map((group) => ({
		...aggregateAskUserMessages(group.items),
		__sourceIndex: group.firstIndex,
	}))

	return [...items, ...askUserItems]
		.slice()
		.sort((prev, next) => prev.__sourceIndex - next.__sourceIndex)
		.map((item) => {
			const { __sourceIndex, ...restItem } = item
			void __sourceIndex
			return restItem
		})
}

export function getMessageNodeKey(node: any): string {
	if (node?.askUser)
		return `ask-user-${getAskUserCorrelationId(node) || node?.app_message_id || ""}`
	if (node?.type === "tool_call") {
		return node?.tool?.correlation_id || node?.tool?.id || ""
	}
	if (isAskUserMessage(node)) {
		return getAskUserCorrelationId(node) || node?.app_message_id || ""
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

export function findPendingAskUserCard(
	list: Array<Record<string, unknown>>,
): AskUserCardData | undefined {
	const messages = messagesConverter(list)
	const pendingAskUserMessage = messages.find((message) => {
		return (message?.askUser as AskUserCardData | undefined)?.status === "pending"
	})

	return pendingAskUserMessage?.askUser as AskUserCardData | undefined
}
