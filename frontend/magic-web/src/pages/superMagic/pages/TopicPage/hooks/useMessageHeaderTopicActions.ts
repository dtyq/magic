import { useMemo } from "react"
import { useMemoizedFn } from "ahooks"
import { MagicClawApi, SuperMagicApi } from "@/apis"
import type { MessageHeaderTopicActions } from "@/pages/superMagic/components/MessageHeader"
import type { ProjectListItem, Topic } from "@/pages/superMagic/pages/Workspace/types"
import type { TopicStore } from "@/pages/superMagic/stores/core/topic"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import SuperMagicService, { renameTopicWithChatSync } from "@/pages/superMagic/services"
import routeManageService from "@/pages/superMagic/services/routeManageService"
import { normalizeTopicHistoryItem } from "@/pages/superMagic/utils/topicHistory"
import {
	isAgentSelectionAvailable,
	resolveDefaultAgentSelection,
} from "@/services/superMagic/DefaultAgentSelectionService"

interface UseMessageHeaderTopicActionsParams {
	selectedProject: ProjectListItem | null
	selectedTopic?: Topic | null
	topicStore: TopicStore
}

export function useMessageHeaderTopicActions({
	selectedProject,
	selectedTopic,
	topicStore,
}: UseMessageHeaderTopicActionsParams): MessageHeaderTopicActions {
	const createTopic = useMemoizedFn(async () => {
		let sourceTopic:
			Pick<Topic, "project_id" | "topic_mode" | "agent_code"> | null | undefined =
			selectedTopic
		if (
			selectedTopic &&
			(!selectedTopic.topic_mode ||
				!isAgentSelectionAvailable(selectedTopic.topic_mode, selectedTopic.agent_code))
		) {
			const defaultSelection = resolveDefaultAgentSelection()
			// 顶部按钮创建独立新话题；当前模式已失效时，不应继承历史话题的员工。
			sourceTopic = {
				project_id: selectedTopic.project_id,
				topic_mode: defaultSelection.topicPattern,
				agent_code: defaultSelection.agentCode,
			}
		}

		await SuperMagicService.handleCreateTopic({
			selectedProject,
			// 创建请求保持空话题；sourceTopic 只用于前端设置新话题的初始模式。
			sourceTopic,
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

			await renameTopicWithChatSync({
				project: selectedProject,
				topicId,
				topicName,
			})
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

	const restartSandbox = useMemoizedFn(async (topicId: string) => {
		if (selectedProject?.project_mode === TopicMode.MagiClaw) {
			await MagicClawApi.restartMagicClawSandbox({ topic_id: topicId })
			return
		}

		await SuperMagicApi.restartTopicSandbox({ topic_id: topicId })
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
			restartSandbox,
		}),
		[
			archiveTopic,
			createTopic,
			deleteTopic,
			pinTopic,
			renameTopic,
			restartSandbox,
			selectTopic,
			unarchiveTopic,
			unpinTopic,
			updateTopicName,
		],
	)
}
