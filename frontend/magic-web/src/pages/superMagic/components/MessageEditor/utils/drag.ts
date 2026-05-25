import {
	clearProjectAttachmentDragHoverPlainText,
	setProjectAttachmentDragHoverPlainText,
} from "@/components/CanvasDesign/components/MessageEditor/reference-assets/projectAttachmentDragHoverBridge"
import { TabItem } from "../../Detail/components/FilesViewer/types"
import { AttachmentItem } from "../../TopicFilesButton/hooks"
import projectFilesStore from "@/stores/projectFiles"
import { MentionItemType, ProjectFileMentionData } from "@/components/business/MentionPanel/types"
import { getFolderMentionData } from "@/components/business/MentionPanel/utils/directoryMention"
import { dragLogger } from "./dragLogger"

export enum DRAG_TYPE {
	Tab = "tab",
	ProjectFile = "project_file",
	ProjectDirectory = "project_directory",
	MultipleFiles = "multiple_files",
	PPTSlide = "ppt_slide",
	SelfMediaCard = "self_media_card",
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
	const payload = genAttachmentDragData(file)
	e.dataTransfer.setData("text/plain", payload)
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
export function handleMultipleFilesDragStart(e: React.DragEvent, files: AttachmentItem[]) {
	const payload = genMultipleFilesDragData(files)
	e.dataTransfer.setData("text/plain", payload)
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

export function insertMentionFromDroppedData({
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
}) {
	// 📋 日志记录：检查编辑器状态
	const hasEditor = !!editor
	const isDestroyed = hasEditor && (editor as any).isDestroyed === true
	const canExecuteCommands =
		hasEditor && typeof (editor as any).commands?.insertContent === "function"

	dragLogger.logEditorCheck({
		hasEditor,
		isDestroyed,
		canExecuteCommands,
	})

	if (!editor) {
		dragLogger.logError("insertMention", new Error("Editor is null"))
		return
	}

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

	if (!isTiptapLikeEditor(editor)) {
		dragLogger.logError("insertMention", new Error("Editor is not Tiptap-like"))
		return
	}

	try {
		switch (data.type) {
			case DRAG_TYPE.Tab: {
				const fileData = data.data.fileData

				// 如果是文件夹入口文件（slide、录音总结等 index.html），应该 @文件夹 而不是 @文件
				const fileName = fileData.file_name || fileData.display_filename || fileData.filename
				const isFolderEntryFile =
					fileData.display_config?.type === "slide" ||
					(fileName?.toLowerCase() === "index.html" &&
						fileData.display_config &&
						fileData.parent_id)

				if (isFolderEntryFile && fileData.parent_id) {
					const folderData = projectFilesStore.getFolderData(fileData.parent_id)
					if (folderData) {
						editor.commands.insertContent({
							type: "mention",
							attrs: {
								type: MentionItemType.FOLDER,
								data: getFolderMentionData({
									directoryId: folderData.file_id,
									directoryName: folderData.file_name,
									directoryPath: folderData.relative_file_path,
									directoryMetadata: folderData.display_config,
								}),
							},
						})
						editor.commands.focus()

						dragLogger.logMentionInsert({
							success: true,
							mentionType: MentionItemType.FOLDER,
							mentionData: {
								directory_name: folderData.file_name,
							},
						})
						return
					}
				}

				const isDirectoryLikeTab =
					fileData.is_directory === true ||
					(typeof fileData.relative_file_path === "string" &&
						fileData.relative_file_path.endsWith("/")) ||
					fileData.display_config?.type === "design"

				if (isDirectoryLikeTab) {
					editor.commands.insertContent({
						type: "mention",
						attrs: {
							type: MentionItemType.FOLDER,
							data: getFolderMentionData({
								directoryId: fileData.file_id,
								directoryName: fileData.file_name,
								directoryPath: fileData.relative_file_path,
								directoryMetadata: fileData.display_config,
							}),
						},
					})
					editor.commands.focus()

					dragLogger.logMentionInsert({
						success: true,
						mentionType: MentionItemType.FOLDER,
						mentionData: {
							directory_name: fileData.file_name,
						},
					})
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

				// 📋 日志记录：Mention 插入成功
				dragLogger.logMentionInsert({
					success: true,
					mentionType: MentionItemType.PROJECT_FILE,
					mentionData: {
						file_name: data.data.fileData.file_name,
					},
				})
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

				// 📋 日志记录：Mention 插入成功
				dragLogger.logMentionInsert({
					success: true,
					mentionType: MentionItemType.PROJECT_FILE,
					mentionData: {
						file_name: data.data.file_name,
					},
				})
				return
			}
			case DRAG_TYPE.ProjectDirectory: {
				editor.commands.insertContent({
					type: "mention",
					attrs: {
						type: MentionItemType.FOLDER,
						data: getFolderMentionData({
							directoryId: data.data.file_id,
							directoryName: data.data.file_name,
							directoryPath: data.data.relative_file_path,
							directoryMetadata: data.data.display_config,
						}),
					},
				})
				editor.commands.focus()

				// 📋 日志记录：Mention 插入成功
				dragLogger.logMentionInsert({
					success: true,
					mentionType: MentionItemType.FOLDER,
					mentionData: {
						directory_name: data.data.file_name,
					},
				})
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
								data: getFolderMentionData({
									directoryId: item.file_id,
									directoryName: item.file_name,
									directoryPath: item.relative_file_path,
									directoryMetadata: item.display_config,
								}),
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

				// 📋 日志记录：Mention 插入成功
				dragLogger.logMentionInsert({
					success: true,
					mentionType: "multiple",
					itemsCount: data.data.length,
					mentionData: data.data.map((item) => item.file_name),
				})

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

				// 📋 日志记录：Mention 插入成功
				dragLogger.logMentionInsert({
					success: true,
					mentionType: MentionItemType.PROJECT_FILE,
					mentionData: {
						file_name: data.data.file_name,
						slide_index: data.data.slide_index,
					},
				})
				return
			}
			case DRAG_TYPE.SelfMediaCard: {
				// Self-media card: insert as PROJECT_FILE mention
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
				dragLogger.logMentionInsert({
					success: true,
					mentionType: MentionItemType.PROJECT_FILE,
					mentionData: { file_name: data.data.file_name },
				})
				return
			}
			default: {
				dragLogger.logError("insertMention", new Error("Unknown drag type"), {
					dragType: (data as { type?: string }).type,
				})
				return
			}
		}
	} catch (error) {
		dragLogger.logMentionInsert({
			success: false,
			error,
			mentionData: data,
		})
		throw error
	}
}
