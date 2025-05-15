import type { SeqResponse } from "@/types/request"

export const enum SeqRecordType {
	seq = "seq",
	/** 流式类型消息 */
	stream_seq = "stream_seq",
}

/**
 * seq 消息
 */
export type SeqRecord<M> = DefaultSeqRecord<M>

export interface DefaultSeqRecord<M> {
	type: SeqRecordType.seq
	seq: SeqResponse<M>
}

/**
 * 获取会话名称 - 响应
 */
export type GetMagicTopicNameResponse = {
	conversation_id: string
	id: string
	name: string
}

/**
 * 创建群聊 - 参数
 */
export enum CreateGroupConversationParamKey {
	group_name = "group_name",
	group_avatar = "group_avatar",
	group_type = "group_type",
	user_ids = "user_ids",
	department_ids = "department_ids",
}

/**
 * 消息接收者列表 - 响应
 */
export type MessageReceiveListResponse = {
	unseen_list: string[]
	seen_list: string[]
	read_list: string[]
}

/**
 * 获取会话AI自动补全 - 响应
 */
export type GetConversationAiAutoCompletionResponse = {
	choices: [
		{
			message: {
				role: "assistant"
				content: string
			}
		},
	]
	request_info: {
		conversation_id: string
		message: string
	}
}

/**
 * 获取会话消息 - 参数
 */
export type GetConversationMessagesParams = {
	topic_id?: string
	time_start?: string
	time_end?: string
	page_token?: string
	limit?: number
	order?: string
}
