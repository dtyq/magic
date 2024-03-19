import { Extension } from "@tiptap/core"
import { Plugin, PluginKey } from "prosemirror-state"
import { isAllowedMention } from "../utils/mention"
import { MentionListItem } from "@/opensource/components/business/MentionPanel/tiptap-plugin/types"
import { extractClipboardMetadata, isMagicClipboard } from "@/opensource/utils/clipboard-helpers"

const CopyMessageExtension = Extension.create({
	name: "copyMessage",

	addOptions() {
		return {
			onMentionsInsert: () => null,
			dataService: null,
		}
	},

	addProseMirrorPlugins() {
		return [
			new Plugin({
				key: new PluginKey("copyMessage"),

				props: {
					handlePaste: (_view, event) => {
						const clipboardData = event.clipboardData
						if (!clipboardData) return false

						// 检查是否是来自Magic应用的剪贴板数据
						if (!isMagicClipboard(clipboardData)) {
							return false
						}

						// 使用兼容移动端的方式提取元数据
						const metadata = extractClipboardMetadata(clipboardData)
						console.log("📋 Extracted clipboard metadata:", metadata)

						if (!metadata) {
							return false
						}

						// 处理mentions
						if (metadata.mentions && Array.isArray(metadata.mentions)) {
							const mentionsList = metadata.mentions as MentionListItem[]
							this.options.onMentionsInsert?.(
								mentionsList
									.map((mention) => mention.attrs)
									.filter((mention) =>
										isAllowedMention(mention, this.options.dataService ?? null),
									),
							)
						}

						// 处理富文本内容
						if (metadata.richText) {
							try {
								const content = JSON.parse(metadata.richText)
								this.editor.commands.insertContent(content)
								return true
							} catch (err) {
								console.error("❌ Failed to parse rich text content:", err)
							}
						}

						return false
					},
				},
			}),
		]
	},
})

export default CopyMessageExtension
