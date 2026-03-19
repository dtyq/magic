import { useCallback, useEffect, useRef } from "react"
import {
	ProjectListItem,
	Topic,
	TopicMode,
} from "@/pages/superMagic/pages/Workspace/types"
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
	topicMode = superMagicModeService.firstModeIdentifier,
	topicModelStore,
}: {
	selectedTopic?: Topic | null
	selectedProject?: ProjectListItem | null
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
		superMagicTopicModelService.initForStore(topicStore)
	})

	// Sync context to Store when props change
	// Store's reaction will automatically trigger model loading
	useEffect(() => {
		if (selectedTopic && !selectedProject) {
			return
		}
		topicStore.setCurrentContext(selectedTopic?.id, selectedProject?.id || "", topicMode)
	}, [topicMode, selectedTopic, selectedProject, topicStore])

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			// Flush all pending saves on unmount
			superMagicTopicModelService.flushAll(topicStore.currentTopicId)
			superMagicTopicModelService.destroyForStore(topicStore)
		}
	}, [topicStore])

	// Get model lists from mode service
	const modelGroups = superMagicModeService.getModelGroupsByMode(topicMode)
	const imageModelGroups = superMagicModeService.getImageModelGroupsByMode(topicMode)
	const validateSelectedModels = useCallback(() => {
		return superMagicTopicModelService.validateSelectedModels(topicStore)
	}, [topicStore])

	return {
		modelList: modelGroups ?? [],
		imageModelList: imageModelGroups ?? [],
		topicModelStore: topicStore,
		validateSelectedModels,
		setSelectedModel: (model: ModelItem | null) => {
			superMagicTopicModelService.saveModel(
				topicStore.currentTopicId,
				topicStore.currentProjectId,
				model,
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
				topicStore,
			)
		},
		// Backward-compatible API used by MessagePanel
		saveSuperMagicTopicModel: ({
			selectedTopic: topic,
			model,
			imageModel,
		}: {
			selectedTopic: Topic
			model: ModelItem
			imageModel: ModelItem | null
		}) => {
			superMagicTopicModelService.saveModel(
				topic?.id,
				selectedProject?.id || "",
				model,
				imageModel,
				topicStore,
			)
		},
	}
}

export default useTopicModel
