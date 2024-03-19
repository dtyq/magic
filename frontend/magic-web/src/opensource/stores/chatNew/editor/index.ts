import { makeAutoObservable } from "mobx"

class EditorStore {
	/** 会话id */
	conversationId: string | undefined
	/** 主题id */
	topicId: string | undefined
	/** 值 */
	value: string = ""

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

	/** 初始化 */
	switch(conversationId: string, topicId: string = "") {
		this.conversationId = conversationId
		this.topicId = topicId
	}

	/**
	 * 设置值
	 * @param value 值
	 */
	setValue = (value: string) => {
		this.value = value
	}
}

export default new EditorStore()
