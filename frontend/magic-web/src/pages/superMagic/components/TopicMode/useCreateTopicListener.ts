import { useEffect } from "react"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import type { SuperMagicCreateNewTopicPayload } from "@/pages/superMagic/events/message"
import SuperMagicService from "../../services"
import TopicService from "../../services/topicService"
import { projectStore, topicStore as globalTopicStore } from "../../stores/core"
import type { ProjectListItem, Topic } from "../../pages/Workspace/types"
import { TopicMode } from "../../pages/Workspace/TopicMode"
import type { TopicStore } from "../../stores/core/topic"

interface UseCreateTopicListenerOptions {
	enabled?: boolean
	selectedProject?: ProjectListItem | null
	topicStore?: TopicStore
}

type TopicModeSource = Pick<Topic, "project_id" | "topic_mode" | "agent_code">

function normalizeCreateTopicPayload(payload?: SuperMagicCreateNewTopicPayload) {
	if (payload == null) {
		return {
			afterCreate: undefined as SuperMagicCreateNewTopicPayload["afterCreate"],
			topicMode: undefined as SuperMagicCreateNewTopicPayload["topicMode"],
		}
	}

	return {
		afterCreate: payload.afterCreate,
		topicMode: payload.topicMode,
	}
}

function resolveRequestedModeSourceTopic({
	sourceTopic,
	selectedProject,
	topicMode,
}: {
	sourceTopic: TopicModeSource | null
	selectedProject?: ProjectListItem | null
	topicMode?: TopicMode
}): TopicModeSource | null {
	if (!topicMode) return sourceTopic

	const modeIdentifier = String(topicMode).trim()
	if (!modeIdentifier) return sourceTopic

	const projectId = sourceTopic?.project_id || selectedProject?.id
	if (!projectId) return sourceTopic

	const modeSource = modeIdentifier.startsWith("SMA")
		? {
				project_id: projectId,
				topic_mode: TopicMode.CustomAgent,
				agent_code: modeIdentifier,
			}
		: {
				project_id: projectId,
				topic_mode: topicMode,
				agent_code: undefined,
			}

	return sourceTopic ? { ...sourceTopic, ...modeSource } : modeSource
}

/**
 * Hook to listen for Create_New_Topic event and handle topic creation
 * @description Listens for PubSubEvents.Create_New_Topic and calls SuperMagicService.handleCreateTopic.
 * Uses object payload contract ({ topicMode, afterCreate }) for all callers.
 */
export function useCreateTopicListener(options: UseCreateTopicListenerOptions = {}) {
	const { enabled = true, selectedProject: selectedProjectFromOptions, topicStore } = options
	const selectedProject = selectedProjectFromOptions ?? projectStore.selectedProject

	useEffect(() => {
		if (!enabled) return

		const handleCreateTopic = (payload?: SuperMagicCreateNewTopicPayload) => {
			const { afterCreate, topicMode } = normalizeCreateTopicPayload(payload)
			const publishAfterCreate = () => {
				if (!afterCreate?.content) return
				pubsub.publish(PubSubEvents.Add_Content_To_Chat, {
					content: afterCreate.content,
					extraData: afterCreate.extraData,
				})
			}

			if (topicStore) {
				const projectId = selectedProject?.id
				if (!projectId) return

				new TopicService({ store: topicStore })
					.createTopic({
						projectId,
						topicName: "",
						sourceTopic: topicStore.selectedTopic,
					})
					.then((newTopic) => {
						if (!newTopic || !afterCreate) return
						setTimeout(publishAfterCreate, 500)
					})
			} else {
				// 普通项目新建话题不把员工/mode 写入创建接口；
				// 触发当下读取当前话题，交给 TopicService 在前端选中态中继承员工。
				const sourceTopic = resolveRequestedModeSourceTopic({
					sourceTopic: globalTopicStore.selectedTopic,
					selectedProject,
					topicMode,
				})

				SuperMagicService.handleCreateTopic({
					selectedProject,
					sourceTopic,
					onNavigated: afterCreate ? publishAfterCreate : undefined,
				})
			}
		}

		pubsub.subscribe(PubSubEvents.Create_New_Topic, handleCreateTopic)
		return () => {
			pubsub.unsubscribe(PubSubEvents.Create_New_Topic, handleCreateTopic)
		}
	}, [enabled, selectedProject, topicStore])
}
