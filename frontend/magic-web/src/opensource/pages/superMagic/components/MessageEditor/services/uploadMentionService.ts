import type { Editor, JSONContent } from "@tiptap/react"
import type { MentionListItem } from "@/opensource/components/business/MentionPanel/tiptap-plugin/types"
import type { TiptapMentionAttributes } from "@/opensource/components/business/MentionPanel/tiptap-plugin"
import {
	MentionItemType,
	UploadFileMentionData,
	ProjectFileMentionData,
} from "@/opensource/components/business/MentionPanel/types"
import { SuperMagicApi } from "@/opensource/apis"
import pubsub, { PubSubEvents } from "@/opensource/utils/pubsub"
import type { FileData } from "../types"
import {
	createUploadFileMentionAttributes,
	transformUploadFileToProjectFile,
} from "../utils/mention"

interface LoggerLike {
	error: (message: string, error?: unknown) => void
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
			items.push({
				type: "mention",
				attrs: node.attrs as TiptapMentionAttributes,
			})
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
			items.push({
				type: "mention",
				attrs: node.attrs as TiptapMentionAttributes,
			})
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

	editor.commands.insertContent(mentions)
	editor.commands.focus()
}

export function updateUploadMentionProgress({
	editor,
	fileId,
	progress,
	status,
	error,
}: {
	editor: Editor | null
	fileId: string
	progress: number
	status: FileData["status"]
	error?: string
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

		tr.setNodeMarkup(pos, undefined, {
			type: MentionItemType.UPLOAD_FILE,
			data: {
				...uploadData,
				upload_progress: progress,
				upload_status: status,
				upload_error: error,
			},
		})

		return true
	})

	if (tr.steps.length > 0) {
		dispatch(tr)
	}
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

		if (isProjectContext && saveResult) {
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
					upload_progress: uploadData.upload_progress,
					upload_status: uploadData.upload_status,
					upload_error: uploadData.upload_error,
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
		pubsub.publish(PubSubEvents.Update_Attachments)
	} catch (error) {
		logger.error("delete project file failed", error)
		onError?.(error)
	}
}
