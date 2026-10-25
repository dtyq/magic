import type { AttachmentItem } from "../hooks/types"

export interface FileFilters {
	documents: boolean
	multimedia: boolean
	code: boolean
}

export type FileFilterCategory = keyof FileFilters

export interface FileFilterResult {
	filteredFiles: AttachmentItem[]
	matchedItemPaths: string[]
	matchedItemCount: number
	resultTooLarge: boolean
}

interface BuildFileFilterResultOptions {
	attachments: AttachmentItem[]
	fileFilters: FileFilters
	searchValue: string
}

interface SearchFilterContext {
	fileFilters: FileFilters
	searchText: string
	// Parent paths for matched items, used for auto-expansion.
	matchedParentPathSet: Set<string>
	matchedItemCount: number
}

const FILE_TYPES: Record<FileFilterCategory, string[]> = {
	documents: ["pdf", "doc", "docx", "docm", "txt", "md", "csv", "xlsx", "xls"],
	multimedia: [
		"jpg",
		"jpeg",
		"png",
		"gif",
		"mp4",
		"mp3",
		"wav",
		"ogg",
		"opus",
		"m4a",
		"aac",
		"flac",
		"avi",
		"mov",
	],
	code: ["js", "ts", "tsx", "jsx", "py", "java", "cpp", "c", "go", "rust", "html", "css"],
}

const SEARCH_RESULT_TOO_LARGE_THRESHOLD = 5000

function areAllFileFiltersEnabled(fileFilters: FileFilters) {
	return fileFilters.documents && fileFilters.multimedia && fileFilters.code
}

export function getFileTypeCategory(extension?: string): FileFilterCategory | null {
	if (!extension) return null
	if (FILE_TYPES.documents.includes(extension)) return "documents"
	if (FILE_TYPES.multimedia.includes(extension)) return "multimedia"
	if (FILE_TYPES.code.includes(extension)) return "code"
	return null
}

function isDirectoryItem(item: AttachmentItem) {
	return Boolean(item.is_directory && "children" in item)
}

function getSearchableName(item: AttachmentItem) {
	if (isDirectoryItem(item)) return item.name || ""
	return item.filename || item.file_name || ""
}

function isFileTypeAllowed(item: AttachmentItem, fileFilters: FileFilters) {
	if (!item.file_extension) return true
	const category = getFileTypeCategory(item.file_extension)
	return !category || fileFilters[category]
}

function addMatchedParentPath(context: SearchFilterContext, parentPath: string[]) {
	// Multiple child hits can share a parent; dedupe before expanding.
	parentPath.forEach((path) => {
		context.matchedParentPathSet.add(path)
	})
}

function buildDefaultFilteredFiles(items: AttachmentItem[], fileFilters: FileFilters) {
	if (areAllFileFiltersEnabled(fileFilters) && !items.some((item) => item.is_hidden)) {
		return items
	}

	const filteredFiles: AttachmentItem[] = []

	items.forEach((item) => {
		if (item.is_hidden) return

		if (isDirectoryItem(item)) {
			// Without search, keep original children refs to preserve UI behavior.
			filteredFiles.push({
				...item,
				children: item.children || [],
			})
			return
		}

		if (isFileTypeAllowed(item, fileFilters)) {
			filteredFiles.push(item)
		}
	})

	return filteredFiles
}

function buildSearchFilteredFiles(
	items: AttachmentItem[],
	parentPath: string[],
	context: SearchFilterContext,
): AttachmentItem[] {
	const filteredFiles: AttachmentItem[] = []

	// Combine search, parent-path collection, and type filtering in one DFS.
	items.forEach((item) => {
		const itemId = item.file_id || ""
		const currentPath = [...parentPath, itemId]
		const isDirectory = isDirectoryItem(item)
		const itemMatches = getSearchableName(item).toLowerCase().includes(context.searchText)

		if (itemMatches) {
			context.matchedItemCount += 1
			addMatchedParentPath(context, parentPath)
		}

		const filteredChildren = isDirectory
			? buildSearchFilteredFiles(item.children || [], currentPath, context)
			: []

		if (item.is_hidden) return

		if (isDirectory) {
			if (itemMatches || filteredChildren.length > 0) {
				filteredFiles.push({
					...item,
					// Keep all children when the directory name matches; otherwise keep matches only.
					children: itemMatches ? item.children || [] : filteredChildren,
				})
			}
			return
		}

		if (!itemMatches || !isFileTypeAllowed(item, context.fileFilters)) return
		filteredFiles.push(item)
	})

	return filteredFiles
}

export function buildFileFilterResult({
	attachments,
	fileFilters,
	searchValue,
}: BuildFileFilterResultOptions): FileFilterResult {
	const searchText = searchValue.trim().toLowerCase()
	if (!searchText) {
		// Non-search mode only applies type and hidden filters.
		return {
			filteredFiles: buildDefaultFilteredFiles(attachments, fileFilters),
			matchedItemPaths: [],
			matchedItemCount: 0,
			resultTooLarge: false,
		}
	}

	const context: SearchFilterContext = {
		fileFilters,
		searchText,
		matchedParentPathSet: new Set<string>(),
		matchedItemCount: 0,
	}
	const filteredFiles = buildSearchFilteredFiles(attachments, [], context)
	const matchedItemPaths = Array.from(context.matchedParentPathSet)

	return {
		filteredFiles,
		matchedItemPaths,
		matchedItemCount: context.matchedItemCount,
		// For large results, record metrics and let the UI layer decide.
		resultTooLarge:
			context.matchedItemCount > SEARCH_RESULT_TOO_LARGE_THRESHOLD ||
			matchedItemPaths.length > SEARCH_RESULT_TOO_LARGE_THRESHOLD,
	}
}
