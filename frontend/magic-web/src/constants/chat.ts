import { ControlEventMessageType } from "@/types/chat/control_message"
import { ConversationMessageType } from "@/types/chat/conversation_message"

/**
 * @deprecated 使用 ChatMessageApplyServices.isChatMessage 和 ControlMessageApplyService.isControlMessageShouldRender 替代
 */
export const CONVERSATION_MESSAGE_TYPES: (ConversationMessageType | ControlEventMessageType)[] = [
	ConversationMessageType.Text,
	ConversationMessageType.RichText,
	ConversationMessageType.Markdown,
	ConversationMessageType.MagicSearchCard,
	ConversationMessageType.AggregateAISearchCard,
	ConversationMessageType.Image,
	ConversationMessageType.Files,
	ConversationMessageType.Video,
	ConversationMessageType.Voice,
	ControlEventMessageType.GroupAddMember,
	ControlEventMessageType.GroupDisband,
	ControlEventMessageType.GroupCreate,
	ControlEventMessageType.GroupUsersRemove,
	ControlEventMessageType.GroupUpdate,
	ConversationMessageType.RecordingSummary,
	ConversationMessageType.AiImage,
	ControlEventMessageType.RevokeMessage,
	ConversationMessageType.HDImage,
]

/** 魔法表单表确认消息 */
export const MAGIC_FORM_CONFIRM_MESSAGE = "[MAGIC_FORM_CONFIRM]"

/** 可撤回的会话消息类型 */
export const CONVERSATION_MESSAGE_CAN_REVOKE_TYPES = [
	ConversationMessageType.Text,
	ConversationMessageType.RichText,
	ConversationMessageType.Markdown,
	ConversationMessageType.MagicSearchCard,
	ConversationMessageType.AggregateAISearchCard,
	ConversationMessageType.Files,
	ConversationMessageType.RecordingSummary,
]

/** 可渲染为文本的会话消息类型 */
export const CONVERSATION_MESSAGE_CAN_RENDER_TO_TEXT_TYPES = [
	...CONVERSATION_MESSAGE_CAN_REVOKE_TYPES,
	ControlEventMessageType.RevokeMessage,
]

export const enum ConversationGroupKey {
	Top = "top",
	Group = "group",
	AI = "ai",
	Single = "single",
	User = "user",
	Other = "Other",
}

// 心跳时间偏移值
export const HEARTBEAT_TIME_OFFSET = 2000
