import { makeAutoObservable } from "mobx"
import type { Topic, TaskStatus } from "../../pages/Workspace/types"

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

	setFetchList(isFetchList: boolean) {
		this.isFetchList = isFetchList
	}

	setTopics(topics: Topic[]) {
		this.topics = topics
	}

	setSelectedTopic = (topic: Topic | null) => {
		this.selectedTopic = topic
	}

	updateTopic(topic: Topic) {
		const index = this.topics.findIndex((t) => t.id === topic.id)
		if (index !== -1) {
			this.topics[index] = topic
		}
		if (this.selectedTopic?.id === topic.id) {
			this.selectedTopic = topic
		}
	}

	updateTopicName(topicId: string, topicName: string) {
		const topic = this.topics.find((t) => t.id === topicId)
		if (topic) {
			topic.topic_name = topicName
		}
		if (this.selectedTopic?.id === topicId) {
			this.selectedTopic.topic_name = topicName
		}
	}

	updateTopicStatus(topicId: string, status: TaskStatus) {
		const topic = this.topics.find((t) => t.id === topicId)
		if (topic) {
			topic.task_status = status
		}
		if (this.selectedTopic?.id === topicId) {
			this.selectedTopic.task_status = status
		}
	}

	removeTopic(id: string) {
		this.topics = this.topics.filter((t) => t.id !== id)
		if (this.selectedTopic?.id === id) {
			this.selectedTopic = null
		}
	}

	cacheTopicState(projectId: string) {
		this.topicStateMap.set(projectId, {
			selectedTopic: this.selectedTopic,
			topics: this.topics,
		})
	}

	restoreTopicState(projectId: string) {
		const cached = this.topicStateMap.get(projectId)
		if (cached) {
			this.topics = cached.topics
			this.selectedTopic = cached.selectedTopic
		}
	}

	reset() {
		this.topics = []
		this.selectedTopic = null
		this.topicStateMap.clear()
	}
}

export default new TopicStore()
