import { useState, type MouseEvent, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import type { Editor } from "@/infrastructure/editors/tiptap/core"
import {
	ContextMenu,
	ContextMenuTrigger,
	ContextMenuContent,
	ContextMenuItem,
} from "@/components/shadcn-ui/context-menu"
import magicToast from "@/components/base/MagicToaster/utils"
import {
	MentionItemType,
	type UploadFileMentionData,
} from "@/components/business/MentionPanel/types"
import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin/types"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import { resolveMentionForClipboard } from "../../MessageList/utils/mentionClipboard"
import { copyWithMetadata } from "@/utils/clipboard-helpers"
import {
	createMessageClipboardPayloadFromContent,
	type MessageClipboardPayload,
} from "@/utils/messageClipboardSerializer"
import { useOptionalMessageEditorStore } from "../stores"

interface MentionContextMenuProps {
	editor: Editor | null
	getWorkspaceFilesList?: () => AttachmentItem[]
	getCurrentProjectId?: () => string | undefined
	children: ReactNode
}

export default function MentionContextMenu({
	editor,
	getWorkspaceFilesList,
	getCurrentProjectId,
	children,
}: MentionContextMenuProps) {
	const { t } = useTranslation("super")
	const store = useOptionalMessageEditorStore()
	const [payload, setPayload] = useState<MessageClipboardPayload | null>(null)

	function handleContextMenu(event: MouseEvent<HTMLDivElement>) {
		const target = event.target instanceof Element ? event.target : null
		const element = target?.closest<HTMLElement>("[data-magic-editor-node]")
		const interactive = target?.closest("input, textarea, button, [contenteditable='true']")
		if (
			!editor ||
			editor.isDestroyed ||
			!element ||
			!editor.view.dom.contains(element) ||
			(interactive && element.contains(interactive))
		) {
			// 普通文字和标签内部输入控件继续使用原生右键菜单。
			event.stopPropagation()
			return
		}
		const position = editor.view.posAtDOM(element, 0)
		const node = editor.state.doc.nodeAt(position)
		if (node?.type.name !== "mention") {
			event.stopPropagation()
			return
		}
		const attrs = node.attrs as TiptapMentionAttributes
		if (attrs.type === MentionItemType.UPLOAD_FILE) {
			const data = attrs.data as UploadFileMentionData
			const status =
				store?.fileUploadStore.getFileById(data.file_id)?.status ?? data.upload_status
			if (status !== "done") {
				setPayload(null)
				return
			}
		}
		const workspaceFiles = getWorkspaceFilesList?.() ?? []
		const sourceProjectId = getCurrentProjectId?.()
		// 复制被右击的节点快照，不改变选区；沿用现有路径补全与粘贴校验。
		const copied = createMessageClipboardPayloadFromContent(
			{ type: "doc", content: [{ type: "paragraph", content: [node.toJSON()] }] },
			{
				workspaceFiles,
				sourceProjectId,
				enrichMentionAttrs: (mention) =>
					resolveMentionForClipboard(mention, workspaceFiles, sourceProjectId),
			},
		)
		// 序列化降级为文字时不能宣称复制了标签，未就绪附件也不能产生失效引用。
		setPayload(copied.metadata.mentions?.length === 1 ? copied : null)
	}

	async function copyMention() {
		if (!payload) return
		try {
			await copyWithMetadata(payload.plainText, payload.metadata)
			magicToast.success(t("common.copySuccess"))
		} catch {
			magicToast.error(t("common.copyFailed"))
		}
	}

	return (
		<ContextMenu>
			<ContextMenuTrigger asChild>
				<div className="contents" onContextMenuCapture={handleContextMenu}>
					{children}
				</div>
			</ContextMenuTrigger>
			<ContextMenuContent>
				<ContextMenuItem disabled={!payload} onSelect={() => void copyMention()}>
					{t("messageEditor.copyMention")}
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	)
}
