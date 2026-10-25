import { Extension, type JSONContent } from "@/infrastructure/editors/tiptap/core"
import { Plugin, PluginKey } from "prosemirror-state"
import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin/types"
import type { DataService } from "@/components/business/MentionPanel/types"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import {
	serializeMessageClipboard,
	writeMessageClipboardPayload,
} from "@/utils/messageClipboardSerializer"
import { pasteMessageClipboard } from "./pasteMessageClipboard"

interface CopyMessageOptions {
	onMentionsInsert?: (items: TiptapMentionAttributes[]) => void
	onContentChange?: (content: JSONContent) => void
	dataService?: DataService | null
	getWorkspaceFilesList?: () => AttachmentItem[]
	getCurrentProjectId?: () => string | undefined
}

const CopyMessageExtension = Extension.create<CopyMessageOptions>({
	name: "copyMessage",
	// Tiptap 会反转同优先级扩展；先恢复资源，再让通用文本插件处理剩余粘贴。
	priority: 110,

	addOptions() {
		return {
			onMentionsInsert: undefined,
			dataService: null,
			getWorkspaceFilesList: undefined,
			getCurrentProjectId: undefined,
		}
	},

	addProseMirrorPlugins() {
		return [
			new Plugin({
				key: new PluginKey("copyMessage"),

				props: {
					handleDOMEvents: {
						copy: (view, event) => {
							if (!this.options.getWorkspaceFilesList) {
								return false
							}

							const clipboardEvent = event as ClipboardEvent
							const clipboardData = clipboardEvent.clipboardData
							if (!clipboardData) {
								return false
							}

							const payload = serializeMessageClipboard(view, {
								workspaceFiles: this.options.getWorkspaceFilesList(),
								sourceProjectId: this.options.getCurrentProjectId?.(),
							})
							if (!payload) {
								return false
							}

							clipboardEvent.preventDefault()
							writeMessageClipboardPayload(clipboardData, payload)

							return true
						},
					},
					handlePaste: (_view, event) => {
						const clipboardData = event.clipboardData
						if (!clipboardData) return false

						return pasteMessageClipboard(this.editor, clipboardData, {
							onMentionsInsert: this.options.onMentionsInsert,
							dataService: this.options.dataService ?? null,
							getWorkspaceFilesList: this.options.getWorkspaceFilesList,
							getCurrentProjectId: this.options.getCurrentProjectId,
						})
					},
				},
			}),
		]
	},
})

export default CopyMessageExtension
