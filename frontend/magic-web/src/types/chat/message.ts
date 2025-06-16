import type {
	ConversationMessage,
	ConversationMessageStatus,
	ConversationMessageType,
	SendStatus,
} from "@/types/chat/conversation_message"
import type { ControlEventMessageType } from "./control_message"

export interface Message<M extends ConversationMessage = ConversationMessage> {
	/** 本地临时id */
	temp_id?: string
	/** 用户唯一 ID */
	magic_id: string
	/** 消息序列 ID */
	seq_id?: string
	/** 消息 ID */
	message_id: string
	/** 引用消息 ID */
	refer_message_id?: string
	/** 发送者消息 ID */
	sender_message_id?: string
	/** 会话 ID */
	conversation_id: string
	/** 消息类型 */
	type: ConversationMessageType | ControlEventMessageType
	/** 消息内容 */
	message: M
	/** 是否已撤回 */
	revoked?: boolean
	/** 发送时间 */
	send_time: string
}

export interface FullMessage<M extends ConversationMessage = ConversationMessage>
	extends Message<M> {
	unread_count: number
	sender_id: string
	name: string
	avatar: string
	is_self?: boolean
	seen_status: ConversationMessageStatus
	send_status: SendStatus
	is_unreceived?: boolean
}

export interface MessagePage {
	page?: number
	pageSize?: number
	totalPages?: number
	messages: FullMessage[]
}

export interface UserInfo {
	id: string
	name: string
	avatar: string
}

export type ApplyMessageOptions = {
	isHistoryMessage?: boolean
	isFromOtherTab?: boolean
	sortCheck?: boolean
	updateLastSeqId?: boolean
}
