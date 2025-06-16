import chatDb from "@/opensource/database/chat"
import type ChatDatabase from "@/opensource/database/chat/class-new"
import Topic from "@/opensource/models/chat/topic"
import type { ConversationTopic } from "@/types/chat/topic"
import { uniqBy } from "lodash-es"

class TopicDBServices {
	db: ChatDatabase

	constructor(db: ChatDatabase) {
		this.db = db
	}

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
	static getTopicCache(conversationId: string) {
		return chatDb.getTopicListTable()?.where("conversation_id").equals(conversationId).first()
	}

	/**
	 * 设置话题缓存
	 * @param conversationId 会话ID
	 * @param topicList 话题列表
	 */
	static setTopicCache(conversationId: string, topicList: ConversationTopic[]) {
		chatDb.getTopicListTable()?.put({ conversation_id: conversationId, topic_list: topicList })
	}

	/**
	 * 加载会话的话题列表
	 * @param conversationId 会话ID
	 * @returns 话题列表
	 */
	async loadTopicsFromDB(conversationId: string): Promise<Topic[]> {
		const result = await this.db
			.getTopicListTable()
			?.where("conversation_id")
			.equals(conversationId)
			.first()

		// 将 ConversationTopic 数组转换为 Topic 数组
		const topicList = result?.topic_list || []
		return topicList.map((topic) => new Topic(topic))
	}

	/**
	 * 保存话题列表到数据库
	 * @param conversationId 会话ID
	 * @param topics 话题列表
	 */
	saveTopicsToDB(conversationId: string, topics: Topic[]) {
		return this.db.getTopicListTable()?.put({
			conversation_id: conversationId,
			topic_list: topics,
		})
	}

	/**
	 * 添加单个话题到数据库
	 * @param topic 话题
	 */
	async addTopicToDB(topic: Topic) {
		const topics = await this.loadTopicsFromDB(topic.conversation_id)
		const newTopics = uniqBy([...topics, topic], "id")
		return this.saveTopicsToDB(topic.conversation_id, newTopics)
	}

	/**
	 * 更新话题
	 * @param topicId 话题ID
	 * @param conversationId 会话ID
	 * @param data 更新的数据
	 */
	async updateTopic(topicId: string, conversationId: string, data: Partial<ConversationTopic>) {
		const topics = await this.loadTopicsFromDB(conversationId)
		const updatedTopics = topics.map((topic) => {
			if (topic.id === topicId) {
				return new Topic({ ...topic, ...data, updated_at: Date.now() })
			}
			return topic
		})
		return this.saveTopicsToDB(conversationId, updatedTopics)
	}

	/**
	 * 删除话题
	 * @param topicId 话题ID
	 * @param conversationId 会话ID
	 */
	async deleteTopic(topicId: string, conversationId: string) {
		const topics = await this.loadTopicsFromDB(conversationId)
		const filteredTopics = topics.filter((topic) => topic.id !== topicId)
		return this.saveTopicsToDB(conversationId, filteredTopics)
	}

	/**
	 * 根据ID获取话题
	 * @param topicId 话题ID
	 * @param conversationId 会话ID
	 * @returns 话题
	 */
	async getTopicById(topicId: string, conversationId: string): Promise<Topic | undefined> {
		const topics = await this.loadTopicsFromDB(conversationId)
		return topics.find((topic) => topic.id === topicId)
	}

	/**
	 * 批量添加话题
	 * @param topics 话题列表
	 */
	async bulkAddTopics(topics: Topic[]) {
		if (topics.length === 0) return

		// 按会话ID分组
		const topicsByConversation = topics.reduce((acc, topic) => {
			if (!acc[topic.conversation_id]) {
				acc[topic.conversation_id] = []
			}
			acc[topic.conversation_id].push(topic)
			return acc
		}, {} as Record<string, Topic[]>)

		// 逐个会话保存话题
		await Promise.all(
			Object.entries(topicsByConversation).map(async ([conversationId, topicsToAdd]) => {
				const existingTopics = await this.loadTopicsFromDB(conversationId)
				const newTopics = [...existingTopics, ...topicsToAdd]
				return this.saveTopicsToDB(conversationId, newTopics)
			}),
		)
	}
}

export default new TopicDBServices(chatDb)
