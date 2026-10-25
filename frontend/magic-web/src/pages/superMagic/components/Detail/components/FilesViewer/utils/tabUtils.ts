import type { TabItem, FileItem, TabAction } from "../types"
import { TabActionType } from "../types"
import type { AttachmentItem } from "../../../../TopicFilesButton/hooks/types"
import { getParentIdFromPath } from "../../../../TopicFilesButton/utils/getParentIdFromPath"
import {
	isSlidesTemplateFolder,
	toSlidesTemplatePreviewItem,
} from "../../../../TopicFilesButton/utils/slides-template-folder"
import { isMagicProjectConfigFile } from "@/pages/superMagic/components/MessageList/components/MessageAttachment/utils"

export interface TabRestoreState {
	interacted: boolean
	closedIds: Set<string>
	closeAll: boolean
	keepOnly?: string
}

export function createTabRestoreState(): TabRestoreState {
	return { interacted: false, closedIds: new Set(), closeAll: false }
}

/** 恢复只补齐用户尚未处理的标签；读取期间的关闭、排序和选择优先于旧缓存。 */
export function recordTabRestoreAction(state: TabRestoreState, action: TabAction, tabs: TabItem[]) {
	if (
		[
			TabActionType.SYNC_TABS_DATA,
			TabActionType.SYNC_USER_FILE_REFERENCES,
			TabActionType.RESTORE_USER_FILE_TABS,
			TabActionType.RESTORE_PROJECT_TABS,
		].includes(action.type) ||
		(action.type === TabActionType.UPDATE_TAB && !action.payload?.userInteraction)
	)
		return
	state.interacted = true
	const tabId = action.payload?.tabId
	if (action.type === TabActionType.REMOVE_TAB && tabId) state.closedIds.add(tabId)
	if (action.type === TabActionType.ADD_TAB && action.payload?.tab)
		state.closedIds.delete(action.payload.tab.id)
	if (
		action.type === TabActionType.CLEAR_TABS ||
		action.type === TabActionType.CLOSE_OTHER_TABS
	) {
		state.closeAll = true
		state.keepOnly = action.type === TabActionType.CLOSE_OTHER_TABS ? tabId : undefined
	}
	if (action.type === TabActionType.CLOSE_TABS_TO_RIGHT) {
		const index = tabs.findIndex((tab) => tab.id === tabId)
		if (index >= 0) tabs.slice(index + 1).forEach((tab) => state.closedIds.add(tab.id))
	}
}

export function canRestoreTab(state: TabRestoreState, id: string): boolean {
	return (!state.closeAll || id === state.keepOnly) && !state.closedIds.has(id)
}

/** 缺失项不会占据绝对下标；临时 Tab 被排除后，仍按剩余 ID 的相对顺序恢复。 */
export function restoreTabOrder(tabs: TabItem[], order?: string[]): TabItem[] {
	if (!order) return tabs
	const positions = new Map(order.map((id, index) => [id, index]))
	return [...tabs].sort(
		(left, right) =>
			(positions.get(left.id) ?? order.length) - (positions.get(right.id) ?? order.length),
	)
}

/** 将个人文件插回已保存的位置；用户已重新排序时只追加缺少的标签。 */
export function mergeUserFileTabs(
	tabs: TabItem[],
	userTabs: TabItem[],
	positions?: Record<string, number>,
): TabItem[] {
	const result = [...tabs]
	const ids = new Set(result.map((tab) => tab.id))
	const ordered = positions
		? [...userTabs].sort(
				(a, b) => (positions[a.id] ?? Infinity) - (positions[b.id] ?? Infinity),
			)
		: userTabs
	for (const tab of ordered) {
		if (ids.has(tab.id)) continue
		const order = positions?.[tab.id] ?? result.length
		result.splice(Math.min(order, result.length), 0, tab)
		ids.add(tab.id)
	}
	return result
}

function normalizeTabFileId(fileId: unknown): string {
	if (typeof fileId === "string") return fileId.trim()
	if (typeof fileId === "number" && Number.isFinite(fileId)) return String(fileId)
	return ""
}

function getAttachmentFileName(item: FileItem | AttachmentItem): string {
	return item.display_filename || item.file_name || item.filename || ""
}

/** 附件树刷新时保留 Tab 内存中的模板预览类型和 HTML 导航状态。 */
export function mergeAttachmentFileForTab(tab: TabItem, updatedFile: FileItem): FileItem {
	const displayConfig =
		tab.fileData.display_config?.type === "slide-template"
			? tab.fileData.display_config
			: updatedFile.display_config
	return {
		...updatedFile,
		display_config: displayConfig,
		htmlNavigation: tab.fileData.htmlNavigation,
	}
}

function isSlideTemplatePreviewFolder(item: FileItem | AttachmentItem | undefined): boolean {
	return Boolean(item?.is_directory && item?.display_config?.type === "slide-template")
}

/** Identifies content folders whose index.html must share the folder tab identity. */
function isProjectBundleFolder(item: FileItem | AttachmentItem | undefined): boolean {
	const type = item?.display_config?.type
	return Boolean(item?.is_directory && (type === "audio" || type === "slide"))
}

function asAttachmentItem(item: FileItem | AttachmentItem): AttachmentItem {
	return item as AttachmentItem
}

/** Map template root (or its template.json) to a slide-template preview tab. */
function resolveSlidesTemplateTabFile(
	file: FileItem | AttachmentItem,
	attachments?: FileItem[] | AttachmentItem[],
): FileItem | AttachmentItem | null {
	if (isSlideTemplatePreviewFolder(file)) {
		return toSlidesTemplatePreviewItem(asAttachmentItem(file)) as FileItem | AttachmentItem
	}

	if (isSlidesTemplateFolder(asAttachmentItem(file))) {
		return toSlidesTemplatePreviewItem(asAttachmentItem(file)) as FileItem | AttachmentItem
	}

	const fileName = getAttachmentFileName(file).toLowerCase()
	if (fileName !== "template.json" || file.is_directory) return null

	const parentDirectory = findParentDirectory(attachments, file)
	if (!parentDirectory) return null

	if (
		isSlideTemplatePreviewFolder(parentDirectory) ||
		isSlidesTemplateFolder(asAttachmentItem(parentDirectory))
	) {
		return toSlidesTemplatePreviewItem(asAttachmentItem(parentDirectory)) as
			FileItem | AttachmentItem
	}

	return null
}

/** Builds a temporary bundle root when cached attachments have not loaded yet. */
function createFallbackProjectFolder(
	file: FileItem | AttachmentItem,
): (FileItem | AttachmentItem) | undefined {
	const parentId = normalizeTabFileId(file.parent_id)
	const type = file.display_config?.type
	if (!parentId || (type !== "audio" && type !== "slide")) return undefined

	const relativeFilePath = file.relative_file_path || ""
	const folderPath = relativeFilePath.includes("/")
		? relativeFilePath.split("/").slice(0, -1).join("/")
		: ""
	if (!folderPath) return undefined

	const folderPathParts = folderPath.split("/").filter(Boolean)
	const folderName =
		file.display_config.name ||
		(folderPath ? folderPathParts[folderPathParts.length - 1] : undefined) ||
		getAttachmentFileName(file)

	return {
		...file,
		file_id: parentId,
		file_name: folderName,
		filename: folderName,
		display_filename: folderName,
		file_extension: "",
		relative_file_path: folderPath,
		parent_id: undefined,
		is_directory: true,
		children: undefined,
	}
}

function findParentDirectory(
	items: (FileItem | AttachmentItem)[] | undefined,
	child: FileItem | AttachmentItem,
): FileItem | AttachmentItem | undefined {
	if (!items || !Array.isArray(items)) return undefined

	const childParentId = normalizeTabFileId(child.parent_id)
	const childPath = child.relative_file_path || ""
	const parentPath = childPath.includes("/") ? childPath.split("/").slice(0, -1).join("/") : ""

	for (const item of items) {
		if (item.is_directory) {
			const itemId = normalizeTabFileId(item.file_id)
			const itemPath = item.relative_file_path || ""
			if (
				(childParentId && itemId === childParentId) ||
				(parentPath && itemPath === parentPath)
			) {
				return item
			}
		}

		if (Array.isArray(item.children)) {
			const found = findParentDirectory(item.children, child)
			if (found) return found
		}
	}

	return undefined
}

/** Resolves slide templates and audio/slide bundle entries to one canonical folder file. */
function resolveProjectTabFile(
	file: FileItem | AttachmentItem,
	attachments?: FileItem[] | AttachmentItem[],
): FileItem | AttachmentItem {
	if ("recycleBin" in file && file.recycleBin) return file
	if (file.space_type === "user" || file.file_reference?.space_type === "user") return file
	const templateTabFile = resolveSlidesTemplateTabFile(file, attachments)
	if (templateTabFile) return templateTabFile
	if (isProjectBundleFolder(file)) return file
	if (getAttachmentFileName(file).toLowerCase() !== "index.html") return file

	const parentDirectory = findParentDirectory(attachments, file)
	if (isProjectBundleFolder(parentDirectory)) return parentDirectory
	return createFallbackProjectFolder(file) || file
}

/** Normalizes cached bundle tabs before ID-based deduplication. */
export function normalizeProjectTabItem(
	tab: TabItem,
	attachments?: FileItem[] | AttachmentItem[],
): TabItem {
	const tabFile = resolveProjectTabFile(tab.fileData, attachments)
	const stableFileId = normalizeTabFileId(tabFile.file_id)
	if (!stableFileId) return tab

	const currentTabId = normalizeTabFileId(tab.id)
	const currentFileId = normalizeTabFileId(tab.fileData.file_id)
	const displayConfig = tabFile.display_config || tab.display_config
	const sameIds = stableFileId === currentTabId && stableFileId === currentFileId
	const sameTabShape =
		tab.fileData.is_directory === tabFile.is_directory &&
		tab.fileData.display_config?.type === displayConfig?.type &&
		tab.display_config?.type === displayConfig?.type
	if (sameIds && sameTabShape) return tab

	return {
		...tab,
		id:
			"recycleBin" in tabFile && tabFile.recycleBin
				? `recycle-bin:${tabFile.recycleBin.id}`
				: stableFileId,
		title: getFileTabTitle(tabFile, attachments, displayConfig),
		fileData: {
			...tab.fileData,
			...tabFile,
			file_id: stableFileId,
			display_config: displayConfig,
		} as FileItem,
		filePath: tabFile.relative_file_path || tab.filePath,
		display_config: displayConfig,
	}
}

export function dedupeTabsById(tabs: TabItem[]): TabItem[] {
	const result: TabItem[] = []
	const indexById = new Map<string, number>()

	for (const tab of tabs) {
		const id = normalizeTabFileId(tab.id)
		if (!id) continue

		const existingIndex = indexById.get(id)
		if (existingIndex === undefined) {
			indexById.set(id, result.length)
			result.push({ ...tab, id })
			continue
		}

		const existing = result[existingIndex]
		const shouldUseNext =
			tab.active ||
			(!existing.active &&
				(tab.active_at || tab.create_at || 0) >=
					(existing.active_at || existing.create_at || 0))

		result[existingIndex] = {
			...(shouldUseNext ? tab : existing),
			id,
			active: Boolean(existing.active || tab.active),
		}
	}

	return result
}

/**
 * 递归查找指定路径的目录项
 * @param items - 附件树数组
 * @param targetPath - 目标路径
 * @returns 找到的目录项或 undefined
 */
function findDirectoryByPath(
	items: (FileItem | AttachmentItem)[] | undefined,
	targetPath: string,
): FileItem | AttachmentItem | undefined {
	if (!items || !Array.isArray(items) || !targetPath) {
		return undefined
	}

	for (const item of items) {
		const itemPath = item.relative_file_path || ""
		if (item.is_directory && itemPath === targetPath) {
			return item
		}
		if (item.is_directory && Array.isArray(item.children)) {
			const found = findDirectoryByPath(item.children, targetPath)
			if (found) return found
		}
	}
	return undefined
}

/**
 * 获取文件的 tab title
 * 对于 index.html 文件：优先从文件 display_config.name 获取，其次从父目录 display_config.name 获取，最后使用目录名称
 * 对于其他文件：优先从 display_config.name 获取，否则使用文件名
 * @param file - 文件项
 * @param attachments - 附件树数组（用于查找父目录）
 * @param displayConfig - 可选的元数据（优先使用）
 * @returns tab title
 */
export function getFileTabTitle(
	file: FileItem | AttachmentItem,
	attachments?: FileItem[] | AttachmentItem[],
	displayConfig?: Record<string, unknown>,
): string {
	const fileName = file.display_filename || file.file_name || file.filename || "未命名文件"
	const fileDisplayConfig = displayConfig || file.display_config

	// 检查是否为 index.html
	if (fileName.toLowerCase() === "index.html" && file.relative_file_path) {
		// 优先从 index.html 文件的 display_config.name 获取
		if (
			fileDisplayConfig &&
			typeof fileDisplayConfig.name === "string" &&
			fileDisplayConfig.name.trim()
		) {
			return fileDisplayConfig.name.trim()
		}

		// 其次从父目录的 display_config.name 获取
		const parentPath = file.relative_file_path.split("/").slice(0, -1).join("/")
		const parentDirectory = parentPath
			? findDirectoryByPath(attachments as FileItem[] | undefined, parentPath)
			: undefined
		const parentDisplayConfig = parentDirectory?.display_config
		if (
			parentDisplayConfig &&
			typeof parentDisplayConfig.name === "string" &&
			parentDisplayConfig.name.trim()
		) {
			return parentDisplayConfig.name.trim()
		}

		// 如果文件或目录有 display_config（但没有 name），使用目录名称作为 tab title
		const hasFileDisplayConfig = !!fileDisplayConfig
		const hasParentDisplayConfig = !!parentDisplayConfig
		if (hasFileDisplayConfig || hasParentDisplayConfig) {
			const pathParts = file.relative_file_path.split("/")
			if (pathParts.length > 1) {
				// 使用父目录名称
				const directoryName = pathParts[pathParts.length - 2]
				return directoryName || fileName
			}
		}
	}

	// magic.project.js 始终显示文件名，不用 display_config.name
	if (isMagicProjectConfigFile(fileName)) {
		return fileName
	}

	// 对于其他非 index.html 文件，优先从 display_config.name 获取
	if (
		fileDisplayConfig &&
		typeof fileDisplayConfig.name === "string" &&
		fileDisplayConfig.name.trim()
	) {
		return fileDisplayConfig.name.trim()
	}

	return fileName
}

/**
 * Convert file item to tab item
 * @param file - File item to convert (FileItem or AttachmentItem)
 * @param attachments - Array of attachments for parent ID calculation
 * @param options - Additional options for tab creation
 * @returns TabItem or null if file is invalid
 */
export function convertFileToTabItem(
	file: FileItem | AttachmentItem,
	attachments?: FileItem[] | AttachmentItem[],
	options?: {
		display_config?: Record<string, unknown>
		create_at?: number
		active_at?: number
		active?: boolean
		closeable?: boolean
	},
): TabItem | null {
	if (!file) {
		return null
	}

	const tabFile = resolveProjectTabFile(file, attachments)
	const stableFileId = normalizeTabFileId(tabFile.file_id)
	if (!stableFileId) {
		return null
	}

	const resolvedToContentFolder =
		tabFile !== file &&
		(isProjectBundleFolder(tabFile) || isSlideTemplatePreviewFolder(tabFile))
	const fileDisplayConfig = resolvedToContentFolder
		? tabFile.display_config
		: options?.display_config || tabFile.display_config
	const tabTitle = getFileTabTitle(tabFile, attachments, fileDisplayConfig)

	const parentPath = tabFile.relative_file_path?.split("/").slice(0, -1).join("/") || ""

	const now = Date.now()

	const tabItem: TabItem = {
		id:
			"recycleBin" in tabFile && tabFile.recycleBin
				? `recycle-bin:${tabFile.recycleBin.id}`
				: stableFileId,
		type: "file",
		title: tabTitle,
		fileData: {
			...tabFile,
			file_id: stableFileId,
			parent_id: getParentIdFromPath(attachments as AttachmentItem[] | undefined, parentPath),
			display_config: fileDisplayConfig,
		} as FileItem,
		active: options?.active ?? true,
		closeable: options?.closeable ?? true,
		filePath: tabFile.relative_file_path,
		display_config: fileDisplayConfig,
		// Note: create_at and active_at will be set by reducer if used through dispatchTabs
		// For direct setCurrentTabs calls, these values are preserved
		create_at: options?.create_at ?? now,
		active_at: options?.active_at ?? now,
	}

	return tabItem
}

/**
 * Calculate calvedRelativePath for duplicate names
 * @param filePath - The file path to process
 * @param existingPaths - Array of existing file paths to check against
 * @returns The calculated relative path or undefined if no duplicates
 */
export function calculateCalvedRelativePath(
	filePath: string | undefined,
	existingPaths: string[],
	spaceType?: "user" | "project",
): string | undefined {
	if (!filePath) return undefined

	// Extract filename from path
	const pathParts = filePath.split("/")
	const filename = pathParts[pathParts.length - 1]

	// Find all existing tabs with the same filename
	const duplicateFilenames = existingPaths.filter((path) => {
		if (!path) return false
		const existingFilename = path.split("/").pop()
		return existingFilename === filename
	})

	// If no duplicates found, no need for calvedRelativePath
	if (duplicateFilenames.length === 0) {
		return undefined
	}

	if (spaceType === "user") {
		const parent = pathParts.slice(0, -1).join("/")
		return parent === "~" ? "~/" : parent
	}

	// Calculate minimum required parent directories to make paths unique
	let requiredDepth = 1
	const maxDepth = pathParts.length - 1 // Exclude filename

	while (requiredDepth <= maxDepth) {
		const currentPath = pathParts.slice(-requiredDepth - 1, -1).join("/")

		// Check if this path is unique among duplicates
		const conflictingPaths = duplicateFilenames.filter((path) => {
			const existingParts = path.split("/")
			const existingPath = existingParts.slice(-requiredDepth - 1, -1).join("/")
			return existingPath === currentPath
		})

		if (conflictingPaths.length === 0) {
			return currentPath ? `../${currentPath}` : "./"
		}

		requiredDepth++
	}

	// If still not unique, return the full directory path with prefix
	const fullPath = pathParts.slice(0, -1).join("/")
	return fullPath ? `../${fullPath}` : "./"
}

/**
 * Handle adding new tab to state
 * @param state - Current tabs state
 * @param newTab - New tab being added
 * @returns Updated state with new tab added and filePath set
 */
export function handleDuplicateTabNames(state: TabItem[], newTab: TabItem): TabItem[] {
	// 简化逻辑：相对路径现在在渲染层动态计算，这里只需要添加tab并设置filePath
	const newTabFilePath = newTab.fileData.relative_file_path || newTab.filePath

	return [
		...state.map((tab) => ({
			...tab,
			active: newTab.active === false ? tab.active : false,
			filePath: tab.fileData.relative_file_path || tab.filePath,
		})),
		{
			...newTab,
			filePath: newTabFilePath,
		},
	]
}
