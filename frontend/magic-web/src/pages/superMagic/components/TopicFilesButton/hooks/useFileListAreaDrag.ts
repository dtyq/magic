import { useState, useCallback } from "react"
import type { AttachmentItem } from "./types"

interface UseFileListAreaDragOptions {
	allowEdit: boolean
	handleDrop: (info: any) => Promise<void>
	// 新增：拖拽移动相关的处理器
	handleFileDragEnter?: (e: React.DragEvent, targetItem: AttachmentItem | null) => void
	handleFileDragLeave?: (e: React.DragEvent, targetItem: AttachmentItem | null) => void
	handleFileDragOver?: (e: React.DragEvent, targetItem: AttachmentItem | null) => void
	handleFileDrop?: (e: React.DragEvent, targetItem: AttachmentItem | null) => void
	// 新增：检查是否可以移动到根目录
	canMoveToRoot?: () => boolean
	// 新增：外部文件上传支持
	allowExternalDrop?: boolean
	onUploadFiles?: (files: File[], targetPath: string, isFolder: boolean) => Promise<void>
}

/**
 * useFileListAreaDrag - 处理文件列表区域的拖拽逻辑
 * 使得可以拖拽到Tree之外的fileListArea区域，视为拖拽到根目录
 */
export function useFileListAreaDrag(options: UseFileListAreaDragOptions) {
	const {
		allowEdit,
		handleDrop,
		handleFileDragEnter,
		handleFileDragLeave,
		handleFileDragOver,
		handleFileDrop,
		canMoveToRoot,
		allowExternalDrop = false,
		onUploadFiles: _onUploadFiles,
	} = options

	// 拖拽状态管理
	const [draggedNode, setDraggedNode] = useState<any>(null)
	const [isDragOverFileListArea, setIsDragOverFileListArea] = useState(false)

	// 检查拖拽目标是否为Tree组件或其子元素
	const isTreeElement = useCallback((element: Element): boolean => {
		// 检查元素本身或其父元素是否包含Tree相关的类名
		let current: Element | null = element
		while (current) {
			const className = current.className || ""
			if (
				typeof className === "string" &&
				(className.includes("ant-tree") ||
					className.includes("magic-tree") ||
					className.includes("ant-tree-node") ||
					className.includes("ant-tree-treenode") ||
					className.includes("magic-tree-treenode") ||
					className.includes("magic-tree-node-content-wrapper"))
			) {
				return true
			}
			current = current.parentElement
		}
		return false
	}, [])

	// 处理Tree节点开始拖拽
	const handleTreeDragStart = useCallback((info: any) => {
		setDraggedNode(info.node)
	}, [])

	// 处理Tree节点拖拽结束
	const handleTreeDragEnd = useCallback(() => {
		setDraggedNode(null)
		setIsDragOverFileListArea(false)
	}, [])

	// 处理fileListArea的拖拽结束（确保状态清理）
	const handleFileListAreaDragEnd = useCallback(() => {
		// 无论如何都清理根目录悬浮状态
		// 这是最后的防护网，确保拖拽结束后状态一定被清理
		setIsDragOverFileListArea(false)
	}, [])

	// 处理fileListArea的拖拽进入
	const handleFileListAreaDragEnter = useCallback(
		(e: React.DragEvent) => {
			// 检查拖拽目标是否为Tree元素
			const target = e.target as Element
			if (isTreeElement(target)) {
				// 如果在Tree元素上，清理根目录悬浮状态
				setIsDragOverFileListArea(false)
				return
			}

			// 检查是否为内部文件移动
			const hasJsonData = e.dataTransfer.types.includes("application/json")
			// 检查是否有外部文件
			const hasFiles = e.dataTransfer.types.includes("Files")

			// 内部文件移动
			if (hasJsonData && allowEdit && handleFileDragEnter) {
				e.preventDefault()
				handleFileDragEnter(e, null) // null表示根目录
			}
			// 外部文件拖拽
			else if (!hasJsonData && hasFiles && allowExternalDrop && handleFileDragEnter) {
				e.preventDefault()
				handleFileDragEnter(e, null) // null表示根目录
			}
		},
		[allowEdit, allowExternalDrop, isTreeElement, handleFileDragEnter],
	)

	// 处理fileListArea的拖拽悬停
	const handleFileListAreaDragOver = useCallback(
		(e: React.DragEvent) => {
			// 检查拖拽目标是否为Tree元素
			const target = e.target as Element
			if (isTreeElement(target)) {
				// 如果在Tree元素上，清理根目录悬浮状态
				setIsDragOverFileListArea(false)
				return
			}

			// 检查是否为内部文件移动
			const hasJsonData = e.dataTransfer.types.includes("application/json")
			// 检查是否有外部文件
			const hasFiles = e.dataTransfer.types.includes("Files")

			// 内部文件移动
			if (hasJsonData && allowEdit && handleFileDragOver) {
				e.preventDefault()
				handleFileDragOver(e, null) // null表示根目录

				// 只有在可以移动到根目录时才显示拖拽样式
				if (canMoveToRoot?.()) {
					setIsDragOverFileListArea(true)
				}
			}
			// 外部文件拖拽
			else if (!hasJsonData && hasFiles && allowExternalDrop && handleFileDragOver) {
				e.preventDefault()
				e.dataTransfer.dropEffect = "copy"
				handleFileDragOver(e, null) // null表示根目录
				setIsDragOverFileListArea(true)
			}
			// 旧的Tree拖拽逻辑（保持兼容性）
			else if (draggedNode && allowEdit) {
				e.preventDefault()
				setIsDragOverFileListArea(true)
			}
		},
		[
			draggedNode,
			allowEdit,
			allowExternalDrop,
			isTreeElement,
			handleFileDragOver,
			canMoveToRoot,
		],
	)

	// 处理fileListArea的拖拽离开
	const handleFileListAreaDragLeave = useCallback(
		(e: React.DragEvent) => {
			const target = e.relatedTarget as Element | null

			// 如果离开后进入的是Tree元素，清理根目录悬浮状态
			// 因为进入Tree元素意味着已经离开了根目录区域，进入了其他文件夹
			if (target && isTreeElement(target)) {
				setIsDragOverFileListArea(false)
				return
			}

			// 检查是否真的离开了fileListArea（而不是进入子元素）
			const rect = e.currentTarget.getBoundingClientRect()
			const x = e.clientX
			const y = e.clientY

			// 只有真正离开了整个 fileListArea 才处理
			if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
				setIsDragOverFileListArea(false)

				// 检查拖拽类型
				const hasJsonData = e.dataTransfer.types.includes("application/json")
				const hasFiles = e.dataTransfer.types.includes("Files")
				const isExternalDrag = !hasJsonData && hasFiles && allowExternalDrop
				const isInternalDrag = hasJsonData && allowEdit

				if (handleFileDragLeave) {
					// 内部文件移动：总是处理（根目录需要冒泡清理）
					if (isInternalDrag) {
						handleFileDragLeave(e, null)
					}
					// 外部文件拖拽：总是处理（包括冒泡事件）
					else if (isExternalDrag) {
						handleFileDragLeave(e, null)
					}
				}
			}
		},
		[isTreeElement, allowEdit, allowExternalDrop, handleFileDragLeave],
	)

	// 处理fileListArea的drop事件
	const handleFileListAreaDrop = useCallback(
		async (e: React.DragEvent) => {
			// 检查拖拽目标是否为Tree元素
			const target = e.target as Element
			if (isTreeElement(target)) {
				// 如果拖拽到Tree元素上，不处理，让Tree组件自己处理
				setIsDragOverFileListArea(false)
				return
			}

			e.preventDefault()
			e.stopPropagation() // 阻止事件冒泡

			// 检查是否为内部文件移动
			const hasJsonData = e.dataTransfer.types.includes("application/json")

			// 1. 优先处理内部文件移动
			if (hasJsonData && allowEdit && handleFileDrop) {
				handleFileDrop(e, null) // null表示根目录
			}
			// 2. 处理外部文件上传
			// useDragMove.handleDrop 已经完整处理了外部文件上传（包括混合拖拽）
			else if (!hasJsonData && allowExternalDrop && e.dataTransfer.files.length > 0) {
				if (handleFileDrop) {
					handleFileDrop(e, null) // null表示根目录
				}
			}
			// 3. 旧的Tree拖拽逻辑（保持兼容性）
			else if (draggedNode && allowEdit) {
				const mockDropInfo = {
					dragNode: draggedNode,
					node: null, // 没有目标节点，表示拖拽到根目录
					dropPosition: -1, // -1表示拖拽到根目录
				}

				console.log("Drop to fileListArea (root directory):", mockDropInfo)
				await handleDrop(mockDropInfo)
			}

			setIsDragOverFileListArea(false)
		},
		[draggedNode, allowEdit, allowExternalDrop, handleDrop, handleFileDrop, isTreeElement],
	)

	return {
		// 状态
		isDragOverFileListArea,
		draggedNode,
		// Tree拖拽事件处理器
		handleTreeDragStart,
		handleTreeDragEnd,
		// fileListArea拖拽事件处理器
		handleFileListAreaDragEnter,
		handleFileListAreaDragOver,
		handleFileListAreaDragLeave,
		handleFileListAreaDragEnd,
		handleFileListAreaDrop,
	}
}
