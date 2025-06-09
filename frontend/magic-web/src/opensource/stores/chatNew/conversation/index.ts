/* eslint-disable class-methods-use-this */
import { ConversationGroupKey } from "@/const/chat"
import Conversation from "@/opensource/models/chat/conversation"
import { groupBy, keyBy } from "lodash-es"
import { makeAutoObservable } from "mobx"
import { getConversationGroupKey } from "@/opensource/services/chat/conversation/utils"
import { ConversationStatus, type ConversationFromService } from "@/types/chat/conversation"
import Logger from "@/utils/log/Logger"
import conversationSiderbarStore from "@/opensource/stores/chatNew/conversationSidebar"
import type { UserTask } from "@/types/chat/task"
import type { ConversationMessageType } from "@/types/chat/conversation_message"
import type { ControlEventMessageType } from "@/types/chat/control_message"

const console = new Logger("ConversationStore")

/**
 * 会话UI状态管理
 */
class ConversationStore {
	/**
	 * 当前会话
	 */
	currentConversation: Conversation | undefined

	/**
	 * 会话任务列表
	 */
	conversationTaskList: UserTask[] = []

	/**
	 * 话题打开状态
	 */
	topicOpen: boolean = false

	/**
	 * 配置面板打开状态
	 */
	settingOpen: boolean = false

	/**
	 * 会话输入状态
	 */
	conversationReceiveInputing: boolean = false

	/**
	 * 会话列表
	 */
	conversations: Record<string, Conversation> = {}

	/**
	 * 会话输入状态
	 */
	receive_inputing: boolean = false

	selectText: string = ""

	setSelectText(text: string) {
		this.selectText = text
	}

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	/**
	 * 添加新会话
	 * @param conversation 会话
	 * @returns 会话
	 */
	addNewConversation(conversation: ConversationFromService) {
		const c = new Conversation(conversation)
		this.conversations[conversation.id] = c

		let menuKey = getConversationGroupKey(this.conversations[conversation.id])

		if (c.is_top) {
			menuKey = ConversationGroupKey.Top
		}

		if (conversation.status === ConversationStatus.Normal) {
			conversationSiderbarStore.addConversationToGroup(menuKey, conversation.id)
		}

		return c
	}

	/**
	 * 设置当前会话
	 * @param conversation 会话
	 */
	setCurrentConversation(conversation: Conversation | undefined) {
		this.currentConversation = conversation
		this.topicOpen = conversation?.topic_default_open ?? false
		this.settingOpen = false
	}

	getCurrentConversation() {
		return this.currentConversation
	}

	getConversationLastMessage(conversationId: string) {
		const conversation = this.conversations[conversationId]
		if (!conversation) return null
		return conversation.last_receive_message
	}

	/**
	 * 切换设置面板开关状态
	 */
	toggleSettingOpen() {
		this.settingOpen = !this.settingOpen
	}

	/**
	 * 设置会话列表
	 * @param conversations 会话列表
	 */
	setConversations(conversations: Conversation[]) {
		this.conversations = keyBy(conversations, "id")
	}

	/**
	 * 更新会话主题默认打开状态
	 * @param open 是否打开
	 */
	setTopicOpen(open: boolean) {
		this.topicOpen = open
	}

	/**
	 * 更新会话置顶状态
	 * @param conversationId 会话ID
	 * @param isTop 是否置顶 (1: 置顶, 0: 不置顶)
	 */
	updateTopStatus(conversationId: string, isTop: 0 | 1) {
		const conversation = this.conversations[conversationId]
		if (!conversation) return

		const conversationGroupKey = conversation.isGroupConversation
			? ConversationGroupKey.Group
			: ConversationGroupKey.Single

		// 更新分组
		const oldGroupKey = isTop ? conversationGroupKey : ConversationGroupKey.Top
		const newGroupKey = isTop ? ConversationGroupKey.Top : conversationGroupKey

		// 从旧分组中移除
		conversationSiderbarStore.removeConversationFromGroup(oldGroupKey, conversationId)

		// 添加到新分组
		conversationSiderbarStore.addConversationToGroup(newGroupKey, conversationId)

		// 实际的 GroupKey
		const actualGroupKey = getConversationGroupKey(conversation)

		if (isTop) {
			// 将会话移动到分组顶部
			conversationSiderbarStore.moveConversationFirst(conversationId, actualGroupKey)
		} else {
			// 将会话移动到所有置顶会话的下面
			conversationSiderbarStore.moveAfterTopConversations(conversationId, actualGroupKey)
		}

		// 更新置顶状态
		conversation.is_top = isTop
	}

	/**
	 * 更新会话免打扰状态
	 * @param conversationId 会话ID
	 * @param isNotDisturb 是否免打扰 (1: 免打扰, 0: 不免打扰)
	 */
	updateConversationDisturbStatus(conversationId: string, isNotDisturb: 0 | 1) {
		const conversation = this.conversations[conversationId]
		if (!conversation) return
		conversation.setNotDisturb(isNotDisturb)
	}

	/**
	 * 更新会话状态
	 * @param conversationId 会话ID
	 * @param status 状态值
	 */
	updateConversationStatus(conversationId: string, status: number) {
		const conversation = this.conversations[conversationId]
		if (!conversation) return

		conversation.setStatus(status)
	}

	/**
	 * 更新会话主题默认打开状态
	 * @param conversationId 会话ID
	 * @param open 是否默认打开
	 */
	updateConversationTopicDefaultOpen(conversationId: string, open: boolean) {
		const conversation = this.conversations[conversationId]
		if (!conversation) return

		conversation.setTopicDefaultOpen(open)
	}

	/**
	 * 更新会话当前话题ID
	 * @param conversationId 会话ID
	 * @param topicId 话题ID
	 */
	updateConversationCurrentTopicId(conversationId: string, topicId: string) {
		const conversation = this.conversations[conversationId]
		if (!conversation) return

		if (this.currentConversation?.id === conversationId) {
			this.currentConversation.setCurrentTopicId(topicId)
		}
		conversation.setCurrentTopicId(topicId)
	}

	/**
	 * 更新会话最后一条消息
	 * @param conversationId 会话ID
	 * @param message 最后一条消息
	 */
	updateConversationLastMessage(
		conversationId: string,
		message:
			| {
					time: number
					seq_id: string
					text: string
					topic_id: string
					type: ConversationMessageType | ControlEventMessageType
			  }
			| undefined,
	) {
		const conversation = this.conversations[conversationId]
		if (!conversation) return

		conversation.setLastReceiveMessageAndLastReceiveTime(message)
	}

	/**
	 * 初始化会话列表
	 * @param conversations 会话列表
	 */
	initConversations(conversations: Conversation[]) {
		conversations.forEach((conversation) => {
			this.conversations[conversation.id] = new Conversation(conversation)
		})

		const result = this.calcSidebarConversations(
			Object.keys(this.conversations),
			this.conversations,
		)

		// 更新侧边栏分组
		Object.entries(result).forEach(([key, value]) => {
			this.updateSidebarGroup(key as ConversationGroupKey, value)
		})
	}

	/**
	 * 排序会话
	 * @param convA 会话A
	 * @param convB 会话B
	 * @returns 排序结果
	 */
	sortConversations(convA: Conversation, convB: Conversation) {
		// 置顶会话排在最前面
		if (convA.is_top && !convB.is_top) {
			return -1
		}

		if (!convA.is_top && convB.is_top) {
			return 1
		}

		// 没有消息的会话排在最后
		if (!convA.last_receive_message && !convB.last_receive_message) {
			return 0
		}

		// 没有消息的会话排在最后
		if (!convA.last_receive_message) {
			return 1
		}

		if (!convB.last_receive_message) {
			return -1
		}

		// 按照最后一条消息的时间排序
		return convB.last_receive_message.time - convA.last_receive_message.time
	}

	/**
	 * 计算侧边栏会话
	 * @param conversations 会话列表
	 * @returns 会话组
	 */
	calcSidebarConversations(ids: string[], conversations: Record<string, Conversation>) {
		const top = new Set<string>()

		const {
			[ConversationGroupKey.User]: userConversations = [],
			[ConversationGroupKey.AI]: aiConversations = [],
			[ConversationGroupKey.Group]: groupConversations = [],
			[ConversationGroupKey.Other]: otherConversations = [],
		} = groupBy(ids, (id) => {
			if (conversations[id].is_top) {
				top.add(id)
			}

			return getConversationGroupKey(conversations[id])
		})

		const singleConversations = [...userConversations, ...aiConversations].filter(
			(id) => !top.has(id),
		)

		const singleConversationsSorted = singleConversations.sort((a, b) =>
			this.sortConversations(conversations[a], conversations[b]),
		)

		return {
			[ConversationGroupKey.Top]: Array.from(top).sort((a, b) =>
				this.sortConversations(conversations[a], conversations[b]),
			),
			[ConversationGroupKey.Single]: singleConversationsSorted,
			[ConversationGroupKey.User]: userConversations.sort((a, b) =>
				this.sortConversations(conversations[a], conversations[b]),
			),
			[ConversationGroupKey.AI]: aiConversations.sort((a, b) =>
				this.sortConversations(conversations[a], conversations[b]),
			),
			[ConversationGroupKey.Group]: groupConversations.sort((a, b) =>
				this.sortConversations(conversations[a], conversations[b]),
			),
			[ConversationGroupKey.Other]: otherConversations.sort((a, b) =>
				this.sortConversations(conversations[a], conversations[b]),
			),
		}
	}

	/**
	 * 更新会话组
	 * @param menuKey 菜单组
	 * @param ids 会话ID列表
	 */
	updateSidebarGroup(menuKey: ConversationGroupKey, ids: string[]) {
		conversationSiderbarStore.updateConversationSiderbarGroups(menuKey, ids)
	}

	/**
	 * 从会话组中移除会话
	 * @param menuKey 菜单组
	 * @param id 会话ID
	 */
	removeConversation(id: string): string | undefined {
		if (!id) return undefined

		const conversation = this.getConversation(id)
		if (!conversation) return undefined

		let menuKey = getConversationGroupKey(conversation)

		if (conversation.is_top) {
			menuKey = ConversationGroupKey.Top
		}

		const nextConversationId = conversationSiderbarStore.removeConversationFromGroup(
			menuKey,
			id,
		)

		this.removeConversationRecord(id)

		return nextConversationId
	}

	/**
	 * 从会话列表中移除会话
	 * @param ids 会话ID列表
	 */
	removeConversations(ids: string[]) {
		ids.forEach((id) => this.removeConversation(id))
	}

	/**
	 * 将会话移动到指定分组的开头
	 * @param targetGroupKey 目标分组
	 * @param conversationId 会话ID
	 */
	moveConversationToGroupTop(targetGroupKey: ConversationGroupKey, conversationId: string) {
		const currentGroup = conversationSiderbarStore
			.getConversationSiderbarGroup(targetGroupKey)
			.filter((id) => id !== conversationId)

		conversationSiderbarStore.updateConversationSiderbarGroups(targetGroupKey, [
			conversationId,
			...currentGroup,
		])
	}

	/**
	 * 将会话从一个分组移动到另一个分组的开头
	 * @param fromGroupKey 源分组
	 * @param toGroupKey 目标分组
	 * @param conversationId 会话ID
	 */
	moveConversationBetweenGroups(
		fromGroupKey: ConversationGroupKey,
		toGroupKey: ConversationGroupKey,
		conversationId: string,
	) {
		// 从源分组中移除
		const sourceGroup = conversationSiderbarStore
			.getConversationSiderbarGroup(fromGroupKey)
			.filter((id) => id !== conversationId)

		// 准备目标分组
		const targetGroup = conversationSiderbarStore
			.getConversationSiderbarGroup(toGroupKey)
			.filter((id) => id !== conversationId)

		// 一次性更新所有变化
		conversationSiderbarStore.updateConversationSiderbarGroups(fromGroupKey, sourceGroup)
		conversationSiderbarStore.updateConversationSiderbarGroups(toGroupKey, [
			conversationId,
			...targetGroup,
		])
	}

	/**
	 * 从会话列表中移除会话
	 * @param id 会话ID
	 */
	removeConversationRecord(id: string) {
		if (this.conversations[id]) {
			// 如果要删除的是当前会话，清空当前会话
			if (this.currentConversation?.id === id) {
				this.currentConversation = undefined
				this.receive_inputing = false
			}

			// 从会话列表中删除
			const { [id]: removed, ...rest } = this.conversations
			this.conversations = rest
		}
	}

	/**
	 * 更新会话输入状态
	 * @param arg1 输入状态
	 */
	updateConversationReceiveInputing(conversationId: string, arg1: boolean) {
		const conversation = this.conversations[conversationId]
		if (!conversation) return

		conversation.setReceiveInputing(arg1)
	}

	/**
	 * 增加会话红点
	 * @param conversationId 会话ID
	 * @param dots 红点数量
	 */
	addConversationDots(conversationId: string, dots: number) {
		const conversation = this.conversations[conversationId]
		if (!conversation) return

		conversation.addUnreadDots(dots)

		console.log("addConversationDots ====> ", conversation, dots)
	}

	/**
	 * 减少会话红点
	 * @param conversationId 会话ID
	 * @param dots 红点数量
	 */
	reduceConversationDots(conversationId: string, dots: number) {
		const conversation = this.conversations[conversationId]
		if (!conversation) return

		conversation.reduceUnreadDots(dots)
	}

	/**
	 * 重置会话红点
	 * @param conversationId 会话ID
	 */
	resetConversationDots(conversationId: string) {
		const conversation = this.conversations[conversationId]
		if (!conversation) return

		conversation.resetUnreadDots()
	}

	/**
	 * 获取会话红点
	 * @param conversationId 会话ID
	 * @returns 红点数量
	 */
	getConversationDots(conversationId: string) {
		const conversation = this.conversations[conversationId]
		if (!conversation) return 0

		return conversation.unread_dots
	}

	/**
	 * 获取会话所有话题未读数量
	 * @param conversationId 会话ID
	 * @returns 所有话题未读数量
	 */
	getAllTopicUnreadDots(conversationId: string) {
		const conversation = this.conversations[conversationId]
		if (!conversation) return new Map()
		return conversation.topic_unread_dots
	}

	/**
	 * 获取会话话题未读数量
	 * @param conversationId 会话ID
	 * @param topicId 话题ID
	 * @returns 未读数量
	 */
	getTopicUnreadDots(conversationId: string, topicId: string) {
		const conversation = this.conversations[conversationId]
		if (!conversation) return 0

		return conversation.topic_unread_dots.get(topicId) || 0
	}

	/**
	 * 增加会话话题未读数量
	 * @param conversationId   会话ID
	 * @param topicId 话题ID
	 * @param dots 未读数量
	 */
	addTopicUnreadDots(conversationId: string, topicId: string, dots: number) {
		const conversation = this.conversations[conversationId]
		if (!conversation) return
		conversation.addTopicUnreadDots(topicId, dots)
	}

	/**
	 * 减少会话话题未读数量
	 * @param conversationId 会话ID
	 * @param topicId 话题ID
	 * @param dots 未读数量
	 */
	reduceTopicUnreadDots(conversationId: string, topicId: string, dots: number) {
		const conversation = this.conversations[conversationId]
		if (!conversation) return
		conversation.reduceTopicUnreadDots(topicId, dots)
	}

	/**
	 * 重置会话话题未读数量
	 * @param conversationId 会话ID
	 */
	resetTopicUnreadDots(conversationId: string) {
		const conversation = this.conversations[conversationId]
		if (!conversation) return

		conversation.resetAllTopicUnreadDots()
	}

	/**
	 * 判断会话是否存在
	 * @param id 会话ID
	 * @returns 是否存在
	 */
	hasConversation(id: string) {
		return this.conversations[id]
	}

	getConversation(id: string) {
		return this.conversations[id]
	}

	setConversationTaskList(items: UserTask[]) {
		this.conversationTaskList = items
	}

	updateConversations(filteredConversationList: ConversationFromService[]) {
		filteredConversationList.forEach((conversation) => {
			if (this.conversations[conversation.id]) {
				this.conversations[conversation.id]?.updateFromRemote(conversation)
			} else {
				this.conversations[conversation.id] = new Conversation(conversation)
			}
		})
	}

	reset() {
		this.conversations = {}
		this.currentConversation = undefined
		this.conversationTaskList = []
		this.topicOpen = false
		this.settingOpen = false
		this.conversationReceiveInputing = false
		this.selectText = ""
	}
}

export default new ConversationStore()
