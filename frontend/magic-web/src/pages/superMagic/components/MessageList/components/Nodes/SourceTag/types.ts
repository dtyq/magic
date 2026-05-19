import type { SuperMagicNode } from "@/types/chat/conversation_message"
import type { SVGProps } from "react"

export interface SourceTagProps {
	source?: SuperMagicNode
}

export type SupportedSourceChannel = "dingtalk" | "lark" | "wechat" | "wecom"

export interface SourceChannelMeta {
	labelKey: string
	className: string
	Icon: (props: SVGProps<SVGSVGElement>) => JSX.Element
}
