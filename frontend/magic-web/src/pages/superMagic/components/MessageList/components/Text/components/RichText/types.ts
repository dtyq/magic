import { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import type { JSONContent } from "@tiptap/core"
import { MarkerClickScene } from "@/pages/superMagic/components/MessageEditor/hooks/useMarkerClickHandler"

// Mention node structure for ProseMirror
export interface MentionNode {
	type: "mention"
	attrs: {
		id: string
		label: string
		type: string
		description?: string
		icon?: string
		metadata?: Record<string, unknown>
	}
}

// Props for the RichText component
export interface RichTextProps {
	content?: JSONContent | string | Record<string, unknown>
	className?: string
	style?: React.CSSProperties
	onFileClick?: (item: TiptapMentionAttributes["data"]) => void
	/** 消息节点中的 mentions，用于获取原始标记数据 */
	mentions?: Array<{ attrs: TiptapMentionAttributes }>
	/** Marker 点击场景（用于决定点击行为） */
	markerClickScene?: MarkerClickScene
}
