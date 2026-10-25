import type { DownloadProgressState } from "@/pages/superMagic/stores/download-progress"
import type { MouseEvent, ReactNode } from "react"
import type { FileItem, Topic } from "@/pages/superMagic/pages/Workspace/types"
import type { ToolCardInteractionTarget } from "../../toolDetailSelection"

export interface ToolDetail {
	type?: string
	data?: Record<string, unknown>
	[key: string]: unknown
}

export interface ToolAttachment extends FileItem {
	file_url?: string
}

export interface ToolCallItem {
	id: string
	type: "function"
	function: {
		name: string
		label: string
		arguments: string
	}
	tool?: {
		id?: string
		name?: string
		action?: string
		status?: string
		remark?: string
		detail?: ToolDetail
		attachments?: ToolAttachment[] | null
		[key: string]: unknown
	}
}

export interface ToolCallViewModel {
	downloadProgress?: DownloadProgressState
	id?: string
	name?: string
	url?: string
	action?: string | ReactNode
	remark?: string
	status?: string
	attachments: ToolAttachment[]
	interactionTarget?: ToolCardInteractionTarget
	rawArguments?: string
	detail?: ToolDetail
}

export interface ToolCallContainerProps {
	topicId: string
	correlationId: string
	/** 所属 Assistant 的逻辑身份，用于 RenderSession 完成前屏蔽 canonical Tool Response。 */
	ownerSuperMessageId?: string
	classNames?: string
	toolCall: ToolCallItem
	selectedTopic?: Topic | null
	isShare?: boolean
	onSelectDetail?: (detail: unknown) => void
	onMouseEnter?: (evt: MouseEvent) => void
	onMouseLeave?: (evt: MouseEvent) => void
}

export interface ToolCallRendererProps extends ToolCallContainerProps {
	toolData: ToolCallViewModel
	loading: boolean
	onClick: () => void
}

export const TERMINAL_TOOL_STATUSES = new Set([
	"finished",
	"error",
	"suspended",
	"response_missing",
])

/** 工具响应未进入终态时，进度由工具卡片承接。 */
export function isToolCallLoading(toolCall: unknown): boolean {
	if (!toolCall || typeof toolCall !== "object" || Array.isArray(toolCall)) return true
	const tool = (toolCall as { tool?: unknown }).tool
	if (!tool || typeof tool !== "object" || Array.isArray(tool)) return true
	const status = (tool as { status?: unknown }).status
	return typeof status !== "string" || !TERMINAL_TOOL_STATUSES.has(status)
}

export function isRenderableToolCall(toolCall: unknown): toolCall is ToolCallItem {
	if (!toolCall || typeof toolCall !== "object") return false
	const candidate = toolCall as {
		id?: unknown
		function?: { name?: unknown }
	}
	return Boolean(
		typeof candidate.id === "string" &&
		candidate.id &&
		typeof candidate.function?.name === "string" &&
		candidate.function.name,
	)
}
