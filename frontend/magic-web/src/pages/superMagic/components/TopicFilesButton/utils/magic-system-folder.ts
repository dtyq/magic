import type { AttachmentItem } from "../hooks/types"

/** Keep in sync with MAGIC_ROOT_DIRECTORY_NAME (identity-markdown.ts). */
const MAGIC_FOLDER_NAME = ".magic" as const

function basenameMatchesMagicFolder(item: AttachmentItem): boolean {
	const candidates = [item.name, item.file_name, item.filename, item.display_filename]
	for (const c of candidates) {
		const value = typeof c === "string" ? c.trim() : ""
		if (value === MAGIC_FOLDER_NAME) return true
	}
	return false
}

function pathLeafSegmentIsMagicFolder(path?: string): boolean {
	if (!path) return false
	const normalized = path.replace(/\\/g, "/")
	const segments = normalized.split("/").filter(Boolean)
	const leaf = segments[segments.length - 1]
	return leaf === MAGIC_FOLDER_NAME
}

/** True only for the root `.magic` directory node — not descendants under `.magic/`. */
export function isMagicSystemFolder(item: AttachmentItem): boolean {
	if (!item.is_directory) return false
	if (basenameMatchesMagicFolder(item)) return true
	return (
		pathLeafSegmentIsMagicFolder(item.relative_file_path) ||
		pathLeafSegmentIsMagicFolder(item.path)
	)
}

function subtreeContainsMagicFolder(node: AttachmentItem): boolean {
	if (isMagicSystemFolder(node)) return true
	if (!node.is_directory || !node.children?.length) return false
	for (const child of node.children) {
		if (subtreeContainsMagicFolder(child)) return true
	}
	return false
}

/**
 * True when deleting the current selection implies removing `.magic`:
 * `.magic` is selected or a selected folder's subtree contains it.
 */
export function hasMagicSystemFolderInDeletionSelection(
	items: AttachmentItem[],
	selectedItems: Set<string>,
	getItemId: (item: AttachmentItem) => string,
): boolean {
	function walk(nodes: AttachmentItem[]): boolean {
		for (const node of nodes) {
			const id = getItemId(node)
			if (selectedItems.has(id)) {
				if (subtreeContainsMagicFolder(node)) return true
			} else if (node.is_directory && node.children?.length) {
				if (walk(node.children)) return true
			}
		}
		return false
	}
	return walk(items)
}

interface SingleDeleteConfirmContentKeyParams {
	isFolder: boolean
	isMagicFolder: boolean
}

/**
 * 统一单文件/文件夹删除的正文 key 选择，避免移动端 sheet 与桌面 modal 分叉后漏掉 `.magic` 特殊提示。
 */
export function resolveSingleDeleteConfirmContentKey({
	isFolder,
	isMagicFolder,
}: SingleDeleteConfirmContentKeyParams) {
	if (isMagicFolder) return "topicFiles.contextMenu.deleteMagicFolderContent"
	if (isFolder) return "topicFiles.contextMenu.deleteFolderContent"
	return "topicFiles.contextMenu.deleteFileDescription"
}

interface BatchDeleteConfirmContentKeyParams {
	containsFolders: boolean
	touchesMagicFolder: boolean
}

/**
 * 批量删除优先提示 `.magic` 风险，其次再回退到通用文件夹/文件文案。
 */
export function resolveBatchDeleteConfirmContentKey({
	containsFolders,
	touchesMagicFolder,
}: BatchDeleteConfirmContentKeyParams) {
	if (touchesMagicFolder) return "topicFiles.contextMenu.confirmBatchDeleteWithMagicSystemFolder"
	if (containsFolders) return "topicFiles.contextMenu.confirmBatchDeleteWithFolders"
	return "topicFiles.contextMenu.confirmBatchDelete"
}
