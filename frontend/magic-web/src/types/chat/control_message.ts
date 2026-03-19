import { MessageReceiveType } from "."
import { SeqMessageBase } from "./base"
import type { OpenConversationMessage } from "./conversation"
import { ConversationMessageBase, ConversationMessageStatus } from "./conversation_message"
import type { SeenMessage } from "./seen_message"
import type { CreateTopicMessage, UpdateTopicMessage, DeleteTopicMessage } from "./topic"

/**
 * 控制事件类型
 */

export const enum ControlEventMessageType {
	/** 打开（创建）会话 */
	OpenConversation = "open_conversation",
	/** 创建会话 */
	CreateConversation = "create_conversation",
	/** 已读回执 */
	SeenMessages = "seen_messages",
	/** 创建话题 */
	CreateTopic = "create_topic",
	/** 更新话题 */
	UpdateTopic = "update_topic",
	/** 删除话题 */
	DeleteTopic = "delete_topic",
	/** 设置会话话题 */
	SetConversationTopic = "set_conversation_topic",
	/** 撤回消息 */
	RevokeMessage = "revoke_message",
	/** 免打扰 */
	MuteConversation = "mute_conversation",
	/** 置顶群聊 */
	TopConversation = "top_conversation",
	/** 隐藏会话 */
	HideConversation = "hide_conversation",
	/** 群聊创建 */
	GroupCreate = "group_create",
	/** 群新增成员消息 */
	GroupAddMember = "group_users_add",
	/** 群解散 */
	GroupDisband = "group_disband",
	/** 群人员退群 */
	GroupUsersRemove = "group_users_remove",
	/** 群更新 */
	GroupUpdate = "group_update",
	/** 添加好友成功 */
	AddFriendSuccess = "add_friend_success",
}

export interface AddFriendSuccessMessage extends SeqMessageBase {
	type: ControlEventMessageType.AddFriendSuccess
	/** 添加好友成功 */
	add_friend_success: {
		/** 用户 ID */
		user_id: string
		/** 接收者 ID */
		receive_id: string
		/** 接收者类型 */
		receive_type: MessageReceiveType
	}
}
/**
 * 撤回消息
 */

export interface RevokeMessage extends ConversationMessageBase {
	type: ControlEventMessageType.RevokeMessage
	revoke_message: {
		/** 撤回消息 ID */
		refer_message_id: string
	}
}
/**
 * 群创建消息
 */

export interface GroupCreateMessage extends ConversationMessageBase {
	type: ControlEventMessageType.GroupCreate
	/** 未读数 */
	unread_count: number
	/** 发送时间 */
	send_time: number
	/** 状态 */
	status: ConversationMessageStatus
	group_create: {
		/** 操作人ID */
		operate_user_id: string
		/** 群ID */
		group_id: string
		/** 用户ID列表 */
		user_ids: string[]
		/** 会话ID */
		conversation_id: string
		/** 群名称 */
		group_name: string
		/** 群主ID */
		group_owner_id: string
	}
}
/**
 * 群解散消息
 */

export interface GroupDisbandMessage extends ConversationMessageBase {
	type: ControlEventMessageType.GroupDisband
	/** 未读数 */
	unread_count: number
	/** 发送时间 */
	send_time: number
	/** 状态 */
	status: ConversationMessageStatus
}
/**
 * 群新增成员消息
 */

export interface GroupAddMemberMessage extends ConversationMessageBase {
	type: ControlEventMessageType.GroupAddMember
	/** 未读数 */
	unread_count: number
	/** 发送时间 */
	send_time: number
	/** 状态 */
	status: ConversationMessageStatus
	/** 群新增成员 */
	group_users_add: {
		/** 操作人ID */
		operate_user_id: string
		/** 群ID */
		group_id: string
		/** 用户ID列表 */
		user_ids: string[]
		/** 会话ID */
		conversation_id: string
	}
}
/**
 * 群人员退群
 */

export interface GroupUsersRemoveMessage extends ConversationMessageBase {
	type: ControlEventMessageType.GroupUsersRemove
	/** 未读数 */
	unread_count: number
	/** 发送时间 */
	send_time: number
	/** 状态 */
	status: ConversationMessageStatus
	group_users_remove: {
		/** 操作人ID */
		operate_user_id: string
		/** 群ID */
		group_id: string
		/** 用户ID列表 */
		user_ids: string[]
		/** 会话ID */
		conversation_id: string
	}
}
/**
 * 群更新
 */

export interface GroupUpdateMessage extends ConversationMessageBase {
	type: ControlEventMessageType.GroupUpdate
	/** 未读数 */
	unread_count: number
	/** 发送时间 */
	send_time: number
	/** 状态 */
	status: ConversationMessageStatus
	group_update: {
		/** 操作人ID */
		operate_user_id: string
		/** 群ID */
		group_id: string
		/** 会话ID */
		conversation_id: string
		/** 群名称 */
		group_name: string
		/** 群头像 */
		group_avatar: string
	}
}
/**
 * 置顶会话
 */

export interface TopConversationMessage extends ConversationMessageBase {
	type: ControlEventMessageType.TopConversation
	[ControlEventMessageType.TopConversation]: {
		conversation_id: string
		is_top: 0 | 1
	}
}
/**
 * 免打扰消息
 */

export interface MuteConversationMessage extends ConversationMessageBase {
	type: ControlEventMessageType.MuteConversation
	[ControlEventMessageType.MuteConversation]: {
		conversation_id: string
		is_not_disturb: 0 | 1
	}
}
/**
 * 隐藏会话
 */

export interface HideConversationMessage extends ConversationMessageBase {
	type: ControlEventMessageType.HideConversation
	[ControlEventMessageType.HideConversation]: {
		conversation_id: string
	}
}
/**
 * 控制消息类型
 */

export type ControlMessage =
	| OpenConversationMessage
	| CreateTopicMessage
	| UpdateTopicMessage
	| DeleteTopicMessage
	| SeenMessage
	| TopConversationMessage
	| MuteConversationMessage
	| HideConversationMessage
	| AddFriendSuccessMessage
