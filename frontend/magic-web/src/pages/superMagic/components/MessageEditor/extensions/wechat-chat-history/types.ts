import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin/types"

export const WECHAT_CHAT_HISTORY = "wechatChatHistory"
export type WechatMediaState = "markerOnly" | "unmatched" | "prepareFailed" | "unavailable"

export interface WechatMessage {
	id: string
	sender: string
	date: string
	time: string
	text: string
	kind: "text" | "image" | "video" | "file" | "link"
	url?: string
	mentions: TiptapMentionAttributes[]
	mediaState?: WechatMediaState
	from: number
	to: number
}

export interface WechatChatSnapshot {
	messages: WechatMessage[]
	participants: string[]
	unrecognized: boolean
}

export interface WechatChatActions {
	activeId: string | null
	preview: (id: string) => void
	append: (id: string) => void
}
