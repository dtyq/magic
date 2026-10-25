import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
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
	/** 超级麦吉消息 */
	SuperMagicChunk = "super_magic_chunk",
	/** 超级麦吉消息队列更新事件 */
	SuperMagicMessageQueueChange = "super_magic_message_queue_change",
	/** 超级麦吉工程文件变更 */
	SuperMagicFileChange = "super_magic_file_change",
	/** 超级麦吉检查点撤销、恢复与提交后的权威刷新通知 */
	SuperMagicCheckpointRollback = "super_magic_checkpoint_rollback",
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

/** 超级麦吉消息(新版本流式块) */
export interface SuperMagicChunkMessage extends SeqMessageBase {
	type: IntermediateMessageType.SuperMagicChunk
	project_id: string
	topic_id: string
	chat_topic_id: string
	message_id: string
	super_magic_chunk: {
		/** 同一逻辑消息的稳定 ID；后端保证至少在 Topic 内唯一 */
		super_message_id: string
		/** 当前流式消息所属任务 ID */
		task_id: string
		/** 当前流式块索引 */
		i: number
		/** 使用统计 */
		usage: {
			/** 完成 token 数 */
			completion_tokens: number
			/** 提示 token 数 */
			prompt_tokens: number
			/** 总 token 数 */
			total_tokens: number
		} | null
		/** 消息卡片关联唯一字段 */
		correlation_id: string
		choices: Array<{
			finish_reason: "stop" | "tool_calls" | "length" | null
			delta: {
				content: string
				role: "assistant" | "user" | "tool"
				tool_calls: Array<{
					id: string
					type: string
					function: {
						name: string
						arguments: string
					}
					index: number
				}>
				reasoning_content: string
				index: number
				logprobs?: {
					token_logprobs: Array<number>
					token_ids: Array<number>
					token_strs: Array<string>
				} | null
			}
		}>
	}
}

export interface SuperMagicFileChangeItem {
	file?: FileItem
	file_id: string
	operation: "add" | "delete" | "update" | (string & {})
}

export interface SuperMagicFileChangeMessage extends Partial<SeqMessageBase> {
	type: IntermediateMessageType.SuperMagicFileChange
	/** The file namespace that owns this change event. Legacy events omit it and are project-scoped. */
	space_type?: "project" | "user" | (string & {})
	project_id: string
	workspace_id: string
	topic_id: string
	timestamp: string
	changes: SuperMagicFileChangeItem[]
	refresh_parent_ids?: string[]
}

export type SuperMagicCheckpointRollbackAction = "start" | "undo" | "commit" | "rollback"

/**
 * 检查点变更只携带刷新路由与影响范围，不是普通 IM 消息，不能继承 SeqMessageBase。
 * 外层 seq_id 是领域事件 ID，不代表消息列表已经持久化到该水位。
 */
export interface SuperMagicCheckpointRollbackMessage {
	type: IntermediateMessageType.SuperMagicCheckpointRollback
	action: SuperMagicCheckpointRollbackAction
	project_id: string
	topic_id: string
	chat_topic_id: string
	target_seq_id: string | null
	affected_seq_ids: string[]
	affected_count: number
	truncated: boolean
	refresh_required: true
	timestamp: string
}

/**
 * 即时消息
 */
export type IntermediateMessage =
	| StartConversationInputMessage
	| EndConversationInputMessage
	| RawMessage
	| SuperMagicMessageQueueMessage
	| SuperMagicFileChangeMessage
	| SuperMagicCheckpointRollbackMessage
	| SuperMagicChunkMessage
