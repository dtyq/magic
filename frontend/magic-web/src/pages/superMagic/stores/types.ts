import type { SeqRecord } from "@/apis/modules/chat/types"
import type {
	ConversationMessageSend,
	ConversationQueryMessage,
	SuperMagicNode,
} from "@/types/chat/conversation_message"
import type { SeqResponse } from "@/types/request"
import {
	type CrewDomainEventPayload as InternalCrewDomainEventPayload,
	type RegisterDomainEventListenerParams as InternalRegisterDomainEventListenerParams,
	type TaskDomainEventPayload as InternalTaskDomainEventPayload,
	type RegisterTopicMessageListenerParams as InternalTopicMessageListenerParams,
	type TopicMessageListenerPayload as TopicMessageListenerEventPayload,
} from "./listener-registry"

// ─── 基础别名 ────────────────────────────────────────────────

export type SuperMagicStoreTopicId = string
export type TopicMessageNode = unknown

// ─── 领域事件相关（具化泛型后再导出） ───────────────────────

export type RegisterTopicMessageListenerParams = InternalTopicMessageListenerParams<
	MessageItem,
	TopicMessageNode
>
export type TopicMessageListenerPayload = TopicMessageListenerEventPayload<
	MessageItem,
	TopicMessageNode
>
export type CrewDomainEventPayload = InternalCrewDomainEventPayload<MessageItem, TopicMessageNode>
export type TaskDomainEventPayload = InternalTaskDomainEventPayload<MessageItem, TopicMessageNode>
export type DomainEventPayload = CrewDomainEventPayload | TaskDomainEventPayload
export type RegisterDomainEventListenerParams =
	InternalRegisterDomainEventListenerParams<DomainEventPayload>

// ─── 原始消息相关 ────────────────────────────────────────────

export type RawSuperMagicMessageNode = SuperMagicNode
export type RawSuperMagicIMMessage = ConversationQueryMessage
export type RawSuperMagicMessageSequence = SeqResponse<ConversationQueryMessage>
export type RawSuperMagicMessageEnvelope = SeqRecord<ConversationQueryMessage>

export interface PendingUserMessageEnvelope {
	message: ConversationMessageSend["message"]
	conversation_id: string
}

export interface SharedMessageItem {
	message_id?: string
	type?: string
	raw_content?: {
		rich_text?: Record<string, unknown>
		super_magic_message?: Record<string, unknown>
	}
	[key: string]: unknown
}

// ─── 消息项 ──────────────────────────────────────────────────

export interface MessageItem {
	app_message_id: string
	/** 消息相关联Id */
	correlation_id: string
	/** 父消息相关联Id */
	parent_correlation_id: string
	debug: RawSuperMagicMessageNode
	/** 事件 */
	event: string
	/** 引用消息关联id（用于超麦的"从此处创建新话题，复制对话列表"） */
	refer_message_id: string
	/** 消息归属 */
	role: "assistant" | "user" | "tool"
	/** 发送时间 */
	send_time: number
	/** 唯一id */
	seq_id: string
	/** IM 的消息状态（消息是否已读） */
	status: string
	/** IM 的话题id */
	topic_id: string
	/** 消息类型 */
	type: string

	[key: string]: unknown
}

// ─── 流式渲染 ────────────────────────────────────────────────

export type MessageRole = "user" | "assistant" | "tool"

export interface FunctionCall {
	name: string
	label?: string
	arguments: string
}

export interface ToolCall {
	id: string
	type: string
	index: number
	function: FunctionCall
	tool?: ToolResponseState
}

export interface StreamMessage {
	role: MessageRole
	content: string | null
	reasoning_content: string | null
	tool_calls?: ToolCall[]
}

export interface StreamState {
	stage: "reasoning_content" | "content" | "tool" | "done"
	reasoning_content: string
	content: string
	currentToolIndex: number
	tool_calls: ToolCall[]
	isFinalMessageReceived: boolean
	finalMessage?: StreamMessage
}

export interface ToolStreamStepResult {
	progressed: boolean
	done: boolean
}

export interface ToolStreamMessageState {
	tool_calls?: ToolCall[] | null
	currentToolIndex?: number
	[key: string]: unknown
}

export interface ToolResponseState {
	action?: string
	attachments?: null | Array<any>
	detail?: {
		data: any
		type: string
	}
	id?: string
	name?: string
	remark?: string
	status?: string
	[key: string]: unknown
}

export interface TopicMetaContentEntry {
	/** 当前流式渲染所在位置（表示文本下标） */
	index: number
	/** 当前文本块完整内容 */
	content: string
	/** 思考中内容 */
	reasoning_content: string
	/** 工具流式内容 */
	tool_calls: Record<string, any>[]
	/** 流式处理状态（-1:未开始流式、0开始流式、1思考中、2正文流式、3工具流式、4结束流式） */
	status: number
}

export interface StreamSnapshot {
	reasoning_content: string
	content: string
	tool_calls: ToolCall[]
}

export interface TopicMeta {
	/** 当前是否正在处于流式开启中 */
	isStream: boolean
	/** 当前是否正在流式交互中 */
	isStreamLoading: boolean
	/** 当前话题流式运行时定时器 */
	timer: ReturnType<typeof window.setTimeout> | null
	/** 当前流式文本数据映射（Record<当前流式卡片关联id - correlationId，当前流式文本内容>） */
	content: Map<string, StreamState>
	/** 不可见期间已完成的流式快照（用于切回后回放打字机） */
	streamSnapshots: Map<string, StreamSnapshot>
}
