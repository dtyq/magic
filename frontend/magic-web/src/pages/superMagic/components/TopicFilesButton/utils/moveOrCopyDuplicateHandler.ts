import type { AttachmentItem } from "../hooks/types"
import { collectExistingFilePaths, getTargetFolderChildren } from "./folderConflictHandler"
import type { AttachmentIndex } from "./attachmentIndex"

function getItemName(item: AttachmentItem): string {
	return item.file_name || item.filename || item.name || ""
}

function findItemById(id: string, attachments: AttachmentItem[]): AttachmentItem | null {
	for (const item of attachments) {
		if (item.file_id === id) return item
		if (item.children) {
			const found = findItemById(id, item.children)
			if (found) return found
		}
	}
	return null
}

function resolveItemById(
	id: string,
	attachments: AttachmentItem[],
	attachmentIndex?: AttachmentIndex,
): AttachmentItem | null {
	if (attachmentIndex) {
		return attachmentIndex.getItemById(id) || null
	}
	return findItemById(id, attachments)
}

function resolveTargetParentRef(targetPath: AttachmentItem[]): string | undefined {
	const targetFolder = targetPath[targetPath.length - 1]
	return (
		targetFolder?.file_id || targetPath.map(getItemName).filter(Boolean).join("/") || undefined
	)
}

function getExistingPathsInTarget(
	targetPath: AttachmentItem[],
	targetAttachments: AttachmentItem[],
	targetIndex?: AttachmentIndex,
): Map<string, string> {
	const targetRef = resolveTargetParentRef(targetPath)
	return collectExistingFilePaths(
		getTargetFolderChildren(targetRef, targetAttachments, targetIndex),
	)
}

function detectSingleFileSiblingConflict(
	item: AttachmentItem,
	targetPath: AttachmentItem[],
	targetAttachments: AttachmentItem[],
	targetIndex?: AttachmentIndex,
): Map<string, { fileName: string; relativePath: string }> {
	const fileName = getItemName(item)
	if (!fileName) return new Map()

	const targetRef = resolveTargetParentRef(targetPath)
	const siblings = getTargetFolderChildren(targetRef, targetAttachments, targetIndex)
	const hasConflict = siblings.some(
		(sibling) =>
			!sibling.is_directory &&
			String(sibling.file_id || "") !== String(item.file_id || "") &&
			getItemName(sibling) === fileName,
	)

	if (!hasConflict) return new Map()

	return new Map([
		[
			String(item.file_id || ""),
			{
				fileName,
				relativePath: fileName,
			},
		],
	])
}

function collectFilesFromFolder(
	folder: AttachmentItem,
	basePath: string,
	result: Map<string, { item: AttachmentItem; relativePath: string }>,
) {
	if (!folder.children?.length) return

	for (const child of folder.children) {
		const childName = getItemName(child)
		if (!childName) continue

		const childRelativePath = basePath ? `${basePath}/${childName}` : childName
		if (child.is_directory) {
			collectFilesFromFolder(child, childRelativePath, result)
			continue
		}

		result.set(String(child.file_id || ""), {
			item: child,
			relativePath: childRelativePath,
		})
	}
}

function extractSourceFilesWithPaths(
	fileIds: string[],
	sourceAttachments: AttachmentItem[],
	sourceIndex?: AttachmentIndex,
): Map<string, { item: AttachmentItem; relativePath: string }> {
	const result = new Map<string, { item: AttachmentItem; relativePath: string }>()

	for (const id of fileIds) {
		const item = resolveItemById(id, sourceAttachments, sourceIndex)
		if (!item) continue

		const itemName = getItemName(item)
		if (item.is_directory) {
			collectFilesFromFolder(item, itemName, result)
			continue
		}

		result.set(String(item.file_id || ""), {
			item,
			relativePath: itemName,
		})
	}

	return result
}

function buildTargetPathString(targetPath: AttachmentItem[]): string {
	return targetPath.map(getItemName).filter(Boolean).join("/")
}

export interface DetectDuplicateFilesForMoveOptions {
	sourceIndex?: AttachmentIndex
	targetIndex?: AttachmentIndex
}

/**
 * 检测要移动/复制的文件在目标路径下是否存在同名文件
 */
export function detectDuplicateFilesForMove(
	fileIds: string[],
	sourceAttachments: AttachmentItem[],
	targetAttachments: AttachmentItem[],
	targetPath: AttachmentItem[],
	options: DetectDuplicateFilesForMoveOptions = {},
): Map<string, { fileName: string; relativePath: string }> {
	const { sourceIndex, targetIndex } = options

	if (fileIds.length === 1) {
		const item = resolveItemById(fileIds[0], sourceAttachments, sourceIndex)
		if (item && !item.is_directory) {
			return detectSingleFileSiblingConflict(item, targetPath, targetAttachments, targetIndex)
		}
	}

	const sourceFilesMap = extractSourceFilesWithPaths(fileIds, sourceAttachments, sourceIndex)
	const existingPaths = getExistingPathsInTarget(targetPath, targetAttachments, targetIndex)
	const duplicates = new Map<string, { fileName: string; relativePath: string }>()

	sourceFilesMap.forEach(({ item, relativePath }, fileId) => {
		if (!existingPaths.has(relativePath)) return
		duplicates.set(fileId, {
			fileName: getItemName(item),
			relativePath,
		})
	})

	return duplicates
}

/** @deprecated Use detectDuplicateFilesForMove with targetPath AttachmentItem[] */
export function detectDuplicateFilesForMoveLegacyPath(
	fileIds: string[],
	sourceAttachments: AttachmentItem[],
	targetAttachments: AttachmentItem[],
	targetPathString: string,
	options: DetectDuplicateFilesForMoveOptions = {},
): Map<string, { fileName: string; relativePath: string }> {
	const targetPath = targetPathString
		.split("/")
		.filter(Boolean)
		.map((segment) => ({ file_name: segment, name: segment }) as AttachmentItem)
	return detectDuplicateFilesForMove(
		fileIds,
		sourceAttachments,
		targetAttachments,
		targetPath,
		options,
	)
}

export { buildTargetPathString }
