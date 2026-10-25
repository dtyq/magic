import { SuperMagicApi } from "@/apis"
import type { LayerElement } from "@/components/CanvasDesign/runtime/document/types"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import type { AttachmentIndex } from "@/pages/superMagic/components/TopicFilesButton/utils/attachmentIndex"
import { getFileContentsByIds } from "@/pages/superMagic/utils/api"
import { parseMagicProjectConfigContent } from "@/pages/superMagic/utils/magicProjectConfigParser"
import { isRemoteOrSpecialPath } from "@/components/CanvasDesign/runtime/shared/path/canvasResourcePath"
import {
	compressCanvasData,
	decompressCanvasData,
	isCompressedCanvas,
	MAGIC_PROJECT_VERSION_V1,
	MAGIC_PROJECT_VERSION_V2,
	MAGIC_PROJECT_VERSION_V3,
} from "./magicProjectCompression"
import { ELEMENT_DETAILS_FILENAME, ELEMENT_DETAILS_USER_FILENAME } from "./elementDetailsStore"
import { rewriteLayerElementsPathsForMagicProjectSave } from "./internal/designPathPrimitives"

export type CanvasProjectPathRepairOperation = "rename" | "move"

export interface CanvasProjectPathRepairOptions {
	signal?: AbortSignal
	attachments: AttachmentItem[]
	flatAttachments?: AttachmentItem[]
	attachmentIndex?: AttachmentIndex
	/** Whether the supplied attachment snapshot is known to contain the complete project tree. */
	attachmentSnapshotComplete?: boolean
	fileIds?: string[]
	items?: AttachmentItem[]
	operation: CanvasProjectPathRepairOperation
	projectId?: string
}

export interface CanvasProjectPathRepairFailure {
	projectName: string
	fileName: string
	message: string
}

export interface CanvasProjectPathRepairProjectResult {
	projectName: string
	rootPath: string
	hasRepairablePaths: boolean
	changedFileIds: string[]
	changed: boolean
}

export interface CanvasProjectPathRepairResult {
	affectedProjects: CanvasProjectPathRepairProjectResult[]
	repairedFileIds: string[]
	repairedFiles: Array<{
		fileId: string
		fileName: string
		projectName: string
	}>
	failures: CanvasProjectPathRepairFailure[]
	warnings?: CanvasProjectPathRepairFailure[]
	saveFailures: CanvasProjectPathRepairFailure[]
	hasFailures: boolean
	hasWarnings?: boolean
	hasSaveFailures: boolean
	/** Whether the caller should ask before continuing the pending file operation. */
	requiresConfirmation: boolean
	pendingFileSaves?: CanvasProjectPathRepairPendingFileSave[]
}

export interface CanvasProjectNameSyncOptions {
	attachments: AttachmentItem[]
	flatAttachments?: AttachmentItem[]
	attachmentIndex?: AttachmentIndex
	fileIds?: string[]
	items?: AttachmentItem[]
	projectId?: string
	newName: string
}

export interface CanvasProjectNameSyncResult {
	syncedFileIds: string[]
	failures: CanvasProjectPathRepairFailure[]
	hasFailures: boolean
}

interface CanvasProjectInfo {
	rootPath: string
	projectName: string
	mainFile: AttachmentItem
	sidecars: AttachmentItem[]
}

export interface CanvasProjectPathRepairPendingFileSave {
	fileId: string
	fileName: string
	content: string
	projectName: string
	projectRootPath: string
}

type PendingFileSave = CanvasProjectPathRepairPendingFileSave

interface ResourcePathIssues {
	missingPaths: Set<string>
	ambiguousPaths: Set<string>
	unverifiedPaths: Set<string>
}

type AttachmentCollectionOptions = Pick<
	CanvasProjectPathRepairOptions,
	"attachments" | "flatAttachments" | "attachmentIndex"
>

interface PersistPendingFileSavesResult {
	successfulFiles: PendingFileSave[]
	failures: CanvasProjectPathRepairFailure[]
}

interface ProjectCheckState {
	project: CanvasProjectInfo
	resourceLookup: ResourceLookup
	projectResult: CanvasProjectPathRepairProjectResult
	projectFailures: CanvasProjectPathRepairFailure[]
	projectSaves: PendingFileSave[]
}

interface ResourceLookup {
	isComplete: boolean
	allFilePaths: Set<string>
	uniqueFilePaths: Map<string, string>
	allDirectoryPaths: Set<string>
	uniqueDirectoryPaths: Map<string, string>
	allWorkspaceFilePaths: Set<string>
	uniqueWorkspaceFilePaths: Map<string, string>
	allWorkspaceDirectoryPaths: Set<string>
	uniqueWorkspaceDirectoryPaths: Map<string, string>
	ambiguousBareFilePaths: Set<string>
	ambiguousBareDirectoryPaths: Set<string>
}

const MAGIC_PROJECT_FILE_NAME = "magic.project.js"
const DESIGN_CANVAS_DISPLAY_TYPE = "design"
const CANVAS_RESOURCE_DIRS = new Set(["images", "videos", "audios"])
const DIRECT_PATH_KEYS = new Set(["src", "file_dir", "file_path", "uri", "audio", "video", "mask"])
const PATH_ARRAY_KEYS = new Set([
	"reference_images",
	"reference_videos",
	"reference_audios",
	"frames",
	"audio",
	"video",
	"mask",
])

function normalizePath(value: unknown): string {
	if (typeof value !== "string") return ""
	return value
		.replace(/\\/g, "/")
		.replace(/^\.\//, "")
		.replace(/^\/+|\/+$/g, "")
}

function itemName(item: AttachmentItem): string {
	return item.file_name || item.filename || item.display_filename || item.name || ""
}

/** Path repair rewrites Design canvas DSL only — not slide/PPT or other magic.project.js types. */
function isDesignCanvasProjectRoot(root: AttachmentItem | undefined): boolean {
	if (!root?.is_directory) return false
	return root.display_config?.type === DESIGN_CANVAS_DISPLAY_TYPE
}

export function resolveCanvasOperationConfirmTitleKey(options: {
	requiresCanvasRisk: boolean
	hasPathRepairFailures: boolean
}):
	| "topicFiles.canvasOperationRisk.title"
	| "topicFiles.canvasOperationRisk.pathRepairFailureTitle" {
	if (options.requiresCanvasRisk) return "topicFiles.canvasOperationRisk.title"
	if (options.hasPathRepairFailures)
		return "topicFiles.canvasOperationRisk.pathRepairFailureTitle"
	return "topicFiles.canvasOperationRisk.title"
}

function itemPath(
	item: AttachmentItem,
	items?: AttachmentItem[],
	visited = new Set<string>(),
): string {
	const explicitPath = normalizePath(item.relative_file_path || item.path)
	if (explicitPath) return explicitPath

	const name = normalizePath(itemName(item))
	const itemId = item.file_id ? String(item.file_id) : ""
	if (!items || !item.parent_id || (itemId && visited.has(itemId))) return name
	if (itemId) visited.add(itemId)
	const parent = items.find((candidate) => String(candidate.file_id) === String(item.parent_id))
	const parentItemPath = parent ? itemPath(parent, items, visited) : ""
	return parentItemPath ? `${parentItemPath}/${name}` : name
}

/**
 * When both fields are present, require the explicit attachment path to agree with
 * the parent_id chain before using it as ownership evidence.
 */
function isAttachmentPathConsistent(item: AttachmentItem, items: AttachmentItem[]): boolean {
	const explicitPath = normalizePath(item.relative_file_path)
	if (!explicitPath || item.parent_id === undefined || item.parent_id === null) return true
	const parent = items.find((candidate) => String(candidate.file_id) === String(item.parent_id))
	if (!parent) return false
	const parentItemPath = itemPath(parent, items)
	const name = normalizePath(itemName(item))
	return Boolean(parentItemPath && name && explicitPath === `${parentItemPath}/${name}`)
}

function parentPath(path: string): string {
	const index = path.lastIndexOf("/")
	return index >= 0 ? path.slice(0, index) : ""
}

function hasSameParentId(left: AttachmentItem, right: AttachmentItem): boolean {
	if (left.parent_id === undefined || left.parent_id === null) return false
	if (right.parent_id === undefined || right.parent_id === null) return false
	return String(left.parent_id) === String(right.parent_id)
}

function flattenAttachments(items: AttachmentItem[]): AttachmentItem[] {
	const result: AttachmentItem[] = []
	const walk = (list: AttachmentItem[]) => {
		for (const item of list) {
			result.push(item)
			if (item.children?.length) walk(item.children)
		}
	}
	walk(items)
	return result
}

function findParentItem(items: AttachmentItem[], item: AttachmentItem): AttachmentItem | undefined {
	if (item.parent_id !== undefined && item.parent_id !== null) {
		const byId = items.find((candidate) => String(candidate.file_id) === String(item.parent_id))
		if (byId?.is_directory) return byId
	}
	const path = parentPath(itemPath(item, items))
	return path
		? items.find((candidate) => candidate.is_directory && itemPath(candidate, items) === path)
		: undefined
}

function collectCanvasProjects(items: AttachmentItem[], projectId?: string): CanvasProjectInfo[] {
	const projects = new Map<string, CanvasProjectInfo>()
	for (const item of items) {
		if (item.is_directory || itemName(item) !== MAGIC_PROJECT_FILE_NAME) continue
		if (!isAttachmentPathConsistent(item, items)) continue
		const parent = findParentItem(items, item)
		if (!parent?.is_directory) continue
		if (!isDesignCanvasProjectRoot(parent)) continue
		if (!isAttachmentPathConsistent(parent, items)) continue
		if (
			projectId &&
			[parent, item].some(
				(candidate) =>
					candidate &&
					candidate.project_id !== undefined &&
					candidate.project_id !== null &&
					String(candidate.project_id) !== String(projectId),
			)
		)
			continue
		const rootPath = parent ? itemPath(parent, items) : parentPath(itemPath(item, items))
		if (!rootPath || !item.file_id) continue
		const projectKey = String(parent?.file_id || rootPath)
		const sidecars = items.filter(
			(candidate) =>
				!candidate.is_directory &&
				Boolean(candidate.file_id) &&
				isAttachmentPathConsistent(candidate, items) &&
				candidate.file_id !== item.file_id &&
				(itemName(candidate) === ELEMENT_DETAILS_FILENAME ||
					itemName(candidate) === ELEMENT_DETAILS_USER_FILENAME) &&
				(hasSameParentId(candidate, item) ||
					parentPath(itemPath(candidate, items)) === rootPath),
		)
		projects.set(projectKey, {
			rootPath,
			projectName: itemName(parent || item) || rootPath.split("/").pop() || rootPath,
			mainFile: item,
			sidecars,
		})
	}
	return [...projects.values()]
}

function selectedOperationItems(
	options: CanvasProjectPathRepairOptions,
	items: AttachmentItem[],
): AttachmentItem[] {
	const selected = [...(options.items || [])]
	for (const fileId of options.fileIds || []) {
		const item = items.find((candidate) => String(candidate.file_id) === String(fileId))
		if (item) selected.push(item)
	}
	const seen = new Set<string>()
	return selected.filter((item) => {
		const key = String(item.file_id || itemPath(item, items))
		if (!key || key === "undefined") return false
		if (seen.has(key)) return false
		seen.add(key)
		return true
	})
}

function isSameOrDescendant(path: string, ancestor: string): boolean {
	return path === ancestor || path.startsWith(`${ancestor}/`)
}

function isAffectedProject(
	project: CanvasProjectInfo,
	selectedItems: AttachmentItem[],
	items: AttachmentItem[],
): boolean {
	return selectedItems.some((item) => {
		// Path repair is only safe when the operation moves/renames the canvas
		// root itself or one of its parent directories. A resource file (or a
		// directory inside the canvas, such as `images`) may move to an
		// unrelated destination, so rewriting it before the destination is
		// applied would leave a stale relative reference.
		if (!item.is_directory) return false
		const selectedPath = itemPath(item, items)
		return isSameOrDescendant(project.rootPath, selectedPath)
	})
}

function resolveIndexedItem(
	attachmentIndex: AttachmentIndex,
	lookupKey: string,
): AttachmentItem | undefined {
	return attachmentIndex.getItemById(lookupKey) || attachmentIndex.getItemByKey(lookupKey)
}

function resolveSelectedItemsWithIndex(options: CanvasProjectPathRepairOptions): AttachmentItem[] {
	const attachmentIndex = options.attachmentIndex
	if (!attachmentIndex) return []

	const selected = [...(options.items || [])]
	for (const fileId of options.fileIds || []) {
		const item = resolveIndexedItem(attachmentIndex, String(fileId))
		if (item) selected.push(item)
	}

	const seen = new Set<string>()
	return selected.filter((item) => {
		const key = String(item.file_id || item.relative_file_path || item.path || "")
		if (!key || key === "undefined") return false
		if (seen.has(key)) return false
		seen.add(key)
		return true
	})
}

function directoryHasMagicProjectChild(
	directory: AttachmentItem,
	attachmentIndex: AttachmentIndex,
): AttachmentItem | undefined {
	const lookupKey = String(directory.file_id || directory.relative_file_path || "")
	if (!lookupKey) return undefined

	const childKeys = directory.file_id
		? attachmentIndex.getChildKeysById(String(directory.file_id))
		: attachmentIndex.getChildKeysByKey(lookupKey)

	for (const childKey of childKeys) {
		const child = attachmentIndex.getItemByKey(childKey)
		if (!child || child.is_directory) continue
		if (itemName(child) === MAGIC_PROJECT_FILE_NAME) return child
	}
	return undefined
}

function getIndexedParentItems(
	item: AttachmentItem,
	attachmentIndex: AttachmentIndex,
): AttachmentItem[] {
	if (item.file_id) return attachmentIndex.getParentItemsById(String(item.file_id))
	const path = normalizePath(item.relative_file_path || item.path)
	if (!path) return []
	return attachmentIndex.getParentItemsByKey(path)
}

/**
 * Path repair only applies when the selection is the canvas root or an ancestor
 * directory. Resource files / folders inside a canvas (images, magic.project.js,
 * etc.) must not trigger a full-tree collect + rewrite plan.
 */
function selectedCanTriggerPathRepair(
	selectedItems: AttachmentItem[],
	attachmentIndex: AttachmentIndex,
): boolean {
	return selectedItems.some((item) => {
		if (!item.is_directory) return false

		// Descendant of an existing canvas root → cannot be "root or ancestor".
		const ancestors = getIndexedParentItems(item, attachmentIndex)
		if (ancestors.some((ancestor) => directoryHasMagicProjectChild(ancestor, attachmentIndex)))
			return false

		return true
	})
}

function collectSidecarsForRoot(
	root: AttachmentItem,
	mainFile: AttachmentItem,
	attachmentIndex: AttachmentIndex,
): AttachmentItem[] {
	const lookupKey = String(root.file_id || root.relative_file_path || "")
	if (!lookupKey) return []

	const childKeys = root.file_id
		? attachmentIndex.getChildKeysById(String(root.file_id))
		: attachmentIndex.getChildKeysByKey(lookupKey)

	return childKeys
		.map((key) => attachmentIndex.getItemByKey(key))
		.filter((candidate): candidate is AttachmentItem => {
			if (!candidate || candidate.is_directory || !candidate.file_id) return false
			if (String(candidate.file_id) === String(mainFile.file_id)) return false
			const name = itemName(candidate)
			return name === ELEMENT_DETAILS_FILENAME || name === ELEMENT_DETAILS_USER_FILENAME
		})
}

function collectAffectedProjectsWithIndex(
	selectedItems: AttachmentItem[],
	attachmentIndex: AttachmentIndex,
	projectId?: string,
): CanvasProjectInfo[] {
	const projects = new Map<string, CanvasProjectInfo>()

	const maybeAddProject = (root: AttachmentItem, mainFile: AttachmentItem) => {
		if (!isDesignCanvasProjectRoot(root)) return
		if (
			projectId &&
			[root, mainFile].some(
				(candidate) =>
					candidate.project_id !== undefined &&
					candidate.project_id !== null &&
					String(candidate.project_id) !== String(projectId),
			)
		)
			return

		const rootPath = normalizePath(root.relative_file_path || root.path) || itemName(root)
		if (!rootPath || !mainFile.file_id) return

		const projectKey = String(root.file_id || rootPath)
		if (projects.has(projectKey)) return

		projects.set(projectKey, {
			rootPath,
			projectName: itemName(root) || rootPath.split("/").pop() || rootPath,
			mainFile,
			sidecars: collectSidecarsForRoot(root, mainFile, attachmentIndex),
		})
	}

	for (const item of selectedItems) {
		if (!item.is_directory) continue

		const ancestors = getIndexedParentItems(item, attachmentIndex)
		if (ancestors.some((ancestor) => directoryHasMagicProjectChild(ancestor, attachmentIndex)))
			continue

		const ownMainFile = directoryHasMagicProjectChild(item, attachmentIndex)
		if (ownMainFile) {
			maybeAddProject(item, ownMainFile)
			continue
		}

		const lookupKey = String(item.file_id || item.relative_file_path || "")
		if (!lookupKey) continue

		const descendantKeys = item.file_id
			? attachmentIndex.getDescendantKeysById(String(item.file_id))
			: attachmentIndex.getDescendantKeysByKey(lookupKey)

		for (const key of descendantKeys) {
			const candidate = attachmentIndex.getItemByKey(key)
			if (
				!candidate ||
				candidate.is_directory ||
				itemName(candidate) !== MAGIC_PROJECT_FILE_NAME
			)
				continue
			if (!candidate.file_id) continue

			const parent =
				(candidate.file_id
					? attachmentIndex.getParentItemById(String(candidate.file_id))
					: null) || attachmentIndex.getParentItemByKey(key)
			if (!parent?.is_directory) continue
			maybeAddProject(parent, candidate)
		}
	}

	return [...projects.values()]
}

function getSaveFailureMessage(response: unknown, fileId: string): string | null {
	if (!response || typeof response !== "object") return "save-result-missing"
	const payload = response as {
		error_files?: Array<{ file_id?: string; error?: string }>
		success_files?: Array<{ file_id?: string }>
	}
	const failedFile = payload.error_files?.find(
		(file) => String(file?.file_id || "") === String(fileId),
	)
	if (failedFile) return failedFile.error || "save-failed"
	const savedFile = payload.success_files?.find(
		(file) => String(file?.file_id || "") === String(fileId),
	)
	return savedFile ? null : "save-result-missing"
}

function resolveFlatAttachmentItems(options: AttachmentCollectionOptions): AttachmentItem[] {
	return options.flatAttachments?.length
		? options.flatAttachments
		: options.attachmentIndex
			? options.attachmentIndex.allKeys
					.map((key) => options.attachmentIndex?.getItemByKey(key))
					.filter((item): item is AttachmentItem => Boolean(item))
			: flattenAttachments(options.attachments || [])
}

async function persistPendingFileSaves(
	pendingSaves: PendingFileSave[],
): Promise<PersistPendingFileSavesResult> {
	if (pendingSaves.length === 0) return { successfulFiles: [], failures: [] }

	const saveResult = await Promise.allSettled([
		SuperMagicApi.saveFileContent(
			pendingSaves.map((file) => ({ file_id: file.fileId, content: file.content })),
		),
	])
	const result = saveResult[0]
	const successfulFiles: PendingFileSave[] = []
	const failures: CanvasProjectPathRepairFailure[] = []
	for (const file of pendingSaves) {
		const message = !result
			? "save-result-missing"
			: result.status === "fulfilled"
				? getSaveFailureMessage(result.value, file.fileId)
				: result.reason instanceof Error
					? result.reason.message
					: String(result.reason)
		if (message) {
			failures.push({
				projectName: file.projectName,
				fileName: file.fileName,
				message,
			})
		} else successfulFiles.push(file)
	}
	return { successfulFiles, failures }
}

function resourceRelativePath(rootPath: string, workspacePath: string): string | null {
	if (!workspacePath || !isSameOrDescendant(workspacePath, rootPath)) return null
	const relative = workspacePath.slice(rootPath.length).replace(/^\//, "")
	const firstSegment = relative.split("/")[0]
	if (!firstSegment || !CANVAS_RESOURCE_DIRS.has(firstSegment)) return null
	return relative
}

function buildResourceLookup(
	items: AttachmentItem[],
	rootPath: string,
	isComplete: boolean,
): ResourceLookup {
	const fileIdsByPath = new Map<string, Set<string>>()
	const directoryIdsByPath = new Map<string, Set<string>>()
	const workspaceFileIdsByPath = new Map<string, Set<string>>()
	const workspaceDirectoryIdsByPath = new Map<string, Set<string>>()
	for (const item of items) {
		const path = itemPath(item, items)
		if (!item.file_id || !path || !isAttachmentPathConsistent(item, items)) continue
		const id = String(item.file_id)
		const workspacePaths = item.is_directory
			? workspaceDirectoryIdsByPath
			: workspaceFileIdsByPath
		const workspaceIds = workspacePaths.get(path)
		if (workspaceIds) workspaceIds.add(id)
		else workspacePaths.set(path, new Set([id]))

		const relative = resourceRelativePath(rootPath, path)
		if (!relative) continue
		const pathIds = item.is_directory ? directoryIdsByPath : fileIdsByPath
		const ids = pathIds.get(relative)
		if (ids) ids.add(id)
		else pathIds.set(relative, new Set([id]))
	}
	const toUniquePaths = (paths: Map<string, Set<string>>) => {
		const unique = new Map<string, string>()
		for (const [relative, ids] of paths) {
			if (ids.size === 1) unique.set(relative, `./${relative}`)
		}
		return unique
	}
	const toUniqueWorkspacePaths = (paths: Map<string, Set<string>>) => {
		const unique = new Map<string, string>()
		for (const [workspacePath, ids] of paths) {
			if (ids.size === 1) unique.set(workspacePath, `/${workspacePath}`)
		}
		return unique
	}
	const collectAmbiguousBarePaths = (
		canvasPaths: Map<string, Set<string>>,
		workspacePaths: Map<string, Set<string>>,
	) => {
		const ambiguous = new Set<string>()
		for (const [workspacePath, ids] of workspacePaths) {
			if (ids.size > 1) ambiguous.add(workspacePath)
		}
		for (const [relative, canvasIds] of canvasPaths) {
			const workspaceIds = workspacePaths.get(relative)
			if (!workspaceIds) continue
			if (new Set([...canvasIds, ...workspaceIds]).size > 1) ambiguous.add(relative)
		}
		return ambiguous
	}
	return {
		isComplete,
		allFilePaths: new Set(fileIdsByPath.keys()),
		uniqueFilePaths: toUniquePaths(fileIdsByPath),
		allDirectoryPaths: new Set(directoryIdsByPath.keys()),
		uniqueDirectoryPaths: toUniquePaths(directoryIdsByPath),
		allWorkspaceFilePaths: new Set(workspaceFileIdsByPath.keys()),
		uniqueWorkspaceFilePaths: toUniqueWorkspacePaths(workspaceFileIdsByPath),
		allWorkspaceDirectoryPaths: new Set(workspaceDirectoryIdsByPath.keys()),
		uniqueWorkspaceDirectoryPaths: toUniqueWorkspacePaths(workspaceDirectoryIdsByPath),
		ambiguousBareFilePaths: collectAmbiguousBarePaths(fileIdsByPath, workspaceFileIdsByPath),
		ambiguousBareDirectoryPaths: collectAmbiguousBarePaths(
			directoryIdsByPath,
			workspaceDirectoryIdsByPath,
		),
	}
}

/**
 * Builds the same lookup directly from the session index. The legacy array
 * implementation resolves every parent with `items.find`, which becomes
 * quadratic when a large attachment tree omits explicit relative paths.
 */
function buildResourceLookupFromIndex(
	attachmentIndex: AttachmentIndex,
	rootPath: string,
	isComplete: boolean,
): ResourceLookup {
	const pathCache = new Map<string, string>()

	const getPath = (item: AttachmentItem): string => {
		const itemId = String(item.file_id || "")
		if (itemId && pathCache.has(itemId)) return pathCache.get(itemId) || ""
		const explicitPath = normalizePath(item.relative_file_path || item.path)
		const parent = itemId ? attachmentIndex.getParentItemById(itemId) : null
		// Preserve the legacy consistency guard without an O(n) parent lookup:
		// explicit paths are trusted only when they agree with the indexed parent.
		if (item.parent_id !== undefined && item.parent_id !== null && !parent) {
			if (itemId) pathCache.set(itemId, "")
			return ""
		}
		const parentPathValue = parent ? getPath(parent) : ""
		if (explicitPath) {
			if (parent && explicitPath !== `${parentPathValue}/${normalizePath(itemName(item))}`) {
				if (itemId) pathCache.set(itemId, "")
				return ""
			}
			if (itemId) pathCache.set(itemId, explicitPath)
			return explicitPath
		}
		const path = parentPathValue
			? `${parentPathValue}/${normalizePath(itemName(item))}`
			: normalizePath(itemName(item))
		if (itemId) pathCache.set(itemId, path)
		return path
	}

	const fileIdsByPath = new Map<string, Set<string>>()
	const directoryIdsByPath = new Map<string, Set<string>>()
	const workspaceFileIdsByPath = new Map<string, Set<string>>()
	const workspaceDirectoryIdsByPath = new Map<string, Set<string>>()
	for (const key of attachmentIndex.allKeys) {
		const item = attachmentIndex.getItemByKey(key)
		if (!item) continue
		if (!item.file_id) continue
		const path = getPath(item)
		if (!path) continue
		const id = String(item.file_id)
		const workspacePaths = item.is_directory
			? workspaceDirectoryIdsByPath
			: workspaceFileIdsByPath
		const workspaceIds = workspacePaths.get(path)
		if (workspaceIds) workspaceIds.add(id)
		else workspacePaths.set(path, new Set([id]))

		const relative = resourceRelativePath(rootPath, path)
		if (!relative) continue
		const pathIds = item.is_directory ? directoryIdsByPath : fileIdsByPath
		const ids = pathIds.get(relative)
		if (ids) ids.add(id)
		else pathIds.set(relative, new Set([id]))
	}

	const toUniquePaths = (paths: Map<string, Set<string>>) => {
		const unique = new Map<string, string>()
		for (const [relative, ids] of paths)
			if (ids.size === 1) unique.set(relative, `./${relative}`)
		return unique
	}
	const toUniqueWorkspacePaths = (paths: Map<string, Set<string>>) => {
		const unique = new Map<string, string>()
		for (const [workspacePath, ids] of paths)
			if (ids.size === 1) unique.set(workspacePath, `/${workspacePath}`)
		return unique
	}
	const collectAmbiguousBarePaths = (
		canvasPaths: Map<string, Set<string>>,
		workspacePaths: Map<string, Set<string>>,
	) => {
		const ambiguous = new Set<string>()
		for (const [workspacePath, ids] of workspacePaths)
			if (ids.size > 1) ambiguous.add(workspacePath)
		for (const [relative, canvasIds] of canvasPaths) {
			const workspaceIds = workspacePaths.get(relative)
			if (workspaceIds && new Set([...canvasIds, ...workspaceIds]).size > 1)
				ambiguous.add(relative)
		}
		return ambiguous
	}

	return {
		isComplete,
		allFilePaths: new Set(fileIdsByPath.keys()),
		uniqueFilePaths: toUniquePaths(fileIdsByPath),
		allDirectoryPaths: new Set(directoryIdsByPath.keys()),
		uniqueDirectoryPaths: toUniquePaths(directoryIdsByPath),
		allWorkspaceFilePaths: new Set(workspaceFileIdsByPath.keys()),
		uniqueWorkspaceFilePaths: toUniqueWorkspacePaths(workspaceFileIdsByPath),
		allWorkspaceDirectoryPaths: new Set(workspaceDirectoryIdsByPath.keys()),
		uniqueWorkspaceDirectoryPaths: toUniqueWorkspacePaths(workspaceDirectoryIdsByPath),
		ambiguousBareFilePaths: collectAmbiguousBarePaths(fileIdsByPath, workspaceFileIdsByPath),
		ambiguousBareDirectoryPaths: collectAmbiguousBarePaths(
			directoryIdsByPath,
			workspaceDirectoryIdsByPath,
		),
	}
}

function resolveCanvasRelativePath(
	value: string,
	rootPath: string,
	resourceLookup: ResourceLookup,
	issues: ResourcePathIssues,
	options?: { allowDirectory?: boolean },
): string {
	if (isRemoteOrSpecialPath(value)) return value
	const normalized = normalizePath(value)
	if (!normalized) return value
	const candidates = new Set<string>()
	const withoutCurrentDirectory = normalized
	const trimmed = value.trim().replace(/\\/g, "/")
	let explicitCanvasReference = trimmed.startsWith("./")
	const isBareResourceReference =
		!trimmed.startsWith("/") &&
		!trimmed.startsWith("./") &&
		(withoutCurrentDirectory.startsWith("images/") ||
			withoutCurrentDirectory.startsWith("videos/") ||
			withoutCurrentDirectory.startsWith("audios/") ||
			CANVAS_RESOURCE_DIRS.has(withoutCurrentDirectory))
	if (
		!trimmed.startsWith("/") &&
		(withoutCurrentDirectory.startsWith("images/") ||
			withoutCurrentDirectory.startsWith("videos/") ||
			withoutCurrentDirectory.startsWith("audios/"))
	)
		candidates.add(withoutCurrentDirectory)
	else if (!trimmed.startsWith("/") && CANVAS_RESOURCE_DIRS.has(withoutCurrentDirectory))
		candidates.add(withoutCurrentDirectory)
	const rootPrefix = `${rootPath}/`
	if (withoutCurrentDirectory.startsWith(rootPrefix)) {
		candidates.add(withoutCurrentDirectory.slice(rootPrefix.length))
		explicitCanvasReference = true
	}
	const suffixMarker = `/${rootPath}/`
	const suffixIndex = withoutCurrentDirectory.lastIndexOf(suffixMarker)
	if (suffixIndex >= 0) {
		candidates.add(withoutCurrentDirectory.slice(suffixIndex + suffixMarker.length))
		explicitCanvasReference = true
	}
	const ambiguousBarePaths = options?.allowDirectory
		? resourceLookup.ambiguousBareDirectoryPaths
		: resourceLookup.ambiguousBareFilePaths
	if (
		isBareResourceReference &&
		[...candidates].some((candidate) => ambiguousBarePaths.has(candidate))
	) {
		issues.ambiguousPaths.add(value)
		return value
	}
	if (
		!options?.allowDirectory &&
		[...candidates].some(
			(candidate) =>
				(resourceLookup.allDirectoryPaths.has(candidate) ||
					resourceLookup.allWorkspaceDirectoryPaths.has(candidate)) &&
				!resourceLookup.allFilePaths.has(candidate) &&
				!resourceLookup.allWorkspaceFilePaths.has(candidate),
		)
	)
		return value
	if (isBareResourceReference) {
		if (!resourceLookup.isComplete) {
			issues.unverifiedPaths.add(value)
			return value
		}
		for (const candidate of candidates) {
			const resolved =
				resourceLookup.uniqueFilePaths.get(candidate) ??
				(options?.allowDirectory
					? resourceLookup.uniqueDirectoryPaths.get(candidate)
					: undefined) ??
				resourceLookup.uniqueWorkspaceFilePaths.get(candidate) ??
				(options?.allowDirectory
					? resourceLookup.uniqueWorkspaceDirectoryPaths.get(candidate)
					: undefined)
			if (resolved) return resolved
		}
		issues.missingPaths.add(value)
		return value
	}
	for (const candidate of candidates) {
		const resolved =
			resourceLookup.uniqueFilePaths.get(candidate) ??
			(options?.allowDirectory
				? resourceLookup.uniqueDirectoryPaths.get(candidate)
				: undefined)
		if (resolved) return resolved
	}
	const allKnownPaths = (candidate: string) =>
		resourceLookup.allFilePaths.has(candidate) ||
		(options?.allowDirectory && resourceLookup.allDirectoryPaths.has(candidate))
	if (
		explicitCanvasReference &&
		[...candidates].some(
			(candidate) =>
				allKnownPaths(candidate) ||
				candidate.startsWith("images/") ||
				candidate.startsWith("videos/") ||
				candidate.startsWith("audios/"),
		) &&
		![...candidates].some(
			(candidate) =>
				resourceLookup.uniqueFilePaths.has(candidate) ||
				(options?.allowDirectory && resourceLookup.uniqueDirectoryPaths.has(candidate)),
		)
	)
		if (resourceLookup.isComplete) issues.missingPaths.add(value)
		else issues.unverifiedPaths.add(value)
	else if ([...candidates].some(allKnownPaths)) issues.ambiguousPaths.add(value)
	return value
}

function rewriteKnownPathFields(
	value: unknown,
	rootPath: string,
	resourceLookup: ResourceLookup,
	issues: ResourcePathIssues,
	allowArrayStrings = false,
): boolean {
	if (!value || typeof value !== "object") return false
	let changed = false
	if (Array.isArray(value)) {
		for (let index = 0; index < value.length; index += 1) {
			const entry = value[index]
			if (allowArrayStrings && typeof entry === "string") {
				const next = resolveCanvasRelativePath(entry, rootPath, resourceLookup, issues)
				if (next !== entry) {
					value[index] = next
					changed = true
				}
			} else if (rewriteKnownPathFields(entry, rootPath, resourceLookup, issues, false))
				changed = true
		}
		return changed
	}
	for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
		if (DIRECT_PATH_KEYS.has(key) && typeof raw === "string") {
			const next = resolveCanvasRelativePath(raw, rootPath, resourceLookup, issues, {
				allowDirectory: key === "file_dir",
			})
			if (next !== raw) {
				;(value as Record<string, unknown>)[key] = next
				changed = true
			}
			continue
		}
		if (PATH_ARRAY_KEYS.has(key) && Array.isArray(raw)) {
			if (rewriteKnownPathFields(raw, rootPath, resourceLookup, issues, true)) changed = true
			continue
		}
		if (key === "reference_image_options" && Array.isArray(raw)) {
			for (const option of raw) {
				if (!option || typeof option !== "object") continue
				const path = (option as Record<string, unknown>).path
				if (typeof path !== "string") continue
				const next = resolveCanvasRelativePath(path, rootPath, resourceLookup, issues)
				if (next !== path) {
					;(option as Record<string, unknown>).path = next
					changed = true
				}
			}
			continue
		}
		if (
			raw &&
			typeof raw === "object" &&
			rewriteKnownPathFields(raw, rootPath, resourceLookup, issues, false)
		)
			changed = true
	}
	return changed
}

function serializeConfig(config: Record<string, unknown>): string {
	return `window.magicProjectConfig = ${JSON.stringify(config, null, "\t")};`
}

function rewriteMainFile(
	content: string,
	project: CanvasProjectInfo,
	resourceLookup: ResourceLookup,
): {
	content: string
	changed: boolean
	version: string
	missingPaths: string[]
	ambiguousPaths: string[]
	unverifiedPaths: string[]
} {
	const config = parseMagicProjectConfigContent(content) as Record<string, unknown> | null
	if (!config || typeof config !== "object") throw new Error("invalid-project-config")
	const version = typeof config.version === "string" ? config.version : ""
	const canvas = config.canvas
	let canvasObject: Record<string, unknown>
	const compressed = isCompressedCanvas(canvas)
	if (
		(version === MAGIC_PROJECT_VERSION_V2 || version === MAGIC_PROJECT_VERSION_V3) &&
		compressed
	) {
		const decompressed = decompressCanvasData(canvas)
		if (!decompressed || typeof decompressed !== "object")
			throw new Error("invalid-canvas-data")
		canvasObject = decompressed as Record<string, unknown>
	} else if (
		(version === MAGIC_PROJECT_VERSION_V1 ||
			version === MAGIC_PROJECT_VERSION_V2 ||
			version === MAGIC_PROJECT_VERSION_V3) &&
		!compressed &&
		canvas &&
		typeof canvas === "object" &&
		!Array.isArray(canvas)
	) {
		canvasObject = canvas as Record<string, unknown>
	} else {
		throw new Error(
			version === MAGIC_PROJECT_VERSION_V1 || version === MAGIC_PROJECT_VERSION_V2
				? "invalid-canvas-data"
				: `unsupported-project-version: ${version || "missing"}`,
		)
	}
	const issues: ResourcePathIssues = {
		missingPaths: new Set<string>(),
		ambiguousPaths: new Set<string>(),
		unverifiedPaths: new Set<string>(),
	}
	let changed = false
	if (Array.isArray((canvasObject as { elements?: unknown }).elements)) {
		rewriteLayerElementsPathsForMagicProjectSave(
			(canvasObject as { elements: unknown[] }).elements as LayerElement[],
			project.rootPath,
			{
				rewritePath: (path: string) => {
					const next = resolveCanvasRelativePath(
						path,
						project.rootPath,
						resourceLookup,
						issues,
					)
					if (next !== path) changed = true
					return next
				},
			},
		)
	}
	changed =
		rewriteKnownPathFields(canvasObject, project.rootPath, resourceLookup, issues) || changed
	if (!changed)
		return {
			content,
			changed: false,
			version,
			missingPaths: [...issues.missingPaths],
			ambiguousPaths: [...issues.ambiguousPaths],
			unverifiedPaths: [...issues.unverifiedPaths],
		}
	config.canvas = compressed ? compressCanvasData(canvasObject) : canvasObject
	return {
		content: serializeConfig(config),
		changed: true,
		version,
		missingPaths: [...issues.missingPaths],
		ambiguousPaths: [...issues.ambiguousPaths],
		unverifiedPaths: [...issues.unverifiedPaths],
	}
}

function updateProjectName(
	content: string,
	newName: string,
): { content: string; changed: boolean } {
	const config = parseMagicProjectConfigContent(content) as Record<string, unknown> | null
	if (!config || typeof config !== "object") throw new Error("invalid-project-config")
	if (config.name === newName) return { content, changed: false }
	config.name = newName
	return { content: serializeConfig(config), changed: true }
}

function rewriteSidecar(
	content: string,
	rootPath: string,
	resourceLookup: ResourceLookup,
): {
	content: string
	changed: boolean
	missingPaths: string[]
	ambiguousPaths: string[]
	unverifiedPaths: string[]
} {
	const value = JSON.parse(content) as unknown
	if (!value || typeof value !== "object" || Array.isArray(value))
		throw new Error("invalid-sidecar")
	const issues: ResourcePathIssues = {
		missingPaths: new Set<string>(),
		ambiguousPaths: new Set<string>(),
		unverifiedPaths: new Set<string>(),
	}
	const changed = rewriteKnownPathFields(value, rootPath, resourceLookup, issues)
	return {
		content: changed ? JSON.stringify(value, null, 2) : content,
		changed,
		missingPaths: [...issues.missingPaths],
		ambiguousPaths: [...issues.ambiguousPaths],
		unverifiedPaths: [...issues.unverifiedPaths],
	}
}

function emptyPathRepairResult(): CanvasProjectPathRepairResult {
	return {
		affectedProjects: [],
		repairedFileIds: [],
		repairedFiles: [],
		failures: [],
		warnings: [],
		saveFailures: [],
		hasFailures: false,
		hasWarnings: false,
		hasSaveFailures: false,
		requiresConfirmation: false,
		pendingFileSaves: [],
	}
}

function addPathWarnings(
	warnings: CanvasProjectPathRepairFailure[],
	projectName: string,
	fileName: string,
	missingPaths: string[],
	ambiguousPaths: string[],
	unverifiedPaths: string[],
): void {
	if (missingPaths.length > 0)
		warnings.push({
			projectName,
			fileName,
			message: `missing resource paths: ${missingPaths.join(", ")}`,
		})
	if (ambiguousPaths.length > 0)
		warnings.push({
			projectName,
			fileName,
			message: `ambiguous resource paths: ${ambiguousPaths.join(", ")}`,
		})
	if (unverifiedPaths.length > 0)
		warnings.push({
			projectName,
			fileName,
			message: `unverified resource paths: ${unverifiedPaths.join(", ")}`,
		})
}

/**
 * 在画布根目录或其父级目录重命名/同项目移动前，生成受影响画布的路径修复计划。
 * 该流程只解析原始 v1/v2/v3 文件，不进入 Canvas runtime，也不触发版本升级。
 */
export async function planCanvasProjectsBeforeFileOperation(
	options: CanvasProjectPathRepairOptions,
): Promise<CanvasProjectPathRepairResult> {
	options.signal?.throwIfAborted()
	let projects: CanvasProjectInfo[] = []

	// Local-index fast path: resource moves inside a canvas (images / magic.project.js /
	// sidecars) must not materialize the full attachment list just to discover that no
	// project root is affected.
	if (options.attachmentIndex) {
		const indexedSelectedItems = resolveSelectedItemsWithIndex(options)
		if (indexedSelectedItems.length === 0) return emptyPathRepairResult()
		if (!selectedCanTriggerPathRepair(indexedSelectedItems, options.attachmentIndex))
			return emptyPathRepairResult()

		projects = collectAffectedProjectsWithIndex(
			indexedSelectedItems,
			options.attachmentIndex,
			options.projectId,
		)
		if (projects.length === 0) return emptyPathRepairResult()
	} else {
		const flatItems = resolveFlatAttachmentItems(options)
		const selectedItems = selectedOperationItems(options, flatItems)
		if (selectedItems.length === 0) {
			return emptyPathRepairResult()
		}
		projects = collectCanvasProjects(flatItems, options.projectId).filter((project) =>
			isAffectedProject(project, selectedItems, flatItems),
		)
		if (projects.length === 0) {
			return emptyPathRepairResult()
		}
	}

	const flatItems = options.attachmentIndex ? [] : resolveFlatAttachmentItems(options)

	const mainFileIds = projects.map((project) => String(project.mainFile.file_id))
	const mainContents = await getFileContentsByIds(mainFileIds, {
		responseType: "text",
		signal: options.signal,
	})
	options.signal?.throwIfAborted()

	const checkedProjects: ProjectCheckState[] = projects.map((project) => ({
		project,
		resourceLookup: options.attachmentIndex
			? buildResourceLookupFromIndex(
					options.attachmentIndex,
					project.rootPath,
					options.attachmentSnapshotComplete === true,
				)
			: buildResourceLookup(
					flatItems,
					project.rootPath,
					options.attachmentSnapshotComplete === true,
				),
		projectResult: {
			projectName: project.projectName,
			rootPath: project.rootPath,
			hasRepairablePaths: false,
			changedFileIds: [],
			changed: false,
		},
		projectFailures: [],
		projectSaves: [],
	}))
	const warnings: CanvasProjectPathRepairFailure[] = []
	const sidecarReads: Array<{ state: ProjectCheckState; sidecar: AttachmentItem }> = []

	for (const state of checkedProjects) {
		const { project, resourceLookup, projectFailures, projectSaves, projectResult } = state
		const mainFileId = String(project.mainFile.file_id)
		const mainContent = mainContents.successes.get(mainFileId)
		if (typeof mainContent !== "string" || !mainContent.trim()) {
			projectFailures.push({
				projectName: project.projectName,
				fileName: MAGIC_PROJECT_FILE_NAME,
				message: mainContents.failures.get(mainFileId)?.message ?? "empty-file-content",
			})
			continue
		}

		try {
			const rewritten = rewriteMainFile(mainContent, project, resourceLookup)
			addPathWarnings(
				warnings,
				project.projectName,
				MAGIC_PROJECT_FILE_NAME,
				rewritten.missingPaths,
				rewritten.ambiguousPaths,
				rewritten.unverifiedPaths,
			)
			projectResult.hasRepairablePaths = rewritten.changed
			if (rewritten.changed)
				projectSaves.push({
					fileId: mainFileId,
					fileName: MAGIC_PROJECT_FILE_NAME,
					content: rewritten.content,
					projectName: project.projectName,
					projectRootPath: project.rootPath,
				})

			if (
				rewritten.version === MAGIC_PROJECT_VERSION_V2 ||
				rewritten.version === MAGIC_PROJECT_VERSION_V3
			)
				for (const sidecar of project.sidecars) sidecarReads.push({ state, sidecar })
		} catch (error) {
			projectFailures.push({
				projectName: project.projectName,
				fileName: MAGIC_PROJECT_FILE_NAME,
				message: error instanceof Error ? error.message : String(error),
			})
		}
	}

	const sidecarContents = sidecarReads.length
		? await getFileContentsByIds(
				sidecarReads.map(({ sidecar }) => String(sidecar.file_id)),
				{ responseType: "text", signal: options.signal },
			)
		: {
				successes: new Map<string, string | ArrayBuffer | Blob>(),
				failures: new Map<string, Error>(),
			}
	options.signal?.throwIfAborted()
	for (const { state, sidecar } of sidecarReads) {
		const { project, resourceLookup, projectFailures, projectSaves, projectResult } = state
		const sidecarFileId = String(sidecar.file_id)
		const sidecarContent = sidecarContents.successes.get(sidecarFileId)
		if (typeof sidecarContent !== "string" || !sidecarContent.trim()) {
			projectFailures.push({
				projectName: project.projectName,
				fileName: itemName(sidecar),
				message:
					sidecarContents.failures.get(sidecarFileId)?.message ?? "empty-file-content",
			})
			continue
		}
		try {
			const rewrittenSidecar = rewriteSidecar(
				sidecarContent,
				project.rootPath,
				resourceLookup,
			)
			addPathWarnings(
				warnings,
				project.projectName,
				itemName(sidecar),
				rewrittenSidecar.missingPaths,
				rewrittenSidecar.ambiguousPaths,
				rewrittenSidecar.unverifiedPaths,
			)
			if (rewrittenSidecar.changed) projectResult.hasRepairablePaths = true
			if (rewrittenSidecar.changed)
				projectSaves.push({
					fileId: sidecarFileId,
					fileName: itemName(sidecar),
					content: rewrittenSidecar.content,
					projectName: project.projectName,
					projectRootPath: project.rootPath,
				})
		} catch (error) {
			projectFailures.push({
				projectName: project.projectName,
				fileName: itemName(sidecar),
				message: error instanceof Error ? error.message : String(error),
			})
		}
	}

	for (const state of checkedProjects) {
		const { projectResult, projectSaves } = state
		projectResult.changedFileIds.push(...projectSaves.map((save) => save.fileId))
		projectResult.changed = projectSaves.length > 0
	}

	const failures = checkedProjects.flatMap((checked) => checked.projectFailures)
	const pendingSaves = checkedProjects.flatMap((checked) => checked.projectSaves)
	const projectResults = checkedProjects.map((checked) => checked.projectResult)

	return {
		affectedProjects: projectResults,
		repairedFileIds: [],
		repairedFiles: [],
		failures,
		warnings,
		saveFailures: [],
		hasFailures: failures.length > 0,
		hasWarnings: warnings.length > 0,
		hasSaveFailures: false,
		requiresConfirmation: failures.length > 0,
		pendingFileSaves: pendingSaves,
	}
}

/**
 * @deprecated Use planCanvasProjectsBeforeFileOperation followed by
 * commitCanvasProjectPathRepair after the operation confirmation.
 */
export async function repairCanvasProjectsBeforeFileOperation(
	options: CanvasProjectPathRepairOptions,
): Promise<CanvasProjectPathRepairResult> {
	return commitCanvasProjectPathRepair(await planCanvasProjectsBeforeFileOperation(options))
}

export async function commitCanvasProjectPathRepair(
	plan: CanvasProjectPathRepairResult,
): Promise<CanvasProjectPathRepairResult> {
	const pendingSaves = plan.pendingFileSaves ?? []
	const saveResult = await persistPendingFileSaves(pendingSaves)
	const repairedFileIds = saveResult.successfulFiles.map((file) => file.fileId)
	const repairedFiles: CanvasProjectPathRepairResult["repairedFiles"] =
		saveResult.successfulFiles.map((file) => ({
			fileId: file.fileId,
			fileName: file.fileName,
			projectName: file.projectName,
		}))
	const successfulFileIds = new Set(repairedFileIds)
	const affectedProjects = plan.affectedProjects.map((project) => {
		const changedFileIds = project.changedFileIds.filter((id) => successfulFileIds.has(id))
		return {
			...project,
			changedFileIds,
			changed: changedFileIds.length > 0,
		}
	})
	return {
		...plan,
		affectedProjects,
		repairedFileIds,
		repairedFiles,
		failures: [...plan.failures, ...saveResult.failures],
		saveFailures: saveResult.failures,
		hasFailures: plan.hasFailures || saveResult.failures.length > 0,
		hasSaveFailures: saveResult.failures.length > 0,
		requiresConfirmation: plan.hasFailures || saveResult.failures.length > 0,
		pendingFileSaves: [],
	}
}

/**
 * 在画布根目录重命名成功后，同步 magic.project.js 中的画布名称。
 *
 * 该步骤必须发生在真正的目录 rename 成功之后；路径修复采用计划/提交两阶段流程，以保证取消或失败时
 * 不会提前持久化新的画布名称。
 */
export async function syncCanvasProjectNameAfterFileOperation(
	options: CanvasProjectNameSyncOptions,
): Promise<CanvasProjectNameSyncResult> {
	const flatItems = resolveFlatAttachmentItems(options)
	const selectedItems = selectedOperationItems(
		{
			attachments: options.attachments,
			flatAttachments: options.flatAttachments,
			attachmentIndex: options.attachmentIndex,
			fileIds: options.fileIds,
			items: options.items,
			operation: "rename",
			projectId: options.projectId,
		},
		flatItems,
	)
	const projects = collectCanvasProjects(flatItems, options.projectId).filter((project) =>
		selectedItems.some(
			(item) => item.is_directory && itemPath(item, flatItems) === project.rootPath,
		),
	)
	if (projects.length === 0) {
		return { syncedFileIds: [], failures: [], hasFailures: false }
	}

	const mainFileIds = projects.map((project) => String(project.mainFile.file_id))
	const mainContents = await getFileContentsByIds(mainFileIds, { responseType: "text" })
	const failures: CanvasProjectPathRepairFailure[] = []
	const pendingSaves: PendingFileSave[] = []
	for (const project of projects) {
		const fileId = String(project.mainFile.file_id)
		const content = mainContents.successes.get(fileId)
		if (typeof content !== "string" || !content.trim()) {
			failures.push({
				projectName: project.projectName,
				fileName: MAGIC_PROJECT_FILE_NAME,
				message: mainContents.failures.get(fileId)?.message ?? "empty-file-content",
			})
			continue
		}

		try {
			const named = updateProjectName(content, options.newName)
			if (named.changed)
				pendingSaves.push({
					fileId,
					fileName: MAGIC_PROJECT_FILE_NAME,
					content: named.content,
					projectName: project.projectName,
					projectRootPath: project.rootPath,
				})
		} catch (error) {
			failures.push({
				projectName: project.projectName,
				fileName: MAGIC_PROJECT_FILE_NAME,
				message: error instanceof Error ? error.message : String(error),
			})
		}
	}

	const saveResult = await persistPendingFileSaves(pendingSaves)
	failures.push(...saveResult.failures)
	return {
		syncedFileIds: saveResult.successfulFiles.map((file) => file.fileId),
		failures,
		hasFailures: failures.length > 0,
	}
}

export function formatCanvasPathRepairFailures(failures: CanvasProjectPathRepairFailure[]): string {
	return failures
		.map((failure) => `${failure.projectName} / ${failure.fileName}: ${failure.message}`)
		.join("\n")
}
