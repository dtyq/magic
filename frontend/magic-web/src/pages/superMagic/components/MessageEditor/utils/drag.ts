import {
	clearProjectAttachmentDragHoverPlainText,
	setProjectAttachmentDragHoverPlainText,
} from "@/components/CanvasDesign/ui/editors/message/reference-assets/projectAttachmentDragHoverBridge"
import { TabItem } from "../../Detail/components/FilesViewer/types"
import { AttachmentItem } from "../../TopicFilesButton/hooks"
import projectFilesStore from "@/stores/projectFiles"
import { getFileReferenceIdentityKey } from "@/pages/superMagic/services/userFileReferenceResolver"
import { MentionItemType } from "@/components/business/MentionPanel/types"
import { createProjectFileMentionData } from "@/components/business/MentionPanel/utils/projectReferenceMention"
import {
	createFileReferenceMention,
	normalizeFileReferenceMention,
	type FileReferenceSource,
} from "@/components/business/MentionPanel/utils/fileReferenceMention"
import type { JSONContent } from "@/infrastructure/editors/tiptap/core"
import magicToast from "@/components/base/MagicToaster/utils"
import i18n from "i18next"
import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import { dragLogger } from "./dragLogger"
import { runActiveEditor, type MaybeEditor } from "./editorLifecycle"

export enum DRAG_TYPE {
	Tab = "tab",
	ProjectFile = "project_file",
	ProjectDirectory = "project_directory",
	MultipleFiles = "multiple_files",
	PPTSlide = "ppt_slide",
	SelfMediaCard = "self_media_card",
}
export const PROJECT_ATTACHMENT_DRAG_MIME = "application/x-magic-project-attachment"
export const PROJECT_IMAGE_ATTACHMENT_DRAG_MIME = "application/x-magic-project-image-attachment"

const IMAGE_FILE_EXTENSIONS = new Set([
	"png",
	"jpg",
	"jpeg",
	"gif",
	"webp",
	"svg",
	"bmp",
	"ico",
	"avif",
])

function isImageAttachment(item: AttachmentItem): boolean {
	if (item.is_directory) return false
	const fileName = item.file_name || item.name || item.filename || ""
	const ext = fileName.split(".").pop()?.toLowerCase() || ""
	return IMAGE_FILE_EXTENSIONS.has(ext)
}

export interface TabDragData {
	type: DRAG_TYPE.Tab
	data: TabItem
}

/**
 * 生成tab拖拽数据
 * @param data
 * @returns
 */
export function genTabDragData(data: TabItem) {
	return JSON.stringify({
		type: "tab",
		data,
	})
}

/**
 * 处理tab拖拽开始事件
 * @param e
 * @param tab
 */
export function handleTabDragStart(e: React.DragEvent, tab: TabItem) {
	clearProjectAttachmentDragHoverPlainText()
	const payload = genTabDragData(tab)
	e.dataTransfer.setData("text/plain", payload)
	setProjectAttachmentDragHoverPlainText(payload)

	// 📋 日志记录：开始拖拽 Tab
	dragLogger.startSession()
	dragLogger.logDragStart({
		source: "tab",
		itemType: DRAG_TYPE.Tab,
		itemId: tab.fileData.file_id,
		itemName: tab.fileData.file_name,
		dataTransferTypes: Array.from(e.dataTransfer.types),
		payload: payload.substring(0, 200),
	})
}
/**
 * 处理tab拖拽结束事件
 * @param e
 */
export function handleTabDragEnd(e: React.DragEvent) {
	clearProjectAttachmentDragHoverPlainText()
	e.dataTransfer.clearData()

	// 📋 日志记录：拖拽结束
	dragLogger.logDragEnd()
}

export interface AttachmentDragData {
	type: DRAG_TYPE.ProjectFile | DRAG_TYPE.ProjectDirectory
	data: AttachmentItem
	mention?: TiptapMentionAttributes
}

export interface MultipleFilesDragData {
	type: DRAG_TYPE.MultipleFiles
	data: AttachmentItem[]
	mentions?: Array<TiptapMentionAttributes | null>
}

export interface PPTSlideDragData {
	type: DRAG_TYPE.PPTSlide
	data: {
		file_id: string
		file_name: string
		relative_file_path: string
		file_extension: string
		slide_index?: number
		slide_title?: string
	}
}

export interface SelfMediaCardDragData {
	type: DRAG_TYPE.SelfMediaCard
	data: {
		file_id: string
		file_name: string
		relative_file_path: string
		file_extension: string
	}
}

/**
 * 生成附件拖拽数据
 * @param data
 * @returns
 */
export function genAttachmentDragData(data: AttachmentItem, mention?: TiptapMentionAttributes) {
	return JSON.stringify({
		type: data.is_directory ? DRAG_TYPE.ProjectDirectory : DRAG_TYPE.ProjectFile,
		data,
		mention,
	})
}

/**
 * 生成多文件拖拽数据
 * @param data 文件列表
 * @returns
 */
export function genMultipleFilesDragData(
	data: AttachmentItem[],
	mentions?: Array<TiptapMentionAttributes | null>,
) {
	return JSON.stringify({
		type: DRAG_TYPE.MultipleFiles,
		data,
		mentions,
	})
}

/**
 * 处理项目文件拖拽开始事件
 * @param e
 * @param file
 */
export function handleAttachmentDragStart(
	e: React.DragEvent,
	file: AttachmentItem,
	mention?: TiptapMentionAttributes,
) {
	const payload = genAttachmentDragData(file, mention)
	e.dataTransfer.setData("text/plain", payload)
	e.dataTransfer.setData(PROJECT_ATTACHMENT_DRAG_MIME, payload)
	if (isImageAttachment(file)) {
		e.dataTransfer.setData(PROJECT_IMAGE_ATTACHMENT_DRAG_MIME, payload)
	}
	setProjectAttachmentDragHoverPlainText(payload)

	// 📋 日志记录：开始拖拽附件
	dragLogger.startSession()
	dragLogger.logDragStart({
		source: "attachment",
		itemType: file.is_directory ? DRAG_TYPE.ProjectDirectory : DRAG_TYPE.ProjectFile,
		itemId: file.file_id,
		itemName: file.file_name,
		dataTransferTypes: Array.from(e.dataTransfer.types),
		payload: payload.substring(0, 200),
	})
}

/**
 * 处理多文件拖拽开始事件
 * @param e
 * @param files 文件列表
 */
export function handleMultipleFilesDragStart(
	e: React.DragEvent,
	files: AttachmentItem[],
	mentions?: Array<TiptapMentionAttributes | null>,
) {
	const payload = genMultipleFilesDragData(files, mentions)
	e.dataTransfer.setData("text/plain", payload)
	e.dataTransfer.setData(PROJECT_ATTACHMENT_DRAG_MIME, payload)
	if (files.some(isImageAttachment)) {
		e.dataTransfer.setData(PROJECT_IMAGE_ATTACHMENT_DRAG_MIME, payload)
	}
	setProjectAttachmentDragHoverPlainText(payload)

	// 📋 日志记录：开始拖拽多个文件
	dragLogger.startSession()
	dragLogger.logDragStart({
		source: "multipleFiles",
		itemType: DRAG_TYPE.MultipleFiles,
		itemName: `${files.length} files`,
		dataTransferTypes: Array.from(e.dataTransfer.types),
		payload: payload.substring(0, 200),
	})
}

/**
 * 生成PPT slide拖拽数据
 * @param data
 * @returns
 */
export function genPPTSlideDragData(data: {
	file_id: string
	file_name: string
	relative_file_path: string
	file_extension: string
	slide_index?: number
	slide_title?: string
}) {
	return JSON.stringify({
		type: DRAG_TYPE.PPTSlide,
		data,
	})
}

/**
 * 生成自媒体卡片拖拽数据
 * @param data
 * @returns
 */
export function genSelfMediaCardDragData(data: SelfMediaCardDragData["data"]) {
	return JSON.stringify({
		type: DRAG_TYPE.SelfMediaCard,
		data,
	})
}

/**
 * 处理自媒体卡片拖拽开始事件
 * @param e
 * @param cardData
 */
export function handleSelfMediaCardDragStart(
	e: React.DragEvent,
	cardData: SelfMediaCardDragData["data"],
) {
	clearProjectAttachmentDragHoverPlainText()
	e.dataTransfer.setData("text/plain", genSelfMediaCardDragData(cardData))
}

/**
 * 处理PPT slide拖拽开始事件
 * @param e
 * @param slideData
 */
export function handlePPTSlideDragStart(
	e: React.DragEvent,
	slideData: {
		file_id: string
		file_name: string
		relative_file_path: string
		file_extension: string
		slide_index?: number
		slide_title?: string
	},
) {
	clearProjectAttachmentDragHoverPlainText()
	const payload = genPPTSlideDragData(slideData)
	e.dataTransfer.setData("text/plain", payload)

	// 📋 日志记录：开始拖拽 PPT slide
	dragLogger.startSession()
	dragLogger.logDragStart({
		source: "pptSlide",
		itemType: DRAG_TYPE.PPTSlide,
		itemId: slideData.file_id,
		itemName: slideData.slide_title || `Slide ${slideData.slide_index}`,
		dataTransferTypes: Array.from(e.dataTransfer.types),
		payload: payload.substring(0, 200),
	})
}

/**
 * 将单个AttachmentItem转换为ProjectFile拖拽数据格式
 */
export function convertAttachmentToProjectFileDragData(item: AttachmentItem): AttachmentDragData {
	return {
		type: item.is_directory ? DRAG_TYPE.ProjectDirectory : DRAG_TYPE.ProjectFile,
		data: item,
	}
}

/**
 * 将多个AttachmentItem转换为MultipleFiles拖拽数据格式
 */
export function convertAttachmentsToMultipleFilesDragData(
	items: AttachmentItem[],
): MultipleFilesDragData {
	return {
		type: DRAG_TYPE.MultipleFiles,
		data: items,
	}
}

/**
 * 使用现有的insertMentionFromDroppedData方法插入单个文件到编辑器
 */
export function insertSingleFileToEditor(editor: unknown, item: AttachmentItem) {
	const dragData = convertAttachmentToProjectFileDragData(item)
	insertMentionFromDroppedData({ editor, data: dragData })
}

/**
 * 使用现有的insertMentionFromDroppedData方法插入多个文件到编辑器
 */
export function insertMultipleFilesToEditor(editor: unknown, items: AttachmentItem[]) {
	const dragData = convertAttachmentsToMultipleFilesDragData(items)
	insertMentionFromDroppedData({ editor, data: dragData })
}

/**
 * 处理项目文件拖拽结束事件
 * @param e
 */
export function handleAttachmentDragEnd(e: React.DragEvent) {
	clearProjectAttachmentDragHoverPlainText()
	e.dataTransfer.clearData()

	// 📋 日志记录：拖拽结束
	dragLogger.logDragEnd()
}

async function resolveDroppedMention(
	file: FileReferenceSource,
	mention?: TiptapMentionAttributes | null,
): Promise<TiptapMentionAttributes | null> {
	if (mention) return normalizeFileReferenceMention(mention)
	return createFileReferenceMention(file, {
		getFolderData: (parentId) => projectFilesStore.getFolderData(parentId),
		workspaceFilesList: projectFilesStore.workspaceFilesList,
	})
}

export async function insertMentionFromDroppedData({
	editor,
	data,
}: {
	editor?: unknown | null
	data:
		| TabDragData
		| AttachmentDragData
		| MultipleFilesDragData
		| PPTSlideDragData
		| SelfMediaCardDragData
}): Promise<void> {
	// 📋 日志记录：检查编辑器状态
	const hasEditor = !!editor
	const isDestroyed = hasEditor && (editor as { isDestroyed?: unknown }).isDestroyed === true
	const canExecuteCommands = hasEditor && !isDestroyed
	dragLogger.logEditorCheck({ hasEditor, isDestroyed, canExecuteCommands })
	if (!canExecuteCommands) return
	const identity = getFileReferenceIdentityKey()
	const project = projectFilesStore.currentSelectedProject?.id

	try {
		let mentions: Array<TiptapMentionAttributes | null>
		let files: FileReferenceSource[]
		switch (data.type) {
			case DRAG_TYPE.Tab: {
				const tab = data.data
				files = [
					{
						...tab.fileData,
						file_id: tab.fileData.file_id || tab.id,
						file_name: tab.fileData.file_name || tab.title,
						relative_file_path: tab.fileData.relative_file_path || tab.filePath,
						parent_id:
							tab.fileData.parent_id == null
								? undefined
								: String(tab.fileData.parent_id),
					},
				]
				mentions = [await resolveDroppedMention(files[0])]
				break
			}
			case DRAG_TYPE.ProjectFile:
			case DRAG_TYPE.ProjectDirectory:
				files = [data.data]
				mentions = [await resolveDroppedMention(data.data, data.mention)]
				break
			case DRAG_TYPE.MultipleFiles:
				files = data.data
				mentions = await Promise.all(
					files.map((file, index) => resolveDroppedMention(file, data.mentions?.[index])),
				)
				break
			case DRAG_TYPE.PPTSlide:
			case DRAG_TYPE.SelfMediaCard:
				files = [data.data]
				mentions = [
					{
						type: MentionItemType.PROJECT_FILE,
						data: createProjectFileMentionData(data.data),
					},
				]
				break
			default:
				return
		}

		if (
			identity !== getFileReferenceIdentityKey() ||
			project !== projectFilesStore.currentSelectedProject?.id
		)
			return
		const content: JSONContent[] = mentions.map((attrs, index) =>
			attrs
				? { type: "mention", attrs }
				: {
						type: "text",
						text: String(
							files[index].file_name ||
								files[index].name ||
								files[index].relative_file_path ||
								"",
						),
					},
		)
		if (mentions.some((mention) => mention === null))
			magicToast.error(i18n.t("super:common.fileNotFoundOrLoadFailed"))

		// 查询完成时重新检查编辑器，离开页面后的响应不能写入新的输入框。
		let didInsert = false
		runActiveEditor(editor as MaybeEditor, (activeEditor) => {
			activeEditor.commands.insertContent(content)
			activeEditor.commands.focus()
			didInsert = true
		})
		dragLogger.logMentionInsert({
			success: didInsert,
			mentionType: mentions.length > 1 ? "multiple" : mentions[0]?.type,
			itemsCount: files.length,
		})
	} catch (error) {
		dragLogger.logMentionInsert({ success: false, error, mentionData: data })
		magicToast.error(i18n.t("super:common.fileNotFoundOrLoadFailed"))
	}
}
