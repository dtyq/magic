import { useEffect } from "react"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { SuperMagicApi } from "@/apis"
import SuperMagicService from "../../services"
import { workspaceStore, projectStore } from "../../stores/core"
import type { SuperMagicCreateNewTopicPayload } from "../../events/message"
import type { ProjectListItem } from "../../pages/Workspace/types"
import type { TopicStore } from "../../stores/core/topic"

export interface UseCreateTopicListenerOptions {
	/**
	 * Override the project used for topic creation.
	 * When provided, uses this instead of the global projectStore.
	 */
	selectedProject?: ProjectListItem | null
	/**
	 * Override the topic store for selecting the newly created topic.
	 * When provided, creates the topic via API and switches in-place
	 * instead of navigating to the main topic page.
	 */
	topicStore?: TopicStore
}

/**
 * Hook to listen for Create_New_Topic event and handle topic creation.
 *
 * Default (no options): uses global stores and navigates to the new topic page.
 * With options (crew/skill): creates a topic in the given project and
 * switches the provided topicStore in-place without page navigation.
 */
export function useCreateTopicListener(options?: UseCreateTopicListenerOptions) {
	const globalSelectedWorkspace = workspaceStore.selectedWorkspace
	const globalSelectedProject = projectStore.selectedProject

	const selectedProject = options?.selectedProject ?? globalSelectedProject
	const localTopicStore = options?.topicStore

	useEffect(() => {
		const handleCreateTopic = (payload?: SuperMagicCreateNewTopicPayload) => {
			if (localTopicStore) {
				// In-place mode: create topic via API + switch topicStore (crew/skill)
				const projectId = selectedProject?.id
				if (!projectId) return

				SuperMagicApi.createTopic({
					project_id: projectId,
					topic_name: "",
				}).then((newTopic) => {
					if (!newTopic) return
					localTopicStore.setSelectedTopic(newTopic)

					if (payload?.afterCreate) {
						setTimeout(() => {
							pubsub.publish(PubSubEvents.Add_Content_To_Chat, {
								content: payload.afterCreate!.content,
								extraData: payload.afterCreate!.extraData,
							})
						}, 500)
					}
				})
			} else {
				// Default mode: navigate to the new topic page
				SuperMagicService.handleCreateTopic({
					selectedProject,
					topicMode: payload?.topicMode,
					onNavigated: payload?.afterCreate
						? () => {
								pubsub.publish(PubSubEvents.Add_Content_To_Chat, {
									content: payload.afterCreate!.content,
									extraData: payload.afterCreate!.extraData,
								})
							}
						: undefined,
				})
			}
		}
		pubsub.subscribe(PubSubEvents.Create_New_Topic, handleCreateTopic)
		return () => {
			pubsub.unsubscribe(PubSubEvents.Create_New_Topic, handleCreateTopic)
		}
	}, [selectedProject, globalSelectedWorkspace, localTopicStore])
}
