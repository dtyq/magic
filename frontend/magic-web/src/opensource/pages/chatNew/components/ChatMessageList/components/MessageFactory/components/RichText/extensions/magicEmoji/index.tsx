import { mergeAttributes, Node, nodePasteRule } from "@tiptap/core"
import { ReactNodeViewRenderer } from "@tiptap/react"
import type { HTMLAttributes } from "react"
import { emojiLocaleCache } from "@/opensource/components/base/MagicEmojiPanel/cache"
import { magicEmojiRegex } from "@/opensource/pages/chatNew/components/ChatSubSider/utils"
import MagicEmojiNodeRender from "./MagicEmojiNodeRender"

type Options = {
	basePath?: string
	HTMLAttributes: HTMLAttributes<HTMLImageElement>
}

const ExtensionName = "magic-emoji"

const MagicEmojiNodeExtension = Node.create<Options>({
	name: ExtensionName,
	group: "inline",
	inline: true,
	atom: true,
	selectable: true,
	addAttributes() {
		return {
			code: {
				default: "",
			},
			ns: {
				default: "emojis/",
			},
			suffix: {
				default: ".png",
			},
			size: {
				default: 20,
			},
			locale: {
				default: "zh_CN",
			},
		}
	},
	addPasteRules() {
		return [
			nodePasteRule({
				find: magicEmojiRegex,
				type: this.type,
				getAttributes: (match) => {
					return {
						code: match[0].slice(1, -1),
					}
				},
			}),
		]
	},
	parseHTML() {
		return [
			{
				tag: `img[data-type="${ExtensionName}"]`,
			},
		]
	},
	renderHTML({ HTMLAttributes }) {
		return [
			"img",
			mergeAttributes(HTMLAttributes, {
				"data-type": ExtensionName,
			}),
		]
	},

	addNodeView() {
		return ReactNodeViewRenderer(MagicEmojiNodeRender)
	},
	renderText({ node }) {
		// FIXME: 获取当前语言对应的表情名称 失败
		return `[${emojiLocaleCache.get(node.attrs.code)?.[node.attrs.locale] || node.attrs.code}]`
	},
})

export default MagicEmojiNodeExtension
