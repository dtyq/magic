import type Topic from "@/opensource/models/chat/topic"
import { t } from "i18next"
import { makeAutoObservable } from "mobx"

/**
 * 话题 UI 状态管理
 */
class TopicStore {
	/**
	 * 话题列表
	 */
	topicList: Topic[] = []

	/**
	 * 是否正在加载话题列表
	 */
	isLoading: boolean = false

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	get timeTaskTopicList() {
		return this.topicList.map((topic) => ({
			label: topic.name || t("chat.topic.newTopic", { ns: "interface" }),
			value: topic.id,
		}))
	}

	getTopicName(topicId: string) {
		return this.topicList.find((topic) => topic.id === topicId)?.name
	}

	/**
	 * 设置话题列表
	 * @param topicList 话题列表
	 */
	setTopicList(topicList: Topic[]) {
		this.topicList = topicList
	}

	/**
	 * 设置加载状态
	 * @param loading 是否加载中
	 */
	setLoading(loading: boolean) {
		this.isLoading = loading
	}

	/**
	 * 添加话题到列表头部
	 * @param topic 话题
	 */
	unshiftTopic(topic: Topic) {
		if (this.topicList.find((tt) => tt.id === topic.id)) {
			return
		}
		this.topicList = [topic, ...this.topicList]
	}

	/**
	 * 添加话题到列表
	 * @param topic 话题
	 */
	addTopic(topic: Topic) {
		if (this.topicList.find((tt) => tt.id === topic.id)) {
			return
		}
		this.topicList.push(topic)
	}

	/**
	 * 更新话题
	 * @param topicId 话题ID
	 * @param updates 更新内容
	 */
	updateTopic(topicId: string, updates: Partial<Topic>) {
		const index = this.topicList.findIndex((topic) => topic.id === topicId)
		console.log("updateTopic ====== ", index, updates)

		if (index !== -1) {
			// 创建新的话题数组，以触发mobx的响应式更新
			const updatedTopicList = [...this.topicList]
			const topic = updatedTopicList[index]

			// 更新属性
			Object.entries(updates).forEach(([key, value]) => {
				// @ts-ignore
				topic[key] = value
			})

			// 如果包含名称更新，调用专门的方法
			if (updates.name) {
				topic.updateName(updates.name)
			}

			// 如果包含描述更新，调用专门的方法
			if (updates.description) {
				topic.updateDescription(updates.description)
			}

			// 替换整个数组以确保视图更新
			this.topicList = updatedTopicList
		}
	}

	/**
	 * 替换特定话题
	 * @param oldTopicId 旧话题ID
	 * @param newTopic 新话题
	 */
	replaceTopic(oldTopicId: string, newTopic: Topic) {
		const index = this.topicList.findIndex((topic) => topic.id === oldTopicId)
		if (index !== -1) {
			this.topicList[index] = newTopic
		}
	}

	/**
	 * 删除话题
	 * @param topicId 话题ID
	 */
	removeTopic(topicId: string) {
		this.topicList = this.topicList.filter((topic) => topic.id !== topicId)
	}

	/**
	 * 清空话题列表
	 */
	clearTopicList() {
		this.topicList = []
	}

	/**
	 * 根据ID获取话题
	 * @param topicId 话题ID
	 * @returns 话题
	 */
	getTopicById(topicId: string): Topic | undefined {
		return this.topicList.find((topic) => topic.id === topicId)
	}
}

export default new TopicStore()
