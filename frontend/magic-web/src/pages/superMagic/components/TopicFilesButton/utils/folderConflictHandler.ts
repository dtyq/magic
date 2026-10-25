import type { AttachmentItem } from "../hooks/types"
import {
	buildAttachmentIndex,
	getAttachmentByLookupKey,
	getAttachmentIndexEntry,
	type AttachmentIndex,
} from "./attachmentIndex"

export interface FolderConflictInfo {
	folderId?: string
	folderName: string
	relativePath: string
	targetItem?: AttachmentItem
	canMerge: boolean
}

function getItemName(item: AttachmentItem): string {
	return item.file_name || item.filename || item.name || ""
}

function getFileRelativePath(file: File): string {
	return (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name
}

function defineWebkitRelativePath(file: File, relativePath: string): File {
	try {
		Object.defineProperty(file, "webkitRelativePath", {
			value: relativePath,
			writable: false,
			enumerable: true,
			configurable: true,
		})
	} catch {
		// Some File implementations expose webkitRelativePath as non-configurable.
	}

	return file
}

function cloneFileWithRelativePath(file: File, relativePath: string): File {
	const clonedFile = new File([file], file.name, {
		type: file.type,
		lastModified: file.lastModified,
	})

	return defineWebkitRelativePath(clonedFile, relativePath)
}

export function extractTopLevelFolderName(files: File[]): string {
	if (files.length === 0) return ""

	const firstRelativePath = getFileRelativePath(files[0])
	const firstFolderName = firstRelativePath.split("/").filter(Boolean)[0] || ""
	if (!firstFolderName || firstFolderName === files[0].name) return ""

	return files.every((file) => {
		const relativePath = getFileRelativePath(file)
		return relativePath === firstFolderName || relativePath.startsWith(`${firstFolderName}/`)
	})
		? firstFolderName
		: ""
}

export function replaceTopLevelFolderNameInFiles(files: File[], nextFolderName: string): File[] {
	const currentFolderName = extractTopLevelFolderName(files)
	if (!currentFolderName || !nextFolderName || currentFolderName === nextFolderName) {
		return files
	}

	return files.map((file) => {
		const relativePath = getFileRelativePath(file)
		const nextRelativePath = relativePath.startsWith(`${currentFolderName}/`)
			? `${nextFolderName}/${relativePath.slice(currentFolderName.length + 1)}`
			: relativePath
		return cloneFileWithRelativePath(file, nextRelativePath)
	})
}

export function stripTopLevelFolderFromFiles(files: File[]): File[] {
	const currentFolderName = extractTopLevelFolderName(files)
	if (!currentFolderName) return files

	return files.map((file) => {
		const relativePath = getFileRelativePath(file)
		const nextRelativePath = relativePath.startsWith(`${currentFolderName}/`)
			? relativePath.slice(currentFolderName.length + 1)
			: file.name
		return cloneFileWithRelativePath(file, nextRelativePath || file.name)
	})
}

export function extractTargetUploadRelativePath(file: File): string {
	// Target-folder uploads already have their root folder removed.
	return getFileRelativePath(file)
}

/**
 * Renames target-upload files while preserving their relative directory paths.
 *
 * Example:
 * Input:  `分类4/新建文件.md` + `{ "分类4/新建文件.md" => "新建文件(1).md" }`
 * Output: `分类4/新建文件(1).md`
 */
export function renameFilesForTargetUpload(files: File[], renameMap: Map<string, string>): File[] {
	return files.map((file) => {
		const relativePath = extractTargetUploadRelativePath(file)
		const nextName = renameMap.get(relativePath)
		if (!nextName || nextName === file.name) return file

		const lastSlashIndex = relativePath.lastIndexOf("/")
		const nextRelativePath =
			lastSlashIndex === -1
				? nextName
				: `${relativePath.slice(0, lastSlashIndex + 1)}${nextName}`
		const renamedFile = new File([file], nextName, {
			type: file.type,
			lastModified: file.lastModified,
		})
		return defineWebkitRelativePath(renamedFile, nextRelativePath)
	})
}

function getResolvedAttachmentIndex(
	attachments: AttachmentItem[],
	attachmentIndex?: AttachmentIndex,
): AttachmentIndex {
	return attachmentIndex ?? buildAttachmentIndex(attachments)
}

function findItemById(
	items: AttachmentItem[],
	id: string,
	attachmentIndex?: AttachmentIndex,
): AttachmentItem | undefined {
	const indexedItem = attachmentIndex ? getAttachmentByLookupKey(attachmentIndex, id) : undefined
	if (indexedItem) return indexedItem

	for (const item of items) {
		if (String(item.file_id || "") === id) return item
		if (item.children?.length) {
			const found = findItemById(item.children, id)
			if (found) return found
		}
	}

	return undefined
}

function findFolderByPath(items: AttachmentItem[], path: string): AttachmentItem | undefined {
	const parts = path
		.replace(/^\/+|\/+$/g, "")
		.split("/")
		.filter(Boolean)
	if (parts.length === 0) return undefined

	let currentItems = items
	let currentFolder: AttachmentItem | undefined
	for (const part of parts) {
		currentFolder = currentItems.find((item) => item.is_directory && getItemName(item) === part)
		if (!currentFolder) return undefined
		currentItems = currentFolder.children || []
	}

	return currentFolder
}

export function isAttachmentIdRef(
	targetRef: string,
	attachments: AttachmentItem[],
	attachmentIndex?: AttachmentIndex,
): boolean {
	if (!targetRef) return false
	const resolvedIndex = getResolvedAttachmentIndex(attachments, attachmentIndex)
	return Boolean(getAttachmentByLookupKey(resolvedIndex, targetRef))
}

export function getTargetFolderChildren(
	targetRef: string | undefined,
	attachments: AttachmentItem[],
	attachmentIndex?: AttachmentIndex,
): AttachmentItem[] {
	if (!targetRef) return attachments

	const resolvedIndex = getResolvedAttachmentIndex(attachments, attachmentIndex)
	const targetEntry = getAttachmentIndexEntry(resolvedIndex, targetRef)
	if (targetEntry?.item.is_directory) {
		return resolvedIndex
			.getChildKeysByKey(targetEntry.key)
			.map((childKey) => resolvedIndex.getItemByKey(childKey))
			.filter((item): item is AttachmentItem => Boolean(item))
	}

	const itemByPath = findFolderByPath(attachments, targetRef)
	if (itemByPath?.is_directory) return itemByPath.children || []

	return []
}

export function findTargetChildByName(
	targetRef: string | undefined,
	attachments: AttachmentItem[],
	name: string,
	attachmentIndex?: AttachmentIndex,
): AttachmentItem | undefined {
	return getTargetFolderChildren(targetRef, attachments, attachmentIndex).find(
		(item) => getItemName(item) === name,
	)
}

export function collectExistingFilePaths(items: AttachmentItem[]): Map<string, string> {
	const paths = new Map<string, string>()

	function visit(children: AttachmentItem[], currentPath = "") {
		children.forEach((item) => {
			const itemName = getItemName(item)
			if (!itemName) return

			const itemPath = currentPath ? `${currentPath}/${itemName}` : itemName
			if (item.is_directory) {
				visit(item.children || [], itemPath)
				return
			}

			paths.set(itemPath, itemName)
		})
	}

	visit(items)
	return paths
}

export function detectDuplicateFilesInTarget(
	files: File[],
	targetRef: string | undefined,
	attachments: AttachmentItem[],
	attachmentIndex?: AttachmentIndex,
): Map<string, File> {
	const existingPaths = collectExistingFilePaths(
		getTargetFolderChildren(targetRef, attachments, attachmentIndex),
	)
	const duplicates = new Map<string, File>()

	files.forEach((file) => {
		const relativePath = extractTargetUploadRelativePath(file)
		if (existingPaths.has(relativePath)) {
			duplicates.set(relativePath, file)
		}
	})

	return duplicates
}

export function generateRenameMapForDuplicatesInTarget(
	duplicateFiles: Map<string, File>,
	targetRef: string | undefined,
	attachments: AttachmentItem[],
	generateUniqueFileName: (originalName: string, existingNames: Set<string>) => string,
	attachmentIndex?: AttachmentIndex,
): Map<string, string> {
	const existingPaths = collectExistingFilePaths(
		getTargetFolderChildren(targetRef, attachments, attachmentIndex),
	)
	const renameMap = new Map<string, string>()
	const pathFileNames = new Map<string, Set<string>>()

	existingPaths.forEach((fileName, relativePath) => {
		const slashIndex = relativePath.lastIndexOf("/")
		const pathPart = slashIndex === -1 ? "" : relativePath.slice(0, slashIndex)
		if (!pathFileNames.has(pathPart)) {
			pathFileNames.set(pathPart, new Set())
		}
		pathFileNames.get(pathPart)!.add(fileName)
	})

	duplicateFiles.forEach((_file, relativePath) => {
		const slashIndex = relativePath.lastIndexOf("/")
		const pathPart = slashIndex === -1 ? "" : relativePath.slice(0, slashIndex)
		const fileName = slashIndex === -1 ? relativePath : relativePath.slice(slashIndex + 1)
		if (!pathFileNames.has(pathPart)) {
			pathFileNames.set(pathPart, new Set())
		}

		const existingNames = pathFileNames.get(pathPart)!
		const nextName = generateUniqueFileName(fileName, existingNames)
		renameMap.set(relativePath, nextName)
		existingNames.add(nextName)
	})

	return renameMap
}

export function generateUniqueFolderName(originalName: string, siblings: AttachmentItem[]): string {
	const existingNames = new Set(siblings.map(getItemName).filter(Boolean))
	if (!existingNames.has(originalName)) return originalName

	let counter = 1
	let candidate = `${originalName}(${counter})`
	while (existingNames.has(candidate)) {
		counter += 1
		candidate = `${originalName}(${counter})`
	}

	return candidate
}

export function detectUploadFolderConflict(
	files: File[],
	targetRef: string | undefined,
	attachments: AttachmentItem[],
	attachmentIndex?: AttachmentIndex,
): FolderConflictInfo | null {
	const folderName = extractTopLevelFolderName(files)
	if (!folderName) return null

	const targetItem = findTargetChildByName(targetRef, attachments, folderName, attachmentIndex)
	if (!targetItem) return null

	return {
		folderName,
		relativePath: folderName,
		targetItem,
		canMerge: Boolean(targetItem.is_directory),
	}
}

function collectSourceItemsById(
	fileIds: string[],
	sourceAttachments: AttachmentItem[],
	sourceAttachmentIndex?: AttachmentIndex,
): AttachmentItem[] {
	const resolvedIndex = getResolvedAttachmentIndex(sourceAttachments, sourceAttachmentIndex)
	return fileIds
		.map((fileId) => getAttachmentByLookupKey(resolvedIndex, fileId))
		.filter((item): item is AttachmentItem => Boolean(item))
}

function buildTargetRefFromPath(targetPath: AttachmentItem[]): string | undefined {
	const targetFolder = targetPath[targetPath.length - 1]
	return (
		targetFolder?.file_id || targetPath.map(getItemName).filter(Boolean).join("/") || undefined
	)
}

export function collectSameParentOperationIds(
	fileIds: string[],
	sourceAttachments: AttachmentItem[],
	targetPath: AttachmentItem[],
	sourceAttachmentIndex?: AttachmentIndex,
): string[] {
	const sourceIndex = getResolvedAttachmentIndex(sourceAttachments, sourceAttachmentIndex)
	const targetParentId = targetPath[targetPath.length - 1]?.file_id || ""

	return fileIds.filter((fileId) => {
		const sourceEntry = getAttachmentIndexEntry(sourceIndex, fileId)
		if (!sourceEntry) return false

		const sourceParentId = sourceEntry.parentItem?.file_id || ""
		return sourceParentId === targetParentId
	})
}

export function detectFolderConflictsForMove(
	fileIds: string[],
	sourceAttachments: AttachmentItem[],
	targetAttachments: AttachmentItem[],
	targetPath: AttachmentItem[],
	indexes: { source?: AttachmentIndex; target?: AttachmentIndex } = {},
): Map<string, FolderConflictInfo> {
	const targetRef = buildTargetRefFromPath(targetPath)
	const conflicts = new Map<string, FolderConflictInfo>()
	const targetIndex = getResolvedAttachmentIndex(targetAttachments, indexes.target)

	collectSourceItemsById(fileIds, sourceAttachments, indexes.source).forEach((item) => {
		if (!item.is_directory || !item.file_id) return

		const folderName = getItemName(item)
		if (!folderName) return

		const targetItem = findTargetChildByName(
			targetRef,
			targetAttachments,
			folderName,
			targetIndex,
		)
		if (!targetItem || targetItem.file_id === item.file_id) return

		conflicts.set(item.file_id, {
			folderId: item.file_id,
			folderName,
			relativePath: folderName,
			targetItem,
			canMerge: Boolean(targetItem.is_directory),
		})
	})

	return conflicts
}
