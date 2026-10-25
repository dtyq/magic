import { MentionItemType } from "@/components/business/MentionPanel/types"
import type { Editor } from "@/infrastructure/editors/tiptap/react"
import { runActiveEditor } from "@/pages/superMagic/components/MessageEditor/utils/editorLifecycle"

interface MentionNode {
	type?: string
	attrs?: { type?: string; data?: { app_id?: string } }
	content?: MentionNode[]
}

function hasMicroAppMention(node: MentionNode | undefined, appId: string): boolean {
	if (!node) return false
	if (
		node.type === "mention" &&
		node.attrs?.type === MentionItemType.MICRO_APP &&
		node.attrs.data?.app_id === appId
	) {
		return true
	}
	return node.content?.some((child) => hasMicroAppMention(child, appId)) ?? false
}

export function insertCurrentMicroAppMention(
	editor: Editor | null | undefined,
	params: { appId?: string; appName?: string },
) {
	const appId = params.appId?.trim()
	if (!appId) return
	const appName = params.appName?.trim() || appId

	runActiveEditor(editor, (active) => {
		if (hasMicroAppMention(active.getJSON() as MentionNode, appId)) {
			active.commands.focus()
			return
		}

		active.commands.insertContent({
			type: "mention",
			attrs: {
				type: MentionItemType.MICRO_APP,
				data: { app_id: appId, app_name: appName },
			},
		})
		active.commands.focus()
	})
}
