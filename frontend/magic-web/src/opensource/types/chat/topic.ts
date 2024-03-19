import type { ControlEventMessageType } from "./control_message"
import type { SeqMessageBase } from "./base"
import type { ConversationMessageBase } from "./conversation_message"

export interface UpdateTopicMessage extends SeqMessageBase {
	type: ControlEventMessageType.UpdateTopic
	[ControlEventMessageType.UpdateTopic]: ConversationTopic
}

/**
 * 创建话题消息
 */
export interface CreateTopicMessage extends ConversationMessageBase {
	type: ControlEventMessageType.CreateTopic
	[ControlEventMessageType.CreateTopic]: ConversationTopic
}

/**
 * 删除话题消息
 */
export interface DeleteTopicMessage extends ConversationMessageBase {
	type: ControlEventMessageType.DeleteTopic
	[ControlEventMessageType.DeleteTopic]: ConversationTopic
}

/**
 * 话题
 */
export interface ConversationTopic {
	id: string
	name: string
	description: string
	conversation_id: string
	created_at?: number
	updated_at?: number
}

/**
 * 编辑消息
 */
export interface EditMessage extends ConversationMessageBase {
	type: ControlEventMessageType.EditMessage
	[ControlEventMessageType.EditMessage]: {
		refer_message_id: string
		markdown: string
		text: string
		rich_text: string
	}
}
