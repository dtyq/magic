import { useCallback, useEffect, useRef } from "react"
import { ProjectListItem, Topic, TopicMode } from "@/pages/superMagic/pages/Workspace/types"
import { useMount } from "ahooks"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import { superMagicTopicModelService } from "@/services/superMagic/topicModel"
import { ModelItem } from "../types"
import { createSuperMagicTopicModelStore } from "@/stores/superMagic/topicModelStore"

/**
 * Hook for managing topic models
 * Simplified version using Store/Service architecture
 */
function useTopicModel({
	selectedTopic,
	selectedProject,
	agentCode,
	autoFetch = true,
	topicMode = superMagicModeService.firstModeIdentifier,
	topicModelStore,
}: {
	selectedTopic?: Topic | null
	selectedProject?: ProjectListItem | null
	agentCode?: string | null
	autoFetch?: boolean
	topicMode?: TopicMode
	topicModelStore?: ReturnType<typeof createSuperMagicTopicModelStore>
}) {
	// Each hook call owns an isolated store instance (multi-instance safe)
	const topicStoreRef = useRef<ReturnType<typeof createSuperMagicTopicModelStore> | null>(null)
	if (!topicStoreRef.current) {
		topicStoreRef.current = topicModelStore ?? createSuperMagicTopicModelStore()
	}
	const topicStore = topicStoreRef.current

	// Initialize Service (only once)
	useMount(() => {
		if (!autoFetch) return
		superMagicTopicModelService.initForStore(topicStore)
	})

	// Sync context to Store when props change
	// Store's reaction will automatically trigger model loading
	useEffect(() => {
		if (!autoFetch) return
		if (selectedTopic && !selectedProject) {
			return
		}
		topicStore.setCurrentContext(
			selectedTopic?.id,
			selectedProject?.id || "",
			topicMode,
			agentCode ?? selectedTopic?.agent_code,
		)
	}, [agentCode, autoFetch, topicMode, selectedTopic, selectedProject, topicStore])

	// Cleanup on unmount
	useEffect(() => {
		if (!autoFetch) return
		return () => {
			// Flush all pending saves on unmount
			superMagicTopicModelService.flushAll(topicStore.currentTopicId)
			superMagicTopicModelService.destroyForStore(topicStore)
		}
	}, [autoFetch, topicStore])

	const currentAgentCode = agentCode ?? selectedTopic?.agent_code ?? null
	// Get model lists from mode service
	const modelGroups = superMagicModeService.getModelGroupsByMode(topicMode, currentAgentCode)
	const imageModelGroups = superMagicModeService.getImageModelGroupsByMode(
		topicMode,
		currentAgentCode,
	)
	const videoModelGroups = superMagicModeService.getVideoModelGroupsByMode(
		topicMode,
		currentAgentCode,
	)
	const validateSelectedModels = useCallback(() => {
		return superMagicTopicModelService.validateSelectedModels(topicStore)
	}, [topicStore])

	return {
		modelList: modelGroups ?? [],
		imageModelList: imageModelGroups ?? [],
		videoModelList: videoModelGroups ?? [],
		topicModelStore: topicStore,
		validateSelectedModels,
		setSelectedModel: (model: ModelItem | null) => {
			superMagicTopicModelService.saveModel(
				topicStore.currentTopicId,
				topicStore.currentProjectId,
				model,
				undefined,
				undefined,
				topicStore,
			)
		},
		setSelectedImageModel: (model: ModelItem | null) => {
			superMagicTopicModelService.saveModel(
				topicStore.currentTopicId,
				topicStore.currentProjectId,
				undefined,
				model,
				undefined,
				topicStore,
			)
		},
		setSelectedVideoModel: (model: ModelItem | null) => {
			superMagicTopicModelService.saveModel(
				topicStore.currentTopicId,
				topicStore.currentProjectId,
				undefined,
				undefined,
				model,
				topicStore,
			)
		},
		// Backward-compatible API used by MessagePanel
		saveSuperMagicTopicModel: ({
			selectedTopic: topic,
			model,
			imageModel,
			videoModel,
		}: {
			selectedTopic: Topic
			model: ModelItem
			imageModel: ModelItem | null
			videoModel?: ModelItem | null
		}) => {
			superMagicTopicModelService.saveModel(
				topic?.id,
				selectedProject?.id || "",
				model,
				imageModel,
				videoModel,
				topicStore,
			)
		},
	}
}

export default useTopicModel
