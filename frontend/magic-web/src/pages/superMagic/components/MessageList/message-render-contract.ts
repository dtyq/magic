import { extractFilePathMentions } from "@/pages/superMagic/utils/filePathMention"
import { TaskStatus } from "@/pages/superMagic/pages/Workspace/types"
import { SuperMagicMessageType } from "./type"

/**
 * The single source of truth for "will this message put anything on screen".
 *
 * The virtual projection has to answer that question before a row exists, while the renderer
 * answers it again from inside the component tree. Keeping the two on one predicate is what
 * stops a message from being projected as a measured row that renders to nothing — virtua
 * cannot skip a child that already reported a size, so the decision has to be made upstream.
 */

/** Node types that resolve to a component in `components/Nodes`'s NodeMap. */
const renderableNodeTypes = new Set<string>([
	SuperMagicMessageType.Reminder,
	SuperMagicMessageType.RichText,
	SuperMagicMessageType.Chat,
	SuperMagicMessageType.Init,
	SuperMagicMessageType.TaskUpdate,
	SuperMagicMessageType.Thinking,
	SuperMagicMessageType.ToolCall,
	SuperMagicMessageType.ProjectArchive,
	SuperMagicMessageType.AgentReply,
	SuperMagicMessageType.AgentThink,
])

/**
 * A typed node bypasses MessageNode entirely and renders through NodeMap, so its visibility
 * is decided by that component rather than by the attachment contract below.
 */
export function hasRenderableNodeType(node?: { type?: unknown }) {
	return typeof node?.type === "string" && renderableNodeTypes.has(node.type)
}

/**
 * 附件列表属于任务交付：工具步骤结束或等待用户回答都不算任务完成。
 * raw 投影的 debug.status / superStatus 是任务状态，外层 status 仅表示 IM 传输状态；
 * canonical 节点则直接使用 status。历史完成消息按自身状态展示，不受新任务影响。
 */
export function canRenderFinalAttachments(node?: {
	role?: unknown
	status?: unknown
	superStatus?: unknown
	debug?: unknown
	tool?: unknown
}): boolean {
	const debug = node?.debug as Record<string, unknown> | undefined
	const message = debug ?? node
	const tool = message?.tool as Record<string, unknown> | undefined
	const status = debug ? (debug.status ?? node?.superStatus) : (node?.superStatus ?? node?.status)
	return (
		message?.role === "tool" && tool?.name === "finish_task" && status === TaskStatus.FINISHED
	)
}

/**
 * Mirrors AttachmentSection's own resolution order: the canonical node wins, and the raw
 * message is only consulted when the canonical projection carries no attachment array.
 */
export function resolveAttachmentList(
	node?: { attachments?: unknown },
	fallbackNode?: { attachments?: unknown },
): Array<unknown> {
	if (Array.isArray(node?.attachments)) return node.attachments
	if (Array.isArray(fallbackNode?.attachments)) return fallbackNode.attachments
	return []
}

/**
 * AttachmentSection can also render a file list derived from the *previous* message's
 * `[@file_path:...]` mentions, so an attachment-free Tool row is not automatically empty.
 */
export function hasFilePathMentions(content?: unknown) {
	if (typeof content !== "string" || !content) return false
	return extractFilePathMentions(content).length > 0
}

export interface ToolMessageRenderInput {
	node?: Record<string, unknown>
	/** The raw message behind the canonical projection, used as AttachmentSection's fallback. */
	fallbackNode?: { attachments?: unknown }
	/** Content of the message preceding this one, which supplies file-path mentions. */
	previousContent?: unknown
}

/**
 * Whether a `role: "tool"` message can produce visible output.
 *
 * MessageNode's Tool branch renders AttachmentSection and nothing else, so a Tool result's
 * `content` / `reasoning_content` / `tool_calls` never reach the screen. Treating them as
 * visible payload is what projects an empty measured row for every text-only tool result.
 *
 * The projection can only reach the mention level for file-path attachments — whether those
 * paths exist in the workspace file tree is an async store fact that resolves later. Keeping
 * the row in that case is the safe direction: it degrades to today's behaviour for a small
 * subset instead of dropping a row that would have been visible.
 */
export function canToolMessageRender({
	node,
	fallbackNode,
	previousContent,
}: ToolMessageRenderInput) {
	if (hasRenderableNodeType(node)) return true
	if (!canRenderFinalAttachments(node)) return false

	const debug = node?.debug as Record<string, unknown> | undefined
	const tool = node?.tool as Record<string, unknown> | undefined
	const debugTool = debug?.tool as Record<string, unknown> | undefined
	// The canonical store node hoists attachments out of `debug`/`tool`, and the projection
	// runs before that hoist. Accepting every location keeps extra rows rather than losing one.
	const hasAttachments = [node, debug, tool, debugTool, fallbackNode].some(
		(source) => Array.isArray(source?.attachments) && source.attachments.length > 0,
	)
	if (hasAttachments) return true

	return hasFilePathMentions(previousContent)
}
