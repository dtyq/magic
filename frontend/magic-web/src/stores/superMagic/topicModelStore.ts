import { makeAutoObservable } from "mobx"
import type { ModelItem } from "@/pages/superMagic/components/MessageEditor/types"
import type { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import { DEFAULT_TOPIC_ID } from "@/services/superMagic/topicModel/constants"
import { getFallbackTopicModeIdentifier } from "@/services/superMagic/DefaultAgentSelectionService"

/**
 * Super Magic Topic Model Store
 * Manages current selected language, image and video models
 * Provides event mechanism for topic changes
 */
class SuperMagicTopicModelStore {
	/** Selected language model */
	selectedLanguageModel: ModelItem | null = null

	/** Selected image model */
	selectedImageModel: ModelItem | null = null

	/** Selected video model */
	selectedVideoModel: ModelItem | null = null

	/** Loading state */
	isLoading = false

	/** Current topic ID */
	currentTopicId: string = ""

	/** Current project ID */
	currentProjectId: string = ""

	/** Current topic mode */
	currentTopicMode: TopicMode = "" as TopicMode

	/** Agent code when topic_mode is custom_agent (featured mode.identifier) */
	currentAgentCode: string = ""

	/** Context key whose model data has completed loading */
	loadedContextKey = ""

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	/** Whether the language model for the current context is ready for use */
	get isLanguageModelReady() {
		return !this.isLoading && Boolean(this.selectedLanguageModel?.model_id)
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
	 * Set selected video model
	 * @param model - Model to set
	 */
	setSelectedVideoModel(model: ModelItem | null) {
		this.selectedVideoModel = model
	}

	/**
	 * Set loading state
	 * @param loading - Loading state
	 */
	setLoading(loading: boolean) {
		this.isLoading = loading
	}

	/** 标记当前上下文的模型已加载完成 */
	markCurrentContextLoaded(contextKey: string) {
		this.loadedContextKey = contextKey
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
		agentCode?: string | null,
	) {
		const nextTopicId = topicId || ""
		const nextProjectId = projectId || ""
		const nextAgentCode = agentCode ?? ""
		const contextChanged =
			this.currentTopicId !== nextTopicId ||
			this.currentProjectId !== nextProjectId ||
			this.currentTopicMode !== topicMode ||
			this.currentAgentCode !== nextAgentCode

		this.currentTopicId = nextTopicId
		this.currentProjectId = nextProjectId
		this.currentTopicMode = topicMode
		this.currentAgentCode = nextAgentCode

		if (contextChanged) {
			this.isLoading = true
			this.loadedContextKey = ""

			const isWorkspaceHome = !nextTopicId && !nextProjectId
			if (isWorkspaceHome) {
				this.selectedLanguageModel = null
				this.selectedImageModel = null
				this.selectedVideoModel = null
			}
		}
	}

	/**
	 * Reset store to initial state
	 */
	reset() {
		this.selectedLanguageModel = null
		this.selectedImageModel = null
		this.selectedVideoModel = null
		this.isLoading = false
		this.currentTopicId = DEFAULT_TOPIC_ID
		this.currentProjectId = ""
		this.currentTopicMode = getFallbackTopicModeIdentifier()
		this.currentAgentCode = ""
		this.loadedContextKey = ""
	}
}

const topicModelStore = new SuperMagicTopicModelStore()

export function createSuperMagicTopicModelStore() {
	return new SuperMagicTopicModelStore()
}

export default topicModelStore
