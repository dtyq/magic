import { makeAutoObservable } from "mobx"
import type { ModelItem } from "@/pages/superMagic/components/MessageEditor/types"
import type { TopicMode } from "@/pages/superMagic/pages/Workspace/types"
import { DEFAULT_TOPIC_ID } from "@/services/superMagic/topicModel/constants"

/**
 * Super Magic Topic Model Store
 * Manages current selected language and image models
 * Provides event mechanism for topic changes
 */
class SuperMagicTopicModelStore {
	/** Selected language model */
	selectedLanguageModel: ModelItem | null = null

	/** Selected image model */
	selectedImageModel: ModelItem | null = null

	/** Loading state */
	isLoading = false

	/** Current topic ID */
	currentTopicId: string = ""

	/** Current project ID */
	currentProjectId: string = ""

	/** Current topic mode */
	currentTopicMode: TopicMode = "" as TopicMode

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	/**
	 * Set selected language model
	 * @param model - Model to set
	 */
	setSelectedLanguageModel(model: ModelItem | null) {
		this.selectedLanguageModel = model
	}

	/**
	 * Set selected image model
	 * @param model - Model to set
	 */
	setSelectedImageModel(model: ModelItem | null) {
		this.selectedImageModel = model
	}

	/**
	 * Set loading state
	 * @param loading - Loading state
	 */
	setLoading(loading: boolean) {
		this.isLoading = loading
	}

	/**
	 * Set current context (topic, project, mode)
	 * This will trigger the service to fetch models via reaction
	 * @param topicId - Topic ID
	 * @param projectId - Project ID
	 * @param topicMode - Topic mode
	 */
	setCurrentContext(
		topicId: string | undefined,
		projectId: string | undefined,
		topicMode: TopicMode,
	) {
		this.currentTopicId = topicId || ""
		this.currentProjectId = projectId || ""
		this.currentTopicMode = topicMode
	}

	/**
	 * Reset store to initial state
	 */
	reset() {
		this.selectedLanguageModel = null
		this.selectedImageModel = null
		this.isLoading = false
		this.currentTopicId = DEFAULT_TOPIC_ID
		this.currentProjectId = ""
		this.currentTopicMode = "general" as TopicMode
	}
}

const topicModelStore = new SuperMagicTopicModelStore()

export function createSuperMagicTopicModelStore() {
	return new SuperMagicTopicModelStore()
}

export default topicModelStore
