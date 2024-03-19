import type { SeqMessageBase } from "./base"
import type { ConversationMessageStatus } from "./conversation_message"

/**
 * 即时消息类型
 */

export const enum IntermediateMessageType {
	/** 开始会话输入 */
	StartConversationInput = "start_conversation_input",
	/** 结束会话输入 */
	EndConversationInput = "end_conversation_input",
	/** 元数据(超级麦吉) */
	Raw = "raw",
	/** 超级麦吉消息队列更新事件 */
	SuperMagicMessageQueueChange = "super_magic_message_queue_change",
}

/**
 * 开始会话输入消息
 */
export interface StartConversationInputMessage extends SeqMessageBase {
	type: IntermediateMessageType.StartConversationInput
	unread_count: number
	send_time: number
	status: ConversationMessageStatus
	start_conversation_input: {
		conversation_id: string
		topic_id: string
	}
}

/**
 * 结束会话输入消息
 */
export interface EndConversationInputMessage extends SeqMessageBase {
	type: IntermediateMessageType.EndConversationInput
	unread_count: number
	send_time: number
	status: ConversationMessageStatus
	end_conversation_input: {
		conversation_id: string
		topic_id: string
	}
}

/**
 * 流式消息传输消息
 */
export interface RawMessage extends SeqMessageBase {
	type: IntermediateMessageType.Raw
	unread_count: number
	send_time: number
	status: ConversationMessageStatus
	raw: {
		raw_data: {
			/** 当前流式状态 */
			stream_status: number
			/** 流式内容（不可靠，不落库，最终需要通过关联的消息卡片覆盖原卡片保持内容完整性，当前类型只为了交互优化） */
			content: string
			/** 消息卡片关联唯一字段 */
			correlation_id: string
			send_timestamp: number
		}
	}
}

/**
 * 超级麦吉消息队列更新消息
 */
export interface SuperMagicMessageQueueMessage extends SeqMessageBase {
	type: IntermediateMessageType.SuperMagicMessageQueueChange
	project_id: string
	topic_id: string
	chat_topic_id: string
	message_id: string
}

/**
 * 即时消息
 */
export type IntermediateMessage =
	| StartConversationInputMessage
	| EndConversationInputMessage
	| RawMessage
	| SuperMagicMessageQueueMessage
