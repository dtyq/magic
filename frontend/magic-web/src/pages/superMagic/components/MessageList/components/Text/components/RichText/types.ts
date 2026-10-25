import { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import type { JSONContent } from "@/infrastructure/editors/tiptap/core"
import { MarkerClickScene } from "@/pages/superMagic/components/MessageEditor/hooks/useMarkerClickHandler"
import type { FileMentionRenderConfig } from "@/pages/superMagic/components/MessageEditor/components/MentionMedia/fileMentionRenderConfig"

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
	/** 文件 Mention 的 Icon 与 Tooltip 展示配置。 */
	fileMentionRenderConfig?: FileMentionRenderConfig
}
