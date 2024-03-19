import { isEmpty } from "lodash-es"
import { handleAttachmentDragEnd } from "../../MessageEditor/utils/drag"
import type { AttachmentItem } from "./types"
import type { TreeNodeData } from "../utils/treeDataConverter"
import { canMoveToTarget as checkCanMoveToTarget } from "./useDragMove"

interface DragMoveState {
	draggingFileIds: string[]
	draggingItems: AttachmentItem[]
	isDragging: boolean
	isExternalDrag: boolean
	[key: string]: any
}

interface CreateFileDragHandlersOptions {
	item: AttachmentItem
	node: TreeNodeData
	allowEdit: boolean
	isExpanded: boolean
	dragState: DragMoveState
	selectedItems: Set<string>
	// 回调函数
	handleDragStart: (e: React.DragEvent, item: AttachmentItem) => void // 原有的拖到聊天
	handleFileDragStart: (
		e: React.DragEvent,
		item: AttachmentItem,
		selected: AttachmentItem[],
	) => void
	handleFileDragEnd: (e: React.DragEvent) => void
	handleAutoExpandDragEnter: (key: string, callback: () => void) => void
	handleAutoExpandDragLeave: () => void
	// 工具函数
	getItemId: (item: AttachmentItem) => string
	findFileInTree: (id: string) => AttachmentItem | undefined
	setExpandedKeys: React.Dispatch<React.SetStateAction<React.Key[]>>
}

interface CreateFileDragHandlersReturn {
	// 基础拖拽事件（文件和文件夹都有）
	onDragStart: (e: React.DragEvent) => void
	onDragEnd: (e: React.DragEvent) => void
	// 自动展开事件（仅文件夹有）
	onDragEnter?: (e: React.DragEvent) => void
	onDragLeave?: (e: React.DragEvent) => void
}

/**
 * 创建文件/文件夹拖拽事件处理器
 *
 * 封装文件和文件夹的拖拽相关逻辑，包括：
 * - 拖拽到聊天功能
 * - 文件移动功能
 * - 文件夹自动展开（仅文件夹）
 *
 * @param options 配置选项
 * @returns 拖拽事件处理器
 */
export function createFileDragHandlers(
	options: CreateFileDragHandlersOptions,
): CreateFileDragHandlersReturn {
	const {
		item,
		node,
		allowEdit,
		isExpanded,
		dragState,
		selectedItems,
		handleDragStart,
		handleFileDragStart,
		handleFileDragEnd,
		handleAutoExpandDragEnter,
		handleAutoExpandDragLeave,
		getItemId,
		findFileInTree,
		setExpandedKeys,
	} = options

	// 处理拖拽开始
	const onDragStart = (e: React.DragEvent) => {
		// 1. 首先调用原有的拖拽到聊天功能
		handleDragStart(e, item)

		// 2. 然后启动文件移动拖拽功能（如果有编辑权限）
		if (allowEdit) {
			const currentItemId = getItemId(item)
			// 检查当前拖拽的项是否在选中列表中
			const isCurrentItemSelected = selectedItems.has(currentItemId)

			let selectedItemsArray: AttachmentItem[] = []
			if (isCurrentItemSelected && selectedItems.size > 1) {
				// 如果当前项在选中列表中且有多个选中项，拖拽所有选中的项
				selectedItemsArray = Array.from(selectedItems)
					.map((id) => findFileInTree(id))
					.filter(Boolean) as AttachmentItem[]
			} else {
				// 否则只拖拽当前项
				selectedItemsArray = [item]
			}

			handleFileDragStart(e, item, selectedItemsArray)
		}
	}

	// 处理拖拽结束
	const onDragEnd = (e: React.DragEvent) => {
		// 1. 调用原有的拖拽到聊天结束处理
		handleAttachmentDragEnd(e)
		// 2. 调用文件移动拖拽结束处理
		handleFileDragEnd(e)
	}

	// 处理拖拽进入（仅文件夹）
	const onDragEnter = (e: React.DragEvent) => {
		// 只有文件夹才需要处理拖拽进入
		if (!item?.is_directory) return

		// 只有在未展开且为普通文件夹时才启用自动展开
		if (
			!isExpanded &&
			isEmpty(item.metadata) &&
			allowEdit &&
			(dragState.isDragging || dragState.isExternalDrag)
		) {
			// 对于内部拖拽，检查是否可以移动到此文件夹
			if (dragState.isDragging) {
				const currentParentFolderIds = dragState.draggingItems.map(
					(item) => item.parent_id || null,
				)
				const uniqueParentFolderIds = Array.from(new Set(currentParentFolderIds))

				if (
					checkCanMoveToTarget(
						dragState.draggingFileIds,
						item,
						dragState.draggingItems,
						uniqueParentFolderIds,
					)
				) {
					handleAutoExpandDragEnter(node.key, () => {
						// 自动展开该文件夹
						setExpandedKeys((prev) => [...prev, node.key])
					})
				}
			}
			// 对于外部拖拽，文件夹可以直接接收
			else if (dragState.isExternalDrag) {
				handleAutoExpandDragEnter(node.key, () => {
					// 自动展开该文件夹
					setExpandedKeys((prev) => [...prev, node.key])
				})
			}
		}
	}

	// 处理拖拽离开（仅文件夹）
	const onDragLeave = (e: React.DragEvent) => {
		// 只有文件夹才需要处理拖拽离开
		if (!item?.is_directory) return

		// 检查是否真的离开了当前元素
		const relatedTarget = e.relatedTarget as Element | null
		const currentTarget = e.currentTarget as Element

		// 如果相关目标是当前元素的子元素，则不处理leave
		if (relatedTarget && currentTarget.contains(relatedTarget)) {
			return
		}

		handleAutoExpandDragLeave()
	}

	// 根据是否为文件夹返回不同的事件处理器
	if (item?.is_directory) {
		return {
			onDragStart,
			onDragEnd,
			onDragEnter,
			onDragLeave,
		}
	}

	// 文件只需要基础的拖拽事件
	return {
		onDragStart,
		onDragEnd,
	}
}
