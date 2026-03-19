import type { ConversationTopic } from "@/types/chat/topic"

class Topic implements ConversationTopic {
	/**
	 * 话题ID
	 */
	id: string

	/**
	 * 话题名称
	 */
	name: string

	/**
	 * 话题描述
	 */
	description: string

	/**
	 * 所属会话ID
	 */
	conversation_id: string

	/**
	 * 创建时间
	 */
	created_at?: number

	/**
	 * 更新时间
	 */
	updated_at?: number

	constructor(data: ConversationTopic) {
		this.id = data.id
		this.name = data.name
		this.description = data.description
		this.conversation_id = data.conversation_id
		this.created_at = data.created_at || Date.now()
		this.updated_at = data.updated_at || Date.now()
	}

	/**
	 * 更新话题名称
	 * @param name 新名称
	 */
	updateName(name: string) {
		this.name = name
		this.updated_at = Date.now()
	}

	/**
	 * 更新话题描述
	 * @param description 新描述
	 */
	updateDescription(description: string) {
		this.description = description
		this.updated_at = Date.now()
	}

	/**
	 * 克隆话题
	 * @returns 新的话题实例
	 */
	clone(): Topic {
		return new Topic({
			id: this.id,
			name: this.name,
			description: this.description,
			conversation_id: this.conversation_id,
			created_at: this.created_at,
			updated_at: this.updated_at,
		})
	}
}

export default Topic
