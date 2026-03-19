import type { MessageReceiveType } from "."
import type { ControlEventMessageType } from "./control_message"
import type { SeqMessageBase } from "./base"

export const enum ConversationStatus {
	/** 正常 */
	Normal = 0,
	/** 不显示 */
	Hidden = 1,
	/** 删除 */
	Deleted = 2,
}

/**
 * 会话 (服务端返回)
 */
export interface ConversationFromService {
	/** 会话 ID */
	id: string
	/** 用户 ID */
	user_id: string
	/** 用户组织编码 */
	user_organization_code: string
	/** 接收者类型 */
	receive_type: MessageReceiveType
	/** 接收者 ID */
	receive_id: string
	/** 接收者组织编码 */
	receive_organization_code: string
	/** 是否免打扰 */
	is_not_disturb: 0 | 1
	/** 是否置顶 */
	is_top: 0 | 1
	/** 是否标记 */
	is_mark: 0 | 1
	/** 额外信息 */
	extra: string
	/** 创建时间 */
	created_at: string
	/** 更新时间 */
	updated_at: string
	/** 删除时间 */
	deleted_at: string | null
	/** 当前话题 ID, 废弃 */
	// current_topic_id: string
	/** 状态 */
	status: ConversationStatus
	/** 翻译配置 */
	translate_config: unknown | null
	/** 快捷指令配置 */
	instructs?: Record<string, unknown>
	// instruct?: string
}

/**
 * 会话
 */
export interface Conversation extends ConversationFromService {
	/** 消息 ID 列表 */
	messageIds: string[]
	/** 接收者是否正在输入 */
	receive_inputing: boolean
	/** 当前话题 ID */
	currentTopicId?: string
	/** 最后一次收到的会话消息 ID (用于列表展示) */
	lastReceiveMessageId?: string
	/** 最后一次收到的会话消息 seqId */
	lastReceiveSeqId?: string
	/** 不同话题下的消息 ID */
	topicMessageIds?: Map<string, string[]>
	/** 不同话题下最后一次收到的会话消息 ID */
	topicLastReceiveMessageId?: Map<string, string>
	/** 不同话题下最后一次收到的会话消息 seqId */
	topicLastReceiveSeqId?: Map<string, string>
}

/**
 * 创建/打开会话消息
 */

export interface OpenConversationMessage extends SeqMessageBase {
	type: ControlEventMessageType.OpenConversation | ControlEventMessageType.CreateConversation
	/** 发送时间 */
	send_time: number
	/** 打开会话 */
	open_conversation: {
		/** 接收者 ID */
		receive_id: string
		/** 接收者类型 */
		receive_type: MessageReceiveType
		/** 会话 ID */
		id: string
	}
}

/**
 * 群聊类型
 */
export enum GroupConversationType {
	/** 内部群 */
	Internal = 1,
	/** 内部培训群 */
	InternalTraining = 2,
	/** 内部会议群 */
	InternalMeeting = 3,
	/** 内部项目群 */
	InternalProject = 4,
	/** 内部工单群 */
	InternalWorkOrder = 5,
	/** 外部群 */
	External = 6,
}

export enum GroupStatus {
	/** 正常 */
	Normal = 1,
	/** 解散 */
	Dismiss = 2,
}

/**
 * 群聊详情
 */
export interface GroupConversationDetail {
	/** 群聊ID */
	id: string
	/** 群主 */
	group_owner: string
	/** 组织编码 */
	organization_code: string
	/** 群聊名称 */
	group_name: string
	/** 群聊头像 */
	group_avatar: string
	/** 群聊公告 */
	group_tag: string
	/** 群聊类型 */
	group_type: GroupConversationType
	/** 群聊状态 */
	group_status: GroupStatus
	/** 群公告 */
	group_notice: string
}

export interface GroupConversationDetailWithConversationId extends GroupConversationDetail {
	conversation_id: string
}

export interface GroupConversationMember {
	id: string
	group_id: string
	user_id: string
	user_role: number
	user_type: number
	status: number
	organization_code: string
	deleted_at: string | null
	created_at: number
	updated_at: number
}
