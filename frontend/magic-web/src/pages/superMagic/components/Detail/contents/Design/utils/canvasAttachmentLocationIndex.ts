import { useMemo } from "react"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"

export interface CanvasAttachmentLocation {
	canvasDesignId: string
	mediaFileId: string
}

export type CanvasAttachmentLocationIndex = ReadonlyMap<string, readonly CanvasAttachmentLocation[]>

interface CanvasDirectory {
	fileId: string
	path: string
}

interface CanvasAttachmentLocationOptions {
	attachments: FileItem[]
	flatAttachments: FileItem[]
	candidateFileIds: readonly string[]
}

interface CanvasLookupData {
	canvasDirectories: CanvasDirectory[]
	filesById: ReadonlyMap<string, FileItem>
}

const EMPTY_LOCATION_INDEX: CanvasAttachmentLocationIndex = new Map()
const flattenedTreeCache = new WeakMap<FileItem[], FileItem[]>()
const mergedFilesCache = new WeakMap<FileItem[], WeakMap<FileItem[], FileItem[]>>()
const canvasLookupDataCache = new WeakMap<FileItem[], CanvasLookupData>()

function normalizePath(path: string | undefined): string {
	return (path || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "")
}

function flattenFileTree(items: FileItem[]): FileItem[] {
	const cached = flattenedTreeCache.get(items)
	if (cached) return cached
	const result: FileItem[] = []
	const visit = (nodes: FileItem[]) => {
		for (const node of nodes) {
			result.push(node)
			if (node.children?.length) visit(node.children)
		}
	}
	visit(items)
	flattenedTreeCache.set(items, result)
	return result
}

function resolveProjectFiles(attachments: FileItem[], flatAttachments: FileItem[]): FileItem[] {
	if (flatAttachments.length === 0) return flattenFileTree(attachments)
	if (attachments.length === 0) return flatAttachments

	const cachedByFlat = mergedFilesCache.get(attachments)
	const cached = cachedByFlat?.get(flatAttachments)
	if (cached) return cached

	// The tree can carry a newly created folder before the flat snapshot catches up, while flat rows
	// carry the latest file metadata. Tree rows provide coverage; flat rows remain authoritative.
	const byFileId = new Map<string, FileItem>()
	for (const item of flattenFileTree(attachments)) {
		if (item.file_id) byFileId.set(String(item.file_id), item)
	}
	for (const item of flatAttachments) {
		if (item.file_id) byFileId.set(String(item.file_id), item)
	}
	const merged = Array.from(byFileId.values())
	if (cachedByFlat) cachedByFlat.set(flatAttachments, merged)
	else mergedFilesCache.set(attachments, new WeakMap([[flatAttachments, merged]]))
	return merged
}

function buildCanvasLookupData(flatAttachments: FileItem[]): CanvasLookupData {
	return {
		canvasDirectories: flatAttachments.flatMap((item) => {
			const path = normalizePath(item.relative_file_path)
			if (!item.file_id || !item.is_directory || item.display_config?.type !== "design") {
				return []
			}
			return [{ fileId: String(item.file_id), path }]
		}),
		filesById: new Map(
			flatAttachments
				.filter((item) => item.file_id && !item.is_directory)
				.map((item) => [String(item.file_id), item] as const),
		),
	}
}

function getCanvasLookupData(flatAttachments: FileItem[]): CanvasLookupData {
	const cached = canvasLookupDataCache.get(flatAttachments)
	if (cached) return cached
	const data = buildCanvasLookupData(flatAttachments)
	canvasLookupDataCache.set(flatAttachments, data)
	return data
}

/** Canvas identity comes from folder metadata; magic.project.js content is intentionally not read here. */
export function resolveCanvasDirectories(flatAttachments: FileItem[]): CanvasDirectory[] {
	return getCanvasLookupData(flatAttachments).canvasDirectories
}

/** Keep only the deepest Canvas ancestor when Canvas folders are nested. */
function resolveCanvasForFilePath(
	filePath: string,
	canvasDirectories: CanvasDirectory[],
): CanvasDirectory | undefined {
	const candidates = canvasDirectories
		.filter((canvas) => canvas.path && filePath.startsWith(`${canvas.path}/`))
		.sort((left, right) => right.path.length - left.path.length)
	if (candidates.length === 0) return undefined
	if (candidates.length > 1 && candidates[0].path.length === candidates[1].path.length)
		return undefined
	return candidates[0]
}

export function buildCanvasAttachmentLocationIndex({
	attachments,
	flatAttachments,
	candidateFileIds,
}: CanvasAttachmentLocationOptions): CanvasAttachmentLocationIndex {
	if (candidateFileIds.length === 0) return EMPTY_LOCATION_INDEX
	const projectFiles = resolveProjectFiles(attachments, flatAttachments)
	if (projectFiles.length === 0) return EMPTY_LOCATION_INDEX
	const { canvasDirectories, filesById } = getCanvasLookupData(projectFiles)
	if (canvasDirectories.length === 0) return EMPTY_LOCATION_INDEX

	const index = new Map<string, CanvasAttachmentLocation[]>()
	for (const fileId of candidateFileIds) {
		const file = filesById.get(fileId)
		const filePath = normalizePath(file?.relative_file_path)
		if (!filePath) continue
		const canvas = resolveCanvasForFilePath(filePath, canvasDirectories)
		if (!canvas) continue
		index.set(fileId, [{ canvasDesignId: canvas.fileId, mediaFileId: fileId }])
	}
	return index
}

export function useCanvasAttachmentLocationIndex(
	options: CanvasAttachmentLocationOptions,
): CanvasAttachmentLocationIndex {
	const { attachments, flatAttachments, candidateFileIds } = options
	return useMemo(
		() =>
			buildCanvasAttachmentLocationIndex({ attachments, flatAttachments, candidateFileIds }),
		[attachments, candidateFileIds, flatAttachments],
	)
}
