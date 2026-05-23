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

/** True when the node is `.magic` itself or any file/folder stored under a `.magic/` path. */
export function isNodeUnderMagicSystemFolder(item: AttachmentItem): boolean {
	if (isMagicSystemFolder(item)) return true

	const pathCandidates = [item.relative_file_path, item.path]
	for (const pathCandidate of pathCandidates) {
		if (!pathCandidate) continue
		const segments = pathCandidate.replace(/\\/g, "/").split("/").filter(Boolean)
		if (segments.includes(MAGIC_FOLDER_NAME)) return true
	}

	return false
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
 * `.magic` is selected, a selected folder's subtree contains it, or any selected
 * file/folder lives under a `.magic/` path (mobile cascade only stores descendant file ids).
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
				if (isNodeUnderMagicSystemFolder(node)) return true
			} else if (node.is_directory && node.children?.length) {
				if (walk(node.children)) return true
			}
		}
		return false
	}
	return walk(items)
}

function findAttachmentByKey(
	items: AttachmentItem[],
	key: string,
	getItemId: (item: AttachmentItem) => string,
): AttachmentItem | undefined {
	for (const node of items) {
		if (getItemId(node) === key) return node
		if (node.children?.length) {
			const found = findAttachmentByKey(node.children, key, getItemId)
			if (found) return found
		}
	}
	return undefined
}

/**
 * Pick mobile delete-sheet magic warning copy: single when selection is only under `.magic`,
 * multi when `.magic` is mixed with other paths.
 */
export function resolveMagicDeleteWarningVariant(
	attachments: AttachmentItem[],
	selectedKeys: Set<string>,
	getItemId: (item: AttachmentItem) => string,
): "none" | "single" | "multi" {
	if (!hasMagicSystemFolderInDeletionSelection(attachments, selectedKeys, getItemId)) {
		return "none"
	}

	const hasSelectionOutsideMagic = [...selectedKeys].some((key) => {
		const node = findAttachmentByKey(attachments, key, getItemId)
		if (!node) return false
		return !isNodeUnderMagicSystemFolder(node)
	})

	return hasSelectionOutsideMagic ? "multi" : "single"
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
