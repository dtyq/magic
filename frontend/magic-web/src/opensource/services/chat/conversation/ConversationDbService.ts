/* eslint-disable class-methods-use-this */
import chatDb from "@/opensource/database/chat"
import Conversation from "@/opensource/models/chat/conversation"
import { ConversationObject } from "@/opensource/models/chat/conversation/types"
import { ConversationStatus } from "@/types/chat/conversation"
import { cloneDeep } from "lodash-es"

class ConversationDbServices {
	/**
	 * 从数据库加载会话
	 * @param organizationCode 组织编码
	 * @param userId 用户ID
	 * @returns 会话列表
	 */
	loadNormalConversationsFromDB(organizationCode: string, userId: string) {
		return chatDb
			.getConversationTable()
			?.where({
				user_organization_code: organizationCode,
				receive_organization_code: organizationCode,
				status: ConversationStatus.Normal,
				user_id: userId,
			})
			.toArray()
	}

	/**
	 * 获取会话
	 * @param conversationId 会话ID
	 * @returns 会话
	 */
	getConversation(conversationId: string): Promise<ConversationObject | undefined> {
		return chatDb
			.getConversationTable()
			?.where({ id: conversationId })
			.first()
			.then((c) => (c ? new Conversation(c) : undefined))
	}

	/**
	 * 保存会话到数据库
	 * @param conversation 会话
	 */
	addConversationsToDB(conversations: Conversation[]) {
		return chatDb
			.getConversationTable()
			.bulkPut(conversations.map((conversation) => cloneDeep(conversation.toObject())))
			.then((res) => {
				console.log("addConversation success", res)
			})
			.catch((err) => {
				console.error("addConversation error", err)
			})
	}

	/**
	 * 更新会话
	 * @param filteredConversationList 会话列表
	 */
	updateConversations(filteredConversationList: ConversationObject[]) {
		return chatDb.getConversationTable()?.bulkPut(filteredConversationList)
	}

	/**
	 * 更新会话
	 * @param id 会话ID
	 * @param data 更新的数据
	 */
	updateConversation(id: string, data: Partial<Conversation>) {
		return chatDb.getConversationTable()?.update(id, data)
	}

	/**
	 * 删除会话
	 * @param id 会话ID
	 */
	deleteConversation(id: string) {
		return chatDb.getConversationTable()?.delete(id)
	}

	deleteConversations(ids: string[]) {
		return chatDb.getConversationTable()?.bulkDelete(ids)
	}

	/**
	 * 更新会话当前话题ID
	 * @param id 会话ID
	 * @param topicId 话题ID
	 */
	updateCurrentTopicId(id: string, topicId: string) {
		return chatDb.getConversationTable()?.update(id, { current_topic_id: topicId })
	}

	/**
	 * 更新会话置顶状态
	 * @param id 会话ID
	 * @param isTop 是否置顶
	 */
	updateTopStatus(id: string, isTop: 0 | 1) {
		return chatDb.getConversationTable()?.update(id, { is_top: isTop })
	}

	/**
	 * 更新会话免打扰状态
	 * @param id 会话ID
	 * @param isNotDisturb 是否免打扰
	 */
	updateNotDisturbStatus(id: string, isNotDisturb: 0 | 1) {
		return chatDb.getConversationTable()?.update(id, { is_not_disturb: isNotDisturb })
	}

	/**
	 * 更新会话话题默认打开状态
	 * @param id 会话ID
	 * @param open 是否打开
	 */
	updateTopicDefaultOpen(id: string, open: boolean) {
		return chatDb.getConversationTable()?.update(id, { topic_default_open: open })
	}

	/**
	 * 更新会话状态（隐藏/显示）
	 * @param id 会话ID
	 * @param status 状态
	 */
	updateStatus(id: string, status: number) {
		return chatDb.getConversationTable()?.update(id, { status })
	}

	/**
	 * 更新会话未读数量
	 * @param id 会话ID
	 * @param unreadDots 未读数量
	 * @param topicUnreadDots 话题未读数量
	 */
	updateUnreadDots(id: string, unreadDots: number, topicUnreadDots: Record<string, number>) {
		return chatDb.getConversationTable()?.update(id, {
			unread_dots: unreadDots,
			topic_unread_dots: new Map(Object.entries(topicUnreadDots)),
		})
	}
}

export default new ConversationDbServices()
