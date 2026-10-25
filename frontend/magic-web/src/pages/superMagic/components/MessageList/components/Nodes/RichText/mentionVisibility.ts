import type { JSONContent } from "@/infrastructure/editors/tiptap/core"
import type {
	MentionListItem,
	TiptapMentionAttributes,
} from "@/components/business/MentionPanel/tiptap-plugin/types"
import { getMentionUniqueId } from "@/components/business/MentionPanel/tiptap-plugin/types"
import { MentionItemType } from "@/components/business/MentionPanel/types"
import { normalizeCanvasMarkerMentionData } from "@/components/business/MentionPanel/utils/canvasMarkerMention"
import { INSPECTOR_DETAIL_TYPE } from "@/pages/superMagic/components/MessageEditor/extensions/inspector-detail/const"
import { parseContent } from "../../Text/components/RichText/utils"

function getLegacyMarkerNumberKey(attrs: TiptapMentionAttributes): string | undefined {
	if (attrs.type !== MentionItemType.DESIGN_MARKER) return undefined

	const markerData = normalizeCanvasMarkerMentionData(attrs.data)
	if (markerData?.marker_id || markerData?.mark_number === undefined) return undefined

	return `marker-number:${markerData.mark_number}`
}

function getInlineMarkerNumberKey(attrs: TiptapMentionAttributes): string | undefined {
	if (attrs.type !== MentionItemType.DESIGN_MARKER) return undefined

	const markerData = normalizeCanvasMarkerMentionData(attrs.data)
	if (markerData?.mark_number === undefined) return undefined

	return `marker-number:${markerData.mark_number}`
}

function addMentionKey(keys: Set<string>, attrs: TiptapMentionAttributes | undefined) {
	const key = getMentionUniqueId(attrs)
	if (key) keys.add(key)

	const markerNumberKey = attrs ? getInlineMarkerNumberKey(attrs) : undefined
	if (markerNumberKey) keys.add(markerNumberKey)
}

export function getInlineMentionKeys(content?: JSONContent | string): Set<string> {
	const keys = new Set<string>()
	if (!content) return keys

	const root = parseContent(content)
	if (!root) return keys

	const visit = (node: JSONContent) => {
		if (node.type === "mention" && node.attrs) {
			addMentionKey(keys, node.attrs as TiptapMentionAttributes)
		}

		if (node.type === INSPECTOR_DETAIL_TYPE && node.attrs?.fileMention) {
			addMentionKey(keys, node.attrs.fileMention as TiptapMentionAttributes)
		}

		node.content?.forEach(visit)
	}

	visit(root)
	return keys
}

/**
 * `extra.super_agent.mentions` 是旧协议的独立展示列表；新版富文本会把同一 Mention
 * 直接序列化进 content。只保留 content 中尚未渲染的项目，避免两个表示重复显示。
 */
export function getMentionItemsMissingFromRichTextContent(
	mentions: Array<{ attrs: TiptapMentionAttributes }>,
	content?: JSONContent | string,
): MentionListItem[] {
	const inlineMentionKeys = getInlineMentionKeys(content)

	return mentions.flatMap((mention) => {
		const key = getMentionUniqueId(mention.attrs)
		const legacyMarkerNumberKey = getLegacyMarkerNumberKey(mention.attrs)
		if (
			(key && inlineMentionKeys.has(key)) ||
			(legacyMarkerNumberKey && inlineMentionKeys.has(legacyMarkerNumberKey))
		) {
			return []
		}
		return [{ type: "mention", attrs: mention.attrs }]
	})
}
