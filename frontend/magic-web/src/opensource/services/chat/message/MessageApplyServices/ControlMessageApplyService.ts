import type { CMessage } from "@/types/chat"
import { MessageReceiveType } from "@/types/chat"
import { ControlEventMessageType } from "@/types/chat/control_message"
import type { SeqResponse } from "@/types/request"

// 导入新的服务
import ConversationService from "@/opensource/services/chat/conversation/ConversationService"
import chatTopicService from "@/opensource/services/chat/topic"
import userInfoService from "@/opensource/services/userInfo"

// 导入存储状态管理
import conversationStore from "@/opensource/stores/chatNew/conversation"
import groupInfoStore from "@/opensource/stores/groupInfo"
import type { ConversationMessage } from "@/types/chat/conversation_message"
import type {
	AddFriendSuccessMessage,
	GroupAddMemberMessage,
	GroupCreateMessage,
	GroupDisbandMessage,
	GroupUpdateMessage,
	GroupUsersRemoveMessage,
	MuteConversationMessage,
	RevokeMessage,
	TopConversationMessage,
} from "@/types/chat/control_message"
import type { SeenMessage } from "@/types/chat/seen_message"
import type { CreateTopicMessage, UpdateTopicMessage, DeleteTopicMessage } from "@/types/chat/topic"
import { ConversationStatus } from "@/types/chat/conversation"
import groupInfoService from "@/opensource/services/groupInfo"
import MessageService from "../MessageService"
import { userStore } from "@/opensource/models/user"
import { ChatApi } from "@/apis"
import { ApplyMessageOptions } from "@/types/chat/message"

/**
 * 控制消息应用服务
 * 负责处理各种控制类型的消息并应用相应的业务逻辑
 */
class ControlMessageApplyService {
	/**
	 * 判断是否为控制消息
	 * @param message 消息对象
	 * @returns 是否为控制消息
	 */
	isControlMessage(message: SeqResponse<CMessage>) {
		return [
			ControlEventMessageType.OpenConversation,
			ControlEventMessageType.CreateConversation,
			ControlEventMessageType.SeenMessages,
			ControlEventMessageType.MuteConversation,
			ControlEventMessageType.TopConversation,
			ControlEventMessageType.HideConversation,
			ControlEventMessageType.CreateTopic,
			ControlEventMessageType.UpdateTopic,
			ControlEventMessageType.DeleteTopic,
			ControlEventMessageType.RevokeMessage,
			ControlEventMessageType.SetConversationTopic,
			ControlEventMessageType.GroupCreate,
			ControlEventMessageType.GroupAddMember,
			ControlEventMessageType.GroupUpdate,
			ControlEventMessageType.GroupUsersRemove,
			ControlEventMessageType.GroupDisband,
			ControlEventMessageType.AddFriendSuccess,
		].includes(message.message.type as ControlEventMessageType)
	}

	/**
	 * 判断控制消息是否需要渲染
	 * @param message 消息对象
	 * @returns 是否需要渲染
	 */
	isControlMessageShouldRender(message: SeqResponse<CMessage>) {
		return [
			ControlEventMessageType.GroupCreate,
			ControlEventMessageType.GroupAddMember,
			ControlEventMessageType.GroupUpdate,
			ControlEventMessageType.GroupUsersRemove,
			ControlEventMessageType.GroupDisband,
		].includes(message.message.type as ControlEventMessageType)
	}

	/**
	 * 应用控制类消息
	 * @param message 待应用的消息
	 * @param options 应用选项
	 */
	apply(message: SeqResponse<CMessage>, options: ApplyMessageOptions = {}) {
		const { isHistoryMessage = false } = options
		console.log("message type", message.message.type)

		switch (message.message.type) {
			case ControlEventMessageType.OpenConversation:
			case ControlEventMessageType.CreateConversation:
				this.applyOpenConversationMessage(message)
				break
			case ControlEventMessageType.SeenMessages:
				this.applySeenMessage(message as SeqResponse<SeenMessage>)
				break
			case ControlEventMessageType.MuteConversation:
				this.applyMuteConversationMessage(message as SeqResponse<MuteConversationMessage>)
				break
			case ControlEventMessageType.TopConversation:
				this.applyTopConversationMessage(message as SeqResponse<TopConversationMessage>)
				break
			case ControlEventMessageType.HideConversation:
				this.applyHideConversationMessage(message, isHistoryMessage)
				break
			case ControlEventMessageType.CreateTopic:
				this.applyCreateTopicMessage(message as SeqResponse<CreateTopicMessage>)
				break
			case ControlEventMessageType.UpdateTopic:
				this.applyUpdateTopicMessage(message as SeqResponse<UpdateTopicMessage>)
				break
			case ControlEventMessageType.DeleteTopic:
				this.applyDeleteTopicMessage(message as SeqResponse<DeleteTopicMessage>)
				break
			case ControlEventMessageType.GroupCreate:
			case ControlEventMessageType.GroupAddMember:
			case ControlEventMessageType.GroupUpdate:
				this.applyGroupBasicMessage(
					message as SeqResponse<
						GroupAddMemberMessage | GroupCreateMessage | GroupUpdateMessage
					>,
				)
				break
			case ControlEventMessageType.GroupUsersRemove:
				this.applyGroupUsersRemoveMessage(message as SeqResponse<GroupUsersRemoveMessage>)
				break
			case ControlEventMessageType.GroupDisband:
				this.applyGroupDisbandMessage(message as SeqResponse<GroupDisbandMessage>)
				break
			case ControlEventMessageType.RevokeMessage:
				this.applyRevokeMessage(message as SeqResponse<RevokeMessage>)
				break
			case ControlEventMessageType.AddFriendSuccess:
				this.applyAddFriendSuccessMessage(message as SeqResponse<AddFriendSuccessMessage>)
				break
			default:
				break
		}
	}

	/**
	 * 应用添加好友成功消息
	 * @param message 添加好友成功消息对象
	 */
	applyAddFriendSuccessMessage(message: SeqResponse<AddFriendSuccessMessage>) {
		const {
			add_friend_success: { receive_id, receive_type },
		} = message.message
		switch (receive_type) {
			case MessageReceiveType.Ai:
			case MessageReceiveType.User:
				userInfoService.fetchUserInfos([receive_id], 2)
				break
			case MessageReceiveType.Group:
				groupInfoService.fetchGroupInfos([receive_id])
				break
			default:
				break
		}
	}

	/**
	 * 应用群组基本消息
	 * @param message 群组基本消息对象
	 */
	applyGroupBasicMessage(message: SeqResponse<ConversationMessage>) {
		MessageService.addReceivedMessage(message)

		switch (message.message.type) {
			case ControlEventMessageType.GroupUpdate:
				const groupAddMessage = message as SeqResponse<GroupUpdateMessage>
				groupInfoService.updateGroupInfo(
					groupAddMessage.message.group_update.group_id,
					groupAddMessage.message.group_update,
				)
				break
			case ControlEventMessageType.GroupAddMember:
				groupInfoService.fetchGroupMembers(message.message.group_users_add.group_id)
				break
			default:
				break
		}
	}

	/**
	 * 判断是否是自己退群
	 * @param message 群组移除用户消息对象
	 * @param userId 用户 ID
	 * @returns 是否是自己退群
	 */
	isSelfLeaveGroup(message: GroupUsersRemoveMessage, userId?: string) {
		return (
			userId &&
			message.group_users_remove.user_ids.length &&
			message.group_users_remove.user_ids.includes(userId ?? "")
		)
	}

	/**
	 * 应用群组移除用户消息
	 * @param message 群组移除用户消息对象
	 */
	async applyGroupUsersRemoveMessage(message: SeqResponse<GroupUsersRemoveMessage>) {
		const userId = userStore.user.userInfo?.user_id
		if (this.isSelfLeaveGroup(message.message, userId)) {
			// 自己退群(处理方式可能待优化)
			// 直接移除群聊
			ConversationService.deleteConversation(message.conversation_id)
		}
		// 先获取用户信息，避免用户信息未加载
		await userInfoService.fetchUserInfos(message.message.group_users_remove.user_ids ?? [], 2)
		MessageService.addReceivedMessage(message)

		// 如果当前会话是群组，移除群组成员
		const currentConversation = conversationStore.currentConversation
		if (
			currentConversation?.receive_type === MessageReceiveType.Group &&
			currentConversation?.receive_id === message.message.group_users_remove.group_id
		) {
			groupInfoStore.removeGroupMembers(message.message.group_users_remove.user_ids ?? [])
		}
	}

	/**
	 * 应用群组解散消息
	 * @param message 群组解散消息对象
	 */
	applyGroupDisbandMessage(message: SeqResponse<ConversationMessage>) {
		MessageService.addReceivedMessage(message)

		ConversationService.updateConversationStatus(
			message.conversation_id,
			ConversationStatus.Deleted,
		)

		// 如果当前会话是群组解散的会话，则解散群组
		if (conversationStore.currentConversation?.id === message.conversation_id) {
			ConversationService.groupConversationDisband(message.conversation_id)
		}
	}

	/**
	 * 应用撤回消息
	 * @param message 撤回消息对象
	 */
	applyRevokeMessage(message: SeqResponse<RevokeMessage>) {
		// 把对应的消息设置为已撤回
		MessageService.flagMessageRevoked(
			message.conversation_id,
			message.message.topic_id || "",
			message.message.revoke_message.refer_message_id,
		)
	}

	/**
	 * 应用打开会话/创建会话消息
	 * @param message 消息对象
	 */
	applyOpenConversationMessage(message: SeqResponse<CMessage>) {
		console.log("applyOpenConversationMessage =====> ", message)
		if (
			message.message.type === ControlEventMessageType.OpenConversation ||
			message.message.type === ControlEventMessageType.CreateConversation
		) {
			const conversation = conversationStore.conversations[message.conversation_id]
			// 如果会话已存在，则不处理
			if (conversation) return

			// 获取会话列表
			ChatApi.getConversationList([message.conversation_id]).then(({ items }) => {
				if (items.length === 0) return
				console.log("applyOpenConversationMessage items", items)
				// 如果是单聊，尝试获取用户信息
				if (items[0].receive_type === MessageReceiveType.User) {
					userInfoService.fetchUserInfos([items[0].receive_id], 2)
				} else if (items[0].receive_type === MessageReceiveType.Group) {
					groupInfoService.fetchGroupInfos([items[0].receive_id])
				}
				ConversationService.addNewConversation(items[0])
			})
		}
	}

	/**
	 * 应用已读消息
	 * @param seenMessage 已读消息对象
	 */
	applySeenMessage(seenMessage: SeqResponse<SeenMessage>) {
		const targetMessageId = seenMessage.message.seen_messages.refer_message_ids[0]
		const conversationId = seenMessage.conversation_id
		const unreadCount = seenMessage.message.unread_count
		const topicId = seenMessage.message.topic_id ?? ""
		const tempId = seenMessage.message.app_message_id ?? ""

		if (tempId) {
			MessageService.updateMessageId(tempId, targetMessageId)
		}

		// 1. 先更新视图状态
		if (unreadCount === 0) {
			MessageService.updateMessageStatus(
				conversationId,
				topicId,
				targetMessageId,
				tempId,
				seenMessage,
			)
		}
		// 更新未读数
		MessageService.updateMessageUnreadCount(
			conversationId,
			topicId,
			targetMessageId,
			tempId,
			unreadCount,
		)
	}

	/**
	 * 应用静音会话消息
	 * @param message 静音消息对象
	 */
	applyMuteConversationMessage(message: SeqResponse<MuteConversationMessage>) {
		ConversationService.notDisturbConversation(
			message.conversation_id,
			message.message.mute_conversation.is_not_disturb,
		)
	}

	/**
	 * 应用置顶会话消息
	 * @param message 置顶消息对象
	 */
	applyTopConversationMessage(message: SeqResponse<TopConversationMessage>) {
		ConversationService.updateTopStatus(
			message.conversation_id,
			message.message.top_conversation.is_top,
		)
	}

	/**
	 * 应用隐藏会话消息
	 * @param message 消息对象
	 * @param isHistoryMessage 是否为历史消息
	 */
	applyHideConversationMessage(message: SeqResponse<CMessage>, isHistoryMessage: boolean) {
		// 如果是历史消息，忽略隐藏会话消息
		if (isHistoryMessage) {
			return
		}
		ConversationService.deleteConversation(message.conversation_id)
	}

	/**
	 * 应用创建主题消息
	 * @param message 创建主题消息对象
	 */
	applyCreateTopicMessage(message: SeqResponse<CreateTopicMessage>) {
		chatTopicService.applyCreateTopicMessage(message)
	}

	/**
	 * 应用更新主题消息
	 * @param message 更新主题消息对象
	 */
	applyUpdateTopicMessage(message: SeqResponse<UpdateTopicMessage>) {
		chatTopicService.applyUpdateTopicMessage(message)
	}

	/**
	 * 应用删除主题消息
	 * @param message 删除主题消息对象
	 */
	applyDeleteTopicMessage(message: SeqResponse<DeleteTopicMessage>) {
		chatTopicService.applyDeleteTopicMessage(message)
	}
}

export default new ControlMessageApplyService()
