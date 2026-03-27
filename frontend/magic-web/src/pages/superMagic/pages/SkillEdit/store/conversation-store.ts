import { makeAutoObservable } from "mobx"
import { SuperMagicApi } from "@/apis"
import { TopicStore } from "@/pages/superMagic/stores/core/topic"
import { type ProjectListItem, type TaskStatus, type Topic } from "../../Workspace/types"

interface ConversationHydration {
	project: ProjectListItem | null
	topics: Topic[]
	selectedTopicId?: string | null
}

export class SkillConversationStore {
	selectedProject: ProjectListItem | null = null
	topicStore: TopicStore = new TopicStore()
	isConversationGenerating = false

	constructor() {
		makeAutoObservable(this, { topicStore: false }, { autoBind: true })
	}

	hydrate({ project, topics, selectedTopicId }: ConversationHydration) {
		this.selectedProject = project
		this.topicStore.setTopics(topics)

		if (topics.length === 0) {
			this.topicStore.setSelectedTopic(null)
			return
		}

		const targetTopic = topics.find((topic) => topic.id === selectedTopicId)
		this.topicStore.setSelectedTopic(targetTopic || topics[0])
	}

	async loadProjectContext(projectId: string): Promise<void> {
		const project = await SuperMagicApi.getProjectDetail({ id: projectId })
		if (!project) {
			this.reset()
			return
		}

		const response = await SuperMagicApi.getTopicsByProjectId({
			id: project.id,
			page: 1,
			page_size: 999,
		})

		this.hydrate({
			project,
			topics: response.list,
			selectedTopicId: project.current_topic_id,
		})
	}

	setConversationGenerating(isGenerating: boolean) {
		this.isConversationGenerating = isGenerating
	}

	updateTopicStatus(topicId: string, status: TaskStatus) {
		this.topicStore.updateTopicStatus(topicId, status)
	}

	reset() {
		this.selectedProject = null
		this.isConversationGenerating = false
		this.topicStore.reset()
	}
}
