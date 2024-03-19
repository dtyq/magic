import type { CreateGroupConversationParamKey } from "@/opensource/apis/modules/chat/types"
import type { ControlEventMessageType } from "./control_message"
import type { SeqMessageBase } from "./base"
import type { GroupConversationType } from "./conversation"
import type { ConversationMessageStatus } from "./conversation_message"

/**
 * 已读回执
 */
export interface SeenMessage extends SeqMessageBase {
	type: ControlEventMessageType.SeenMessages
	seen_messages: {
		refer_message_ids: string[]
	}
	/** 发送时间 */
	send_time: number
	/** 消息状态 */
	status: ConversationMessageStatus
	/** 未读消息数 */
	unread_count: number
	/** 话题ID */
	topic_id: string
}

/**
 * 创建群组对话参数
 */
export type CreateGroupConversationParams = {
	[CreateGroupConversationParamKey.group_name]: string
	[CreateGroupConversationParamKey.group_avatar]: string
	[CreateGroupConversationParamKey.group_type]: GroupConversationType
	[CreateGroupConversationParamKey.user_ids]: string[]
	[CreateGroupConversationParamKey.department_ids]: string[]
}
