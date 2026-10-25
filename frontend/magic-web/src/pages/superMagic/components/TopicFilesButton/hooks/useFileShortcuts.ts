import { useEffect, useMemo, type MutableRefObject } from "react"
import type { AttachmentItem } from "./types"
import { ProjectStateRepository } from "@/models/config/repositories/SuperProjectStateRepository"
import { useOrganization } from "@/models/user/hooks"
import { findSlidePageItemByName } from "./useLocateFile"
import {
	getAttachmentByLookupKey,
	getParentItemByLookupKey,
	type AttachmentIndex,
} from "../utils/attachmentIndex"

interface UseFileShortcutsOptions {
	containerRef: React.RefObject<HTMLElement>
	activeFileId?: string | null
	useProjectCache?: boolean
	/** 是否启用文件加入对话快捷键。 */
	enabled?: boolean
	hoveredItemRef: MutableRefObject<string | null>
	contextMenuItemId: string | null
	treeIndex: AttachmentIndex
	editingVirtualFileId: string | null
	editingVirtualFolderId: string | null
	editingVirtualDesignProjectId: string | null
	renamingItemId: string | null
	handleAddToCurrentChat: (item: AttachmentItem) => void
	selectedProjectId?: string
	// 多选模式相关
	isSelectMode?: boolean
	selectedItems?: Set<string>
	handleAddMultipleFilesToCurrentChat?: () => void
}

/**
 * 文件快捷键 Hook
 * 处理文件列表相关的键盘快捷键
 */
export function useFileShortcuts({
	enabled = true,
	containerRef,
	activeFileId,
	useProjectCache = true,
	hoveredItemRef,
	contextMenuItemId,
	treeIndex,
	editingVirtualFileId,
	editingVirtualFolderId,
	editingVirtualDesignProjectId,
	renamingItemId,
	handleAddToCurrentChat,
	selectedProjectId,
	isSelectMode = false,
	selectedItems,
	handleAddMultipleFilesToCurrentChat,
}: UseFileShortcutsOptions) {
	const projectStateRepository = useMemo(() => new ProjectStateRepository(), [])
	const { organizationCode } = useOrganization()

	// 监听快捷键：Command+L 或 Ctrl+L 将悬浮的文件添加到当前对话
	useEffect(() => {
		if (!enabled) return

		const handleKeyDown = async (e: KeyboardEvent) => {
			// 检查是否按下 Command+L (Mac) 或 Ctrl+L (Windows/Linux)
			const isShortcutPressed = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "l"

			if (!isShortcutPressed) return
			const container = containerRef.current
			if (
				!container ||
				!container.getClientRects().length ||
				getComputedStyle(container).visibility === "hidden"
			)
				return
			const hoveredTree = document.querySelector("[data-topic-files-shortcuts]:hover")
			if (hoveredTree && hoveredTree !== container) return
			if (
				!hoveredTree &&
				!contextMenuItemId &&
				activeFileId &&
				!treeIndex.getItemById(activeFileId)
			)
				return
			if (
				!useProjectCache &&
				!contextMenuItemId &&
				!hoveredItemRef.current &&
				!activeFileId &&
				!selectedItems?.size
			)
				return

			// 立即阻止浏览器的默认行为（地址栏聚焦）
			e.preventDefault()
			e.stopPropagation()
			e.stopImmediatePropagation()

			// 🎯 优先级 1: 多选模式下的选中文件
			if (isSelectMode && selectedItems && selectedItems.size > 0) {
				console.log(
					"🎯 Batch adding selected files in multi-select mode:",
					selectedItems.size,
				)
				handleAddMultipleFilesToCurrentChat?.()
				return
			}

			const cachedState = useProjectCache
				? await projectStateRepository.getProjectState(
						organizationCode,
						selectedProjectId || "",
					)
				: undefined

			// 优先级 2: 右键菜单打开的文件
			// 优先级 3: 悬浮的文件
			// 优先级 4: 当前激活的标签页
			const hoveredItem = hoveredItemRef.current
			const targetFileId =
				contextMenuItemId ||
				hoveredItem ||
				activeFileId ||
				cachedState?.fileState?.activeTabId

			if (!targetFileId) {
				console.log("⚠️ No target file: no context menu, hovered item or active tab")
				return
			}

			// 记录使用的来源
			if (contextMenuItemId) {
				console.log("📋 Using file from context menu:", contextMenuItemId)
			} else if (hoveredItem) {
				console.log("👆 Using hovered file:", hoveredItem)
			} else {
				console.log("📑 Using active tab file:", cachedState?.fileState?.activeTabId)
			}

			// Find the file.
			const item = getAttachmentByLookupKey(treeIndex, targetFileId)
			if (!item) {
				console.warn("⚠️ File item not found in tree:", targetFileId)
				return
			}

			// 检查是否是 PPT 入口文件
			const isPPTFile = item.display_config?.type === "slide" && item.display_config?.slides

			let targetItem: AttachmentItem | null = null

			if (isPPTFile) {
				console.log("🎬 Detected PPT file, resolving to active page")
				// 获取 PPT 当前激活的页面索引
				const pptActiveIndex =
					cachedState?.fileState?.pptActiveIndexMap?.[targetFileId] ?? 0

				// 查找父节点
				const parentItem = getParentItemByLookupKey(treeIndex, targetFileId)
				if (!parentItem) {
					console.warn("⚠️ Parent item not found for PPT entry file:", targetFileId)
					return
				}

				// 从 display_config.slides 获取页面文件名列表
				const slides = parentItem.display_config?.slides
				if (!slides || !Array.isArray(slides)) {
					console.warn("⚠️ PPT slides array not found, using entry file")
					targetItem = item
				} else {
					// 获取当前激活的页面文件名
					const pageFileName = slides[pptActiveIndex] || slides[0]
					console.log("📄 Target page file:", pageFileName, "at index:", pptActiveIndex)

					// 查找对应的页面文件节点
					const pageItem = findSlidePageItemByName(parentItem, pageFileName)
					if (pageItem) {
						console.log(
							"✅ Found page file item:",
							pageItem.file_id || pageItem.file_name,
						)
						targetItem = pageItem
					} else {
						console.warn("⚠️ Page file not found, fallback to entry file")
						targetItem = item
					}
				}
			} else {
				// Plain file: use the attachment directly.
				targetItem = item
			}

			// 验证并添加文件
			if (targetItem) {
				const targetId = targetItem.file_id || ""
				// 检查是否是虚拟文件或正在重命名的文件
				const isVirtualItem =
					editingVirtualFileId === targetId ||
					editingVirtualFolderId === targetId ||
					editingVirtualDesignProjectId === targetId
				const isRenamingItem = renamingItemId === targetId

				// 只对真实文件执行添加操作
				if (!isVirtualItem && !isRenamingItem) {
					handleAddToCurrentChat(targetItem)
				} else {
					console.log("⚠️ Cannot add virtual or renaming item:", targetId)
				}
			}
		}

		// 使用捕获阶段，确保我们的处理器先于浏览器的默认处理器执行
		document.addEventListener("keydown", handleKeyDown, true)

		return () => {
			document.removeEventListener("keydown", handleKeyDown, true)
		}
	}, [
		containerRef,
		activeFileId,
		useProjectCache,
		enabled,
		hoveredItemRef,
		contextMenuItemId,
		treeIndex,
		handleAddToCurrentChat,
		editingVirtualFileId,
		editingVirtualFolderId,
		editingVirtualDesignProjectId,
		renamingItemId,
		projectStateRepository,
		organizationCode,
		selectedProjectId,
		isSelectMode,
		selectedItems,
		handleAddMultipleFilesToCurrentChat,
	])

	// 返回快捷键提示（用于在 UI 中显示）
	const getShortcutHint = (action: "addToCurrentChat") => {
		const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0
		const modifier = isMac ? "⌘" : "Ctrl"

		switch (action) {
			case "addToCurrentChat":
				return {
					modifiers: [modifier],
					key: "L",
				}
			default:
				return null
		}
	}

	return {
		getShortcutHint,
	}
}
