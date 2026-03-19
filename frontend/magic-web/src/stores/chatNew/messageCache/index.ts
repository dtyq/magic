import type { FullMessage, MessagePage } from "@/types/chat/message"

interface ConversationMessages {
	cacheData: MessagePage
	lastUpdated: number
	priority: number
}

interface TargetType {
	id: string | null
	priority: number
	lastUpdated: number
}

class MessageCache {
	private cache: Map<string, ConversationMessages>

	private readonly maxSize: number

	private readonly maxMessages: number

	constructor(maxSize: number = 10, maxMessages: number = 50) {
		this.cache = new Map()
		this.maxSize = maxSize
		this.maxMessages = maxMessages
	}

	cacheKey(conversationId: string, topicId: string = "") {
		return `${conversationId}-${topicId}`
	}

	/**
	 * 设置会话消息，支持优先级
	 */
	public set(
		conversationId: string,
		topicId: string,
		cacheData: MessagePage,
		priority: number = 0,
	): void {
		if (this.cache.size >= this.maxSize && !this.cache.has(conversationId)) {
			this.removeLowestPriorityLRU()
		}

		const limitedMessages = cacheData?.messages?.slice(0, this.maxMessages)

		cacheData.messages = limitedMessages

		this.cache.set(this.cacheKey(conversationId, topicId), {
			cacheData,
			lastUpdated: Date.now(),
			priority,
		})
	}

	/**
	 * 获取会话消息
	 */
	public get(conversationId: string, topicId: string = ""): MessagePage {
		const conversation = this.cache.get(this.cacheKey(conversationId, topicId))
		if (conversation) {
			// 会话被切换为当前会话，更新最后更新时间
			conversation.lastUpdated = Date.now()
			return conversation.cacheData
		}

		return { messages: [] }
	}

	/**
	 * 分页获取会话消息
	 */
	public getPage(
		conversationId: string,
		topicId: string,
		page: number,
		pageSize: number,
	): MessagePage {
		const conversation = this.cache.get(this.cacheKey(conversationId, topicId ?? ""))
		if (conversation) {
			const { messages } = conversation.cacheData

			return {
				messages: messages.slice((page - 1) * pageSize, page * pageSize),
				page,
				pageSize,
				totalPages: conversation.cacheData.totalPages,
			}
		}
		return { messages: [] }
	}

	/**
	 * 增加多条消息
	 */
	public addMessages(conversationId: string, topicId: string, data: MessagePage) {
		const conversation = this.cache.get(this.cacheKey(conversationId, topicId))
		if (conversation) {
			conversation.cacheData.messages.push(...data.messages)
			conversation.cacheData.totalPages = data.totalPages
			conversation.cacheData.page = data.page
		}
	}

	/**
	 * 添加单条消息
	 */
	public addOrReplaceMessage(
		conversationId: string,
		topicId: string,
		message: FullMessage,
	): void {
		const cache = this.cache.get(this.cacheKey(conversationId, topicId))
		if (cache) {
			const cacheMessages = cache.cacheData.messages

			// 如果消息已存在，则替换
			const index = cacheMessages.findIndex((item) => item.message_id === message.message_id)
			if (index !== -1) {
				cacheMessages[index] = message
			} else {
				// 如果消息不存在，则添加
				cache.cacheData.messages.unshift(message)
				cache.cacheData.messages = cache.cacheData.messages.slice(0, this.maxMessages)
			}

			// 更新最后更新时间
			cache.lastUpdated = +Date.now()
		} else {
			this.set(conversationId, topicId, {
				page: 1,
				pageSize: 10,
				totalPages: 1,
				messages: [message],
			})
		}
	}

	/**
	 * 删除优先级最低且最久未使用的会话
	 */
	private removeLowestPriorityLRU(): void {
		let targetId: string | null = null
		let lowestPriority = Infinity
		let oldestTimestamp = Infinity

		const entries = [...this.cache.entries()]
		const target = entries.reduce<TargetType>(
			(lowest, [id, conversation]) => {
				const isLowerPriority = conversation.priority < lowest.priority
				const isSamePriorityButOlder =
					conversation.priority === lowest.priority &&
					conversation.lastUpdated < lowest.lastUpdated

				if (isLowerPriority || isSamePriorityButOlder) {
					return {
						id,
						priority: conversation.priority,
						lastUpdated: conversation.lastUpdated,
					}
				}
				return lowest
			},
			{
				id: null,
				priority: lowestPriority,
				lastUpdated: oldestTimestamp,
			},
		)

		targetId = target.id
		lowestPriority = target.priority
		oldestTimestamp = target.lastUpdated

		if (targetId) {
			this.cache.delete(targetId)
		}
	}

	/**
	 * 清除指定会话的缓存
	 */
	public clear(conversationId: string, topicId: string): void {
		this.cache.delete(this.cacheKey(conversationId, topicId))
	}

	/**
	 * 清除所有缓存
	 */
	public clearAll(): void {
		this.cache.clear()
	}

	/**
	 * 获取缓存大小
	 */
	public size(): number {
		return this.cache.size
	}

	/**
	 * 检查会话是否在缓存中
	 */
	public has(conversationId: string, topicId: string): boolean {
		return this.cache.has(this.cacheKey(conversationId, topicId))
	}

	/**
	 * 获取所有缓存的会话ID
	 */
	public getConversationIds(): string[] {
		return Array.from(this.cache.keys())
	}

	/**
	 * 更新会话优先级
	 */
	public updatePriority(conversationId: string, topicId: string, priority: number): void {
		const conversation = this.cache.get(this.cacheKey(conversationId, topicId))
		if (conversation) {
			conversation.priority = priority
			conversation.lastUpdated = Date.now()
		}
	}

	/**
	 * 根据发送者ID查找消息
	 * @param senderId 发送者ID
	 * @returns 找到的第一条消息，如果没有找到则返回 null
	 */
	public findMessageBySenderId(senderId: string): FullMessage | null {
		const allMessages = Array.from(this.cache.values()).flatMap(
			(messages) => messages.cacheData.messages,
		)

		return allMessages.find((msg) => msg.sender_id === senderId) || null
	}
}

// 单例
export default new MessageCache()
