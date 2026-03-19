import { TabItem } from "../../Detail/components/FilesViewer/types"
import { AttachmentItem } from "../../TopicFilesButton/hooks"
import projectFilesStore from "@/stores/projectFiles"
import {
	DirectoryMentionData,
	MentionItemType,
	ProjectFileMentionData,
} from "@/components/business/MentionPanel/types"

export enum DRAG_TYPE {
	Tab = "tab",
	ProjectFile = "project_file",
	ProjectDirectory = "project_directory",
	MultipleFiles = "multiple_files",
	PPTSlide = "ppt_slide",
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
	e.dataTransfer.setData("text/plain", genTabDragData(tab))
}
/**
 * 处理tab拖拽结束事件
 * @param e
 */
export function handleTabDragEnd(e: React.DragEvent) {
	e.dataTransfer.clearData()
}

export interface AttachmentDragData {
	type: DRAG_TYPE.ProjectFile | DRAG_TYPE.ProjectDirectory
	data: AttachmentItem
}

export interface MultipleFilesDragData {
	type: DRAG_TYPE.MultipleFiles
	data: AttachmentItem[]
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

/**
 * 生成附件拖拽数据
 * @param data
 * @returns
 */
export function genAttachmentDragData(data: AttachmentItem) {
	return JSON.stringify({
		type: data.is_directory ? DRAG_TYPE.ProjectDirectory : DRAG_TYPE.ProjectFile,
		data,
	})
}

/**
 * 生成多文件拖拽数据
 * @param data 文件列表
 * @returns
 */
export function genMultipleFilesDragData(data: AttachmentItem[]) {
	return JSON.stringify({
		type: DRAG_TYPE.MultipleFiles,
		data,
	})
}

/**
 * 处理项目文件拖拽开始事件
 * @param e
 * @param file
 */
export function handleAttachmentDragStart(e: React.DragEvent, file: AttachmentItem) {
	e.dataTransfer.setData("text/plain", genAttachmentDragData(file))
}

/**
 * 处理多文件拖拽开始事件
 * @param e
 * @param files 文件列表
 */
export function handleMultipleFilesDragStart(e: React.DragEvent, files: AttachmentItem[]) {
	e.dataTransfer.setData("text/plain", genMultipleFilesDragData(files))
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
	e.dataTransfer.setData("text/plain", genPPTSlideDragData(slideData))
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
	e.dataTransfer.clearData()
}

export function insertMentionFromDroppedData({
	editor,
	data,
}: {
	editor?: unknown | null
	data: TabDragData | AttachmentDragData | MultipleFilesDragData | PPTSlideDragData
}) {
	if (!editor) return

	interface TiptapLikeEditor {
		commands: {
			insertContent: (...args: unknown[]) => unknown
			focus: () => void
		}
	}

	function isTiptapLikeEditor(instance: unknown): instance is TiptapLikeEditor {
		const anyInstance = instance as { commands?: { insertContent?: unknown; focus?: unknown } }
		return !!(
			anyInstance &&
			anyInstance.commands &&
			typeof anyInstance.commands.insertContent === "function" &&
			typeof anyInstance.commands.focus === "function"
		)
	}

	if (!isTiptapLikeEditor(editor)) return

	switch (data.type) {
		case DRAG_TYPE.Tab: {
			const fileData = data.data.fileData

			if (fileData.metadata?.type === "slide") {
				const folderData = projectFilesStore.getFolderData(fileData.parent_id)
				if (folderData) {
					editor.commands.insertContent({
						type: "mention",
						attrs: {
							type: MentionItemType.FOLDER,
							data: {
								directory_id: folderData.file_id,
								directory_name: folderData.file_name,
								directory_path: folderData.relative_file_path,
								directory_metadata: folderData.metadata,
							} as DirectoryMentionData,
						},
					})
					editor.commands.focus()
				}
				return
			}

			editor.commands.insertContent({
				type: "mention",
				attrs: {
					type: MentionItemType.PROJECT_FILE,
					data: {
						file_id: data.data.fileData.file_id,
						file_name: data.data.fileData.file_name,
						file_path: data.data.fileData.relative_file_path,
						file_extension: data.data.fileData.file_extension,
						file_size: data.data.fileData.file_size,
					} as ProjectFileMentionData,
				},
			})
			editor.commands.focus()
			return
		}
		case DRAG_TYPE.ProjectFile: {
			editor.commands.insertContent({
				type: "mention",
				attrs: {
					type: MentionItemType.PROJECT_FILE,
					data: {
						file_id: data.data.file_id,
						file_name: data.data.file_name,
						file_path: data.data.relative_file_path,
						file_extension: data.data.file_extension,
						file_size: data.data.file_size,
					} as ProjectFileMentionData,
				},
			})
			editor.commands.focus()
			return
		}
		case DRAG_TYPE.ProjectDirectory: {
			editor.commands.insertContent({
				type: "mention",
				attrs: {
					type: MentionItemType.FOLDER,
					data: {
						directory_id: data.data.file_id,
						directory_name: data.data.file_name,
						directory_path: data.data.relative_file_path,
						directory_metadata: data.data.metadata,
					} as DirectoryMentionData,
				},
			})
			editor.commands.focus()
			return
		}
		case DRAG_TYPE.MultipleFiles: {
			// 处理多文件拖拽，为每个文件创建一个mention
			const mentions = data.data.map((item) => {
				if (item.is_directory) {
					return {
						type: "mention",
						attrs: {
							type: MentionItemType.FOLDER,
							data: {
								directory_id: item.file_id,
								directory_name: item.file_name,
								directory_path: item.relative_file_path,
								directory_metadata: item.metadata,
							} as DirectoryMentionData,
						},
					}
				} else {
					return {
						type: "mention",
						attrs: {
							type: MentionItemType.PROJECT_FILE,
							data: {
								file_id: item.file_id,
								file_name: item.file_name,
								file_path: item.relative_file_path,
								file_extension: item.file_extension,
								file_size: item.file_size,
							} as ProjectFileMentionData,
						},
					}
				}
			})

			editor.commands.insertContent(mentions)
			editor.commands.focus()

			return
		}
		case DRAG_TYPE.PPTSlide: {
			// 处理 PPT slide 拖拽，插入为 PROJECT_FILE mention
			editor.commands.insertContent({
				type: "mention",
				attrs: {
					type: MentionItemType.PROJECT_FILE,
					data: {
						file_id: data.data.file_id,
						file_name: data.data.file_name,
						file_path: data.data.relative_file_path,
						file_extension: data.data.file_extension,
					} as ProjectFileMentionData,
				},
			})
			editor.commands.focus()
			return
		}
		default:
			return
	}
}
