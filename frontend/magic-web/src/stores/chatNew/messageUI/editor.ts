import { JSONContent } from "@tiptap/core"
import { makeAutoObservable } from "mobx"

class EditorStore {
	lastConversationId = ""

	lastTopicId = ""

	/** 当前会话id */
	conversationId = ""

	/** 当前主题id */
	topicId = ""

	/** 值 */
	value: string | JSONContent | undefined = undefined

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	/** 是否有效内容 */
	get isValidContent() {
		if (this.value === undefined || this.value === null) return false
		// 简单检查是否有type属性
		if (typeof this.value === "object" && "type" in this.value) return true
		return false
	}

	/**
	 * 设置上一次会话id
	 * @param conversationId 会话id
	 */
	setLastConversationId(conversationId: string) {
		this.lastConversationId = conversationId
	}

	/**
	 * 设置上一次主题id
	 * @param topicId 主题id
	 */
	setLastTopicId(topicId: string) {
		this.lastTopicId = topicId
	}

	/**
	 * 设置当前会话id
	 * @param conversationId 会话id
	 */
	setConversationId(conversationId: string) {
		this.conversationId = conversationId
	}

	/**
	 * 设置当前主题id
	 * @param topicId 主题id
	 */
	setTopicId(topicId: string) {
		this.topicId = topicId
	}

	/**
	 * 设置值
	 * @param value 值
	 */
	setValue = (value: string | JSONContent | undefined) => {
		this.value = value
	}
}

export default new EditorStore()
