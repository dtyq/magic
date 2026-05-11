import type { createMessageSendService } from "@/pages/superMagic/services/messageSendFlowService"
import { resolveMessageSendContext } from "@/pages/superMagic/services/messageSendPreparation"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import {
	type ProjectListItem,
	type Topic,
	TopicMode,
} from "@/pages/superMagic/pages/Workspace/types"
import type { createSuperMagicTopicModelStore } from "@/stores/superMagic/topicModelStore"
import type { ClawPlaygroundRootStore } from "../store/root-store"
import { CLAW_NEW_CHAT_SLASH_COMMAND } from "../claw-playground-constants"

type ScopedMessageSendService = ReturnType<typeof createMessageSendService>

interface DispatchClawNewChatSlashParams {
	scopedMessageSendService: ScopedMessageSendService
	store: ClawPlaygroundRootStore
	topicStore: ClawPlaygroundRootStore["topicStore"]
	topicModelStore: ReturnType<typeof createSuperMagicTopicModelStore>
	selectedProject: ProjectListItem | null
	selectedTopic: Topic | null
	messagesLength: number
	showLoading: boolean
	clawCode?: string
}

/** Sends /new as a normal text message with MagiClaw agent options */
export function dispatchClawNewChatSlash({
	scopedMessageSendService,
	store,
	topicStore,
	topicModelStore,
	selectedProject,
	selectedTopic,
	messagesLength,
	showLoading,
	clawCode,
}: DispatchClawNewChatSlashParams) {
	if (!selectedProject || !selectedTopic) return
	// Align with toolbar: block while assistant task is running
	if (showLoading) return

	const selectedModel = topicModelStore.selectedLanguageModel
	const selectedImageModel = topicModelStore.selectedImageModel

	scopedMessageSendService.dispatchMessage({
		content: CLAW_NEW_CHAT_SLASH_COMMAND,
		showLoading: messagesLength > 1 && showLoading,
		selectedProject,
		selectedTopic,
		context: resolveMessageSendContext({
			selectedProject,
			selectedTopic,
			selectedWorkspace: store.selectedWorkspace,
			setSelectedProject: store.projectStore.setSelectedProject,
			setSelectedTopic: topicStore.setSelectedTopic,
			setSelectedWorkspace: store.workspaceStore.setSelectedWorkspace,
			topicStore,
		}),
		options: {
			extra: {
				super_agent: {
					mentions: [],
					chat_mode: "normal" as const,
					topic_pattern: TopicMode.MagiClaw,
					enable_web_search: false,
					...(clawCode && { agent_code: clawCode }),
					...(selectedModel && {
						model: {
							model_id: selectedModel.model_id,
						},
					}),
					...(selectedImageModel?.model_id && {
						image_model: {
							model_id: selectedImageModel.model_id,
						},
					}),
				},
			},
		},
	})

	pubsub.publish(PubSubEvents.Message_Scroll_To_Bottom, { time: 1000 })
}
