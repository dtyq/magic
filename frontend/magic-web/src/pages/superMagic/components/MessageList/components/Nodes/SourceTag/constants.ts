import { DingtalkSourceIcon, LarkSourceIcon, WechatSourceIcon, WecomSourceIcon } from "./icons"
import type { SourceChannelMeta, SupportedSourceChannel } from "./types"

export const sourceTagBaseClassName =
	"h-5 shrink-0 gap-1 rounded-md bg-transparent px-2 py-0 text-xs font-medium leading-4 shadow-none"

export const sourceChannelMetaMap: Record<SupportedSourceChannel, SourceChannelMeta> = {
	dingtalk: {
		labelKey: "common.sourceTagDingTalk",
		className: "border-[#3296FA] text-[#3296FA]",
		Icon: DingtalkSourceIcon,
	},
	lark: {
		labelKey: "common.sourceTagLark",
		className: "border-[#6366F1] text-[#6366F1]",
		Icon: LarkSourceIcon,
	},
	wechat: {
		labelKey: "common.sourceTagWechat",
		className: "border-[#22C55E] text-[#22C55E]",
		Icon: WechatSourceIcon,
	},
	wecom: {
		labelKey: "common.sourceTagWecom",
		className: "border-[#3B82F6] text-[#3B82F6]",
		Icon: WecomSourceIcon,
	},
}

export function isSupportedSourceChannel(channel: string): channel is SupportedSourceChannel {
	return channel in sourceChannelMetaMap
}
