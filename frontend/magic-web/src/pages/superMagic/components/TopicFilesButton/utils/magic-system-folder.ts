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
