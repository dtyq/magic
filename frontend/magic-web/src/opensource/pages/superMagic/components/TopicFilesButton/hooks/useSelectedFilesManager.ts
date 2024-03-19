import { useMemoizedFn } from "ahooks"
import type { AttachmentItem } from "./types"
import {
	addFileToCurrentChat,
	addFileToNewChat,
	addMultipleFilesToCurrentChat,
	addMultipleFilesToNewChat,
} from "../../../utils/topics"
import {
	handleAttachmentDragStart,
	handleMultipleFilesDragStart,
} from "../../MessageEditor/utils/drag"
import type { Workspace, ProjectListItem } from "../../../pages/Workspace/types"

interface UseSelectedFilesManagerOptions {
	selectedItems: Set<string>
	mergedFiles: AttachmentItem[]
	getItemId: (item: AttachmentItem) => string
	selectedWorkspace?: Workspace | null
	selectedProject?: ProjectListItem | null
	afterAddFileToCurrentTopic?: () => void
	afterAddFileToNewTopic?: () => void
}

/**
 * 递归查找文件的工具函数
 */
export function findFileById(
	files: AttachmentItem[],
	targetId: string,
	getItemId: (item: AttachmentItem) => string,
): AttachmentItem | null {
	for (const file of files) {
		if (getItemId(file) === targetId) {
			return file
		}
		if (file.children) {
			const found = findFileById(file.children, targetId, getItemId)
			if (found) return found
		}
	}
	return null
}

/**
 * 收集选中的文件项
 */
export function collectSelectedFiles(
	selectedItems: Set<string>,
	mergedFiles: AttachmentItem[],
	getItemId: (item: AttachmentItem) => string,
): AttachmentItem[] {
	const selectedFiles: AttachmentItem[] = []

	selectedItems.forEach((id) => {
		const file = findFileById(mergedFiles, id, getItemId)
		if (file) {
			selectedFiles.push(file)
		}
	})

	return selectedFiles
}

/**
 * 管理选中文件操作的Hook
 */
export function useSelectedFilesManager(options: UseSelectedFilesManagerOptions) {
	const {
		selectedItems,
		mergedFiles,
		getItemId,
		selectedWorkspace,
		selectedProject,
		afterAddFileToCurrentTopic,
		afterAddFileToNewTopic,
	} = options

	// 获取选中的文件列表
	const getSelectedFiles = useMemoizedFn(() => {
		return collectSelectedFiles(selectedItems, mergedFiles, getItemId)
	})

	// 添加多个文件到当前对话
	const handleAddMultipleFilesToCurrentChat = useMemoizedFn(() => {
		if (selectedItems.size === 0) return

		const selectedFiles = getSelectedFiles()

		if (selectedFiles.length > 0) {
			addMultipleFilesToCurrentChat({ fileItems: selectedFiles })
			afterAddFileToCurrentTopic?.()
		}
	})

	// 添加多个文件到新对话
	const handleAddMultipleFilesToNewChat = useMemoizedFn(() => {
		if (selectedItems.size === 0) return

		const selectedFiles = getSelectedFiles()

		if (selectedFiles.length > 0) {
			addMultipleFilesToNewChat({
				fileItems: selectedFiles,
				selectedWorkspace,
				selectedProject,
				afterAddFileToNewTopic,
			})
		}
	})

	// 检查指定文件是否被选中，并获取所有选中文件用于拖拽
	const getFilesForDrag = useMemoizedFn((item: AttachmentItem) => {
		const itemId = getItemId(item)
		const isCurrentItemSelected = selectedItems.has(itemId)

		// 如果当前项被选中且有多个选中项，则返回所有选中的文件
		if (isCurrentItemSelected && selectedItems.size > 1) {
			const selectedFiles = getSelectedFiles()
			if (selectedFiles.length > 1) {
				return { isMultiple: true, files: selectedFiles }
			}
		}

		// 默认情况：返回单个文件
		return { isMultiple: false, files: [item] }
	})

	// 添加单个文件到当前对话
	const handleAddToCurrentChat = useMemoizedFn((item: AttachmentItem) => {
		addFileToCurrentChat({ fileItem: item })
		afterAddFileToCurrentTopic?.()
	})

	// 添加单个文件到新对话
	const handleAddToNewChat = useMemoizedFn((item: AttachmentItem) => {
		addFileToNewChat({
			fileItem: item,
			selectedWorkspace,
			selectedProject,
			afterAddFileToNewTopic,
		})
	})

	// 处理拖拽开始事件 - 支持多文件拖拽
	const handleDragStart = useMemoizedFn((e: React.DragEvent, item: AttachmentItem) => {
		const dragData = getFilesForDrag(item)

		if (dragData.isMultiple) {
			handleMultipleFilesDragStart(e, dragData.files)
		} else {
			handleAttachmentDragStart(e, item)
		}
	})

	return {
		getSelectedFiles,
		handleAddMultipleFilesToCurrentChat,
		handleAddMultipleFilesToNewChat,
		getFilesForDrag,
		handleAddToCurrentChat,
		handleAddToNewChat,
		handleDragStart,
	}
}
