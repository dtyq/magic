import type { SeqResponse } from "../request"
import type { User } from "../user"
import type {
	AggregateAISearchCardConversationMessage,
	AggregateAISearchCardConversationMessageV2,
	ConversationMessage,
	SuperMagicContent,
} from "./conversation_message"
import type { ControlMessage } from "./control_message"
import type { ConversationFromService } from "./conversation"
import type { IntermediateMessage } from "./intermediate_message"

/** 消息接收方类型 */
export const enum MessageReceiveType {
	Ai = 0,
	/** 用户 */
	User = 1,
	/** 群组 */
	Group = 2,
	/** 系统消息 */
	System = 3,
	/** 云文档 */
	CloudDocument = 4,
	/** 多维表格 */
	MultiTable = 5,
	/** 话题 */
	Topic = 6,
	/** 应用消息 */
	App = 7,
}

/** 最大序号 */
export interface MessageMaxSeqInfo {
	user_local_seq_id?: string
}

/**
 * 服务端推送事件类型
 */
export const enum EventType {
	/** 登录 */
	Login = "login",
	/** 聊天 */
	Chat = "chat",
	/** 流式聊天 */
	Stream = "stream",
	/** 控制 */
	Control = "control",
	/** 即时消息 */
	Intermediate = "intermediate",
	/** 创建会话窗口 */
	CreateConversationWindow = "create_conversation_window",
}

/**
 * 服务端推送事件响应
 */
export interface EventResponseMap {
	[EventType.Login]: User.UserInfo
	[EventType.Chat]: { type: "seq"; seq: SeqResponse<CMessage> }
	[EventType.Control]: { type: "seq"; seq: SeqResponse<CMessage> }
	[EventType.Stream]: { type: "seq"; seq: SeqResponse<CMessage> }
	[EventType.CreateConversationWindow]: { conversation: ConversationFromService }
	[EventType.Intermediate]: { type: "seq"; seq: SeqResponse<CMessage> }
}

/**
 * 服务端推送事件响应结构
 */
export type EventResponse<E extends EventType> = {
	type: E
	payload: EventResponseMap[E]
}

/**
 * 消息
 */
export type CMessage =
	| ControlMessage
	| IntermediateMessage
	| ConversationMessage
	| AggregateAISearchCardConversationMessage<true>
	| AggregateAISearchCardConversationMessageV2
	| SuperMagicContent
