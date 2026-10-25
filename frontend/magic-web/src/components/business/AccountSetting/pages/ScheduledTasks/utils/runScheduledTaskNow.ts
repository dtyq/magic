import type { JSONContent } from "@tiptap/react"
import { getMCPAccess } from "@/components/Agent/MCP/store/mcp-access"
import type { IMCPItem } from "@/components/Agent/MCP/types"
import { parseContent } from "@/pages/superMagic/components/MessageList/components/Text/components/RichText/utils"
import type { SuperMagicCreateNewTopicPayload } from "@/pages/superMagic/events/message"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import { projectStore } from "@/pages/superMagic/stores/core"
import { resolveAgentSelection } from "@/services/superMagic/DefaultAgentSelectionService"
import { ScheduledTask } from "@/types/scheduledTask"

export async function syncScheduledTaskMcpToProject(
	servers: Array<IMCPItem | { id: string }> = [],
) {
	const projectId = projectStore.selectedProject?.id
	if (!projectId || servers.length === 0) return

	const mcpStore = getMCPAccess({ storageKey: projectId })
	await mcpStore.save({
		selectedIds: new Set(servers.map((item) => item.id)),
		items: servers as IMCPItem[],
	})
}

export function buildScheduledTaskRunNowPayload(
	detail: ScheduledTask.Task,
): SuperMagicCreateNewTopicPayload | null {
	const content = parseContent(detail.message_content.content as JSONContent | string)
	if (!content) return null

	const superAgent = detail.message_content.extra?.super_agent
	const selection = resolveAgentSelection(
		superAgent?.topic_pattern as TopicMode | undefined,
		superAgent?.agent_code,
	)
	const topicMode = selection.modeIdentifier as TopicMode

	return {
		topicName: detail.task_name,
		topicMode,
		afterCreate: {
			content,
			send: true,
			mentionItems: superAgent?.mentions,
			topicMode,
			selectedModel: superAgent?.model ?? undefined,
			selectedImageModel: superAgent?.image_model ?? undefined,
			selectedVideoModel: superAgent?.video_model ?? undefined,
			extra: superAgent
				? {
						super_agent: {
							mentions: superAgent.mentions,
							input_mode: superAgent.input_mode,
							chat_mode: superAgent.chat_mode,
							topic_pattern: selection.topicPattern,
							...(selection.agentCode ? { agent_code: selection.agentCode } : {}),
							model: superAgent.model,
							...(superAgent.image_model
								? { image_model: superAgent.image_model }
								: {}),
							...(superAgent.video_model
								? { video_model: superAgent.video_model }
								: {}),
						},
					}
				: undefined,
		},
	}
}

export async function prepareScheduledTaskRunNow(detail: ScheduledTask.Task) {
	// 1. 同步 MCP 到目标项目
	await syncScheduledTaskMcpToProject(detail.plugins?.servers)
	// 2. 构建运行 payload
	return buildScheduledTaskRunNowPayload(detail)
}
