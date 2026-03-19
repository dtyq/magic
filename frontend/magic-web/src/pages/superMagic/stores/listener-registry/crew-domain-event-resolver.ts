import type { CrewDomainEventPayload } from "./crew-domain-event-registry"
import type { TopicMessageListenerPayload } from "./topic-message-listener-registry"

const REFRESH_CREW_DETAIL_TOOL_NAMES = new Set(["update_agent", "update_skill"])

interface CrewToolMessageNode {
	event?: string
	tool?: {
		detail?: {
			code?: string
			data?: {
				code?: string
			}
		}
		name?: string
		status?: string
	}
}

function resolveCrewCodeFromToolDetail(
	detail?: NonNullable<CrewToolMessageNode["tool"]>["detail"],
): null | string {
	const code = detail?.code || detail?.data?.code
	if (!code) return null

	return code
}

export function resolveCrewDomainEvent<TMessage, TMessageNode = unknown>(
	payload: TopicMessageListenerPayload<TMessage, TMessageNode>,
): CrewDomainEventPayload<TMessage, TMessageNode> | null {
	const node = payload.messageNode as CrewToolMessageNode | undefined
	const toolName = node?.tool?.name
	const crewCode = resolveCrewCodeFromToolDetail(node?.tool?.detail)
	const isCrewRefreshTool = Boolean(toolName && REFRESH_CREW_DETAIL_TOOL_NAMES.has(toolName))
	const isToolFinished = node?.event === "after_tool_call" || node?.tool?.status === "finished"
	const message = payload.message as { type?: string }

	if (message.type !== "general_agent_card") return null
	if (!isCrewRefreshTool || !isToolFinished || !crewCode || !toolName) return null

	return {
		type: "crew_detail_refresh_requested",
		crewCode,
		topicId: payload.topicId,
		toolName,
		message: payload.message,
		messageNode: payload.messageNode,
	}
}
