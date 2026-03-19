import { useCallback, useState, useRef, useMemo } from "react"
import { useTranslation } from "react-i18next"
import FoldIcon from "@/pages/superMagic/assets/svg/file-folder.svg"
import { getFileIconByType } from "@/components/base/MagicFileIcon"
import {
	generateColorFromString,
	getFileColor,
} from "@/components/base/FileTypeIcon/utils/colorGenerator"
import {
	normalizeFiletype,
	getDisplayText,
} from "@/components/base/FileTypeIcon/utils/fileTypeHelpers"
import type { AttachmentItem } from "./types"
import type { TreeNodeData } from "../utils/treeDataConverter"
import { processDroppedItems } from "../utils/file-system"
import { getTargetUploadPath } from "../utils/path-helper"
import magicToast from "@/components/base/MagicToaster/utils"

// 拖拽移动配置选项
interface UseDragMoveOptions {
	/** 是否允许移动文件 */
	allowMove?: boolean
	/** 移动文件完成后的回调 */
	onMoveFiles?: (fileIds: string[], targetFolderId: string | null) => Promise<void>
	/** 是否启用调试模式 */
	debug?: boolean
	/** 是否有文件正在移动中 */
	isMoving?: boolean
	/** 是否允许外部文件拖拽上传 */
	allowExternalDrop?: boolean
	/** 外部文件上传回调 */
	onUploadFiles?: (files: File[], targetPath: string, isFolder: boolean) => Promise<void>
	/** 附件列表（用于路径计算） */
	attachments?: AttachmentItem[]
}

// 拖拽移动状态
interface DragMoveState {
	/** 正在拖拽的文件IDs */
	draggingFileIds: string[]
	/** 正在拖拽的文件对象（用于获取parent_id等信息） */
	draggingItems: AttachmentItem[]
	/** 拖拽目标文件夹ID */
	dropTargetFolderId: string | null
	/** 是否正在拖拽中 */
	isDragging: boolean
	/** 拖拽指示器位置 */
	indicatorPosition: { x: number; y: number } | null
	/** 拖拽操作类型 */
	dragOperation: "move" | "copy" | null
	/** 是否正在拖拽到根目录（包括根目录文件） */
	isDragOverRoot: boolean
	/** 是否为外部文件拖拽 */
	isExternalDrag: boolean
	/** 拖拽提示类型 */
	dragIndicatorType: "move" | "upload" | null
}

interface UseDragMoveReturn {
	/** 拖拽移动状态 */
	dragState: DragMoveState
	/** 开始拖拽 */
	handleDragStart: (
		e: React.DragEvent,
		item: AttachmentItem,
		selectedItems?: AttachmentItem[],
	) => void
	/** 拖拽结束 */
	handleDragEnd: (e: React.DragEvent) => void
	/** 拖拽进入 */
	handleDragEnter: (e: React.DragEvent, targetItem: AttachmentItem | null) => void
	/** 拖拽离开 */
	handleDragLeave: (e: React.DragEvent, targetItem: AttachmentItem | null) => void
	/** 拖拽悬停 */
	handleDragOver: (e: React.DragEvent, targetItem: AttachmentItem | null) => void
	/** 拖拽放置 */
	handleDrop: (e: React.DragEvent, targetItem: AttachmentItem | null) => void
	/** 检查是否为拖拽目标 */
	isDropTarget: (item: AttachmentItem) => boolean
	/** 检查是否正在拖拽该项目 */
	isDraggingItem: (item: AttachmentItem) => boolean
	/** 为CustomTree提供的拖拽事件处理器 */
	handleTreeNodeDragEnter: (e: React.DragEvent, node: TreeNodeData) => void
	handleTreeNodeDragLeave: (e: React.DragEvent, node: TreeNodeData) => void
	handleTreeNodeDragOver: (e: React.DragEvent, node: TreeNodeData) => void
	handleTreeNodeDrop: (e: React.DragEvent, node: TreeNodeData) => void
}

/**
 * 获取拖拽数据
 */
function getDragData(dataTransfer: DataTransfer): { type: string; fileIds: string[] } | null {
	try {
		const data = dataTransfer.getData("application/json")
		if (!data) return null
		return JSON.parse(data)
	} catch (error) {
		console.error("解析拖拽数据失败:", error)
		return null
	}
}

/**
 * 创建自定义拖拽图像 - 只显示文件项本身（对应Figma原型中的1:203168）
 */
function createCustomDragImage(
	e: React.DragEvent,
	draggingFileIds: string[],
	draggingItem: AttachmentItem,
	draggingItems: AttachmentItem[],
	t: any,
) {
	// 创建文件项容器 - 对应 文件项 (1:203168)
	const fileItem = document.createElement("div")

	// 设置基本样式
	fileItem.style.position = "absolute"
	fileItem.style.top = "-9999px"
	fileItem.style.left = "-9999px"
	fileItem.style.zIndex = "-1"
	fileItem.style.pointerEvents = "none"

	// 文件项容器样式 - 按照Figma原型
	fileItem.style.display = "flex"
	fileItem.style.alignItems = "center"
	fileItem.style.gap = "4px"
	fileItem.style.padding = "0px 8px"
	fileItem.style.height = "32px"
	fileItem.style.background = "#ffffff"
	fileItem.style.borderRadius = "8px"
	fileItem.style.boxShadow =
		"0px 0px 1px 0px rgba(0, 0, 0, 0.3), 0px 4px 14px 0px rgba(0, 0, 0, 0.1)"
	fileItem.style.width = "fit-content"
	fileItem.style.maxWidth = "228px"

	// 创建图标容器
	const iconContainer = document.createElement("div")
	iconContainer.style.width = "14px"
	iconContainer.style.height = "14px"
	iconContainer.style.flexShrink = "0"
	iconContainer.style.display = "flex"
	iconContainer.style.alignItems = "center"
	iconContainer.style.justifyContent = "center"

	// 判断是否为文件夹
	const isFolder = draggingItem.is_directory

	// 设置图标
	if (isFolder) {
		// 文件夹图标
		iconContainer.innerHTML = `<img src="${FoldIcon}" alt="folder" width="14" height="14" style="width: 14px; height: 14px;" />`
	} else {
		// 根据文件扩展名获取对应的文件图标
		const fileIconSrc = getFileIconByType(draggingItem.file_extension)

		// 如果 getFileIconByType 返回空字符串（不支持的文件类型），创建一个 FileTypeIcon 样式的 SVG
		if (!fileIconSrc) {
			// 使用 FileTypeIcon 的工具函数来保持一致性
			const normalizedType = normalizeFiletype(draggingItem.file_extension)
			const displayText = getDisplayText(normalizedType)
			const fileColor = getFileColor(normalizedType)
			const generatedColor = fileColor || generateColorFromString(normalizedType || "")

			// 根据内容长度计算字体大小（基于 viewBox 24，但需要适配更小的显示尺寸）
			const VIEWBOX_SIZE = 24
			let baseTextSize: number
			if (!displayText) {
				baseTextSize = VIEWBOX_SIZE * 0.3
			} else if (displayText.length <= 2) {
				baseTextSize = VIEWBOX_SIZE * 0.33
			} else if (displayText.length === 3) {
				baseTextSize = VIEWBOX_SIZE * 0.28 // 稍微减小以适配 14px 显示
			} else if (displayText.length === 4) {
				baseTextSize = VIEWBOX_SIZE * 0.2 // 稍微减小以适配 14px 显示
			} else {
				baseTextSize = VIEWBOX_SIZE * 0.16 // 稍微减小以适配 14px 显示
			}

			// 创建 FileTypeIcon 样式的 SVG
			iconContainer.innerHTML = `
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
					<g clipPath="url(#clip0_drag)">
						<path fillRule="evenodd" clipRule="evenodd"
							d="M15.763 0L23 7.237V22C23 22.5304 22.7893 23.0391 22.4142 23.4142C22.0391 23.7893 21.5304 24 21 24H3C2.46957 24 1.96086 23.7893 1.58579 23.4142C1.21071 23.0391 1 22.5304 1 22V2C1 1.46957 1.21071 0.960859 1.58579 0.585786C1.96086 0.210714 2.46957 0 3 0L15.763 0Z"
							fill="${generatedColor}"/>
						<path fillRule="evenodd" clipRule="evenodd"
							d="M17.763 7.237C17.2326 7.237 16.7239 7.02629 16.3488 6.65121C15.9737 6.27614 15.763 5.76743 15.763 5.237V0L23 7.237H17.763Z"
							fill="white" fillOpacity="0.401"/>
						<text fill="#fff" fontSize="${baseTextSize}" fontWeight="bold" textAnchor="middle" x="50%" y="75%">${displayText}</text>
					</g>
					<defs><clipPath id="clip0_drag"><rect width="24" height="24" fill="white"/></clipPath></defs>
				</svg>
			`
		} else {
			iconContainer.innerHTML = `<img src="${fileIconSrc}" alt="file" width="14" height="14" style="width: 14px; height: 14px;" />`
		}
	}

	// 创建文件名文本
	const textElement = document.createElement("span")
	textElement.style.flex = "1"
	textElement.style.minWidth = "0"
	textElement.style.overflow = "hidden"
	textElement.style.textOverflow = "ellipsis"
	textElement.style.whiteSpace = "nowrap"
	textElement.style.fontFamily = '"PingFang SC", -apple-system, BlinkMacSystemFont, sans-serif'
	textElement.style.fontWeight = "400"
	textElement.style.fontSize = "12px"
	textElement.style.lineHeight = "1.3333"
	textElement.style.color = "rgba(28, 29, 35, 0.8)"

	// 设置文本内容
	if (draggingFileIds.length > 1) {
		// 多选情况：区分文件和文件夹
		const fileCount = draggingItems.filter((item) => !item.is_directory).length
		const folderCount = draggingItems.filter((item) => item.is_directory).length

		if (fileCount > 0 && folderCount > 0) {
			// 混合：显示文件和文件夹数量
			const filesText = t("topicFiles.dragMove.dragMultipleFiles", { count: fileCount })
			const foldersText = t("topicFiles.dragMove.dragMultipleFolders", { count: folderCount })
			textElement.textContent = `${filesText}，${foldersText}`
		} else if (folderCount > 0) {
			// 全是文件夹
			if (folderCount === 1) {
				textElement.textContent = t("topicFiles.dragMove.dragOneFolder")
			} else {
				textElement.textContent = t("topicFiles.dragMove.dragMultipleFolders", {
					count: folderCount,
				})
			}
		} else {
			// 全是文件
			if (fileCount === 1) {
				textElement.textContent = t("topicFiles.dragMove.dragOneFile")
			} else {
				textElement.textContent = t("topicFiles.dragMove.dragMultipleFiles", {
					count: fileCount,
				})
			}
		}
	} else {
		// 单选情况：显示文件名
		const fileName = draggingItem?.file_name || t("topicFiles.dragMove.defaultFileName")
		textElement.textContent = fileName
	}

	// 组装文件项
	fileItem.appendChild(iconContainer)
	fileItem.appendChild(textElement)

	// 添加到页面
	document.body.appendChild(fileItem)

	// 同步设置拖拽图像
	try {
		e.dataTransfer.setDragImage(fileItem, 10, 16)
	} catch (error) {
		console.warn("设置自定义拖拽图像失败:", error)
	}

	// 延迟清理
	setTimeout(() => {
		if (document.body.contains(fileItem)) {
			document.body.removeChild(fileItem)
		}
	}, 200)
}

/**
 * 设置拖拽数据
 */
function setDragData(dataTransfer: DataTransfer, fileIds: string[]) {
	const data = {
		type: "file-move",
		fileIds,
	}
	dataTransfer.setData("application/json", JSON.stringify(data))
	dataTransfer.effectAllowed = "move"
}

/**
 * 检查文件/文件夹是否在根目录
 */
export function isInRootDirectory(item: AttachmentItem): boolean {
	const path = item.relative_file_path
	if (!path || !path.startsWith("/")) return false

	// 移除开头的 /
	const pathWithoutPrefix = path.slice(1)

	if (item.is_directory) {
		// 文件夹：应该以 / 结尾，且中间没有其他 /
		return pathWithoutPrefix.endsWith("/") && !pathWithoutPrefix.slice(0, -1).includes("/")
	} else {
		// 文件：中间不应该有 /
		return !pathWithoutPrefix.includes("/")
	}
}

/**
 * 获取被拖拽文件的唯一父文件夹ID列表
 */
function getUniqueParentFolderIds(draggingItems: AttachmentItem[]): (string | null)[] {
	const parentIds = draggingItems.map((item) => item.parent_id || null)
	return Array.from(new Set(parentIds))
}

/**
 * 检查目标文件夹是否是被拖拽文件夹的子文件夹
 */
function isTargetChildOfDraggingItems(
	targetItem: AttachmentItem,
	draggingItems: AttachmentItem[],
): boolean {
	const targetPath = targetItem.relative_file_path
	if (!targetPath) return false

	// 检查目标是否是任何被拖拽文件夹的子文件夹
	for (const draggingItem of draggingItems) {
		// 只检查文件夹
		if (!draggingItem.is_directory) continue

		const draggingPath = draggingItem.relative_file_path
		if (!draggingPath) continue

		// 如果目标路径以被拖拽文件夹路径开头，则说明目标是子文件夹
		if (targetPath.startsWith(draggingPath)) {
			return true
		}
	}

	return false
}

/**
 * 检查是否可以移动到目标文件夹
 */
export function canMoveToTarget(
	draggingFileIds: string[],
	targetItem: AttachmentItem | null,
	draggingItems: AttachmentItem[],
	currentParentFolderIds: (string | null)[],
	debug = false,
): boolean {
	// 移动到根目录
	if (!targetItem) {
		// 检查被拖拽的文件是否已经在根目录
		for (const item of draggingItems) {
			if (isInRootDirectory(item)) {
				if (debug) console.log("❌ 文件已在根目录，不能移动到根目录:", item.file_name)
				return false
			}
		}
		return true
	}

	// 只能移动到文件夹
	if (!targetItem.is_directory) {
		if (debug) console.log("❌ 目标不是文件夹:", targetItem.file_name)
		return false
	}

	// 不能移动到自己
	if (draggingFileIds.includes(targetItem.file_id || "")) {
		if (debug) console.log("❌ 不能移动到自己:", targetItem.file_name)
		return false
	}

	// 不能移动到当前所在的文件夹
	const targetFolderId = targetItem.file_id || null
	if (currentParentFolderIds.includes(targetFolderId)) {
		if (debug) console.log("❌ 不能移动到当前所在的文件夹:", targetItem.file_name)
		return false
	}

	// 不能移动到自己的子文件夹（防止循环引用）
	if (isTargetChildOfDraggingItems(targetItem, draggingItems)) {
		if (debug) console.log("❌ 不能移动到子文件夹:", targetItem.file_name)
		return false
	}

	return true
}

/**
 * 拖拽移动功能 Hook
 *
 * 支持以下功能：
 * 1. 文件/文件夹拖拽移动
 * 2. 多选文件同时移动
 * 3. 拖拽目标高亮显示
 * 4. 拖拽指示器显示
 * 5. 权限和错误处理
 *
 * @param options 配置选项
 * @returns 拖拽移动状态和事件处理器
 */
export function useDragMove({
	allowMove = true,
	onMoveFiles,
	debug = false,
	isMoving = false,
	allowExternalDrop = false,
	onUploadFiles,
	attachments = [],
}: UseDragMoveOptions): UseDragMoveReturn {
	const { t } = useTranslation("super")

	// 拖拽状态
	const [dragState, setDragState] = useState<DragMoveState>({
		draggingFileIds: [],
		draggingItems: [],
		dropTargetFolderId: null,
		isDragging: false,
		indicatorPosition: null,
		dragOperation: null,
		isDragOverRoot: false,
		isExternalDrag: false,
		dragIndicatorType: null,
	})

	// 拖拽计数器，用于处理dragenter/dragleave事件的嵌套问题
	const dragCounterRef = useRef<Map<string, number>>(new Map())

	// 移动提示元素的引用
	const moveIndicatorRef = useRef<HTMLElement | null>(null)

	// 显示移动提示 - 对应Figma原型中的上层提示 (1:203165)
	const showMoveIndicator = useCallback(
		(actionText: string, targetFolderName: string, x: number, y: number) => {
			const topIndicator = document.createElement("div")

			// 设置基本样式
			topIndicator.style.position = "fixed"
			topIndicator.style.left = `${x - 8}px`
			topIndicator.style.top = `${y - 40}px`
			topIndicator.style.zIndex = "9999"
			topIndicator.style.pointerEvents = "none"
			topIndicator.style.userSelect = "none"

			// 上层容器样式 - 复制自DragIndicator的topIndicator样式
			topIndicator.style.display = "flex"
			topIndicator.style.justifyContent = "center"
			topIndicator.style.alignItems = "center"
			topIndicator.style.gap = "4px"
			topIndicator.style.padding = "4px 6px"
			topIndicator.style.background = "#ffffff"
			topIndicator.style.borderRadius = "8px"
			topIndicator.style.boxShadow =
				"0px 0px 1px 0px rgba(0, 0, 0, 0.3), 0px 4px 14px 0px rgba(0, 0, 0, 0.1)"
			topIndicator.style.width = "fit-content"

			// 操作文本（"移动到" 或 "上传至"）
			const moveToText = document.createElement("span")
			moveToText.style.fontFamily =
				'"PingFang SC", -apple-system, BlinkMacSystemFont, sans-serif'
			moveToText.style.fontWeight = "400"
			moveToText.style.fontSize = "10px"
			moveToText.style.lineHeight = "1.3"
			moveToText.style.color = "rgba(28, 29, 35, 0.8)"
			moveToText.style.whiteSpace = "nowrap"
			moveToText.style.flexShrink = "0"
			moveToText.textContent = actionText

			// 目标文件夹名文本
			const targetNameText = document.createElement("span")
			targetNameText.style.fontFamily =
				'"PingFang SC", -apple-system, BlinkMacSystemFont, sans-serif'
			targetNameText.style.fontWeight = "600"
			targetNameText.style.fontSize = "10px"
			targetNameText.style.lineHeight = "1.3"
			targetNameText.style.color = "rgba(28, 29, 35, 0.8)"
			targetNameText.style.minWidth = "20px"
			targetNameText.style.maxWidth = "250px"
			targetNameText.style.overflow = "hidden"
			targetNameText.style.textOverflow = "ellipsis"
			targetNameText.style.whiteSpace = "nowrap"
			targetNameText.textContent = targetFolderName

			topIndicator.appendChild(moveToText)
			topIndicator.appendChild(targetNameText)

			// 添加到页面
			document.body.appendChild(topIndicator)
			moveIndicatorRef.current = topIndicator

			if (debug) {
				console.log("📋 显示移动提示:", targetFolderName)
			}
		},
		[debug],
	)

	// 更新移动提示内容和位置 - 避免重新创建DOM
	const updateMoveIndicator = useCallback(
		(actionText: string, targetFolderName: string, x: number, y: number) => {
			if (moveIndicatorRef.current) {
				// 更新位置
				moveIndicatorRef.current.style.left = `${x - 8}px`
				moveIndicatorRef.current.style.top = `${y - 40}px`

				// 更新操作文本
				const actionSpan = moveIndicatorRef.current.querySelector("span:first-child")
				if (actionSpan) {
					actionSpan.textContent = actionText
				}

				// 更新文件夹名称
				const targetNameSpan = moveIndicatorRef.current.querySelector("span:last-child")
				if (targetNameSpan) {
					targetNameSpan.textContent = targetFolderName
				}

				if (debug) {
					// console.log("🔄 更新移动提示:", actionText, targetFolderName)
				}
				return true
			}
			return false
		},
		[debug],
	)

	// 隐藏移动提示
	const hideMoveIndicator = useCallback(() => {
		if (moveIndicatorRef.current && document.body.contains(moveIndicatorRef.current)) {
			document.body.removeChild(moveIndicatorRef.current)
			moveIndicatorRef.current = null
			if (debug) {
				console.log("🫥 隐藏移动提示")
			}
		}
	}, [debug])

	// 开始拖拽
	const handleDragStart = useCallback(
		(e: React.DragEvent, item: AttachmentItem, selectedItems?: AttachmentItem[]) => {
			if (!allowMove) {
				e.preventDefault()
				return
			}

			// 检查是否有文件正在移动中
			if (isMoving) {
				e.preventDefault()
				magicToast.warning(
					t("topicFiles.dragMove.filesMoving", "文件正在移动中，请稍后再试"),
				)
				if (debug) {
					console.log("❌ 文件正在移动中，禁止拖拽")
				}
				return
			}

			// 确定要拖拽的文件IDs和对象
			const draggingItems = selectedItems && selectedItems.length > 0 ? selectedItems : [item]

			const draggingFileIds = draggingItems.map((item) => item.file_id || "").filter(Boolean)

			if (draggingFileIds.length === 0) {
				e.preventDefault()
				return
			}

			// 设置拖拽数据
			setDragData(e.dataTransfer, draggingFileIds)

			// 创建自定义拖拽图像 - 使用原生DOM实现
			const primaryItem = draggingItems[0]
			// 注意：由于拖拽图像在dragstart时就固定，这里暂不传入targetFolderName
			// 如需显示"移动到"提示，可在合适时机传入目标文件夹名
			createCustomDragImage(e, draggingFileIds, primaryItem, draggingItems, t)

			// 隐藏所有 tooltips，避免拖拽时干扰
			document.body.classList.add("dragging-files")

			// 更新状态
			setDragState((prev) => ({
				...prev,
				draggingFileIds,
				draggingItems,
				isDragging: true,
				dragOperation: "move",
				indicatorPosition: { x: e.clientX, y: e.clientY },
			}))

			if (debug) {
				console.log("🚀 开始拖拽移动:", {
					item: item.file_name,
					selectedCount: selectedItems?.length || 1,
					fileIds: draggingFileIds,
				})
			}
		},
		[allowMove, debug, isMoving, t],
	)

	// 拖拽结束
	const handleDragEnd = useCallback(() => {
		if (debug) {
			console.log("🏁 拖拽结束", {
				remainingCounters: Object.fromEntries(dragCounterRef.current),
			})
		}

		// 强制隐藏移动提示
		hideMoveIndicator()

		// 恢复 tooltips 显示
		document.body.classList.remove("dragging-files")

		// 重置状态
		setDragState({
			draggingFileIds: [],
			draggingItems: [],
			dropTargetFolderId: null,
			isDragging: false,
			indicatorPosition: null,
			dragOperation: null,
			isDragOverRoot: false,
			isExternalDrag: false,
			dragIndicatorType: null,
		})

		// 清空拖拽计数器（强制清理，防止 leave 事件丢失）
		dragCounterRef.current.clear()
	}, [debug, hideMoveIndicator])

	// 拖拽进入目标
	const handleDragEnter = useCallback(
		(e: React.DragEvent, targetItem: AttachmentItem | null) => {
			e.preventDefault()
			e.stopPropagation()

			// 检查是否为内部文件移动
			const hasJsonData = e.dataTransfer.types.includes("application/json")
			// 检查是否有外部文件
			const hasFiles = e.dataTransfer.types.includes("Files")

			// 确定拖拽类型
			const isExternalDrag = !hasJsonData && hasFiles && allowExternalDrop
			const isInternalDrag = hasJsonData && dragState.isDragging

			// 如果两种都不是，直接返回
			if (!isExternalDrag && !isInternalDrag) {
				return
			}

			// 如果拖拽到根目录的文件上，将其视为拖拽到根目录
			let actualTarget = targetItem
			if (targetItem && !targetItem.is_directory && isInRootDirectory(targetItem)) {
				actualTarget = null // 根目录
				if (debug) {
					console.log("🔄 拖拽到根目录文件，转换为根目录:", targetItem.file_name)
				}
			}

			const targetId = actualTarget?.file_id || "" // 根目录时为空字符串

			// 外部文件拖拽：不使用 counter 机制，直接设置状态和显示提示
			if (isExternalDrag) {
				const canDrop = !actualTarget || actualTarget.is_directory
				if (canDrop) {
					// 直接设置状态，不管 counter
					setDragState((prev) => ({
						...prev,
						dropTargetFolderId: targetId,
						isDragOverRoot: actualTarget === null,
						isExternalDrag: true,
						dragIndicatorType: "upload",
					}))

					// 显示上传提示
					const targetFolderName = actualTarget?.file_name || t("根目录")
					const actionText = t("topicFiles.dragMove.uploadTo", "上传至")
					if (!updateMoveIndicator(actionText, targetFolderName, e.clientX, e.clientY)) {
						showMoveIndicator(actionText, targetFolderName, e.clientX, e.clientY)
					}

					if (debug) {
						console.log("📤 外部文件拖拽进入:", actualTarget?.file_name || "根目录")
					}
				}
				return // 外部拖拽直接返回，不进行 counter 操作
			}

			// 内部文件移动：根目录特殊处理
			// 根目录（targetId=""）不使用 counter 机制，因为所有根目录文件共享同一个ID
			const isRootTarget = targetId === ""

			if (isRootTarget) {
				// 根目录：直接设置状态，不使用 counter
				const currentParentFolderIds = getUniqueParentFolderIds(dragState.draggingItems)
				const canMove = canMoveToTarget(
					dragState.draggingFileIds,
					actualTarget,
					dragState.draggingItems,
					currentParentFolderIds,
					debug,
				)

				if (canMove) {
					setDragState((prev) => ({
						...prev,
						dropTargetFolderId: targetId,
						isDragOverRoot: true,
						dragIndicatorType: "move",
					}))

					// 显示移动提示
					const targetFolderName = t("根目录")
					const actionText = t("topicFiles.dragMove.moveTo", "移动到")
					if (!updateMoveIndicator(actionText, targetFolderName, e.clientX, e.clientY)) {
						showMoveIndicator(actionText, targetFolderName, e.clientX, e.clientY)
					}

					if (debug) {
						console.log("📁 内部文件拖拽进入根目录（无counter）")
					}
				}
				return // 根目录直接返回，不进行 counter 操作
			}

			// 非根目录：使用 counter 机制
			const counter = dragCounterRef.current.get(targetId) || 0
			const newCounter = counter + 1
			dragCounterRef.current.set(targetId, newCounter)

			if (debug) {
				console.log("📥 DragEnter (内部-非根目录):", {
					file: actualTarget?.file_name,
					targetId,
					oldCounter: counter,
					newCounter: newCounter,
					eventTarget: e.currentTarget,
					allCounters: Object.fromEntries(dragCounterRef.current),
				})
			}

			// 只在第一次进入时设置目标
			if (counter === 0) {
				const currentParentFolderIds = getUniqueParentFolderIds(dragState.draggingItems)

				const canMove = canMoveToTarget(
					dragState.draggingFileIds,
					actualTarget,
					dragState.draggingItems,
					currentParentFolderIds,
					debug,
				)
				if (canMove) {
					setDragState((prev) => ({
						...prev,
						dropTargetFolderId: targetId,
						isDragOverRoot: false,
						dragIndicatorType: "move",
					}))

					// 显示移动提示
					const targetFolderName = actualTarget?.file_name || ""
					const actionText = t("topicFiles.dragMove.moveTo", "移动到")
					if (!updateMoveIndicator(actionText, targetFolderName, e.clientX, e.clientY)) {
						showMoveIndicator(actionText, targetFolderName, e.clientX, e.clientY)
					}

					if (debug) {
						console.log("📁 内部文件拖拽进入:", actualTarget?.file_name)
					}
				} else {
					// 如果不允许移动到该目标，隐藏移动提示
					hideMoveIndicator()
					if (debug) {
						console.log("❌ 不允许移动到目标:", actualTarget?.file_name)
					}
				}
			}
		},
		[
			allowExternalDrop,
			dragState.isDragging,
			dragState.draggingItems,
			dragState.draggingFileIds,
			debug,
			t,
			updateMoveIndicator,
			showMoveIndicator,
			hideMoveIndicator,
		],
	)

	// 拖拽离开目标
	const handleDragLeave = useCallback(
		(e: React.DragEvent, targetItem: AttachmentItem | null) => {
			e.preventDefault()

			// 检查是否为外部文件拖拽
			const hasJsonData = e.dataTransfer.types.includes("application/json")
			const hasFiles = e.dataTransfer.types.includes("Files")
			const isExternalDrag = !hasJsonData && hasFiles && allowExternalDrop

			// 外部文件拖拽：不使用 counter 机制
			if (isExternalDrag) {
				// 如果是从 fileListArea 调用（targetItem 为 null），清理状态
				if (targetItem === null) {
					setDragState((prev) => ({
						...prev,
						dropTargetFolderId: null,
						isDragOverRoot: false,
						isExternalDrag: false,
						dragIndicatorType: null,
					}))
					hideMoveIndicator()

					if (debug) {
						console.log("📤 DragLeave (外部-清理):", {
							cleanedState: true,
						})
					}
				} else {
					// 从子元素离开，不阻止冒泡，让事件传递到 fileListArea
					if (debug) {
						console.log("📤 DragLeave (外部-冒泡):", {
							file: targetItem.file_name,
							willBubble: true,
						})
					}
				}
				return
			}

			// 如果拖拽到根目录的文件上，将其视为拖拽到根目录
			let actualTarget = targetItem
			if (targetItem && !targetItem.is_directory && isInRootDirectory(targetItem)) {
				actualTarget = null // 根目录
			}

			const targetId = actualTarget?.file_id || "" // 根目录时为空字符串
			const isRootTarget = targetId === ""

			// 内部文件移动 - 根目录：不使用 counter，让 fileListArea 统一处理
			if (isRootTarget) {
				// 如果是从 fileListArea 调用（targetItem 为 null），清理状态
				if (targetItem === null) {
					setDragState((prev) => ({
						...prev,
						dropTargetFolderId: null,
						isDragOverRoot: false,
						dragIndicatorType: null,
					}))
					hideMoveIndicator()

					if (debug) {
						console.log("📤 DragLeave (内部-根目录-清理):", {
							cleanedState: true,
						})
					}
				} else {
					// 从根目录文件离开，不阻止冒泡，让事件传递到 fileListArea
					if (debug) {
						console.log("📤 DragLeave (内部-根目录-冒泡):", {
							file: targetItem.file_name,
							willBubble: true,
						})
					}
				}
				return
			}

			// 内部文件移动 - 非根目录：阻止冒泡并使用 counter 机制
			e.stopPropagation()

			const counter = dragCounterRef.current.get(targetId) || 0
			const newCounter = Math.max(0, counter - 1)
			dragCounterRef.current.set(targetId, newCounter)

			if (debug) {
				console.log("📤 DragLeave (内部-非根目录):", {
					file: actualTarget?.file_name,
					targetId,
					oldCounter: counter,
					newCounter: newCounter,
					eventTarget: e.currentTarget,
					allCounters: Object.fromEntries(dragCounterRef.current),
				})
			}

			// 只在完全离开时清除目标
			if (newCounter === 0) {
				setDragState((prev) => ({
					...prev,
					dropTargetFolderId:
						prev.dropTargetFolderId === targetId ? null : prev.dropTargetFolderId,
					dragIndicatorType:
						prev.dropTargetFolderId === targetId ? null : prev.dragIndicatorType,
				}))

				// 延迟检查是否需要隐藏移动提示，避免快速切换时的闪烁
				setTimeout(() => {
					// 检查是否还有其他目标被激活
					const hasActiveTarget = Array.from(dragCounterRef.current.values()).some(
						(count) => count > 0,
					)
					// 如果没有激活目标，则隐藏indicator
					if (!hasActiveTarget) {
						hideMoveIndicator()
					}
				}, 10)

				if (debug) {
					console.log("📤 离开拖拽目标 (非根目录):", actualTarget?.file_name)
				}
			}
		},
		[debug, hideMoveIndicator, allowExternalDrop],
	)

	// 拖拽悬停在目标上
	const handleDragOver = useCallback(
		(e: React.DragEvent, targetItem: AttachmentItem | null) => {
			e.preventDefault()
			e.stopPropagation()

			// 检查是否为内部文件移动
			const hasJsonData = e.dataTransfer.types.includes("application/json")
			// 检查是否有外部文件
			const hasFiles = e.dataTransfer.types.includes("Files")

			// 确定拖拽类型
			const isExternalDrag = !hasJsonData && hasFiles && allowExternalDrop
			const isInternalDrag = hasJsonData && dragState.isDragging

			if (!isExternalDrag && !isInternalDrag) {
				return
			}

			// 如果拖拽到根目录的文件上，将其视为拖拽到根目录
			let actualTarget = targetItem
			if (targetItem && !targetItem.is_directory && isInRootDirectory(targetItem)) {
				actualTarget = null // 根目录
			}

			// 外部文件拖拽
			if (isExternalDrag) {
				const canDrop = !actualTarget || actualTarget.is_directory
				if (canDrop) {
					e.dataTransfer.dropEffect = "copy"

					// 更新上传提示位置
					const targetFolderName = actualTarget?.file_name || t("根目录")
					const actionText = t("topicFiles.dragMove.uploadTo", "上传至")
					updateMoveIndicator(actionText, targetFolderName, e.clientX, e.clientY)
				} else {
					e.dataTransfer.dropEffect = "none"
				}
			}
			// 内部文件移动
			else if (isInternalDrag && dragState.dragOperation === "move") {
				// 获取所有被拖拽文件的唯一父文件夹ID列表
				const currentParentFolderIds = getUniqueParentFolderIds(dragState.draggingItems)

				const canMove = canMoveToTarget(
					dragState.draggingFileIds,
					actualTarget,
					dragState.draggingItems,
					currentParentFolderIds,
					debug,
				)
				if (canMove) {
					e.dataTransfer.dropEffect = "move"

					// 更新移动提示位置
					const targetFolderName = actualTarget?.file_name || t("根目录")
					const actionText = t("topicFiles.dragMove.moveTo", "移动到")
					updateMoveIndicator(actionText, targetFolderName, e.clientX, e.clientY)
				} else {
					e.dataTransfer.dropEffect = "none"
				}
			}

			// 更新指示器位置
			setDragState((prev) => ({
				...prev,
				indicatorPosition: { x: e.clientX, y: e.clientY },
			}))
		},
		[
			allowExternalDrop,
			debug,
			dragState.isDragging,
			dragState.dragOperation,
			dragState.draggingFileIds,
			dragState.draggingItems,
			updateMoveIndicator,
			t,
		],
	)

	// 处理外部文件拖拽上传
	const handleExternalFilesDrop = useCallback(
		async (files: FileList, dataTransfer: DataTransfer, targetItem: AttachmentItem | null) => {
			if (!allowExternalDrop || !onUploadFiles) {
				if (debug) {
					console.log("❌ 外部文件上传被禁用或未配置")
				}
				return
			}

			try {
				const fileArray = Array.from(files)

				if (fileArray.length === 0) {
					magicToast.warning(
						t("topicFiles.contextMenu.noFilesSelected", "未选择任何文件"),
					)
					return
				}

				// 计算目标路径
				const targetPath = getTargetUploadPath(targetItem, attachments)

				// 使用新的 processDroppedItems 函数来处理混合拖拽
				const { standaloneFiles, folders } = await processDroppedItems(dataTransfer, debug)

				if (debug) {
					console.log("📤 外部文件上传:", {
						standaloneFilesCount: standaloneFiles.length,
						foldersCount: folders.length,
						targetPath,
						targetName: targetItem?.file_name || "根目录",
					})
				}

				// 创建上传任务数组
				const uploadTasks: Promise<void>[] = []

				// 1. 处理单独的文件
				// 每个单独的文件都会创建独立的上传任务（由 useDragUpload 内部处理）
				if (standaloneFiles.length > 0) {
					if (debug) {
						console.log(`📄 上传 ${standaloneFiles.length} 个单独文件`)
					}
					uploadTasks.push(onUploadFiles(standaloneFiles, targetPath, false))
				}

				// 2. 处理文件夹
				// 每个文件夹都创建独立的上传任务
				for (const folder of folders) {
					if (debug) {
						console.log(
							`📁 上传文件夹: "${folder.name}"，包含 ${folder.files.length} 个文件`,
						)
					}
					uploadTasks.push(onUploadFiles(folder.files, targetPath, true))
				}

				// 等待所有上传任务创建完成
				await Promise.all(uploadTasks)

				if (debug) {
					console.log(
						`✅ 已创建 ${uploadTasks.length} 个上传任务（${standaloneFiles.length} 个单独文件 + ${folders.length} 个文件夹）`,
					)
				}
			} catch (error) {
				console.error("外部文件上传失败:", error)
				magicToast.error(t("topicFiles.contextMenu.uploadError", "文件上传失败"))
			}
		},
		[allowExternalDrop, onUploadFiles, attachments, debug, t],
	)

	// 拖拽放置到目标
	const handleDrop = useCallback(
		async (e: React.DragEvent, targetItem: AttachmentItem | null) => {
			e.preventDefault()
			e.stopPropagation()

			// 隐藏移动提示
			hideMoveIndicator()

			// 1. 优先检查内部文件移动
			const dragData = getDragData(e.dataTransfer)
			if (dragData && dragData.type === "file-move") {
				const { fileIds } = dragData

				// 如果拖拽到根目录的文件上，将其视为拖拽到根目录
				let actualTarget = targetItem
				if (targetItem && !targetItem.is_directory && isInRootDirectory(targetItem)) {
					actualTarget = null // 根目录
					if (debug) {
						console.log("🔄 拖拽到根目录文件，转换为根目录:", targetItem.file_name)
					}
				}

				const targetFolderId = actualTarget?.file_id || null

				// 获取所有被拖拽文件的唯一父文件夹ID列表
				const currentParentFolderIds = getUniqueParentFolderIds(dragState.draggingItems)

				// 检查是否可以移动
				if (
					!canMoveToTarget(
						fileIds,
						actualTarget,
						dragState.draggingItems,
						currentParentFolderIds,
						debug,
					)
				) {
					magicToast.warning(
						t("topicFiles.dragMove.cannotMoveToTarget", "无法移动到此位置"),
					)
					return
				}

				try {
					if (debug) {
						console.log("📦 执行文件移动:", {
							fileIds,
							targetFolder: actualTarget?.file_name || "根目录",
							targetFolderId,
						})
					}

					await onMoveFiles?.(fileIds, targetFolderId)
				} catch (error) {
					console.error("文件移动失败:", error)
					magicToast.error(t("topicFiles.dragMove.moveFailed", "文件移动失败"))
				} finally {
					// 清空拖拽计数器
					dragCounterRef.current.clear()
				}
				return
			}

			// 2. 检查外部文件拖拽上传
			if (allowExternalDrop && e.dataTransfer.files.length > 0) {
				// 如果拖拽到根目录的文件上，将其视为拖拽到根目录
				let actualTarget = targetItem
				if (targetItem && !targetItem.is_directory && isInRootDirectory(targetItem)) {
					actualTarget = null // 根目录
					if (debug) {
						console.log("🔄 拖拽到根目录文件，转换为根目录:", targetItem.file_name)
					}
				}

				await handleExternalFilesDrop(e.dataTransfer.files, e.dataTransfer, actualTarget)

				// 清理状态
				setDragState((prev) => ({
					...prev,
					dropTargetFolderId: null,
					isDragOverRoot: false,
					isExternalDrag: false,
					dragIndicatorType: null,
				}))

				// 清空拖拽计数器
				dragCounterRef.current.clear()
			}
		},
		[
			onMoveFiles,
			allowExternalDrop,
			handleExternalFilesDrop,
			hideMoveIndicator,
			t,
			debug,
			dragState.draggingItems,
		],
	)

	// 检查是否为拖拽目标
	const isDropTarget = useCallback(
		(item: AttachmentItem) => {
			return dragState.dropTargetFolderId === (item.file_id || "")
		},
		[dragState.dropTargetFolderId],
	)

	// 检查是否正在拖拽该项目
	const isDraggingItem = useCallback(
		(item: AttachmentItem) => {
			return dragState.draggingFileIds.includes(item.file_id || "")
		},
		[dragState.draggingFileIds],
	)

	// 为CustomTree提供的拖拽事件处理器
	const handleTreeNodeDragEnter = useCallback(
		(e: React.DragEvent, node: TreeNodeData) => {
			if (allowMove && node.item) {
				handleDragEnter(e, node.item)
			}
		},
		[allowMove, handleDragEnter],
	)

	const handleTreeNodeDragLeave = useCallback(
		(e: React.DragEvent, node: TreeNodeData) => {
			if (allowMove && node.item) {
				handleDragLeave(e, node.item)
			}
		},
		[allowMove, handleDragLeave],
	)

	const handleTreeNodeDragOver = useCallback(
		(e: React.DragEvent, node: TreeNodeData) => {
			if (allowMove && node.item) {
				handleDragOver(e, node.item)
			}
		},
		[allowMove, handleDragOver],
	)

	const handleTreeNodeDrop = useCallback(
		(e: React.DragEvent, node: TreeNodeData) => {
			if (allowMove && node.item) {
				handleDrop(e, node.item)
			}
		},
		[allowMove, handleDrop],
	)

	return useMemo(
		() => ({
			dragState,
			handleDragStart,
			handleDragEnd,
			handleDragEnter,
			handleDragLeave,
			handleDragOver,
			handleDrop,
			isDropTarget,
			isDraggingItem,
			// 为CustomTree提供的拖拽事件处理器
			handleTreeNodeDragEnter,
			handleTreeNodeDragLeave,
			handleTreeNodeDragOver,
			handleTreeNodeDrop,
		}),
		[
			dragState,
			handleDragStart,
			handleDragEnd,
			handleDragEnter,
			handleDragLeave,
			handleDragOver,
			handleDrop,
			isDropTarget,
			isDraggingItem,
			handleTreeNodeDragEnter,
			handleTreeNodeDragLeave,
			handleTreeNodeDragOver,
			handleTreeNodeDrop,
		],
	)
}
