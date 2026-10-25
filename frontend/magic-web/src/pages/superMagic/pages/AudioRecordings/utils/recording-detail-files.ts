import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import type {
	MagicProjectConfig,
	RecordingSummaryType,
	RecordingDetailFileMap,
	RecordingDetailFileRef,
} from "../types/recording-detail"

const SUMMARY_TYPE_ORDER: RecordingSummaryType[] = [
	"summary",
	"topics",
	"highlights",
	"insights",
	"metrics",
	"mindmap",
	"followup",
	"power_dynamics",
	"intent",
]

const EXCLUDED_DYNAMIC_TYPES = new Set(["audio", "notes", "transcript", "magic_project"])

/** Lists audio extensions accepted by the upload flow and browser player. */
export const RECORDING_AUDIO_EXTENSIONS = [
	"raw",
	"wav",
	"mp3",
	"ogg",
	"webm",
	"m4a",
	"aac",
	"flac",
	"opus",
] as const

/** Returns the most stable display filename available on an attachment item. */
export function getAttachmentFileName(file: AttachmentItem | undefined): string {
	return file?.file_name || file?.filename || file?.display_filename || file?.name || ""
}

/** Checks whether the recording bundle explicitly declares a non-empty file path. */
export function hasConfiguredRecordingFile(
	fileMap: RecordingDetailFileMap | null | undefined,
	type: string,
): boolean {
	const configuredPath = fileMap?.magicProjectConfig?.files?.[type]
	return typeof configuredPath === "string" && configuredPath.trim().length > 0
}

/**
 * Reports whether the right panel will render a tab strip (and therefore an expand entry).
 * A missing tab strip would strand a collapsed transcript column, so callers disable collapsing.
 */
export function hasRecordingDetailTabStrip(
	fileMap: RecordingDetailFileMap | null | undefined,
	showNotesTab = true,
): boolean {
	if (fileMap?.summaryFiles.length) return true
	if (showNotesTab && hasConfiguredRecordingFile(fileMap, "notes")) return true
	return false
}

/** Flattens tree/list attachment data into one deduplicated file list for lookup. */
export function flattenRecordingAttachments(
	tree: AttachmentItem[] = [],
	list: AttachmentItem[] = [],
): AttachmentItem[] {
	const result: AttachmentItem[] = []
	const seen = new Set<string>()

	function visit(item: AttachmentItem) {
		const key = item.file_id || `${item.path || ""}/${getAttachmentFileName(item)}`
		if (!seen.has(key)) {
			seen.add(key)
			result.push(item)
		}
		item.children?.forEach(visit)
	}

	tree.forEach(visit)
	list.forEach(visit)

	return result.filter((item) => !item.is_directory)
}

/** Builds a typed file map from magic.project.js first, falling back to names and extensions. */
export function buildRecordingDetailFileMap(input: {
	tree: AttachmentItem[]
	list: AttachmentItem[]
	magicProjectConfig?: MagicProjectConfig | null
	bundleRootPath?: string
	preferredAudioFileId?: string
}): RecordingDetailFileMap {
	const files = flattenRecordingAttachments(input.tree, input.list)
	const scopedFiles = scopeFilesToBundle(files, input.bundleRootPath)
	const magicProject = scopedFiles.find(isMagicProjectFile) || files.find(isMagicProjectFile)
	const bundleRootPath = input.bundleRootPath ?? resolveIndexHtmlBundleRoot(input, magicProject)
	const indexHtml = findIndexHtmlInBundle(files, resolveIndexHtmlBundleRoot(input, magicProject))
	const configFiles = input.magicProjectConfig?.files ?? {}

	function findByConfiguredName(type: string) {
		const configuredName = configFiles[type]
		if (!configuredName) return undefined
		return findFileByName(scopedFiles, configuredName)
	}

	const preferredAudio = input.preferredAudioFileId
		? files.find((file) => file.file_id === input.preferredAudioFileId && !file.is_directory)
		: undefined
	const audio =
		preferredAudio ??
		findByConfiguredName("audio") ??
		findFileByExtension(scopedFiles, [...RECORDING_AUDIO_EXTENSIONS])
	const transcript =
		findByConfiguredName("transcript") ??
		findByNameHint(scopedFiles, ["transcript", "文字稿", "流式识别"])
	const notes =
		findByConfiguredName("notes") ??
		findByFileType(scopedFiles, "note") ??
		findByNameHint(scopedFiles, ["notes", "笔记"])

	return {
		bundleRootPath,
		audio,
		transcript,
		notes,
		magicProject,
		indexHtml,
		magicProjectConfig: input.magicProjectConfig ?? undefined,
		summaryFiles: resolveSummaryFiles(scopedFiles, configFiles),
	}
}

/** Resolves dynamic summary tabs while keeping the same type/file index relationship as APP/H5 HTML. */
function resolveSummaryFiles(
	files: AttachmentItem[],
	configFiles: Record<string, string>,
): RecordingDetailFileRef[] {
	const result: RecordingDetailFileRef[] = []
	const added = new Set<string>()

	function addType(type: string) {
		if (added.has(type)) return
		const configuredName = configFiles[type]
		if (!configuredName) return
		const file = findFileByName(files, configuredName) ?? buildPendingFile(configuredName)
		result.push({ type, fileName: configuredName, file })
		added.add(type)
	}

	SUMMARY_TYPE_ORDER.forEach(addType)

	Object.keys(configFiles).forEach((type) => {
		if (EXCLUDED_DYNAMIC_TYPES.has(type) || added.has(type)) return
		addType(type)
	})

	return result
}

/** Creates a file-shaped placeholder so configured tabs exist before their files arrive. */
function buildPendingFile(fileName: string): AttachmentItem {
	const normalizedName = fileName.replace(/\\/g, "/")
	const lastSlashIndex = normalizedName.lastIndexOf("/")
	const baseName = lastSlashIndex >= 0 ? normalizedName.slice(lastSlashIndex + 1) : normalizedName
	const extension = baseName.includes(".") ? baseName.split(".").pop() : undefined

	return {
		file_name: baseName,
		filename: baseName,
		file_extension: extension,
		path: normalizedName,
		relative_file_path: normalizedName,
		is_directory: false,
	}
}

/** Finds a file by exact filename or relative path suffix from magic.project.js. */
function findFileByName(files: AttachmentItem[], expectedName: string): AttachmentItem | undefined {
	const normalizedExpected = normalizeFileLookupText(expectedName)
	return files.find((file) => {
		const candidates = [
			getAttachmentFileName(file),
			file.path,
			file.relative_file_path,
			file.file_key,
		].filter(Boolean)
		return candidates.some((candidate) =>
			normalizeFileLookupText(String(candidate)).endsWith(normalizedExpected),
		)
	})
}

/** Finds a likely file by generated filename hints when magic.project.js is absent or incomplete. */
function findByNameHint(files: AttachmentItem[], hints: string[]): AttachmentItem | undefined {
	return files.find((file) => {
		const name = normalizeFileLookupText(getAttachmentFileName(file))
		return hints.some((hint) => name.includes(normalizeFileLookupText(hint)))
	})
}

/** Finds backend-managed recording source files by their semantic type before using filename hints. */
function findByFileType(files: AttachmentItem[], expectedType: string): AttachmentItem | undefined {
	const normalizedExpectedType = expectedType.toLowerCase()
	return files.find((file) =>
		[file.file_type, file.type, file.data_type, file.dataType].some(
			(type) =>
				type !== undefined && String(type).trim().toLowerCase() === normalizedExpectedType,
		),
	)
}

/** Finds a likely audio file by extension for non-summarized preview fallback. */
function findFileByExtension(
	files: AttachmentItem[],
	extensions: string[],
): AttachmentItem | undefined {
	const allowed = new Set(extensions.map((extension) => extension.toLowerCase()))
	return files.find((file) => {
		const extension = (
			file.file_extension ||
			getAttachmentFileName(file).split(".").pop() ||
			""
		)
			.toLowerCase()
			.replace(/^\./, "")
		return allowed.has(extension)
	})
}

function normalizeFileLookupText(value: string): string {
	return decodeURIComponent(value).trim().toLowerCase().replace(/\\/g, "/")
}

/** Narrows attachment lookups to one audio bundle folder while keeping absolute and relative paths comparable. */
function scopeFilesToBundle(files: AttachmentItem[], bundleRootPath?: string): AttachmentItem[] {
	if (!bundleRootPath) return files

	const normalizedRoot = trimSlashes(normalizeFileLookupText(bundleRootPath))
	if (!normalizedRoot) return files

	const scopedFiles = files.filter((file) =>
		getFileLookupCandidates(file).some((candidate) => {
			const normalizedCandidate = trimSlashes(normalizeFileLookupText(candidate))
			return (
				normalizedCandidate === normalizedRoot ||
				normalizedCandidate.startsWith(`${normalizedRoot}/`)
			)
		}),
	)

	return scopedFiles.length > 0 ? scopedFiles : files
}

function getFileLookupCandidates(file: AttachmentItem): string[] {
	return [getAttachmentFileName(file), file.path, file.relative_file_path, file.file_key].filter(
		(candidate): candidate is string => Boolean(candidate),
	)
}

function getFilePathLookupCandidates(file: AttachmentItem): string[] {
	return [file.path, file.relative_file_path, file.file_key, file.file_name].filter(
		(candidate): candidate is string => Boolean(candidate),
	)
}

function trimSlashes(value: string): string {
	return value.replace(/^\/+|\/+$/g, "")
}

function getDirectoryPath(path: string): string {
	const normalizedPath = trimSlashes(normalizeFileLookupText(path))
	const lastSlashIndex = normalizedPath.lastIndexOf("/")
	return lastSlashIndex >= 0 ? normalizedPath.slice(0, lastSlashIndex) : ""
}

function isMagicProjectFile(file: AttachmentItem): boolean {
	return getFileLookupCandidates(file).some((candidate) =>
		normalizeFileLookupText(candidate).endsWith("/magic.project.js"),
	)
		? true
		: normalizeFileLookupText(getAttachmentFileName(file)) === "magic.project.js"
}

/** Resolves the bundle root that makes index.html safe to include as a hidden runtime file. */
function resolveIndexHtmlBundleRoot(
	input: { bundleRootPath?: string },
	magicProject?: AttachmentItem,
): string | undefined {
	if (input.bundleRootPath !== undefined) {
		return trimSlashes(normalizeFileLookupText(input.bundleRootPath))
	}

	const magicProjectPath = getFilePathLookupCandidates(magicProject ?? {}).find((candidate) =>
		normalizeFileLookupText(candidate).endsWith("magic.project.js"),
	)
	if (!magicProjectPath) return undefined

	return getDirectoryPath(magicProjectPath)
}

/** Finds index.html only after a concrete bundle root is known, preventing sibling bundle leakage. */
function findIndexHtmlInBundle(
	files: AttachmentItem[],
	bundleRootPath: string | undefined,
): AttachmentItem | undefined {
	if (bundleRootPath === undefined) return undefined

	const normalizedRoot = trimSlashes(normalizeFileLookupText(bundleRootPath))
	return files.find((file) => {
		return getFilePathLookupCandidates(file).some((candidate) => {
			const normalizedCandidate = trimSlashes(normalizeFileLookupText(candidate))
			if (
				normalizedCandidate !== "index.html" &&
				!normalizedCandidate.endsWith("/index.html")
			) {
				return false
			}

			return getDirectoryPath(normalizedCandidate) === normalizedRoot
		})
	})
}
