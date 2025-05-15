import type { SeqResponse } from "@/types/request"
import type { CMessage } from "@/types/chat"
import type { ConversationMessageSend } from "@/types/chat/conversation_message"
import type { Conversation } from "@/types/chat/conversation"
import { t } from "i18next"
import type { StructureUserItem } from "@/types/organization"

/**
 * 获取用户名称
 * @param userDetail 用户详情
 * @returns 用户名称
 */
export function getUserName(userDetail?: StructureUserItem) {
	if (!userDetail) return t("common.unknown", { ns: "interface" })
	if (userDetail.nickname && userDetail.nickname.length > 0) {
		return userDetail.nickname
	}
	if (userDetail.nickname && userDetail.nickname.length > 0) {
		return userDetail.nickname
	}
	return userDetail.user_id
}

/**
 * 获取用户职位
 * @param userDetail 用户详情
 * @returns 用户职位
 */
export function getUserJobTitle(userDetail?: StructureUserItem) {
	return userDetail?.job_title
}

/**
 * 获取用户第一部门路径
 * @param userDetail 用户详情
 * @returns 用户第一部门路径
 */
export function getUserDepartmentFirstPath(userDetail?: StructureUserItem) {
	if (!userDetail) return t("common.unknown", { ns: "interface" })
	return userDetail.path_nodes?.[0]?.path || t("common.unknown", { ns: "interface" })
}

/**
 * 收集对话消息
 * @param conversation 对话详情
 * @param penddingMessages 等待发送的消息
 * @returns
 */
export function collectConversationMessages(
	conversation: Conversation | undefined,
	messages: Record<string, SeqResponse<CMessage>>,
	penddingMessages: Record<string, ConversationMessageSend>,
): (CMessage | ConversationMessageSend["message"])[] {
	if (!conversation) return []
	return [
		...conversation.messageIds
			.map((id) => {
				const message = messages[id]
				if (!message) {
					console.warn(`message ${id} not found`)
				}
				return message.message
			})
			.filter(Boolean),
		...Object.values(penddingMessages)
			.filter((msg) => msg.conversation_id === conversation.id)
			.map((msg) => msg.message),
	]
}

/**
 * 标题带数量
 * @param title 标题
 * @param count 数量
 * @returns
 */
export function titleWithCount(title: string, count: number) {
	if (!count) return title
	return `${title} (${count})`
}
