import { getFileDisplayPath } from "@/pages/superMagic/utils/markdownFileReference"
import type { TFunction } from "i18next"
import magicToast from "@/components/base/MagicToaster/utils"
import { clipboard } from "@/utils/clipboard-helpers"
import type { AttachmentItem } from "../hooks/types"
import { getAttachmentIndexEntry, type AttachmentIndex } from "./attachmentIndex"

function normalizePathCandidate(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined
	const trimmedValue = value.trim()
	return trimmedValue || undefined
}

function buildFolderPathFromIndex(
	item: AttachmentItem,
	treeIndex?: AttachmentIndex,
): string | undefined {
	if (!treeIndex || !item.file_id) return undefined

	const entry = getAttachmentIndexEntry(treeIndex, item.file_id)
	if (!entry) return undefined

	const pathNames = [...treeIndex.getParentItemsById(item.file_id), item]
		.map((pathItem) => pathItem.name || pathItem.file_name || pathItem.display_filename)
		.filter(Boolean)

	if (pathNames.length === 0) return "/"
	return `/${pathNames.join("/")}/`
}

export function getAttachmentFolderPath(
	item: AttachmentItem,
	treeIndex?: AttachmentIndex,
): string | undefined {
	if (!item.is_directory || !("children" in item)) return undefined

	const relativePath = normalizePathCandidate(item.relative_file_path)
	if (relativePath) return relativePath

	const pathFromTree = buildFolderPathFromIndex(item, treeIndex)
	return pathFromTree || (item.name ? `/${item.name}` : undefined)
}

export function getCopyableAttachmentPath(
	item: AttachmentItem,
	treeIndex?: AttachmentIndex,
): string | undefined {
	if (item.file_reference || item.space_type === "user")
		return getFileDisplayPath(item) || undefined
	const relativePath = normalizePathCandidate(item.relative_file_path)
	if (relativePath) return relativePath

	// Older folder payloads may omit relative_file_path, so rebuild it from the tree index.
	if (item.is_directory) {
		const folderPath = buildFolderPathFromIndex(item, treeIndex)
		if (folderPath) return folderPath
	}

	return (
		normalizePathCandidate(item.path) ||
		normalizePathCandidate(item.file_key) ||
		normalizePathCandidate(item.name) ||
		normalizePathCandidate(item.file_name) ||
		normalizePathCandidate(item.display_filename)
	)
}

interface CopyAttachmentPathOptions {
	item: AttachmentItem
	treeIndex?: AttachmentIndex
	t: TFunction
}

export async function copyAttachmentPath({ item, treeIndex, t }: CopyAttachmentPathOptions) {
	const path = getCopyableAttachmentPath(item, treeIndex)
	if (!path) {
		magicToast.error(t("topicFiles.contextMenu.copyPathFailed"))
		return
	}

	try {
		await clipboard.writeText(path)
		magicToast.success(t("topicFiles.contextMenu.copyPathSuccess"))
	} catch {
		magicToast.error(t("topicFiles.contextMenu.copyPathFailed"))
	}
}
