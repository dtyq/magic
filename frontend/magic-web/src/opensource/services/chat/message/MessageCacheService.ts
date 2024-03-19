import type { FullMessage } from "@/opensource/types/chat/message"
import conversationStore from "@/opensource/stores/chatNew/conversation"
import topicStore from "@/opensource/stores/chatNew/topic"
import MessageCacheStore from "@/opensource/stores/chatNew/messageCache"
import type { User } from "@/opensource/types/user"
import MessageService from "./MessageService"
import { userStore } from "@/opensource/models/user"

interface PrewarmItem {
	conversationId: string
	topicId: string
	priority: number
}

class MessageCacheService {
	private readonly ADJACENT_COUNT = 5 // 前后各5个会话

	/**
	 * 预热会话
	 * @param conversationId 会话ID
	 * @param priority 优先级
	 * @returns 预热消息列表
	 */
	private async prewarmMessage(
		conversationId: string,
		topicId: string,
		priority: number,
		userInfo?: User.UserInfo | null,
	) {
		try {
			const messages = await MessageService.getMessagesByPage(
				conversationId,
				topicId,
				1,
				10,
				userInfo,
			)
			MessageCacheStore.set(conversationId, topicId, messages, priority)
			return messages
		} catch (error) {
			console.error("Failed to prewarm conversation:", error)
			return []
		}
	}

	/**
	 * 收集预热会话
	 * @returns 预热会话列表
	 */
	private collectPrewarmConversationItems(): PrewarmItem[] {
		const { conversations } = conversationStore
		if (!Object.keys(conversations).length) {
			return []
		}

		const items: PrewarmItem[] = []
		const conversationList = Object.values(conversations)
		const anchorConversation = conversationStore.currentConversation || conversationList[0]
		if (!anchorConversation) {
			return []
		}

		const anchorIndex = conversationList.findIndex((c) => c.id === anchorConversation.id)

		// 不需要预热当前会话
		// if (anchorConversation.last_receive_message) {
		// 	items.push({
		// 		conversationId: anchorConversation.id,
		// 		topicId: anchorConversation.current_topic_id,
		// 		priority: 1,
		// 	})
		// }

		// 获取前后各5个会话
		for (let i = 1; i <= this.ADJACENT_COUNT; i += 1) {
			// 前面的会话
			const prevIndex = anchorIndex - i
			if (prevIndex >= 0) {
				const prevConversation = conversationList[prevIndex]
				if (prevConversation?.last_receive_message) {
					// 优先级随距离递减
					const priority = 0.5 * (1 - i / (this.ADJACENT_COUNT + 1))
					items.push({
						conversationId: prevConversation.id,
						topicId: prevConversation.current_topic_id,
						priority,
					})
				}
			}

			// 后面的会话
			const nextIndex = anchorIndex + i
			if (nextIndex < conversationList.length) {
				const nextConversation = conversationList[nextIndex]
				if (nextConversation?.last_receive_message) {
					// 优先级随距离递减
					const priority = 0.5 * (1 - i / (this.ADJACENT_COUNT + 1))
					items.push({
						conversationId: nextConversation.id,
						topicId: nextConversation.current_topic_id,
						priority,
					})
				}
			}
		}

		// 其他会话最后
		conversationList.forEach((conversation) => {
			const isAdjacent =
				Math.abs(
					conversationList.findIndex((c) => c.id === conversation.id) - anchorIndex,
				) <= this.ADJACENT_COUNT

			if (!isAdjacent && conversation.last_receive_message) {
				items.push({
					conversationId: conversation.id,
					topicId: conversation.current_topic_id,
					priority: 0,
				})
			}
		})

		return items
	}

	/**
	 * 初始化会话消息
	 */
	initConversationsMessage(userInfo?: User.UserInfo | null) {
		const items = this.collectPrewarmConversationItems()
		if (!items.length) {
			return
		}

		// 如果用户信息不存在，则不预热
		if (!userInfo || !userInfo?.user_id) {
			userInfo = userStore.user.userInfo
		}

		// 按优先级排序
		items.sort((a, b) => b.priority - a.priority)

		let currentIndex = 0
		const processNextItem = () => {
			if (currentIndex >= items.length) return

			const item = items[currentIndex]
			this.prewarmMessage(item.conversationId, item.topicId, item.priority, userInfo)
			currentIndex += 1

			requestIdleCallback(() => processNextItem())
		}

		requestIdleCallback(() => processNextItem())
	}

	/**
	 * 收集预热话题
	 * @returns 预热话题列表
	 */
	private collectPrewarmTopicsItems(): PrewarmItem[] {
		const { topicList } = topicStore
		if (!topicList.length) {
			return []
		}

		if (!conversationStore.currentConversation) {
			return []
		}

		const currentTopic = conversationStore.currentConversation?.current_topic_id
		if (!currentTopic) {
			return []
		}

		const items: PrewarmItem[] = []
		// 不需要预热当前话题
		// items.push({
		// 	conversationId: conversationStore.currentConversation?.id,
		// 	topicId: currentTopic,
		// 	priority: 1,
		// })

		const anchorIndex = topicList.findIndex((t) => t.id === currentTopic)

		// 获取前后各5  个话题
		for (let i = 1; i <= this.ADJACENT_COUNT; i += 1) {
			// 前面的会话
			const prevIndex = anchorIndex - i
			if (prevIndex >= 0) {
				const prevTopic = topicList[prevIndex]
				if (prevTopic) {
					// 优先级随距离递减
					const priority = 0.5 * (1 - i / (this.ADJACENT_COUNT + 1))
					items.push({
						conversationId: conversationStore.currentConversation?.id,
						topicId: prevTopic.id,
						priority,
					})
				}
			}

			// 后面的会话
			const nextIndex = anchorIndex + i
			if (nextIndex < topicList.length) {
				const nextTopic = topicList[nextIndex]
				if (nextTopic) {
					// 优先级随距离递减
					const priority = 0.5 * (1 - i / (this.ADJACENT_COUNT + 1))
					items.push({
						conversationId: conversationStore.currentConversation?.id,
						topicId: nextTopic.id,
						priority,
					})
				}
			}
		}

		return items
	}

	/**
	 * 初始化话题消息
	 */
	initTopicsMessage(userInfo?: User.UserInfo | null) {
		const items = this.collectPrewarmTopicsItems()
		if (!items.length) {
			return
		}

		// 先获取当前用户信息，避免切换组织获取错误的信息
		if (!userInfo || !userInfo?.user_id) {
			userInfo = userStore.user.userInfo
		}

		items.sort((a, b) => b.priority - a.priority)

		let currentIndex = 0
		const processNextItem = () => {
			if (currentIndex >= items.length) return

			const item = items[currentIndex]
			this.prewarmMessage(item.conversationId, item.topicId, item.priority, userInfo)
			currentIndex += 1

			requestIdleCallback(() => processNextItem())
		}

		requestIdleCallback(() => processNextItem())
	}

	addConversation(conversationId: string, topicId: string) {
		requestIdleCallback(() => {
			this.prewarmMessage(conversationId, topicId, 1)
		})
	}

	getMessages(conversationId: string, topicId: string): FullMessage[] | undefined {
		return MessageCacheStore.get(conversationId, topicId)?.messages
	}

	clear(conversationId: string, topicId: string = "") {
		MessageCacheStore.clear(conversationId, topicId)
	}

	/**
	 * 判断是否存在缓存
	 * @param conversationId 会话ID
	 * @param topicId 话题ID
	 * @returns 是否存在缓存
	 */
	hasCache(conversationId: string, topicId: string) {
		return MessageCacheStore.has(conversationId, topicId)
	}

	/**
	 * 更新消息为已撤回
	 * @param conversationId 会话ID
	 * @param topicId 话题ID
	 * @param message_id 消息ID
	 */
	updateMessageRevoked(conversationId: string, topicId: string, message_id: string) {
		const cache = MessageCacheStore.get(conversationId, topicId)
		if (cache) {
			cache.messages = cache.messages.map((message) => {
				if (message.message_id === message_id) {
					message.revoked = true
				}
				return message
			})
		}
	}

	/**
	 * 删除缓存中的消息
	 * @param conversationId 会话ID
	 * @param messageId 消息ID
	 * @param topicId 话题ID
	 */
	removeMessageInCache(conversationId: string, messageId: string, topicId: string) {
		const cache = MessageCacheStore.get(conversationId, topicId)
		if (cache) {
			cache.messages = cache.messages.filter((message) => message.message_id !== messageId)
		}
	}

	/**
	 * 删除话题消息
	 * @param conversationId 会话ID
	 * @param topicId 话题ID
	 */
	removeTopicMessages(conversationId: string, topicId: string) {
		MessageCacheStore.clear(conversationId, topicId)
	}

	/**
	 * 更新消息
	 * @param conversationId 会话ID
	 * @param topicId 话题ID
	 * @param messageId 消息ID
	 * @param replace 替换函数
	 */
	updateMessage(
		conversationId: string,
		topicId: string,
		messageId: string,
		replace: FullMessage | ((message: FullMessage) => FullMessage),
	): FullMessage | undefined {
		const cache = MessageCacheStore.get(conversationId, topicId)
		if (cache) {
			const messageIndex = cache.messages.findIndex((m) => m.message_id === messageId)
			if (messageIndex !== -1) {
				cache.messages[messageIndex] =
					typeof replace === "function" ? replace(cache.messages[messageIndex]) : replace
				return cache.messages[messageIndex]
			}
		}
		return undefined
	}
}

export default new MessageCacheService()
