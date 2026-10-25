import type { TabItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import type { WorkspaceFile, WorkspaceFolder } from "@/stores/projectFiles/types"
import type { DirectoryMentionData, ProjectFileMentionData } from "../types"
import { getFolderMentionData } from "./directoryMention"

type ProjectReferenceFileLike = {
	source?: import("@/pages/superMagic/components/TopicFilesButton/hooks/types").AttachmentSource
	file_id?: string | number
	project_id?: string
	file_name?: string | number
	display_filename?: string | number
	filename?: string | number
	name?: string | number
	file_extension?: string
	file_size?: number
	updated_at?: string
	resource_version?: string | null
	version?: string | null
	file_version?: number
	relative_file_path?: string
	type?: string
	is_directory?: boolean
	is_hidden?: boolean
	parent_id?: string | number | null
	children?: unknown[]
	display_config?: {
		type?: string
		name?: string
		version?: string | number
		entry?: string
		index?: string
		root_path?: string
		_customFolderId?: string | number
	}
}

type FolderLookupEntry = ProjectReferenceFileLike & {
	type?: string
	relative_file_path?: string
}

interface ProjectFileMentionFallbacks {
	fileId?: string | number
	fileName?: string | number
	filePath?: string
}

interface ResolveTabFolderOptions {
	getFolderData: (parentId: string | number | undefined) => WorkspaceFolder | undefined
	workspaceFilesList: FolderLookupEntry[]
}

export function normalizeProjectReferencePath(path: string | number | null | undefined): string {
	if (path === null || path === undefined) return ""

	return String(path).replace(/^\/+/, "")
}

export function normalizeProjectFileResourcePath(path: string | number | null | undefined): string {
	return String(path ?? "")
		.trim()
		.replace(/\\/g, "/")
		.replace(/^\.\/+/, "")
		.replace(/\/+/g, "/")
		.replace(/\/$/, "")
}

export function getProjectFileResourceIdentity(
	file: {
		file_id?: string | number | null
		file_path?: string | number | null
		relative_file_path?: string | number | null
	},
	fallbackPath?: string | number | null,
): string {
	if (file.file_id !== null && file.file_id !== undefined && String(file.file_id).length > 0) {
		return `project-file:id:${String(file.file_id)}`
	}

	const normalizedPath = normalizeProjectFileResourcePath(
		file.relative_file_path ?? file.file_path ?? fallbackPath,
	)
	return normalizedPath ? `project-file:path:${normalizedPath}` : ""
}

function normalizeComparableProjectReferencePath(path: string | number | null | undefined): string {
	return normalizeProjectReferencePath(path).replace(/\/+$/, "")
}

function getParentPath(path: string | number | null | undefined): string {
	const normalizedPath = normalizeComparableProjectReferencePath(path)
	const lastSlashIndex = normalizedPath.lastIndexOf("/")

	if (lastSlashIndex < 0) return ""

	return normalizedPath.slice(0, lastSlashIndex)
}

function getAncestorPaths(path: string | number | null | undefined): string[] {
	const paths: string[] = []
	let parentPath = getParentPath(path)

	while (parentPath) {
		paths.push(parentPath)
		parentPath = getParentPath(parentPath)
	}

	return paths
}

function joinProjectReferencePath(basePath: string, childPath: string): string {
	const normalizedBasePath = normalizeComparableProjectReferencePath(basePath)
	const normalizedChildPath = normalizeComparableProjectReferencePath(childPath)

	if (!normalizedBasePath) return normalizedChildPath
	if (!normalizedChildPath) return normalizedBasePath

	return `${normalizedBasePath}/${normalizedChildPath}`
}

function getProjectReferenceFileName(
	file: ProjectReferenceFileLike,
	fallback?: string | number,
): string {
	const fileName =
		file.file_name || file.display_filename || file.filename || file.name || fallback || ""

	return String(fileName)
}

function isExplicitProjectReferenceDirectoryLike(
	file: ProjectReferenceFileLike,
	fallbackPath?: string,
): boolean {
	const filePath = file.relative_file_path || fallbackPath || ""

	return file.is_directory === true || file.type === "directory" || filePath.endsWith("/")
}

function isProjectReferenceDirectoryLike(
	file: ProjectReferenceFileLike,
	fallbackPath?: string,
): boolean {
	return (
		isExplicitProjectReferenceDirectoryLike(file, fallbackPath) ||
		file.display_config?.type === "design"
	)
}

function createDirectoryLikeWorkspaceFolderFromTab(tab: TabItem): WorkspaceFolder | null {
	const { fileData } = tab

	if (!isProjectReferenceDirectoryLike(fileData, tab.filePath)) return null

	const fileId = fileData.file_id || tab.id
	const fileName = getProjectReferenceFileName(fileData, tab.title || fileId)
	const relativeFilePath = fileData.relative_file_path || tab.filePath || ""

	if (!fileId || !relativeFilePath) return null

	return {
		...(fileData as unknown as Partial<WorkspaceFolder>),
		file_id: String(fileId),
		file_name: fileName,
		relative_file_path: relativeFilePath,
		type: "directory",
		is_directory: true,
		is_hidden: Boolean((fileData as ProjectReferenceFileLike).is_hidden),
		parent_id: fileData.parent_id == null ? undefined : String(fileData.parent_id),
		children: (fileData.children ?? []) as (WorkspaceFolder | WorkspaceFile)[],
	}
}

function isWorkspaceFolderEntry(item: FolderLookupEntry | undefined): item is WorkspaceFolder {
	return Boolean(item && (item.type === "directory" || item.is_directory === true))
}

function findWorkspaceFolderById(
	fileId: string | number | null | undefined,
	options: ResolveTabFolderOptions,
): WorkspaceFolder | null {
	if (fileId === null || fileId === undefined || fileId === "") return null

	return (
		(options.workspaceFilesList.find(
			(item) => isWorkspaceFolderEntry(item) && String(item.file_id) === String(fileId),
		) as WorkspaceFolder | undefined) ?? null
	)
}

function findWorkspaceFolderByPath(
	path: string | number | null | undefined,
	options: ResolveTabFolderOptions,
): WorkspaceFolder | null {
	const normalizedPath = normalizeComparableProjectReferencePath(path)
	if (!normalizedPath) return null

	return (
		(options.workspaceFilesList.find(
			(item) =>
				isWorkspaceFolderEntry(item) &&
				normalizeComparableProjectReferencePath(item.relative_file_path) === normalizedPath,
		) as WorkspaceFolder | undefined) ?? null
	)
}

function addFolderCandidate(
	folders: WorkspaceFolder[],
	seenKeys: Set<string>,
	folder: WorkspaceFolder | null | undefined,
) {
	if (!folder) return

	const key =
		String(folder.file_id ?? "") ||
		normalizeComparableProjectReferencePath(folder.relative_file_path)
	if (!key || seenKeys.has(key)) return

	seenKeys.add(key)
	folders.push(folder)
}

function collectFolderCandidatesForEntryFile(
	file: ProjectReferenceFileLike,
	options: ResolveTabFolderOptions,
	fallbackPath?: string,
): WorkspaceFolder[] {
	const folders: WorkspaceFolder[] = []
	const seenKeys = new Set<string>()
	const customFolderId = file.display_config?._customFolderId

	// Custom entry files can live below a nested directory; _customFolderId points back
	// to the app folder that owns the entry declaration and assets.
	if (customFolderId !== undefined && customFolderId !== null) {
		addFolderCandidate(
			folders,
			seenKeys,
			options.getFolderData(customFolderId) ??
				findWorkspaceFolderById(customFolderId, options),
		)
	}

	let parentId = file.parent_id
	const visitedParentIds = new Set<string>()

	while (parentId !== undefined && parentId !== null && parentId !== "") {
		const parentIdKey = String(parentId)
		if (visitedParentIds.has(parentIdKey)) break
		visitedParentIds.add(parentIdKey)

		const parentFolder =
			options.getFolderData(parentId) ?? findWorkspaceFolderById(parentId, options)
		if (!parentFolder) break

		addFolderCandidate(folders, seenKeys, parentFolder)
		parentId = parentFolder.parent_id
	}

	const filePath = file.relative_file_path || fallbackPath
	getAncestorPaths(filePath).forEach((path) => {
		addFolderCandidate(folders, seenKeys, findWorkspaceFolderByPath(path, options))
	})

	return folders
}

function getDeclaredProjectReferenceEntryPath(
	displayConfig: ProjectReferenceFileLike["display_config"],
): string {
	if (!displayConfig) return ""

	if (typeof displayConfig.entry === "string" && displayConfig.entry.trim()) {
		return displayConfig.entry.trim()
	}

	if (displayConfig.type === "custom") {
		const customEntryPath = displayConfig.index ?? displayConfig.root_path
		if (typeof customEntryPath === "string" && customEntryPath.trim()) {
			return customEntryPath.trim()
		}
	}

	return ""
}

function hasProjectReferenceDisplayType(file: ProjectReferenceFileLike): boolean {
	return typeof file.display_config?.type === "string" && file.display_config.type.length > 0
}

function matchesProjectReferenceEntryPath(
	file: ProjectReferenceFileLike,
	folder: WorkspaceFolder,
	entryPath: string,
	fallbackPath?: string,
	fallbackName?: string | number,
): boolean {
	const filePath = normalizeComparableProjectReferencePath(
		file.relative_file_path || fallbackPath,
	)
	const folderPath = normalizeComparableProjectReferencePath(folder.relative_file_path)
	const normalizedEntryPath = normalizeComparableProjectReferencePath(entryPath)
	const expectedWorkspacePath = joinProjectReferencePath(folderPath, normalizedEntryPath)
	const fileName = getProjectReferenceFileName(file, fallbackName).toLowerCase()
	const entryFileName = normalizedEntryPath.split("/").pop()?.toLowerCase() || ""

	return (
		(!!filePath && filePath === expectedWorkspacePath) ||
		(!normalizedEntryPath.includes("/") &&
			!!entryFileName &&
			fileName === entryFileName &&
			getParentPath(filePath) === folderPath)
	)
}

function isProjectReferenceFolderEntryFile(
	file: ProjectReferenceFileLike,
	folder: WorkspaceFolder,
	fallbackPath?: string,
	fallbackName?: string | number,
): boolean {
	if (isExplicitProjectReferenceDirectoryLike(file, fallbackPath)) return false

	const declaredEntryPath =
		getDeclaredProjectReferenceEntryPath(folder.display_config) ||
		getDeclaredProjectReferenceEntryPath(file.display_config)
	const displayType = folder.display_config?.type || file.display_config?.type

	if (displayType === "slide") {
		return matchesProjectReferenceEntryPath(
			file,
			folder,
			declaredEntryPath || "index.html",
			fallbackPath,
			fallbackName,
		)
	}

	if (declaredEntryPath) {
		return matchesProjectReferenceEntryPath(
			file,
			folder,
			declaredEntryPath,
			fallbackPath,
			fallbackName,
		)
	}

	// App-like outputs that do not declare an explicit entry still default to index.html.
	return (
		(hasProjectReferenceDisplayType(folder) || hasProjectReferenceDisplayType(file)) &&
		matchesProjectReferenceEntryPath(file, folder, "index.html", fallbackPath, fallbackName)
	)
}

export function resolveFolderWorkspaceEntryFromProjectFile(
	file: ProjectReferenceFileLike,
	options: ResolveTabFolderOptions,
	fallbacks: ProjectFileMentionFallbacks = {},
): WorkspaceFolder | null {
	const folder = collectFolderCandidatesForEntryFile(file, options, fallbacks.filePath).find(
		(candidate) =>
			isProjectReferenceFolderEntryFile(
				file,
				candidate,
				fallbacks.filePath,
				fallbacks.fileName,
			),
	)

	return folder ?? null
}

export function resolveFolderWorkspaceEntryFromTab(
	tab: TabItem,
	options: ResolveTabFolderOptions,
): WorkspaceFolder | null {
	const entryFolder = resolveFolderWorkspaceEntryFromProjectFile(tab.fileData, options, {
		fileId: tab.id,
		fileName: tab.title,
		filePath: tab.filePath,
	})
	if (entryFolder) return entryFolder

	const directoryLikeFolder = createDirectoryLikeWorkspaceFolderFromTab(tab)
	if (directoryLikeFolder) return directoryLikeFolder

	return null
}

export function createProjectFileMentionData(
	file: ProjectReferenceFileLike,
	fallbacks: ProjectFileMentionFallbacks = {},
): ProjectFileMentionData {
	const fileId = file.file_id || fallbacks.fileId || ""
	const fileName = getProjectReferenceFileName(file, fallbacks.fileName || fileId)
	const filePath = file.relative_file_path || fallbacks.filePath || ""

	return {
		file_id: String(fileId),
		file_name: fileName,
		file_path: normalizeProjectReferencePath(filePath),
		...(file.source !== undefined ? { source: file.source } : {}),
		relative_file_path: normalizeProjectReferencePath(filePath),
		is_hidden: file.is_hidden,
		file_extension: file.file_extension || "",
		...(file.project_id ? { project_id: file.project_id } : {}),
		file_size: file.file_size,
		...(file.updated_at !== undefined ? { updated_at: file.updated_at } : {}),
		...(file.resource_version !== undefined ? { resource_version: file.resource_version } : {}),
		...(file.version !== undefined ? { version: file.version } : {}),
		...(file.file_version !== undefined ? { file_version: file.file_version } : {}),
	}
}

export function createDirectoryMentionData(folder: ProjectReferenceFileLike): DirectoryMentionData {
	return getFolderMentionData({
		directoryId: folder.file_id,
		directoryName: getProjectReferenceFileName(folder),
		directoryPath: normalizeProjectReferencePath(folder.relative_file_path),
		directoryMetadata: folder.display_config,
	})
}
