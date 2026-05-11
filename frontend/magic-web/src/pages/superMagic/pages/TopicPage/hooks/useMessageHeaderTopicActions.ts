import { useMemo } from "react"
import { useMemoizedFn } from "ahooks"
import { SuperMagicApi } from "@/apis"
import type { MessageHeaderTopicActions } from "@/pages/superMagic/components/MessageHeader"
import type { ProjectListItem, Topic } from "@/pages/superMagic/pages/Workspace/types"
import type { TopicStore } from "@/pages/superMagic/stores/core/topic"
import SuperMagicService from "@/pages/superMagic/services"
import routeManageService from "@/pages/superMagic/services/routeManageService"
import { normalizeTopicHistoryItem } from "@/pages/superMagic/utils/topicHistory"

interface UseMessageHeaderTopicActionsParams {
	selectedProject: ProjectListItem | null
	topicStore: TopicStore
}

export function useMessageHeaderTopicActions({
	selectedProject,
	topicStore,
}: UseMessageHeaderTopicActionsParams): MessageHeaderTopicActions {
	const createTopic = useMemoizedFn(async () => {
		await SuperMagicService.handleCreateTopic({
			selectedProject,
		})
	})

	const selectTopic = useMemoizedFn((topic: Topic) => {
		topicStore.setSelectedTopic(topic)
		routeManageService.navigateToState({
			topicId: topic.id,
		})
	})

	const renameTopic = useMemoizedFn(
		async ({ topicId, topicName }: { topicId: string; topicName: string }) => {
			if (!selectedProject?.id) throw new Error("Missing project id")

			await SuperMagicApi.editTopic({
				id: topicId,
				topic_name: topicName,
				project_id: selectedProject.id,
			})
			await SuperMagicService.topic.updateTopicName(topicId, topicName)
		},
	)

	const deleteTopic = useMemoizedFn(async (topicId: string) => {
		await SuperMagicService.deleteTopic(topicId)
	})

	const updateTopicName = useMemoizedFn(async (topicId: string, topicName: string) => {
		await SuperMagicService.topic.updateTopicName(topicId, topicName)
	})

	const pinTopic = useMemoizedFn(async (topicId: string) => {
		const response = await SuperMagicApi.pinTopic(topicId)
		topicStore.mergeTopic(topicId, normalizeTopicHistoryItem(response.topic))
	})

	const unpinTopic = useMemoizedFn(async (topicId: string) => {
		const response = await SuperMagicApi.unpinTopic(topicId)
		topicStore.mergeTopic(topicId, normalizeTopicHistoryItem(response.topic))
	})

	const archiveTopic = useMemoizedFn(async (topicId: string) => {
		const response = await SuperMagicApi.archiveTopic(topicId)
		topicStore.mergeTopic(topicId, normalizeTopicHistoryItem(response.topic))
	})

	const unarchiveTopic = useMemoizedFn(async (topicId: string) => {
		const response = await SuperMagicApi.unarchiveTopic(topicId)
		topicStore.mergeTopic(topicId, normalizeTopicHistoryItem(response.topic))
	})

	return useMemo(
		() => ({
			createTopic,
			selectTopic,
			renameTopic,
			deleteTopic,
			updateTopicName,
			pinTopic,
			unpinTopic,
			archiveTopic,
			unarchiveTopic,
		}),
		[
			archiveTopic,
			createTopic,
			deleteTopic,
			pinTopic,
			renameTopic,
			selectTopic,
			unarchiveTopic,
			unpinTopic,
			updateTopicName,
		],
	)
}
