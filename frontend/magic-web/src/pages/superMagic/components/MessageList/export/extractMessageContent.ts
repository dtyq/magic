import type { MessageTurnGroup } from "../message-turn-groups"
import type { SuperMagicMessageItem } from "../type"
import { SuperMagicMessageType } from "../type"
import { MentionItemType } from "@/components/business/MentionPanel/types"
import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import {
	getMentionDisplayName,
	getMentionUniqueId,
} from "@/components/business/MentionPanel/tiptap-plugin/types"
import { buildFilePathAttachments, findFilePathAttachment } from "../utils/attachmentByFilePath"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"

export interface ExportAttachment {
	file?: AttachmentItem
	name: string
	size?: number
	extension?: string
	file_extension?: string
	kind?: "file" | "folder"
}

export interface ExportMessagePart {
	role: "user" | "assistant" | "tool"
	type: string
	timestamp?: number | string
	text?: string
	segments?: ExportTextSegment[]
	markdown?: string
	attachments?: ExportAttachment[]
	toolRawName?: string
	toolName?: string
	toolBrief?: string
	toolCallId?: string
	thinkState?: "thinking" | "done"
}

export interface ExportTextSegment {
	type: "text" | "mention"
	text: string
	mentionType?: string
	mentionKey?: string
}

export interface ExportTurn {
	key: string
	parts: ExportMessagePart[]
}

function getMentionAttrs(raw: any): TiptapMentionAttributes | undefined {
	const attrs = raw?.attrs || raw
	if (!attrs || typeof attrs !== "object") return undefined
	if (!attrs.type || !("data" in attrs)) return undefined
	return attrs as TiptapMentionAttributes
}

function getMentionSegment(raw: any): ExportTextSegment | undefined {
	const attrs = getMentionAttrs(raw)
	if (!attrs) return undefined
	const displayName = getMentionDisplayName(attrs)
	if (!displayName) return undefined
	return {
		type: "mention",
		text: displayName,
		mentionType: attrs.type,
		mentionKey: getMentionUniqueId(attrs),
	}
}

function getMentionSegmentsFromNode(messageNode: any): ExportTextSegment[] {
	const mentions = messageNode?.extra?.super_agent?.mentions
	if (!Array.isArray(mentions)) return []
	return mentions.flatMap((mention: any) => {
		const segment = getMentionSegment(mention)
		return segment ? [segment] : []
	})
}

function mergeMissingMentionSegments(
	segments: ExportTextSegment[],
	mentions: ExportTextSegment[],
): ExportTextSegment[] {
	if (!mentions.length) return segments
	const existing = new Set(
		segments
			.filter((seg) => seg.type === "mention")
			.map((seg) => seg.mentionKey || `${seg.mentionType || ""}:${seg.text}`),
	)
	const missing = mentions.filter((seg) => {
		const key = seg.mentionKey || `${seg.mentionType || ""}:${seg.text}`
		if (existing.has(key)) return false
		existing.add(key)
		return true
	})
	if (!missing.length) return segments
	const out = [...segments]
	if (out.length && out[out.length - 1].type === "text" && out[out.length - 1].text.trim()) {
		out.push({ type: "text", text: " " })
	}
	out.push(...missing)
	return out
}

/** Walk a TipTap JSON doc into ordered segments. Mentions become chip segments. */
function tiptapDocToSegments(doc: any): ExportTextSegment[] {
	if (!doc || typeof doc !== "object") return []
	const segs: ExportTextSegment[] = []
	const pushText = (s: string) => {
		if (!s) return
		const last = segs[segs.length - 1]
		if (last && last.type === "text") last.text += s
		else segs.push({ type: "text", text: s })
	}
	const walk = (n: any) => {
		if (!n) return
		if (Array.isArray(n)) {
			n.forEach(walk)
			return
		}
		const type = n.type
		if (type === "text" && typeof n.text === "string") {
			pushText(n.text)
			return
		}
		if (type === "mention") {
			const segment = getMentionSegment(n)
			if (segment) segs.push(segment)
			return
		}
		if (type === "hardBreak" || type === "hard_break") {
			pushText("\n")
		}
		if (n.content) walk(n.content)
		if (type === "paragraph") pushText("\n")
	}
	walk(doc.content || doc)
	// Collapse excessive blank text and trim edges.
	segs.forEach((seg) => {
		if (seg.type === "text") seg.text = seg.text.replace(/\n{3,}/g, "\n\n")
	})
	while (segs.length && segs[0].type === "text" && !segs[0].text.trim()) segs.shift()
	while (
		segs.length &&
		segs[segs.length - 1].type === "text" &&
		!segs[segs.length - 1].text.trim()
	)
		segs.pop()
	if (segs.length) {
		if (segs[0].type === "text") segs[0].text = segs[0].text.replace(/^\s+/, "")
		const last = segs[segs.length - 1]
		if (last.type === "text") last.text = last.text.replace(/\s+$/, "")
	}
	return segs
}

function segmentsToText(segments: ExportTextSegment[]): string {
	return segments
		.map((seg) =>
			seg.type === "mention"
				? `@${seg.text}${seg.mentionType === MentionItemType.FOLDER ? "/" : ""}`
				: seg.text,
		)
		.join("")
		.trim()
}

function extractUserContent(rawContent: unknown): {
	text: string
	segments: ExportTextSegment[]
} {
	if (!rawContent) return { text: "", segments: [] }
	if (typeof rawContent === "object") {
		const segments = tiptapDocToSegments(rawContent)
		return { text: segmentsToText(segments), segments }
	}
	if (typeof rawContent !== "string") return { text: "", segments: [] }
	try {
		const doc = JSON.parse(rawContent)
		const segments = tiptapDocToSegments(doc)
		return { text: segmentsToText(segments), segments }
	} catch {
		return { text: rawContent, segments: [{ type: "text", text: rawContent }] }
	}
}

function extractBestUserContent(rawContents: unknown[]): {
	text: string
	segments: ExportTextSegment[]
} {
	let best = { text: "", segments: [] as ExportTextSegment[] }
	let bestScore = -1

	rawContents.forEach((rawContent) => {
		const next = extractUserContent(rawContent)
		const mentionCount = next.segments.filter((seg) => seg.type === "mention").length
		const score = mentionCount * 10000 + next.text.length
		if (score > bestScore) {
			best = next
			bestScore = score
		}
	})

	return best
}

function pickAttachments(
	messageNode: any,
	options?: { includeMentions?: boolean },
): ExportAttachment[] | undefined {
	const out: ExportAttachment[] = []
	const mentions = options?.includeMentions
		? messageNode?.extra?.super_agent?.mentions
		: undefined
	if (Array.isArray(mentions)) {
		mentions.forEach((m: any) => {
			const t = m?.attrs?.type
			if (t !== MentionItemType.PROJECT_FILE && t !== MentionItemType.UPLOAD_FILE) return
			const d = m?.attrs?.data || {}
			const name = d.file_name || d.name || "file"
			const size = typeof d.file_size === "number" ? d.file_size : undefined
			const extension = d.file_extension || name.split(".").pop()
			out.push({
				file: d,
				name,
				size,
				extension,
				file_extension: extension,
				kind: "file",
			})
		})
	}
	const direct = messageNode?.attachments
	if (Array.isArray(direct)) {
		direct.forEach((a: any) => {
			const name = a?.file_name || a?.display_filename || a?.filename || a?.name || "file"
			out.push({
				file: a,
				name,
				size:
					typeof a?.file_size === "number"
						? a.file_size
						: typeof a?.size === "number"
							? a.size
							: undefined,
				extension: a?.file_extension || name.split(".").pop(),
				file_extension: a?.file_extension || name.split(".").pop(),
				kind: a?.is_directory ? "folder" : "file",
			})
		})
	}
	return out.length > 0 ? out : undefined
}

function pickResolvedAttachments(
	primary: any,
	fallback: any,
	options?: { includeMentions?: boolean },
): ExportAttachment[] | undefined {
	return pickAttachments(primary, options) || pickAttachments(fallback, options)
}

function pickFilePathAttachments(
	content?: string,
	workspaceFilesList?: AttachmentItem[],
): ExportAttachment[] | undefined {
	if (!content) return undefined
	if (!workspaceFilesList?.length) return undefined
	const pathAttachments = buildFilePathAttachments(content).filter((attachment) => {
		const found = findFilePathAttachment(workspaceFilesList, attachment)
		if (!found) return false
		if (found.type === "directory" || found.is_directory) return false
		return true
	})

	if (pathAttachments.length === 0) return undefined
	return pathAttachments.map((attachment) => ({
		file: findFilePathAttachment(workspaceFilesList, attachment),
		name: attachment.fileName,
		extension: attachment.fileExt,
		file_extension: attachment.fileExt,
		kind: "file",
	}))
}

function pickDisplayAttachments(
	primary: any,
	fallback: any,
	options?: {
		includeMentions?: boolean
		fallbackContent?: string
		workspaceFilesList?: AttachmentItem[]
	},
): ExportAttachment[] | undefined {
	return (
		pickFilePathAttachments(options?.fallbackContent, options?.workspaceFilesList) ||
		pickResolvedAttachments(primary, fallback, {
			includeMentions: options?.includeMentions,
		})
	)
}

function normalizeIdentifier(value: unknown): string {
	if (typeof value === "string") return value
	if (typeof value === "number") return String(value)
	return ""
}

function getToolCallId(source: any, tool: any, fallbackToolCallId?: string): string {
	return (
		normalizeIdentifier(fallbackToolCallId) ||
		normalizeIdentifier(source?.tool_call_id) ||
		normalizeIdentifier(tool?.id) ||
		normalizeIdentifier(tool?.tool_call_id)
	)
}

function isToolCallType(t?: string): boolean {
	return t === SuperMagicMessageType.ToolCall
}

function isThinkingType(t?: string): boolean {
	return t === SuperMagicMessageType.Thinking || t === SuperMagicMessageType.AgentThink
}

function attachmentOnlyPart(
	attachments: ExportAttachment[] | undefined,
	timestamp?: number | string,
	toolCallId?: string,
): ExportMessagePart | null {
	return attachments
		? {
				role: "assistant",
				type: "attachment",
				timestamp,
				attachments,
				...(toolCallId ? { toolCallId } : {}),
			}
		: null
}

function extractToolPart(
	source: any,
	opts: ExtractOptions,
	options?: {
		type?: string
		timestamp?: number | string
		fallbackToolCallId?: string
		fallbackRawName?: string
		fallbackToolName?: string
		fallbackAttachmentsSource?: any
		fallbackAttachmentContent?: string
	},
): ExportMessagePart | null {
	const type = options?.type || source?.type || SuperMagicMessageType.ToolCall
	const tool = source?.tool || {}

	const rawToolName =
		tool?.name ||
		tool?.tool_name ||
		source?.tool_name ||
		options?.fallbackRawName ||
		(type === SuperMagicMessageType.Init ? "init_virtual_machine" : "")
	const hiddenToolName =
		rawToolName === "finish_task" || options?.fallbackRawName === "finish_task"
	const hiddenSdkSnippet =
		rawToolName === "run_sdk_snippet" || options?.fallbackRawName === "run_sdk_snippet"
	if (hiddenToolName) {
		// finish_task is a task-result projection rather than an ordinary tool call;
		// do not leak its legacy tool_call_id into the exported attachment part.
		return attachmentOnlyPart(
			pickDisplayAttachments(source, options?.fallbackAttachmentsSource, {
				fallbackContent: options?.fallbackAttachmentContent,
				workspaceFilesList: opts.workspaceFilesList,
			}),
			options?.timestamp,
		)
	}
	if (!opts.includeToolCall) {
		return null
	}
	if (hiddenSdkSnippet) {
		return null
	}
	const toolCallId = getToolCallId(source, tool, options?.fallbackToolCallId)

	const brief =
		(typeof tool?.remark === "string" && tool.remark) ||
		(typeof source?.brief === "string" && source.brief) ||
		(typeof source?.description === "string" && source.description) ||
		tool?.brief ||
		tool?.description
	const toolName =
		tool?.action ||
		tool?.name ||
		tool?.tool_name ||
		source?.tool_name ||
		options?.fallbackToolName ||
		"tool"

	return {
		role: "tool",
		type: type || "tool_call",
		timestamp: options?.timestamp,
		toolCallId,
		toolRawName: rawToolName,
		toolName,
		toolBrief: typeof brief === "string" ? brief : undefined,
	}
}

function extractEmbeddedToolCalls(
	merged: any,
	opts: ExtractOptions,
	fallbackTimestamp?: number | string,
	fallbackAttachmentContent?: string,
): ExportMessagePart[] {
	const toolCalls = merged?.tool_calls
	if (!Array.isArray(toolCalls)) return []

	return toolCalls.flatMap((toolCall: any) => {
		const part = extractToolPart(toolCall, opts, {
			type: SuperMagicMessageType.ToolCall,
			timestamp: toolCall?.timestamp ?? toolCall?.tool?.timestamp ?? fallbackTimestamp,
			fallbackToolCallId: toolCall?.id,
			fallbackRawName: toolCall?.function?.name,
			fallbackToolName: toolCall?.function?.label || toolCall?.function?.name,
			fallbackAttachmentContent,
		})
		return part ? [part] : []
	})
}

export interface ExtractOptions {
	includeToolCall: boolean
	resolveNode?: (superMessageId: string) => any
	workspaceFilesList?: AttachmentItem[]
}

function getMergedNode(node: SuperMagicMessageItem | undefined, opts: ExtractOptions): any {
	if (!node) return undefined
	const superMessageId = (node as any)?.super_message_id
	const storeNode: any = superMessageId ? opts.resolveNode?.(superMessageId) : undefined
	return storeNode || node
}

function getNodeContent(node: SuperMagicMessageItem | undefined, opts: ExtractOptions): string {
	const merged = getMergedNode(node, opts)
	return typeof merged?.content === "string" ? merged.content : ""
}

function extractFromNode(
	node: SuperMagicMessageItem,
	opts: ExtractOptions,
	context?: { previousNode?: SuperMagicMessageItem },
): ExportMessagePart[] {
	const role = (node?.role as "user" | "assistant" | "tool") || "assistant"
	const type = node?.type || ""
	const merged: any = getMergedNode(node, opts)
	const timestamp = merged?.timestamp ?? (node as any)?.timestamp
	const previousContent = getNodeContent(context?.previousNode, opts)

	if (role === "user") {
		const baseContent = extractBestUserContent([
			merged?.content,
			merged?.rich_text?.content,
			merged?.raw_content?.rich_text?.content,
			node?.content,
			node?.rich_text?.content,
			node?.raw_content?.rich_text?.content,
		])
		const segments = mergeMissingMentionSegments(baseContent.segments, [
			...getMentionSegmentsFromNode(merged),
			...getMentionSegmentsFromNode(node),
		])
		const text = segmentsToText(segments) || baseContent.text
		const attachments = pickResolvedAttachments(merged, node, { includeMentions: true })
		if (!text && !attachments) return []
		return [
			{
				role,
				type,
				timestamp,
				text,
				segments,
				attachments,
			},
		]
	}

	if (role === "tool" || isToolCallType(type)) {
		const part = extractToolPart(merged, opts, {
			type,
			timestamp,
			fallbackAttachmentsSource: node,
			fallbackAttachmentContent: previousContent,
		})
		return part ? [part] : []
	}

	if (isThinkingType(type)) {
		const text = typeof merged?.content === "string" ? merged.content : ""
		const event = typeof merged?.event === "string" ? merged.event : ""
		return [
			{
				role: "assistant",
				type,
				timestamp,
				markdown: opts.includeToolCall ? text : undefined,
				thinkState: event === "before_agent_think" ? "thinking" : "done",
			},
		]
	}

	// Assistant textual (agent_reply / rich_text / chat / fallback)
	const parts: ExportMessagePart[] = []
	const md = typeof merged?.content === "string" ? merged.content : ""
	const attachments = pickResolvedAttachments(merged, node)
	if (md || attachments) {
		parts.push({
			role: "assistant",
			type: type || "assistant",
			timestamp,
			markdown: md,
			attachments,
		})
	}
	parts.push(...extractEmbeddedToolCalls(merged, opts, timestamp, md))
	return parts
}

function scoreToolPart(part: ExportMessagePart): number {
	let score = 0
	if (part.type === "attachment") score += 5
	if (part.toolBrief) score += 4
	if (part.attachments?.length) score += 3
	if (part.type === "attachment" && part.attachments?.length) {
		score += Math.max(0, 10 - part.attachments.length)
	}
	if (part.toolRawName) score += 2
	if (part.toolName && part.toolName !== "tool") score += 1
	return score
}

function mergeToolPart(prev: ExportMessagePart, next: ExportMessagePart): ExportMessagePart {
	const richer = scoreToolPart(next) >= scoreToolPart(prev) ? next : prev
	const fallback = richer === next ? prev : next
	return {
		...fallback,
		...richer,
		timestamp: richer.timestamp ?? fallback.timestamp,
		toolRawName: richer.toolRawName || fallback.toolRawName,
		toolName: richer.toolName || fallback.toolName,
		toolBrief: richer.toolBrief || fallback.toolBrief,
		attachments: richer.attachments || fallback.attachments,
	}
}

function dedupeToolParts(parts: ExportMessagePart[]): ExportMessagePart[] {
	const out: ExportMessagePart[] = []
	const toolIndexById = new Map<string, number>()

	parts.forEach((part) => {
		const isToolDerivedPart = part.role === "tool" || part.type === "attachment"
		if (!isToolDerivedPart || !part.toolCallId) {
			out.push(part)
			return
		}

		const existingIndex = toolIndexById.get(part.toolCallId)
		if (existingIndex == null) {
			toolIndexById.set(part.toolCallId, out.length)
			out.push(part)
			return
		}

		out[existingIndex] = mergeToolPart(out[existingIndex], part)
	})

	return out
}

export function extractTurns(
	groups: MessageTurnGroup[],
	selectedKeys: Set<string>,
	opts: ExtractOptions,
): ExportTurn[] {
	const turns: ExportTurn[] = []
	groups.forEach((group) => {
		if (!group.stickyItem) return
		if (!selectedKeys.has(group.key)) return

		const parts: ExportMessagePart[] = []
		let previousNode: SuperMagicMessageItem | undefined
		group.items.forEach(({ node }) => {
			parts.push(...extractFromNode(node, opts, { previousNode }))
			const children = (node as any)?.childMessages as SuperMagicMessageItem[] | undefined
			if (Array.isArray(children)) {
				children.forEach((child) => {
					parts.push(...extractFromNode(child, opts, { previousNode: node }))
				})
			}
			previousNode = node
		})
		const dedupedParts = dedupeToolParts(parts)
		if (dedupedParts.length > 0) turns.push({ key: group.key, parts: dedupedParts })
	})
	return turns
}
