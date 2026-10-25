import { makeAutoObservable } from "mobx"
import type { Topic, TaskStatus } from "../../pages/Workspace/types"

/** Detail before persistence has no topic_mode. Keep the local employee. */
function keepLocalEmployeeWhenDetailIsEmpty(
	listed: Topic | undefined,
	selected: Topic | null,
	incoming: Topic,
): Topic {
	if (incoming.topic_mode) return incoming
	const current = listed?.topic_mode ? listed : selected?.topic_mode ? selected : null
	if (!current?.topic_mode) return incoming
	return {
		...incoming,
		topic_mode: current.topic_mode,
		agent_code: current.agent_code,
	}
}

interface TopicState {
	selectedTopic: Topic | null
	topics: Topic[]
}

export class TopicStore {
	topics: Topic[] = []
	selectedTopic: Topic | null = null
	topicStateMap: Map<string, TopicState> = new Map()
	isFetchList: boolean = false

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	/** 标记话题列表是否处于拉取中，供 UI 展示加载态。 */
	setFetchList(isFetchList: boolean) {
		this.isFetchList = isFetchList
	}

	/** 整体替换当前工程下的话题列表。 */
	setTopics(topics: Topic[]) {
		this.topics = topics
	}

	/** 设置当前用户正在查看的话题。 */
	setSelectedTopic = (topic: Topic | null) => {
		this.selectedTopic = topic
	}

	/**
	 * Replace one topic with a server entity.
	 * Keep a local employee when that entity is still an empty topic.
	 */
	updateTopic(topic: Topic) {
		const nextTopic = keepLocalEmployeeWhenDetailIsEmpty(
			this.topics.find((item) => item.id === topic.id),
			this.selectedTopic?.id === topic.id ? this.selectedTopic : null,
			topic,
		)
		const index = this.topics.findIndex((t) => t.id === topic.id)
		if (index !== -1) {
			this.topics[index] = nextTopic
		}
		if (this.selectedTopic?.id === topic.id) {
			this.selectedTopic = nextTopic
		}
	}

	/**
	 * 将接口返回的局部字段合并进列表与当前选中话题。
	 * 通过替换 `topics` 数组项引用，让依赖 `storeTopics` 引用的 React 合并逻辑（如 `usePaginatedTopics`）能稳定重算。
	 */
	mergeTopic(topicId: string, patch: Partial<Topic>) {
		if (this.topics.some((item) => item.id === topicId)) {
			this.topics = this.topics.map((item) =>
				item.id === topicId ? { ...item, ...patch } : item,
			)
		}

		if (this.selectedTopic?.id === topicId) {
			this.selectedTopic = { ...this.selectedTopic, ...patch }
		}
	}

	/** 仅更新话题标题，并保持列表与选中项引用一致。 */
	updateTopicName(topicId: string, topicName: string) {
		this.topics = this.topics.map((topic) =>
			topic.id === topicId ? { ...topic, topic_name: topicName } : topic,
		)
		if (this.selectedTopic?.id === topicId) {
			this.selectedTopic = { ...this.selectedTopic, topic_name: topicName }
		}
	}

	/** 更新任务状态（原地字段），用于轮询或流式进度。 */
	updateTopicStatus(topicId: string, status: TaskStatus) {
		const topic = this.topics.find((t) => t.id === topicId)
		if (topic) {
			topic.task_status = status
		}
		if (this.selectedTopic?.id === topicId) {
			this.selectedTopic.task_status = status
		}
	}

	/** 从列表移除话题；若移除的是当前选中项则清空选中。 */
	removeTopic(id: string) {
		this.topics = this.topics.filter((t) => t.id !== id)
		if (this.selectedTopic?.id === id) {
			this.selectedTopic = null
		}
	}

	/** 按工程缓存当前列表与选中态，便于切换工程后恢复。 */
	cacheTopicState(projectId: string) {
		this.topicStateMap.set(projectId, {
			selectedTopic: this.selectedTopic,
			topics: this.topics,
		})
	}

	/** 从缓存恢复指定工程的话题列表与选中话题。 */
	restoreTopicState(projectId: string) {
		const cached = this.topicStateMap.get(projectId)
		if (cached) {
			this.topics = cached.topics
			this.selectedTopic = cached.selectedTopic
		}
	}

	/** 清空 store（登出或离开工作区聚合页等场景）。 */
	reset() {
		this.topics = []
		this.selectedTopic = null
		this.topicStateMap.clear()
	}
}

export default new TopicStore()
