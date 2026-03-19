import { QuickInstructionList } from "@/types/bot"
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
		topic_id: string
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

/** 获取可用AI助理列表 - 响应 */
export type UserAvailableAgentInfo = {
	id: string
	flow_code: string
	flow_version: string
	instructs: (QuickInstructionList & { id: string })[]
	agent_id: string
	root_id: string
	agent_name: string
	robot_name: string
	agent_avatar: string
	robot_avatar: string
	agent_description: string
	robot_description: string
	version_description: string
	version_number: string
	release_scope: number
	approval_status: number
	review_status: number | null
	enterprise_release_status: number
	app_market_status: number | null
	created_uid: string
	organization_code: string
	created_at: string
	updated_uid: string
	updated_at: string
	deleted_at: string | null
	start_page: boolean
	visibility_config?: {
		visibility_type: number
		users: {
			id: string
		}[]
		departments: {
			id: string
		}[]
	}
	created_info: {
		id: string
		magic_id: string
		organization_code: string
		user_id: string
		user_type: number
		description: string
		like_num: number
		label: string
		status: number
		nickname: string
		avatar_url: string
		user_manual: string
		i18n_name: string
		created_at: string
		updated_at: string
		deleted_at: string | null
		option: null
		extra: Record<string, unknown>
	}
	is_add: boolean
	is_official: boolean
	user_id?: string
	conversation_id?: string
	is_office: boolean
}
