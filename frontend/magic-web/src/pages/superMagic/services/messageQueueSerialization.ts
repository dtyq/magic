import type { JSONContent } from "@/infrastructure/editors/tiptap/core"
import type { MentionListItem } from "@/components/business/MentionPanel/tiptap-plugin/types"
import type { ModelItem } from "../components/MessageEditor/types"
import type { TopicMode } from "../pages/Workspace/TopicMode"
import { transformMentions } from "../components/MessageEditor/utils/mention"
import { resolveAgentSelection } from "@/services/superMagic/DefaultAgentSelectionService"

import modelCache from "@/services/superMagic/topicModel/SuperMagicTopicModelCacheService"

// Share the server queue payload between the composer and programmatic iframe sends.
export const serializeMessageContent = (
	content: JSONContent,
	mentionItems: MentionListItem[],
	selectedModel?: ModelItem | null,
	selectedImageModel?: ModelItem | null,
	selectedVideoModel?: ModelItem | null,
	topicMode?: TopicMode,
	agentCode?: string,
	inputMode?: string,
	clientSyncId?: string,
	dynamicParams?: Record<string, unknown>,
) => {
	const modelSnapshot = selectedModel ? modelCache.snapshotLanguageModel(selectedModel) : null
	const modelObj = modelSnapshot
		? {
				model_id: modelSnapshot.model_id,
				model_name: modelSnapshot.model_name,
				model_icon: modelSnapshot.model_icon,
				...(modelSnapshot.reasoning_effort && {
					reasoning_effort: modelSnapshot.reasoning_effort,
				}),
			}
		: { model_id: "auto" }

	const imageModelObj = selectedImageModel?.model_id
		? {
				model_id: selectedImageModel.model_id,
				model_name: selectedImageModel.model_name,
				model_icon: selectedImageModel.model_icon,
			}
		: undefined
	const videoModelObj = selectedVideoModel?.model_id
		? {
				model_id: selectedVideoModel.model_id,
				model_name: selectedVideoModel.model_name,
				model_icon: selectedVideoModel.model_icon,
			}
		: undefined

	// 转换 mention items，自定义发送给 agent 的内容
	const transformedMentionItems = transformMentions(mentionItems)
	const sendSelection = resolveAgentSelection(topicMode, agentCode)

	return {
		instructs: [
			{
				value: inputMode || "plan",
				instruction: null,
			},
		],
		extra: {
			super_agent: {
				mentions: transformedMentionItems,
				input_mode: inputMode || "plan",
				chat_mode: "normal",
				topic_pattern: sendSelection.topicPattern,
				...(sendSelection.agentCode && { agent_code: sendSelection.agentCode }),
				...(clientSyncId && { client_queue_sync_id: clientSyncId }),
				...(dynamicParams && { dynamic_params: dynamicParams }),
				model: modelObj,
				...(imageModelObj && { image_model: imageModelObj }),
				...(videoModelObj && { video_model: videoModelObj }),
			},
		},
		content: JSON.stringify(content),
	}
}
