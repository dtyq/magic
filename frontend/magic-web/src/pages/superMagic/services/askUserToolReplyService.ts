import { ChatApi } from "@/apis"
import { EventType } from "@/types/chat"
import {
	ConversationMessageType,
	type ConversationMessageSend,
} from "@/types/chat/conversation_message"
import { genAppMessageId } from "@/utils/random"
import type { AskUserActionDetail } from "@/pages/superMagic/components/MessageList/utils/askUser"

export interface SendAskUserToolReplyParams {
	conversationId: string
	topicId: string
	toolName: string
	toolCallId: string
	/** 协议见 ask-user API 文档 §5.2：tool_reply.detail 是对象，不是字符串 */
	detail: AskUserActionDetail
	isAnswered: boolean
}

export async function sendAskUserToolReply({
	conversationId,
	topicId,
	toolName,
	toolCallId,
	detail,
	isAnswered,
}: SendAskUserToolReplyParams) {
	/**
	 * IMPORTANT:
	 * 后端按 TipTap 文档解析 rich_text.content。
	 * 这里必须发送完整 doc（并 stringify），不能只传节点数组。
	 * 与 MessageService 的 rich_text 发送格式保持一致，避免解析失败。
	 */

	const message = {
		type: ConversationMessageType.UserToolCall,
		user_tool_call: {
			name: toolName,
			tool_call_id: toolCallId,
			detail,
			extra: {
				super_agent: {
					dynamic_params: {
						message_version: "v2",
					},
				},
			},
		},
		app_message_id: genAppMessageId(),
		topic_id: topicId,
	} as unknown as Omit<ConversationMessageSend["message"], "sender_id" | "send_time">

	await ChatApi.chat(EventType.Chat, {
		conversation_id: conversationId,
		message,
	})
}
