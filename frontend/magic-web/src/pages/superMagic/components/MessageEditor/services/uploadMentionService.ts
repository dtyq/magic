import type { Editor, JSONContent } from "@/infrastructure/editors/tiptap/react"
import type { MentionListItem } from "@/components/business/MentionPanel/tiptap-plugin/types"
import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import {
	DirectoryMentionData,
	MentionItemType,
	UploadFileMentionData,
	ProjectFileMentionData,
} from "@/components/business/MentionPanel/types"
import { SuperMagicApi } from "@/apis"
import type { FileData } from "../types"
import {
	createUploadFileMentionAttributes,
	transformUploadFileToProjectFile,
} from "../utils/mention"
import { runActiveEditor } from "@/utils/tiptapEditorLifecycle"
import { INSPECTOR_DETAIL_TYPE } from "../extensions/inspector-detail/const"
import type { StructuredErrorInput } from "@/infrastructure/logger"

interface LoggerLike {
	error: (input: StructuredErrorInput) => void
}

interface DeleteProjectFileParams {
	fileId?: string
	logger: LoggerLike
	onError?: (error: unknown) => void
}

function isEditorReady(editor: Editor | null): editor is Editor {
	return Boolean(editor && !editor.isDestroyed)
}

export function collectMentionItemsFromContent(content?: JSONContent): MentionListItem[] {
	if (!content) return []

	const items: MentionListItem[] = []
	const walk = (node?: JSONContent) => {
		if (!node) return
		if (node.type === "mention" && node.attrs) {
			const attrs = node.attrs as TiptapMentionAttributes
			if (!attrs.pending) {
				items.push({ type: "mention", attrs })
			}
		} else if (node.type === INSPECTOR_DETAIL_TYPE) {
			if (node.attrs?.fileMention) {
				items.push({
					type: "mention",
					attrs: node.attrs.fileMention as TiptapMentionAttributes,
				})
			}
		}
		if (Array.isArray(node.content)) {
			node.content.forEach((child) => walk(child as JSONContent))
		}
	}

	walk(content)
	return items
}

export function collectMentionItemsFromEditor(editor: Editor | null): MentionListItem[] {
	if (!isEditorReady(editor)) return []

	const items: MentionListItem[] = []
	editor.state.doc.descendants((node) => {
		if (node.type.name === "mention") {
			const attrs = node.attrs as TiptapMentionAttributes
			if (!attrs.pending) {
				items.push({ type: "mention", attrs })
			}
		} else if (node.type.name === INSPECTOR_DETAIL_TYPE) {
			if (node.attrs.fileMention) {
				items.push({
					type: "mention",
					attrs: node.attrs.fileMention as TiptapMentionAttributes,
				})
			}
		}
		return true
	})
	return items
}

export function insertUploadMentionNodes({
	editor,
	fileDatas,
}: {
	editor: Editor | null
	fileDatas: FileData[]
}) {
	if (!isEditorReady(editor) || fileDatas.length === 0) return

	const mentions = fileDatas.map((fileData) => ({
		type: "mention",
		attrs: createUploadFileMentionAttributes(fileData),
	}))

	runActiveEditor(editor, (activeEditor) => {
		activeEditor.commands.insertContent(mentions)
		activeEditor.commands.focus()
	})
}

export function replaceUploadMentionNode({
	editor,
	fileId,
	reportResult,
	saveResult,
	isProjectContext,
}: {
	editor: Editor | null
	fileId: string
	reportResult: FileData["reportResult"]
	saveResult: FileData["saveResult"]
	isProjectContext: boolean
}) {
	if (!isEditorReady(editor)) return

	const { state, dispatch } = editor.view
	const { tr } = state

	state.doc.descendants((node, pos) => {
		if (node.type.name !== "mention") return true

		const attrs = node.attrs as TiptapMentionAttributes
		if (attrs.type !== MentionItemType.UPLOAD_FILE) return true

		const uploadData = attrs.data as UploadFileMentionData
		if (uploadData.file_id !== fileId) return true

		if (isProjectContext && saveResult && !uploadData.is_canvas_clipboard) {
			tr.setNodeMarkup(pos, undefined, {
				type: MentionItemType.PROJECT_FILE,
				data: transformUploadFileToProjectFile(uploadData, saveResult),
			})
			return true
		}

		if (reportResult) {
			tr.setNodeMarkup(pos, undefined, {
				type: MentionItemType.UPLOAD_FILE,
				data: {
					file_id: uploadData.file_id,
					file_name: uploadData.file_name || reportResult.file_name || "",
					file_path: reportResult.file_key || "",
					file_extension: uploadData.file_extension,
					file_size: reportResult.file_size ?? uploadData.file_size ?? 0,
					file: uploadData.file,
					relative_file_path: uploadData.relative_file_path,
					is_hidden: uploadData.is_hidden,
					is_canvas_clipboard: uploadData.is_canvas_clipboard,
					upload_progress: 100,
					upload_status: "done",
					upload_error: undefined,
				},
			})
		}

		return true
	})

	if (tr.steps.length > 0) {
		dispatch(tr)
	}
}

export function removeUploadMentionNodes({
	editor,
	fileId,
	savedFileId,
}: {
	editor: Editor | null
	fileId: string
	savedFileId?: string
}) {
	if (!isEditorReady(editor)) return

	const { state, dispatch } = editor.view
	const { tr } = state
	const toDelete: { from: number; to: number }[] = []

	state.doc.descendants((node, pos) => {
		if (node.type.name !== "mention") return true

		const attrs = node.attrs as TiptapMentionAttributes
		if (attrs.type === MentionItemType.UPLOAD_FILE) {
			const uploadData = attrs.data as UploadFileMentionData
			if (uploadData.file_id === fileId) {
				toDelete.push({ from: pos, to: pos + node.nodeSize })
			}
		}

		if (attrs.type === MentionItemType.PROJECT_FILE && savedFileId) {
			const projectData = attrs.data as ProjectFileMentionData
			if (projectData.file_id === savedFileId) {
				toDelete.push({ from: pos, to: pos + node.nodeSize })
			}
		}

		if (attrs.type === MentionItemType.FOLDER && savedFileId) {
			const directoryData = attrs.data as DirectoryMentionData
			if (directoryData.directory_id === savedFileId) {
				toDelete.push({ from: pos, to: pos + node.nodeSize })
			}
		}

		return true
	})

	toDelete.reverse().forEach(({ from, to }) => {
		tr.delete(from, to)
	})

	if (tr.steps.length > 0) {
		dispatch(tr)
	}
}

export async function deleteProjectFile({ fileId, logger, onError }: DeleteProjectFileParams) {
	if (!fileId) return

	try {
		await SuperMagicApi.deleteFile(fileId)
	} catch (error) {
		logger.error({
			eventKey: "delete_project_file_failed",
			errorKind: "unknown",
			error: error,
			message: "delete project file failed",
		})
		onError?.(error)
	}
}
