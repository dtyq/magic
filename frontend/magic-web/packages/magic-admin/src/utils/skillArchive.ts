import JSZip from "jszip"

const ZIP_MIME_TYPE = "application/zip"
const DEFAULT_ARCHIVE_NAME = "skill-package"

export const SKILL_ARCHIVE_ERROR = {
	EMPTY_FOLDER: "empty-folder",
} as const

export type SkillArchiveErrorCode = (typeof SKILL_ARCHIVE_ERROR)[keyof typeof SKILL_ARCHIVE_ERROR]

export class SkillArchiveError extends Error {
	readonly code: SkillArchiveErrorCode

	constructor(code: SkillArchiveErrorCode) {
		super(code)
		this.name = "SkillArchiveError"
		this.code = code
	}
}

type FolderFile = File & {
	webkitRelativePath?: string
}

export interface CreateSkillArchiveOptions {
	/** Optional name for the generated zip file. `.zip` is appended when absent. */
	archiveName?: string
	/** The selected folder name. When omitted, it is inferred from webkitRelativePath. */
	rootFolderName?: string
}

function getRelativePath(file: FolderFile) {
	return file.webkitRelativePath?.trim() || file.name
}

function getPathSegments(path: string) {
	return path.split(/[\\/]/).filter((segment) => segment && segment !== "." && segment !== "..")
}

function getFolderName(files: FolderFile[]) {
	const firstPathSegment = getPathSegments(getRelativePath(files[0]))[0]
	return firstPathSegment || DEFAULT_ARCHIVE_NAME
}

function ensureZipName(name: string) {
	const trimmedName = name.trim() || DEFAULT_ARCHIVE_NAME
	return trimmedName.toLowerCase().endsWith(".zip") ? trimmedName : `${trimmedName}.zip`
}

/**
 * Keep the generated archive compatible with the import parser: SKILL.md and
 * all resources live at the zip root instead of being nested under the local
 * folder name. Unsafe path segments are discarded because browser-provided
 * relative paths are user-controlled input when files are dragged in.
 */
function getArchiveEntryPath(file: FolderFile, rootFolderName: string) {
	const segments = getPathSegments(getRelativePath(file))
	const rootSegments = getPathSegments(rootFolderName)
	const hasRootPrefix =
		segments.length > rootSegments.length &&
		rootSegments.every((segment, index) => segments[index] === segment)
	const entrySegments = hasRootPrefix ? segments.slice(rootSegments.length) : segments

	return entrySegments.join("/") || file.name
}

/**
 * Compress all files selected through an `<input webkitdirectory>` control.
 * The returned File can be uploaded through the normal file_key/parse/import
 * flow used by official Skill import.
 */
export async function createSkillArchiveFromFolderFiles(
	files: Iterable<FolderFile> | ArrayLike<FolderFile>,
	options: CreateSkillArchiveOptions = {},
): Promise<File> {
	const fileList = Array.from(files)
	if (fileList.length === 0) {
		throw new SkillArchiveError(SKILL_ARCHIVE_ERROR.EMPTY_FOLDER)
	}

	const rootFolderName = options.rootFolderName?.trim() || getFolderName(fileList)
	const archiveName = ensureZipName(options.archiveName?.trim() || rootFolderName)
	const zip = new JSZip()

	for (const file of fileList) {
		const entryPath = getArchiveEntryPath(file, rootFolderName)
		if (entryPath) zip.file(entryPath, file)
	}

	const blob = await zip.generateAsync({ type: "blob" })
	return new File([blob], archiveName, {
		type: ZIP_MIME_TYPE,
		lastModified: Date.now(),
	})
}

/** Alias that makes call sites explicit when the input came from a picker. */
export const createSkillArchiveFromSelectedFolderFiles = createSkillArchiveFromFolderFiles
