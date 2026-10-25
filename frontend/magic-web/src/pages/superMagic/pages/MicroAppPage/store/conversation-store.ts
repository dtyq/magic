import { makeAutoObservable } from "mobx"
import { SuperMagicApi } from "@/apis"
import { TopicStore } from "@/pages/superMagic/stores/core/topic"
import { takeProjectRenameTask } from "@/pages/superMagic/services/messageSendRenameTask"
import type { MessageSendRenameResult } from "@/pages/superMagic/services/messageSendRenameTask"
import { logger as Logger } from "@/infrastructure/logger"
import { type ProjectListItem, type TaskStatus, type Topic } from "../../Workspace/types"

const logger = Logger.createLogger("AppConversationStore")

interface ConversationHydration {
	project: ProjectListItem | null
	topics: Topic[]
	selectedTopicId?: string | null
}

interface LoadProjectContextOptions {
	isCurrent?: () => boolean
}

export class AppConversationStore {
	selectedProject: ProjectListItem | null = null
	topicStore: TopicStore = new TopicStore()
	isConversationGenerating = false

	constructor() {
		makeAutoObservable(this, { topicStore: false }, { autoBind: true })
	}

	hydrate({ project, topics, selectedTopicId }: ConversationHydration) {
		this.selectedProject = project
		this.topicStore.setTopics(topics)

		// Route changes reload the project context. Replace the selected topic as well so the
		// history panel and message list never keep a topic from the previous project.
		const targetTopic =
			topics.find((topic) => topic.id === selectedTopicId) || topics[0] || null
		this.topicStore.setSelectedTopic(targetTopic)
	}

	setSelectedProject(project: ProjectListItem | null) {
		this.selectedProject = project
	}

	async loadProjectContext(
		projectId: string,
		{ isCurrent = () => true }: LoadProjectContextOptions = {},
	): Promise<void> {
		const project = await SuperMagicApi.getProjectDetail({ id: projectId })
		if (!isCurrent()) return
		if (!project) {
			this.reset()
			return
		}

		const response = await SuperMagicApi.getTopicsByProjectId({
			id: project.id,
			page: 1,
			page_size: 999,
		})
		// Hydration mutates the shared conversation, so validate immediately before committing it.
		if (!isCurrent()) return

		this.hydrate({
			project,
			topics: response.list,
			selectedTopicId: project.current_topic_id,
		})

		const pendingRename = takeProjectRenameTask(projectId)
		if (pendingRename && isCurrent()) {
			void this.refreshProjectAfterRename(projectId, pendingRename, isCurrent)
		}
	}

	private async refreshProjectAfterRename(
		projectId: string,
		pendingRename: Promise<MessageSendRenameResult | null>,
		isCurrent: () => boolean = () => true,
	) {
		try {
			const renameResult = await pendingRename
			if (!isCurrent() || !renameResult || this.selectedProject?.id !== projectId) return

			this.topicStore.updateTopicName(renameResult.topicId, renameResult.topicName)

			const refreshedProject = await SuperMagicApi.getProjectDetail(
				{ id: projectId },
				{ enableErrorMessagePrompt: false },
			)
			if (!isCurrent() || !refreshedProject || this.selectedProject?.id !== projectId) return

			this.setSelectedProject(refreshedProject)
		} catch (error) {
			logger.error({
				eventKey: "refresh_project_after_topic_rename_failed",
				errorKind: "network",
				error,
				message: "Failed to refresh project after topic rename",
			})
		}
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
