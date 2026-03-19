import { useEffect } from "react"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import SuperMagicService from "../../services"
import { workspaceStore, projectStore } from "../../stores/core"

/**
 * Hook to listen for Create_New_Topic event and handle topic creation
 * @description Listens for PubSubEvents.Create_New_Topic and calls SuperMagicService.handleCreateTopic
 * with the current selected workspace and project from stores
 */
export function useCreateTopicListener() {
	const selectedWorkspace = workspaceStore.selectedWorkspace
	const selectedProject = projectStore.selectedProject

	useEffect(() => {
		const handleCreateTopic = () => {
			SuperMagicService.handleCreateTopic({
				selectedProject,
			})
		}
		pubsub.subscribe(PubSubEvents.Create_New_Topic, handleCreateTopic)
		return () => {
			pubsub.unsubscribe(PubSubEvents.Create_New_Topic, handleCreateTopic)
		}
	}, [selectedProject, selectedWorkspace])
}
