import type { AttachmentItem } from "../hooks/types"
import {
	getAttachmentDisplayName,
	getAttachmentKey,
	getVisibleAttachmentChildren,
} from "./getAttachmentKey"

/** Collect all descendant file keys under a folder (visible nodes only). */
export function collectDescendantFileKeys(folder: AttachmentItem): string[] {
	const ids: string[] = []

	function walk(nodes: AttachmentItem[]) {
		for (const node of nodes) {
			if (node.is_directory) {
				walk(getVisibleAttachmentChildren(node))
				continue
			}
			const key = getAttachmentKey(node)
			if (key) ids.push(key)
		}
	}

	walk(getVisibleAttachmentChildren(folder))
	return ids
}

/**
 * Collect selectable unit keys in the current view:
 * files use file keys; empty folders use folder key; non-empty folders recurse into children.
 */
export function collectCurrentViewSelectableKeys(nodes: AttachmentItem[]): string[] {
	const ids: string[] = []

	for (const node of nodes) {
		if (!node.is_directory) {
			ids.push(getAttachmentKey(node))
			continue
		}

		const descendantFileKeys = collectDescendantFileKeys(node)
		if (descendantFileKeys.length === 0) {
			ids.push(getAttachmentKey(node))
			continue
		}

		ids.push(...collectCurrentViewSelectableKeys(getVisibleAttachmentChildren(node)))
	}

	return ids
}

/** Whether a node is considered selected for checkbox UI (matches prototype ChatFilesTreeView). */
export function isAttachmentNodeSelected(item: AttachmentItem, selectedIds: Set<string>): boolean {
	const key = getAttachmentKey(item)
	if (!item.is_directory) return selectedIds.has(key)

	const descendantFileKeys = collectDescendantFileKeys(item)
	if (descendantFileKeys.length === 0) return selectedIds.has(key)

	return descendantFileKeys.length > 0 && descendantFileKeys.every((id) => selectedIds.has(id))
}

/** Toggle one file/folder in the cross-folder selection set. */
export function toggleAttachmentSelection(
	item: AttachmentItem,
	selectedIds: Set<string>,
): Set<string> {
	const next = new Set(selectedIds)
	const key = getAttachmentKey(item)

	if (!item.is_directory) {
		if (next.has(key)) next.delete(key)
		else next.add(key)
		return next
	}

	const descendantFileKeys = collectDescendantFileKeys(item)
	if (descendantFileKeys.length === 0) {
		if (next.has(key)) next.delete(key)
		else next.add(key)
		return next
	}

	const allSelected = descendantFileKeys.every((id) => next.has(id))
	if (allSelected) {
		descendantFileKeys.forEach((id) => next.delete(id))
	} else {
		descendantFileKeys.forEach((id) => next.add(id))
	}

	return next
}

/** Toggle all selectable units in the current view without clearing cross-folder selections. */
export function toggleAllInCurrentView(
	currentViewSelectableKeys: string[],
	selectedIds: Set<string>,
): Set<string> {
	if (currentViewSelectableKeys.length === 0) return selectedIds

	const allSelected = currentViewSelectableKeys.every((id) => selectedIds.has(id))
	const next = new Set(selectedIds)

	if (allSelected) {
		currentViewSelectableKeys.forEach((id) => next.delete(id))
	} else {
		currentViewSelectableKeys.forEach((id) => next.add(id))
	}

	return next
}

/** Walk the full tree and collect nodes whose keys appear in selectedIds. */
export function collectAttachmentsBySelectedKeys(
	nodes: AttachmentItem[],
	selectedIds: Set<string>,
): AttachmentItem[] {
	const result: AttachmentItem[] = []

	function walk(level: AttachmentItem[]) {
		for (const node of level) {
			const key = getAttachmentKey(node)
			if (selectedIds.has(key)) result.push(node)
			if (node.is_directory) walk(getVisibleAttachmentChildren(node))
		}
	}

	walk(nodes.filter((item) => !item?.is_hidden))
	return result
}

export interface DeleteConfirmHierarchyItem {
	kind: "file" | "folder"
	id: string
	name: string
	fileExtension?: string
}

export interface DeleteConfirmHierarchyGroup {
	folder: { id: string; name: string } | null
	items: DeleteConfirmHierarchyItem[]
}

function buildDeleteConfirmHierarchyInternal(
	nodes: AttachmentItem[],
	selectedIds: Set<string>,
	parentFolder: { id: string; name: string } | null,
): DeleteConfirmHierarchyGroup[] {
	const directItems: DeleteConfirmHierarchyItem[] = []
	const childGroups: DeleteConfirmHierarchyGroup[] = []

	for (const node of nodes.filter((n) => !n?.is_hidden)) {
		const key = getAttachmentKey(node)

		if (!node.is_directory) {
			if (selectedIds.has(key)) {
				directItems.push({
					kind: "file",
					id: key,
					name: getAttachmentDisplayName(node),
					fileExtension: node.file_extension,
				})
			}
			continue
		}

		const descendantFileKeys = collectDescendantFileKeys(node)
		if (descendantFileKeys.length === 0) {
			if (selectedIds.has(key)) {
				directItems.push({
					kind: "folder",
					id: key,
					name: getAttachmentDisplayName(node),
				})
			}
			continue
		}

		childGroups.push(
			...buildDeleteConfirmHierarchyInternal(
				getVisibleAttachmentChildren(node),
				selectedIds,
				{ id: key, name: getAttachmentDisplayName(node) },
			),
		)
	}

	const result: DeleteConfirmHierarchyGroup[] = []
	if (directItems.length > 0) result.push({ folder: parentFolder, items: directItems })
	result.push(...childGroups)
	return result
}

/** Public API: build hierarchy from project root attachments. */
export function buildDeleteConfirmHierarchyFromAttachments(
	attachments: AttachmentItem[],
	selectedIds: Set<string>,
): DeleteConfirmHierarchyGroup[] {
	return buildDeleteConfirmHierarchyInternal(
		attachments.filter((item) => !item?.is_hidden),
		selectedIds,
		null,
	)
}

export interface DeleteConfirmSummary {
	folderGroups: { folder: { id: string; name: string }; files: DeleteConfirmHierarchyItem[] }[]
	rootFiles: DeleteConfirmHierarchyItem[]
	emptyFolders: DeleteConfirmHierarchyItem[]
	totalCount: number
}

/** Derive sheet list rows and intro count from hierarchy groups. */
export function summarizeDeleteConfirmHierarchy(
	selectedHierarchy: DeleteConfirmHierarchyGroup[],
): DeleteConfirmSummary {
	const folderGroups = selectedHierarchy
		.filter(
			(
				group,
			): group is DeleteConfirmHierarchyGroup & {
				folder: { id: string; name: string }
			} => group.folder !== null,
		)
		.map((group) => ({
			folder: group.folder,
			files: group.items.filter((item) => item.kind === "file"),
		}))
		.filter((group) => group.files.length > 0)

	const rootGroup = selectedHierarchy.find((group) => group.folder === null)
	const rootFiles = rootGroup?.items.filter((item) => item.kind === "file") ?? []
	const emptyFolders = selectedHierarchy.flatMap((group) =>
		group.items.filter((item) => item.kind === "folder"),
	)

	const totalCount =
		folderGroups.reduce((sum, group) => sum + group.files.length, 0) +
		rootFiles.length +
		emptyFolders.length

	return { folderGroups, rootFiles, emptyFolders, totalCount }
}
