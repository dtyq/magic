import { useMemo } from "react"
import { useMemoizedFn } from "ahooks"
import { SuperMagicApi } from "@/apis"
import type { MessageHeaderTopicActions } from "@/pages/superMagic/components/MessageHeader"
import type { ProjectListItem, Topic } from "@/pages/superMagic/pages/Workspace/types"
import type { TopicStore } from "@/pages/superMagic/stores/core/topic"
import { normalizeTopicHistoryItem } from "@/pages/superMagic/utils/topicHistory"

interface UseScopedMessageHeaderTopicActionsParams {
	selectedProject: ProjectListItem | null
	selectedTopic: Topic | null
	topicStore: TopicStore
}

export function useScopedMessageHeaderTopicActions({
	selectedProject,
	selectedTopic,
	topicStore,
}: UseScopedMessageHeaderTopicActionsParams): MessageHeaderTopicActions {
	const createTopic = useMemoizedFn(async () => {
		if (!selectedProject?.id) return

		const newTopic = await SuperMagicApi.createTopic({
			project_id: selectedProject.id,
			topic_name: "",
		})

		if (!newTopic) return

		const topicsRes = await SuperMagicApi.getTopicsByProjectId({
			id: selectedProject.id,
			page: 1,
			page_size: 999,
		})
		const updatedTopics = Array.isArray(topicsRes?.list) ? topicsRes.list : []
		const targetTopic =
			updatedTopics.find((topic: Topic) => topic.id === newTopic.id) || newTopic

		topicStore.setTopics(updatedTopics)
		topicStore.setSelectedTopic(targetTopic)
	})

	const selectTopic = useMemoizedFn((topic: Topic) => {
		topicStore.setSelectedTopic(topic)
	})

	const renameTopic = useMemoizedFn(
		async ({ topicId, topicName }: { topicId: string; topicName: string }) => {
			if (!selectedProject?.id) throw new Error("Missing project id")

			await SuperMagicApi.editTopic({
				id: topicId,
				topic_name: topicName,
				project_id: selectedProject.id,
			})
			topicStore.updateTopicName(topicId, topicName)
		},
	)

	const deleteTopic = useMemoizedFn(async (topicId: string) => {
		await SuperMagicApi.deleteTopic({
			id: topicId,
		})

		const remainingTopics = topicStore.topics.filter((topic) => topic.id !== topicId)
		topicStore.removeTopic(topicId)

		if (selectedTopic?.id === topicId) {
			topicStore.setSelectedTopic(remainingTopics[0] || null)
		}
	})

	const updateTopicName = useMemoizedFn((topicId: string, topicName: string) => {
		topicStore.updateTopicName(topicId, topicName)
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
