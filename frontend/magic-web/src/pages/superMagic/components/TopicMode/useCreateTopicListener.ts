import { useEffect } from "react"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import type { SuperMagicCreateNewTopicPayload } from "@/pages/superMagic/events/message"
import SuperMagicService from "../../services"
import { projectStore } from "../../stores/core"

interface UseCreateTopicListenerOptions {
	enabled?: boolean
	selectedProject?: Parameters<typeof SuperMagicService.handleCreateTopic>[0]["selectedProject"]
	topicStore?: {
		setSelectedTopic?: (topic: unknown) => void
	}
}

function normalizeCreateTopicPayload(payload?: SuperMagicCreateNewTopicPayload) {
	if (payload == null) {
		return {
			topicMode: undefined as Parameters<typeof SuperMagicService.handleCreateTopic>[0]["topicMode"],
			afterCreate: undefined as SuperMagicCreateNewTopicPayload["afterCreate"],
		}
	}

	return {
		topicMode: payload.topicMode,
		afterCreate: payload.afterCreate,
	}
}

/**
 * Hook to listen for Create_New_Topic event and handle topic creation
 * @description Listens for PubSubEvents.Create_New_Topic and calls SuperMagicService.handleCreateTopic.
 * Uses object payload contract ({ topicMode, afterCreate }) for all callers.
 */
export function useCreateTopicListener(
	options: UseCreateTopicListenerOptions = {},
) {
	const { enabled = true, selectedProject: selectedProjectFromOptions, topicStore } = options
	const selectedProject = projectStore.selectedProject

	useEffect(() => {
		if (!enabled) return

		const handleCreateTopic = (payload?: SuperMagicCreateNewTopicPayload) => {
			const { topicMode, afterCreate } = normalizeCreateTopicPayload(payload)

			SuperMagicService.handleCreateTopic({
				selectedProject: selectedProjectFromOptions ?? selectedProject,
				onSuccess: (topic) => {
					topicStore?.setSelectedTopic?.(topic)
				},
				onNavigated: () => {
					if (!afterCreate?.content) return
					pubsub.publish(PubSubEvents.Add_Content_To_Chat, {
						content: afterCreate.content,
						extraData: afterCreate.extraData,
					})
				},
				topicMode,
			})
		}

		pubsub.subscribe(PubSubEvents.Create_New_Topic, handleCreateTopic)
		return () => {
			pubsub.unsubscribe(PubSubEvents.Create_New_Topic, handleCreateTopic)
		}
	}, [enabled, selectedProject, selectedProjectFromOptions, topicStore])
}
