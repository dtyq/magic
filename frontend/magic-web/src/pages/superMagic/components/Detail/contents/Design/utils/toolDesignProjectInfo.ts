import { LayerElement } from "@/components/CanvasDesign/canvas/types"
import projectFilesStore from "@/stores/projectFiles"

export function getToolDesignProjectInfo(tool: unknown) {
	const toolData = tool as ToolDesignProjectData
	const magicProjectJSFile = toolData.attachments?.find(
		(item) => item.filename === "magic.project.js" || item.file_name === "magic.project.js",
	)
	const fileTree = projectFilesStore.workspaceFileTree as unknown as WorkspaceFileItem[]
	const fileList = projectFilesStore.workspaceFilesList as unknown as WorkspaceFileItem[]
	const designProject = findDesignProjectByMagicProjectFile(
		magicProjectJSFile,
		fileTree,
		fileList,
	)
	const designProjectByPath = getDesignProjectFileByProjectPath({
		projectPath: toolData.detail?.data?.project_path,
		attachments: fileTree,
		flatAttachments: fileList,
	})
	const resolvedDesignProject = designProject || designProjectByPath
	const designProjectId = resolvedDesignProject?.file_id || ""
	const elements = (toolData.detail?.data?.elements || []) as LayerElement[]

	return {
		designProjectId,
		designProject: resolvedDesignProject,
		magicProjectJSFile,
		elements,
	}
}

export function getDesignProjectCurrentFileByProjectPath(options: {
	projectPath?: string
	attachments?: unknown[]
	flatAttachments?: unknown[]
}): { id: string; name: string } | undefined {
	const designProject = getDesignProjectFileByProjectPath(options)
	const id = normalizeFileId(designProject?.file_id)
	const name = designProject?.file_name || designProject?.display_filename
	if (!id || !name) return undefined

	return { id, name }
}

export function isSameDesignProjectPath(options: {
	projectPath?: string
	designProjectName?: string
	attachments?: unknown[]
	flatAttachments?: unknown[]
}) {
	const designProject = getDesignProjectFileByProjectPath(options)
	if (designProject) {
		const designProjectName = designProject.file_name || designProject.display_filename
		return !!designProjectName && designProjectName === options.designProjectName
	}

	const projectDirectoryName = getDeepestDirectoryNameFromProjectPath(options.projectPath)
	return !!projectDirectoryName && projectDirectoryName === options.designProjectName
}

function getDesignProjectFileByProjectPath(options: {
	projectPath?: string
	attachments?: unknown[]
	flatAttachments?: unknown[]
}): WorkspaceFileItem | undefined {
	const normalizedProjectPath = normalizeProjectPath(options.projectPath)
	if (!normalizedProjectPath) return undefined

	const list = options.flatAttachments?.length
		? (options.flatAttachments as WorkspaceFileItem[])
		: flattenWorkspaceFileItems((options.attachments || []) as WorkspaceFileItem[])
	if (!list.length) return undefined

	const magicProjectFile = findMagicProjectFileByProjectPath(normalizedProjectPath, list)
	const parentId = normalizeFileId(magicProjectFile?.parent_id)
	if (parentId) {
		const parent = findFileById(list, parentId)
		if (parent) return parent
	}

	const directoryPaths = getProjectDirectoryPathCandidates(normalizedProjectPath)
	for (const directoryPath of directoryPaths) {
		const matchedDirectory = list.find(
			(item) =>
				item.is_directory &&
				normalizeComparablePath(item.relative_file_path) === directoryPath,
		)
		if (matchedDirectory) return matchedDirectory
	}

	return findDeepestDesignProjectDirectoryByPath(normalizedProjectPath, list)
}

function findDesignProjectByMagicProjectFile(
	magicProjectFile: WorkspaceFileItem | undefined,
	fileTree: WorkspaceFileItem[],
	fileList: WorkspaceFileItem[],
) {
	const magicProjectFileId = normalizeFileId(magicProjectFile?.file_id)
	if (!magicProjectFileId) return undefined

	const latestMagicProjectFile =
		findFileById(fileList, magicProjectFileId) || findFileById(fileTree, magicProjectFileId)
	const parentId = normalizeFileId(
		latestMagicProjectFile?.parent_id || magicProjectFile?.parent_id,
	)
	if (parentId) return findFileById(fileList, parentId) || findFileById(fileTree, parentId)

	return findParentNodeByChildId(fileTree, magicProjectFileId)
}

function findMagicProjectFileByProjectPath(
	normalizedProjectPath: string,
	fileItems: WorkspaceFileItem[],
) {
	const expectedMagicProjectPaths = getProjectDirectoryPathCandidates(normalizedProjectPath).map(
		(directoryPath) => `${directoryPath}/magic.project.js`,
	)
	const directMagicProjectPath = normalizeComparablePath(normalizedProjectPath)
	if (directMagicProjectPath.endsWith("/magic.project.js")) {
		expectedMagicProjectPaths.push(directMagicProjectPath)
	}

	return fileItems.find(
		(item) =>
			!item.is_directory &&
			isMagicProjectFile(item) &&
			expectedMagicProjectPaths.includes(normalizeComparablePath(item.relative_file_path)),
	)
}

function findDeepestDesignProjectDirectoryByPath(
	normalizedProjectPath: string,
	fileItems: WorkspaceFileItem[],
) {
	const directories = fileItems
		.filter((item) => item.is_directory && hasMagicProjectFile(item, fileItems))
		.filter((item) => {
			const directoryPath = normalizeComparablePath(item.relative_file_path)
			return (
				normalizedProjectPath === directoryPath ||
				normalizedProjectPath.startsWith(`${directoryPath}/`)
			)
		})
		.sort(
			(a, b) =>
				normalizeComparablePath(b.relative_file_path).length -
				normalizeComparablePath(a.relative_file_path).length,
		)

	return directories[0]
}

function findFileById(
	fileItems: WorkspaceFileItem[],
	fileId: string,
): WorkspaceFileItem | undefined {
	for (const fileItem of fileItems) {
		if (normalizeFileId(fileItem.file_id) === fileId) return fileItem

		const matchedChild = findFileById(fileItem.children || [], fileId)
		if (matchedChild) return matchedChild
	}

	return undefined
}

function findParentNodeByChildId(
	fileItems: WorkspaceFileItem[],
	childFileId: string,
): WorkspaceFileItem | undefined {
	for (const fileItem of fileItems) {
		const children = fileItem.children || []
		if (children.some((child) => normalizeFileId(child.file_id) === childFileId))
			return fileItem

		const matchedParent = findParentNodeByChildId(children, childFileId)
		if (matchedParent) return matchedParent
	}

	return undefined
}

function hasMagicProjectFile(directory: WorkspaceFileItem, fileItems: WorkspaceFileItem[]) {
	const directoryId = normalizeFileId(directory.file_id)
	const directoryPath = normalizeComparablePath(directory.relative_file_path)
	const magicProjectPath = `${directoryPath}/magic.project.js`

	return fileItems.some(
		(item) =>
			!item.is_directory &&
			isMagicProjectFile(item) &&
			((directoryId && normalizeFileId(item.parent_id) === directoryId) ||
				normalizeComparablePath(item.relative_file_path) === magicProjectPath),
	)
}

function isMagicProjectFile(fileItem: WorkspaceFileItem) {
	return fileItem.filename === "magic.project.js" || fileItem.file_name === "magic.project.js"
}

function getProjectDirectoryPathCandidates(projectPath: string) {
	const normalizedPath = normalizeComparablePath(projectPath)
	if (!normalizedPath) return []

	const fileName = normalizedPath.split("/").pop()
	const directoryPath =
		fileName === "magic.project.js" || fileName?.includes(".")
			? normalizedPath.slice(0, normalizedPath.lastIndexOf("/"))
			: normalizedPath

	return Array.from(new Set([directoryPath, normalizedPath].filter(Boolean)))
}

function getDeepestDirectoryNameFromProjectPath(projectPath: string | undefined) {
	const directoryPath = getProjectDirectoryPathCandidates(projectPath || "")[0]
	return directoryPath?.split("/").filter(Boolean).pop()
}

function flattenWorkspaceFileItems(fileItems: WorkspaceFileItem[]): WorkspaceFileItem[] {
	return fileItems.reduce<WorkspaceFileItem[]>((result, fileItem) => {
		result.push(fileItem)
		if (fileItem.children?.length) result.push(...flattenWorkspaceFileItems(fileItem.children))

		return result
	}, [])
}

function normalizeProjectPath(projectPath: string | undefined) {
	if (!projectPath) return ""

	return normalizeComparablePath(projectPath)
}

function normalizeComparablePath(path: unknown) {
	if (typeof path !== "string") return ""

	return path
		.replace(/\\/g, "/")
		.replace(/^\.?\//, "")
		.replace(/\/+$/, "")
}

function normalizeFileId(fileId: unknown) {
	if (typeof fileId === "string") return fileId
	if (typeof fileId === "number") return String(fileId)

	return ""
}

export interface ToolDesignProjectData {
	attachments?: WorkspaceFileItem[]
	detail?: {
		data?: {
			project_path?: string
			elements?: LayerElement[]
		}
	}
	id?: unknown
	name?: string
	status?: string
	action?: string
	remark?: string
}

interface WorkspaceFileItem {
	file_id?: unknown
	file_name?: string
	filename?: string
	display_filename?: string
	relative_file_path?: string
	is_directory?: boolean
	parent_id?: unknown
	children?: WorkspaceFileItem[]
	[key: string]: unknown
}
