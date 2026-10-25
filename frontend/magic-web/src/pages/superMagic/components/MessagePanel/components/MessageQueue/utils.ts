import type { JSONContent } from "@/infrastructure/editors/tiptap/core"
import i18n from "i18next"
import type { QueuedMessage } from "../../hooks/useMessageQueue"
import { INSPECTOR_DETAIL_TYPE } from "@/pages/superMagic/components/MessageEditor/extensions/inspector-detail/const"
import { getInspectorDetailHeaderLabel } from "@/pages/superMagic/components/MessageEditor/extensions/inspector-detail/display"
import { transformInspectorContent } from "@/pages/superMagic/components/MessageEditor/extensions/inspector-detail/transform"
import type { InspectorDetailAttrs } from "@/pages/superMagic/components/MessageEditor/extensions/inspector-detail/types"

const MENTION_PREVIEW_FALLBACKS: Record<string, string> = {
	agent: "Agent",
	cloud_file: "Cloud File",
	design_marker: "Marker",
	mcp: "MCP",
	memory_directory: "Memory Folder",
	memory_file: "Memory File",
	project_directory: "Folder",
	project_file: "File",
	skill: "Skill",
	tool: "Tool",
	upload_file: "File",
}

/** Resolve a mention node into readable text without loading editor extensions. */
function getMentionPreviewText(node: JSONContent) {
	const data = node.attrs?.data as Record<string, unknown> | undefined
	const mentionType = typeof node.attrs?.type === "string" ? node.attrs.type : ""
	const displayName =
		data?.name ||
		data?.file_name ||
		data?.agent_name ||
		data?.directory_name ||
		data?.label ||
		node.attrs?.label ||
		node.attrs?.name ||
		MENTION_PREVIEW_FALLBACKS[mentionType]
	const memoryPrefix = i18n.t("super/longMemory:mentionPrefix", {
		defaultValue: "Memory",
	})

	if (typeof displayName !== "string" || !displayName) return ""
	if (mentionType === "memory_file" || mentionType === "memory_directory") {
		return `@${memoryPrefix}:${displayName}`
	}
	return `@${displayName}`
}

/**
 * 队列预览（拖拽浮层、删除确认、正文宽度测量）不在 React 上下文里，
 * 标签文案固定走 "super" 命名空间。
 *
 * 这里的 key 是 display.ts / ElementInspector 里的字面量转交过来的（静态扫描仍可命中），
 * 只能这样透传：既要拿到「已选取的元素」这类兜底文案，又不能依赖 useTranslation。
 * 用 i18n.t 而不是 i18n.getFixedT：i18next 未初始化时前者原样返回 key，后者会抛错。
 */
function getInspectorLabelText(key: string) {
	return i18n.t(key, { ns: "super" })
}

/** 序列化文本还原出来的选取元素节点，预览里取其标签文案。 */
function getInspectorPreviewText(node: JSONContent) {
	const attrs = node.attrs as InspectorDetailAttrs | undefined
	if (!attrs) return ""
	return getInspectorDetailHeaderLabel(getInspectorLabelText, attrs.textContent, attrs.tagName)
}

/** Walk TipTap JSON content into plain text; mentions and inspector chips keep their label. */
function collectTextFromContent(node: JSONContent): string {
	if (typeof node.text === "string") return node.text
	if (node.type === "mention") return getMentionPreviewText(node)
	if (node.type === INSPECTOR_DETAIL_TYPE) return getInspectorPreviewText(node)
	if (!Array.isArray(node.content)) return ""

	return node.content.map(collectTextFromContent).filter(Boolean).join(" ")
}

/** Normalize rich queue content into the one-line preview used by the mobile queue card. */
export function normalizeQueuePreviewText(content: QueuedMessage["content"]) {
	// 队列里存的是 `<magic-selection>` 序列化文本，先按渲染路径还原成节点，
	// 否则纯文本摘要会把原始标记（Type/File/Selector…）当成正文吐出来。
	// 传副本：预览会在渲染期被调用，而 transform 的旧格式分支会就地改写节点。
	const restored = transformInspectorContent(trimQueueContent(content))
	return collectTextFromContent(restored).replace(/\s+/g, " ").trim()
}

/** Trim leading/trailing whitespace while preserving rich-text nodes and mentions. */
export function trimQueueContent(content: QueuedMessage["content"]): JSONContent {
	const clonedContent = JSON.parse(JSON.stringify(content)) as JSONContent
	const textNodes: JSONContent[] = []

	const collectTextNodes = (node: JSONContent) => {
		if (typeof node.text === "string") textNodes.push(node)
		node.content?.forEach(collectTextNodes)
	}

	collectTextNodes(clonedContent)
	if (textNodes.length > 0) {
		textNodes[0].text = textNodes[0].text?.replace(/^\s+/, "")
		const lastTextNode = textNodes[textNodes.length - 1]
		lastTextNode.text = lastTextNode.text?.replace(/\s+$/, "")
	}

	const isBoundaryBreak = (node: JSONContent): boolean => {
		return node.type === "hardBreak" || node.type === "hard_break"
	}

	const trimBoundaryBreaks = (node: JSONContent) => {
		if (!Array.isArray(node.content)) return

		node.content.forEach(trimBoundaryBreaks)
		while (
			node.content[0] &&
			(isBoundaryBreak(node.content[0]) || !hasContent(node.content[0]))
		) {
			node.content.shift()
		}
		while (
			node.content.length > 0 &&
			(isBoundaryBreak(node.content[node.content.length - 1]) ||
				!hasContent(node.content[node.content.length - 1]))
		) {
			node.content.pop()
		}
	}

	const hasContent = (node: JSONContent): boolean => {
		if (typeof node.text === "string") return node.text.length > 0
		if (node.type === "mention") return true
		return node.content?.some(hasContent) ?? false
	}

	trimBoundaryBreaks(clonedContent)

	if (Array.isArray(clonedContent.content)) {
		while (clonedContent.content[0] && !hasContent(clonedContent.content[0])) {
			clonedContent.content.shift()
		}
		while (
			clonedContent.content.length > 0 &&
			!hasContent(clonedContent.content[clonedContent.content.length - 1])
		) {
			clonedContent.content.pop()
		}
	}

	return clonedContent
}
