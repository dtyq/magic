import { loadJSZip } from "@/lib/jszip"
import {
	processDroppedItems,
	type DropItem,
} from "@/pages/superMagic/components/TopicFilesButton/utils/file-system"

const ZIP_MIME_TYPE = "application/zip"
const DEFAULT_ARCHIVE_NAME = "skill-package"
const MAC_OS_METADATA_PREFIX = "__MACOSX/"
const MAC_OS_METADATA_FILE_NAME = ".DS_Store"

export const IMPORT_SKILL_DROP_ERROR = {
	EMPTY_FOLDER: "empty-folder",
	MULTIPLE_ITEMS: "multiple-items",
} as const

export type ImportSkillDropErrorCode =
	(typeof IMPORT_SKILL_DROP_ERROR)[keyof typeof IMPORT_SKILL_DROP_ERROR]

export interface DroppedSkillImportFile {
	kind: "file" | "folder"
	file: File
}

export class ImportSkillDropError extends Error {
	code: ImportSkillDropErrorCode

	constructor(code: ImportSkillDropErrorCode) {
		super(code)
		this.name = "ImportSkillDropError"
		this.code = code
	}
}

function ensureZipFileName(name?: string) {
	const trimmedName = name?.trim() || DEFAULT_ARCHIVE_NAME
	return trimmedName.toLowerCase().endsWith(".zip") ? trimmedName : `${trimmedName}.zip`
}

function getFileRelativePath(file: File) {
	return (file as File & { webkitRelativePath?: string }).webkitRelativePath?.trim() || file.name
}

function getPathSegments(path: string) {
	return path.split("/").filter(Boolean)
}

function getArchiveBaseName(fileName: string) {
	const trimmedName = fileName.trim()
	if (!trimmedName) return DEFAULT_ARCHIVE_NAME
	return trimmedName.replace(/\.(zip|skill)$/i, "") || DEFAULT_ARCHIVE_NAME
}

function isArchiveFile(file: File) {
	return /\.(zip|skill)$/i.test(file.name) || file.type === ZIP_MIME_TYPE
}

function shouldIgnoreArchiveEntry(path: string) {
	const trimmed = path.trim()
	if (!trimmed) return true
	if (trimmed.startsWith(MAC_OS_METADATA_PREFIX)) return true

	const segments = getPathSegments(trimmed)
	return segments[segments.length - 1] === MAC_OS_METADATA_FILE_NAME
}

function stripLeadingPathSegments(path: string, depth: number) {
	if (depth <= 0) return path

	const segments = getPathSegments(path)
	if (segments.length <= depth) return ""
	return segments.slice(depth).join("/")
}

function getArchiveRootStripDepth(paths: string[], archiveBaseName: string) {
	let stripDepth = 0
	let currentPaths = paths
	let previousSegment = ""

	while (currentPaths.length > 0) {
		const segmentedPaths = currentPaths.map((path) => getPathSegments(path))
		if (segmentedPaths.some((segments) => segments.length <= 1)) break

		const firstSegments = Array.from(new Set(segmentedPaths.map((segments) => segments[0])))
		if (firstSegments.length !== 1) break

		const [firstSegment] = firstSegments
		const shouldStrip = firstSegment === archiveBaseName || firstSegment === previousSegment
		if (!shouldStrip) break

		stripDepth += 1
		previousSegment = firstSegment
		currentPaths = segmentedPaths.map((segments) => segments.slice(1).join("/"))
	}

	return stripDepth
}

/** Strip root folder segment; zip name uses folder name, entries are inner paths only */
function stripRootFolderPrefix(path: string, rootFolderName: string) {
	const trimmed = path.trim()
	const root = rootFolderName.trim()
	if (!root) return trimmed

	const prefix = `${root}/`
	if (trimmed.startsWith(prefix)) return trimmed.slice(prefix.length)

	const segments = getPathSegments(trimmed)
	const rootSegments = getPathSegments(root)
	if (
		segments.length > rootSegments.length &&
		rootSegments.every((segment, index) => segments[index] === segment)
	) {
		return segments.slice(rootSegments.length).join("/")
	}

	return trimmed
}

function getArchiveEntryPath(file: File, rootFolderName: string) {
	const path = getFileRelativePath(file)
	const innerPath = stripRootFolderPrefix(path, rootFolderName)
	return innerPath || file.name
}

function getSelectedFolderArchiveConfig(files: File[]) {
	const firstSegments = getPathSegments(getFileRelativePath(files[0]))
	const folderName = firstSegments[0] || DEFAULT_ARCHIVE_NAME

	return {
		archiveName: folderName,
		rootFolderName: folderName,
	}
}

async function createSkillArchiveFromFiles(
	files: File[],
	{
		archiveName,
		rootFolderName,
	}: {
		archiveName: string
		rootFolderName: string
	},
): Promise<File> {
	if (files.length === 0) {
		throw new ImportSkillDropError(IMPORT_SKILL_DROP_ERROR.EMPTY_FOLDER)
	}

	const JSZip = await loadJSZip()
	const zip = new JSZip()

	for (const file of files) {
		zip.file(getArchiveEntryPath(file, rootFolderName), file)
	}

	const zipFileName = ensureZipFileName(archiveName)
	const zipBlob = await zip.generateAsync({ type: "blob" })

	return new File([zipBlob], zipFileName, {
		type: ZIP_MIME_TYPE,
		lastModified: Date.now(),
	})
}

export async function createSkillArchiveFromFolder(folder: DropItem): Promise<File> {
	if (folder.files.length === 0) {
		throw new ImportSkillDropError(IMPORT_SKILL_DROP_ERROR.EMPTY_FOLDER)
	}

	return createSkillArchiveFromFiles(folder.files, {
		archiveName: folder.name,
		rootFolderName: folder.name,
	})
}

export async function createSkillArchiveFromSelectedFolderFiles(files: File[]): Promise<File> {
	return createSkillArchiveFromFiles(files, getSelectedFolderArchiveConfig(files))
}

export async function normalizeSkillImportFile(file: File): Promise<File> {
	if (!isArchiveFile(file)) return file

	const JSZip = await loadJSZip()
	let zip: Awaited<ReturnType<typeof JSZip.loadAsync>>

	try {
		zip = await JSZip.loadAsync(file)
	} catch {
		return file
	}

	const archiveEntries = Object.values(zip.files).filter((entry) => !entry.dir)
	const normalizedEntries = archiveEntries.filter(
		(entry) => !shouldIgnoreArchiveEntry(entry.name),
	)
	if (normalizedEntries.length === 0) return file

	const archiveBaseName = getArchiveBaseName(file.name)
	const stripDepth = getArchiveRootStripDepth(
		normalizedEntries.map((entry) => entry.name),
		archiveBaseName,
	)
	const hasIgnoredEntries = normalizedEntries.length !== archiveEntries.length
	const shouldRewrite = hasIgnoredEntries || stripDepth > 0
	if (!shouldRewrite) return file

	const normalizedZip = new JSZip()
	for (const entry of normalizedEntries) {
		const normalizedPath = stripLeadingPathSegments(entry.name, stripDepth)
		if (!normalizedPath) continue

		const content = await entry.async("uint8array")
		normalizedZip.file(normalizedPath, content)
	}

	const normalizedBlob = await normalizedZip.generateAsync({ type: "blob" })
	return new File([normalizedBlob], ensureZipFileName(file.name), {
		type: ZIP_MIME_TYPE,
		lastModified: Date.now(),
	})
}

export async function resolveDroppedSkillImportFile(
	dataTransfer: DataTransfer,
): Promise<DroppedSkillImportFile | null> {
	const { standaloneFiles, folders } = await processDroppedItems(dataTransfer)
	const droppedItemCount = standaloneFiles.length + folders.length

	if (droppedItemCount === 0) {
		return null
	}

	if (droppedItemCount > 1) {
		throw new ImportSkillDropError(IMPORT_SKILL_DROP_ERROR.MULTIPLE_ITEMS)
	}

	if (folders.length === 1) {
		return {
			kind: "folder",
			file: await createSkillArchiveFromFolder(folders[0]),
		}
	}

	const standaloneFile = standaloneFiles[0]
	if (!standaloneFile) return null

	return {
		kind: "file",
		file: standaloneFile,
	}
}
