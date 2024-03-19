import type { ControlEventMessageType } from "@/opensource/types/chat/control_message"
import type { ConversationMessageType } from "@/opensource/types/chat/conversation_message"

export interface LastReceiveMessage {
	time: number
	seq_id: string
	text: string
	topic_id: string
	type: ConversationMessageType | ControlEventMessageType
}

export type ConversationObject = {
	id: string
	user_id: string
	receive_type: number
	receive_id: string
	receive_organization_code: string
	is_not_disturb: 0 | 1
	is_top: 0 | 1
	is_mark: number
	extra: any
	status: number
	last_receive_message: LastReceiveMessage | undefined
	topic_default_open: boolean
	user_organization_code: string
	current_topic_id: string
	unread_dots: number
	topic_unread_dots: Map<string, number>
	receive_inputting: Map<string, boolean>
	last_receive_message_time: number
}
