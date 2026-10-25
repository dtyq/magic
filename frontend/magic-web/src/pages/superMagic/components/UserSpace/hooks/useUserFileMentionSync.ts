import { useEffect } from "react"
import { reaction } from "mobx"
import type { Editor } from "@/infrastructure/editors/tiptap/react"
import userFilesStore from "@/stores/userFiles"
import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import {
	createUserFileMention,
	needsFileReferenceNormalization,
} from "@/components/business/MentionPanel/utils/fileReferenceMention"
import {
	getFileReferenceIdentityKey,
	resolveFileReference,
} from "../../../services/userFileReferenceResolver"
import { runActiveEditor } from "../../MessageEditor/utils/editorLifecycle"

/** 只更新当前未发送文档中的富引用；历史消息和正文中的路径文本保持原样。 */
export function useUserFileMentionSync(editor: Editor | null): void {
	useEffect(() => {
		let controller: AbortController | null = null
		const dispose = reaction(
			() => userFilesStore.mutationVersion,
			async () => {
				controller?.abort()
				const request = new AbortController()
				controller = request
				const identity = getFileReferenceIdentityKey()
				const ids = new Set<string>()
				runActiveEditor(editor, (active) => {
					active.state.doc.descendants((node) => {
						if (node.type.name !== "mention") return
						const attrs = node.attrs as TiptapMentionAttributes
						if (!needsFileReferenceNormalization(attrs)) return
						const data = attrs.data as { file_id?: string; directory_id?: string }
						const id = data.file_id ?? data.directory_id
						if (id) ids.add(id)
					})
				})
				try {
					const results = await Promise.all(
						[...ids].map(
							async (id) =>
								[
									id,
									await resolveFileReference({ file_id: id }, request.signal),
								] as const,
						),
					)
					if (request.signal.aborted || identity !== getFileReferenceIdentityKey()) return
					const resolved = new Map(results)
					runActiveEditor(editor, (active) => {
						const transaction = active.state.tr
						active.state.doc.descendants((node, position) => {
							if (node.type.name !== "mention") return
							const attrs = node.attrs as TiptapMentionAttributes
							if (!needsFileReferenceNormalization(attrs)) return
							const data = attrs.data as { file_id?: string; directory_id?: string }
							const result = resolved.get(data.file_id ?? data.directory_id ?? "")
							if (
								result?.status !== "resolved" ||
								result.reference.space_type !== "user"
							)
								return
							const mention = createUserFileMention(result.reference)
							transaction.setNodeMarkup(position, undefined, { ...attrs, ...mention })
						})
						if (transaction.docChanged) active.view.dispatch(transaction)
					})
				} catch {
					/* 读取失败不改写原引用；发送前仍按真实 ID 验证可用性。 */
				}
			},
		)
		return () => {
			dispose()
			controller?.abort()
		}
	}, [editor])
}
