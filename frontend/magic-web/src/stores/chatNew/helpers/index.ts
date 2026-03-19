import { type CMessage, type MessageMaxSeqInfo } from "@/types/chat"
import type { SeqResponse } from "@/types/request"
import { bigNumCompare } from "@/utils/string"
import { platformKey } from "@/utils/storage"
import type {
	MessageCanRevoke,
	ConversationMessageType,
} from "@/types/chat/conversation_message"
import type { GroupUsersRemoveMessage } from "@/types/chat/control_message"
import {
	CONVERSATION_MESSAGE_CAN_REVOKE_TYPES,
	ConversationGroupKey,
} from "@/constants/chat"
import { uniq } from "lodash-es"
import { isAppMessageId } from "@/utils/random"

/**
 * 是否是可撤回的消息
 * @param message 消息
 * @returns 是否是可撤回的消息
 */
export function isRevokableMessage(
	message: SeqResponse<CMessage>,
): message is SeqResponse<MessageCanRevoke> {
	return CONVERSATION_MESSAGE_CAN_REVOKE_TYPES.includes(
		message?.message?.type as ConversationMessageType,
	)
}

/**
 * 是否是自己退群
 * @param message 消息
 * @param userId 用户 ID
 * @returns 是否是自己退群
 */
export function isSelfLeaveGroup(message: GroupUsersRemoveMessage, userId?: string) {
	return (
		userId &&
		message.group_users_remove.operate_user_id === userId &&
		message.group_users_remove.user_ids.length === 1 &&
		message.group_users_remove.user_ids[0] === userId
	)
}

/**
 * 唯一且排序消息 ID
 * @param messageIds 消息 ID 列表
 * @returns 唯一且排序后的消息 ID 列表
 */
export function uniqueAndSortMessageIds(messageIds: string[]) {
	return uniq(messageIds).sort((a, b) => {
		const isAppMessageA = isAppMessageId(a)
		const isAppMessageB = isAppMessageId(b)

		if (isAppMessageA && !isAppMessageB) {
			return 1
		}

		if (!isAppMessageA && isAppMessageB) {
			return -1
		}

		return bigNumCompare(a, b)
	})
}

const genMaxSeqInfoKey = (magic_id: string) => platformKey(`chat/max_seq_info/${magic_id}`)

/**
 * 获取最大序号
 * @returns
 */
export const getChatMaxSeqInfo = (magic_id: string) =>
	JSON.parse(
		localStorage.getItem(genMaxSeqInfoKey(magic_id)) ??
		JSON.stringify({
			user_local_seq_id: "",
		}),
	) as MessageMaxSeqInfo

/**
 * 设置最大序号
 * @param max_seq_info 最大序号
 * @returns
 */
export const setChatMaxSeqInfo = (magic_id: string, max_seq_info: MessageMaxSeqInfo) =>
	localStorage.setItem(genMaxSeqInfoKey(magic_id), JSON.stringify(max_seq_info))

/**
 * 添加会话到会话组
 * @param list 会话组
 * @param conversationId 会话 ID
 */
export function addToConversationGroup(list: string[], conversationId: string) {
	if (!list.includes(conversationId)) {
		list.unshift(conversationId)
	}
}

/**
 * 创建会话分组
 * @returns 会话分组
 */
export const createConversationGroup = (): Record<ConversationGroupKey, string[]> => ({
	[ConversationGroupKey.Top]: [],
	[ConversationGroupKey.Single]: [],
	[ConversationGroupKey.User]: [],
	[ConversationGroupKey.AI]: [],
	[ConversationGroupKey.Group]: [],
	[ConversationGroupKey.Other]: [],
})

/**
 * 从会话组中移除会话
 * @param list 会话组
 * @param conversationId 会话 ID
 */
export const removeFromConversationGroup = (list: string[], conversationId: string) => {
	if (list.includes(conversationId)) {
		list.splice(
			list.findIndex((item) => item === conversationId),
			1,
		)
	}
}
