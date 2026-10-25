import type { JSONContent } from "@/infrastructure/editors/tiptap/core"
import type { HandleSendParams } from "@/pages/superMagic/services/messageSendFlowService"
import type { QueueMessageInput } from "./types"

export function buildQueueMessageInput(
	params: HandleSendParams,
	fallbackContent: JSONContent,
): QueueMessageInput {
	const agentCode = params.extra?.agent_code
	const superAgent = params.extra?.super_agent
	const nestedDynamicParams = isRecord(superAgent) ? superAgent.dynamic_params : undefined

	return {
		content: params.value ?? fallbackContent,
		mentionItems: params.mentionItems,
		dynamicParams: isRecord(nestedDynamicParams) ? nestedDynamicParams : undefined,
		selectedModel: params.selectedModel,
		selectedImageModel: params.selectedImageModel,
		selectedVideoModel: params.selectedVideoModel,
		topicMode: params.topicMode,
		agentCode: typeof agentCode === "string" ? agentCode : null,
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value)
}
