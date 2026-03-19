import Topic from "@/models/chat/topic"
import type { ConversationTopic } from "@/types/chat/topic"

class TopicCacheServices {
	topicCache: Map<string, Topic[]> = new Map()

	/**
	 * 获取话题缓存key
	 * @param conversationId 会话ID
	 * @returns 话题缓存key
	 */
	static getTopicCacheKey(conversationId: string) {
		return `topic_${conversationId}`
	}

	/**
	 * 获取话题缓存
	 * @param conversationId 会话ID
	 * @returns 话题列表
	 */
	getTopicCache(conversationId: string): Topic[] | undefined {
		return this.topicCache.get(conversationId)
	}

	/**
	 * 判断话题缓存是否存在
	 * @param conversationId 会话ID
	 * @returns 是否存在
	 */
	hasTopicCache(conversationId: string): boolean {
		return this.topicCache.has(conversationId)
	}

	/**
	 * 设置话题缓存
	 * @param conversationId 会话ID
	 * @param topicList 话题列表
	 */
	setTopicCache(conversationId: string, topicList: Topic[]): void {
		this.topicCache.set(conversationId, topicList)
	}

	/**
	 * 清除指定会话的话题缓存
	 * @param conversationId 会话ID
	 */
	clearTopicCache(conversationId: string): void {
		this.topicCache.delete(conversationId)
	}

	/**
	 * 清除所有话题缓存
	 */
	clearAllTopicCache(): void {
		this.topicCache.clear()
	}

	/**
	 * 更新话题缓存中的特定话题
	 * @param conversationId 会话ID
	 * @param topicId 话题ID
	 * @param updates 话题更新内容
	 */
	updateTopicInCache(
		conversationId: string,
		topicId: string,
		updates: Partial<ConversationTopic>,
	): void {
		const topicList = this.getTopicCache(conversationId)
		if (!topicList) return

		const updatedTopicList = topicList.map((topic) => {
			if (topic.id === topicId) {
				return new Topic({ ...topic, ...updates, updated_at: Date.now() })
			}
			return topic
		})

		this.setTopicCache(conversationId, updatedTopicList)
	}

	/**
	 * 从话题缓存中删除话题
	 * @param conversationId 会话ID
	 * @param topicId 话题ID
	 */
	deleteTopicFromCache(conversationId: string, topicId: string): void {
		const topicList = this.getTopicCache(conversationId)
		if (!topicList) return

		const filteredTopicList = topicList.filter((topic) => topic.id !== topicId)
		this.setTopicCache(conversationId, filteredTopicList)
	}

	/**
	 * 添加话题到缓存
	 * @param conversationId 会话ID
	 * @param topic 话题
	 */
	addTopicToCache(conversationId: string, topic: Topic): void {
		const topicList = this.getTopicCache(conversationId) || []
		this.setTopicCache(conversationId, [...topicList, topic])
	}

	/**
	 * 根据ID从缓存中获取话题
	 * @param conversationId 会话ID
	 * @param topicId 话题ID
	 * @returns 话题
	 */
	getTopicById(conversationId: string, topicId: string): Topic | undefined {
		const topicList = this.getTopicCache(conversationId)
		if (!topicList) return undefined

		return topicList.find((topic) => topic.id === topicId)
	}
}

export default new TopicCacheServices()
