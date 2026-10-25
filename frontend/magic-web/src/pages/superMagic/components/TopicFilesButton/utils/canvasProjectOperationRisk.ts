import type { AttachmentItem } from "../hooks/types"
import {
	ELEMENT_DETAILS_FILENAME,
	ELEMENT_DETAILS_USER_FILENAME,
} from "../../Detail/contents/Design/utils/elementDetailsStore"
import type { AttachmentIndex } from "./attachmentIndex"

export type CanvasProjectOperationType = "delete" | "move" | "rename"

export type CanvasProjectOperationRiskType = "project-entry" | "sidecar" | "canvas-resource"
export type CanvasProjectOperationImpact = "open-failure" | "content-loss" | "mixed"

export interface CanvasProjectOperationRisk {
	shouldWarn: boolean
	riskTypes: CanvasProjectOperationRiskType[]
	affectedProjectNames: string[]
}

export interface DetectCanvasProjectOperationRiskOptions {
	attachments: AttachmentItem[]
	attachmentIndex?: AttachmentIndex
	fileIds?: string[]
	items?: AttachmentItem[]
	operation: CanvasProjectOperationType
}

const MAGIC_PROJECT_FILE_NAME = "magic.project.js"
const ELEMENT_DETAILS_FILE_NAMES = new Set([
	ELEMENT_DETAILS_FILENAME,
	ELEMENT_DETAILS_USER_FILENAME,
])
const CANVAS_RESOURCE_DIRS = new Set(["images", "videos", "audios"])
const EMPTY_RISK: CanvasProjectOperationRisk = {
	shouldWarn: false,
	riskTypes: [],
	affectedProjectNames: [],
}

interface CanvasProjectInfo {
	rootPath: string
	projectName: string
}

function normalizePath(value: unknown): string {
	if (typeof value !== "string") return ""
	return value
		.replace(/\\/g, "/")
		.replace(/^\.?\//, "")
		.replace(/^\/+|\/+$/g, "")
}

function normalizeFileId(value: unknown): string {
	if (typeof value === "string") return value
	if (typeof value === "number") return String(value)
	return ""
}

function getItemName(item: AttachmentItem | null | undefined): string {
	return item?.file_name || item?.filename || item?.display_filename || item?.name || ""
}

function getItemPath(item: AttachmentItem | null | undefined): string {
	const path = normalizePath(item?.relative_file_path)
	if (path) return path
	return normalizePath(getItemName(item))
}

function getParentPath(item: AttachmentItem | null | undefined): string {
	const path = getItemPath(item)
	if (!path) return ""
	const index = path.lastIndexOf("/")
	return index >= 0 ? path.slice(0, index) : ""
}

function flattenAttachments(items: AttachmentItem[] | undefined): AttachmentItem[] {
	const result: AttachmentItem[] = []
	const walk = (list: AttachmentItem[] | undefined) => {
		for (const item of list || []) {
			result.push(item)
			if (item.children?.length) walk(item.children)
		}
	}
	walk(items)
	return result
}

function isSameOrDescendantPath(path: string, ancestorPath: string): boolean {
	if (!path || !ancestorPath) return false
	return path === ancestorPath || path.startsWith(`${ancestorPath}/`)
}

function isSameOrAncestorPath(path: string, descendantPath: string): boolean {
	if (!path || !descendantPath) return false
	return path === descendantPath || descendantPath.startsWith(`${path}/`)
}

function findItemById(fileItems: AttachmentItem[], fileId: string): AttachmentItem | undefined {
	return fileItems.find((item) => normalizeFileId(item.file_id) === fileId)
}

function findItemByLookupKey(
	fileItems: AttachmentItem[],
	lookupKey: string,
): AttachmentItem | undefined {
	const normalizedId = normalizeFileId(lookupKey)
	const normalizedPath = normalizePath(lookupKey)

	return fileItems.find((item) => {
		if (normalizeFileId(item.file_id) === normalizedId) return true
		if (normalizedPath && normalizePath(item.relative_file_path) === normalizedPath) return true
		if (normalizedPath && normalizePath(item.path) === normalizedPath) return true

		const fallbackKey = `${normalizeFileId(item.parent_id) || "root"}:${getItemName(item) || "attachment"}`
		return fallbackKey === normalizedId
	})
}

function getParentItem(fileItems: AttachmentItem[], item: AttachmentItem): AttachmentItem | null {
	const parentId = normalizeFileId(item.parent_id)
	if (parentId) return findItemById(fileItems, parentId) ?? null

	const parentPath = getParentPath(item)
	if (!parentPath) return null
	return (
		fileItems.find(
			(candidate) => candidate.is_directory && getItemPath(candidate) === parentPath,
		) ?? null
	)
}

function isDesignRoot(item: AttachmentItem, fileItems: AttachmentItem[]): boolean {
	if (!item.is_directory) return false
	if (item.display_config?.type === "design") return true

	const itemId = normalizeFileId(item.file_id)
	const itemPath = getItemPath(item)
	return fileItems.some((candidate) => {
		if (candidate.is_directory || getItemName(candidate) !== MAGIC_PROJECT_FILE_NAME)
			return false
		const parentId = normalizeFileId(candidate.parent_id)
		if (itemId && parentId === itemId) return true
		return getParentPath(candidate) === itemPath
	})
}

function collectCanvasProjects(fileItems: AttachmentItem[]): CanvasProjectInfo[] {
	const projects = new Map<string, CanvasProjectInfo>()

	for (const item of fileItems) {
		if (item.is_directory || getItemName(item) !== MAGIC_PROJECT_FILE_NAME) continue

		const parent = getParentItem(fileItems, item)
		const rootPath = getParentPath(item)
		if (!rootPath) continue

		const rootId = normalizeFileId(parent?.file_id) || rootPath
		projects.set(rootId, {
			rootPath,
			projectName: getItemName(parent) || rootPath.split("/").pop() || rootPath,
		})
	}

	for (const item of fileItems) {
		if (!isDesignRoot(item, fileItems)) continue
		const rootPath = getItemPath(item)
		if (!rootPath) continue
		const rootId = normalizeFileId(item.file_id) || rootPath
		if (projects.has(rootId)) continue

		const mainFile = fileItems.find(
			(candidate) =>
				!candidate.is_directory &&
				getItemName(candidate) === MAGIC_PROJECT_FILE_NAME &&
				getParentPath(candidate) === rootPath,
		)
		if (!mainFile) continue

		projects.set(rootId, {
			rootPath,
			projectName: getItemName(item) || rootPath.split("/").pop() || rootPath,
		})
	}

	return Array.from(projects.values())
}

function selectedIncludesWholeProject(selectedItems: AttachmentItem[], project: CanvasProjectInfo) {
	return selectedItems.some((item) => {
		const path = getItemPath(item)
		return item.is_directory && isSameOrAncestorPath(path, project.rootPath)
	})
}

function getRelativePathInProject(item: AttachmentItem, project: CanvasProjectInfo): string {
	const itemPath = getItemPath(item)
	if (itemPath === project.rootPath) return ""
	if (!itemPath.startsWith(`${project.rootPath}/`)) return ""
	return itemPath.slice(project.rootPath.length + 1)
}

function isProjectEntryFile(item: AttachmentItem, project: CanvasProjectInfo): boolean {
	return (
		!item.is_directory && getItemPath(item) === `${project.rootPath}/${MAGIC_PROJECT_FILE_NAME}`
	)
}

function isProjectSidecarFile(item: AttachmentItem, project: CanvasProjectInfo): boolean {
	return (
		!item.is_directory &&
		getParentPath(item) === project.rootPath &&
		ELEMENT_DETAILS_FILE_NAMES.has(getItemName(item))
	)
}

function isCanvasResourcePath(relativePath: string): boolean {
	const firstSegment = relativePath.split("/")[0]
	return CANVAS_RESOURCE_DIRS.has(firstSegment)
}

function directoryHasMagicProject(
	directory: AttachmentItem,
	attachmentIndex: AttachmentIndex,
): boolean {
	const directoryId = normalizeFileId(directory.file_id)
	if (directoryId) {
		return attachmentIndex
			.getChildKeysById(directoryId)
			.some(
				(key) =>
					getItemName(attachmentIndex.getItemByKey(key)).toLowerCase() ===
					MAGIC_PROJECT_FILE_NAME.toLowerCase(),
			)
	}

	const directoryPath = getItemPath(directory)
	if (!directoryPath) return false
	return attachmentIndex
		.getChildKeysByKey(directoryPath)
		.some(
			(key) =>
				getItemName(attachmentIndex.getItemByKey(key)).toLowerCase() ===
				MAGIC_PROJECT_FILE_NAME.toLowerCase(),
		)
}

function getItemLineage(item: AttachmentItem, attachmentIndex: AttachmentIndex): AttachmentItem[] {
	const itemId = normalizeFileId(item.file_id)
	if (itemId) {
		const ancestors = attachmentIndex.getParentItemsById(itemId)
		const indexedItem = attachmentIndex.getItemById(itemId)
		return [...ancestors, indexedItem || item]
	}

	const itemPath = getItemPath(item)
	if (!itemPath) return [item]
	const entry = attachmentIndex.getEntryByKey(itemPath)
	if (!entry) return [item]
	return [...attachmentIndex.getParentItemsByKey(entry.key), entry.item]
}

function toCanvasProjectInfo(root: AttachmentItem): CanvasProjectInfo | null {
	const rootPath = getItemPath(root)
	if (!rootPath) return null
	return {
		rootPath,
		projectName: getItemName(root) || rootPath.split("/").pop() || rootPath,
	}
}

/**
 * Resolve the owning canvas project from the selected node only — parent chain +
 * direct children of the candidate root. Never walks the full attachment index.
 */
function resolveCanvasProjectAroundItem(
	item: AttachmentItem,
	attachmentIndex: AttachmentIndex,
): CanvasProjectInfo | null {
	const lineage = getItemLineage(item, attachmentIndex)
	const name = getItemName(item)
	const nameLower = name.toLowerCase()

	if (!item.is_directory) {
		const parent = lineage.length >= 2 ? lineage[lineage.length - 2] : null
		const isEntryOrSidecar =
			nameLower === MAGIC_PROJECT_FILE_NAME.toLowerCase() ||
			ELEMENT_DETAILS_FILE_NAMES.has(name)
		if (
			parent?.is_directory &&
			isEntryOrSidecar &&
			directoryHasMagicProject(parent, attachmentIndex)
		)
			return toCanvasProjectInfo(parent)
	}

	const resourceDirIndex = lineage.findIndex(
		(entry) => entry.is_directory && CANVAS_RESOURCE_DIRS.has(getItemName(entry).toLowerCase()),
	)
	if (resourceDirIndex > 0) {
		const canvasRoot = lineage[resourceDirIndex - 1]
		if (directoryHasMagicProject(canvasRoot, attachmentIndex))
			return toCanvasProjectInfo(canvasRoot)
	}

	if (item.is_directory && directoryHasMagicProject(item, attachmentIndex))
		return toCanvasProjectInfo(item)

	return null
}

function resolveSelectedItems({
	attachments,
	attachmentIndex,
	fileIds,
	items,
}: Pick<
	DetectCanvasProjectOperationRiskOptions,
	"attachments" | "attachmentIndex" | "fileIds" | "items"
>): AttachmentItem[] {
	const selectedFromItems = items || []
	if (!fileIds?.length) return selectedFromItems as AttachmentItem[]

	if (attachmentIndex) {
		return [
			...selectedFromItems,
			...fileIds
				.map(
					(fileId) =>
						attachmentIndex.getItemById(fileId) || attachmentIndex.getItemByKey(fileId),
				)
				.filter((item): item is AttachmentItem => Boolean(item)),
		]
	}

	const fileItems = flattenAttachments(attachments)
	return [
		...selectedFromItems,
		...fileIds
			.map((fileId) => findItemByLookupKey(fileItems, fileId))
			.filter((item): item is AttachmentItem => Boolean(item)),
	]
}

function detectRiskForSelectedItems(
	selectedItems: AttachmentItem[],
	projects: CanvasProjectInfo[],
): CanvasProjectOperationRisk {
	if (selectedItems.length === 0 || projects.length === 0) return EMPTY_RISK

	const riskTypes = new Set<CanvasProjectOperationRiskType>()
	const affectedProjectNames = new Set<string>()

	for (const project of projects) {
		if (selectedIncludesWholeProject(selectedItems, project)) continue

		for (const item of selectedItems) {
			const itemPath = getItemPath(item)
			if (!isSameOrDescendantPath(itemPath, project.rootPath)) continue

			if (isProjectEntryFile(item, project)) {
				riskTypes.add("project-entry")
				affectedProjectNames.add(project.projectName)
				continue
			}

			if (isProjectSidecarFile(item, project)) {
				riskTypes.add("sidecar")
				affectedProjectNames.add(project.projectName)
				continue
			}

			const relativePath = getRelativePathInProject(item, project)
			if (!relativePath) continue

			if (isCanvasResourcePath(relativePath)) {
				riskTypes.add("canvas-resource")
				affectedProjectNames.add(project.projectName)
			}
		}
	}

	return {
		shouldWarn: riskTypes.size > 0,
		riskTypes: Array.from(riskTypes),
		affectedProjectNames: Array.from(affectedProjectNames),
	}
}

function detectRiskWithAttachmentIndex(
	selectedItems: AttachmentItem[],
	attachmentIndex: AttachmentIndex,
): CanvasProjectOperationRisk {
	if (selectedItems.length === 0) return EMPTY_RISK

	const projectsByRoot = new Map<string, CanvasProjectInfo>()
	for (const item of selectedItems) {
		const project = resolveCanvasProjectAroundItem(item, attachmentIndex)
		if (!project) continue
		projectsByRoot.set(project.rootPath, project)
	}

	return detectRiskForSelectedItems(selectedItems, Array.from(projectsByRoot.values()))
}

function isCanvasManagedItem(candidate: AttachmentItem, attachmentIndex: AttachmentIndex): boolean {
	if (candidate.is_directory && candidate.display_config?.type === "design") return true

	const name = getItemName(candidate)
	const nameLower = name.toLowerCase()
	if (nameLower === MAGIC_PROJECT_FILE_NAME.toLowerCase()) return true
	if (ELEMENT_DETAILS_FILE_NAMES.has(name)) return true

	const lineage = getItemLineage(candidate, attachmentIndex)
	const resourceDirIndex = lineage.findIndex(
		(entry) => entry.is_directory && CANVAS_RESOURCE_DIRS.has(getItemName(entry).toLowerCase()),
	)
	if (resourceDirIndex <= 0) return Boolean(candidate.display_config?.type)

	const canvasRoot = lineage[resourceDirIndex - 1]
	if (canvasRoot.display_config?.type === "design") return true
	return directoryHasMagicProject(canvasRoot, attachmentIndex)
}

export function canSkipCanvasProjectOperationRiskForMove(
	fileIds: string[],
	attachmentIndex?: AttachmentIndex,
): boolean {
	if (!fileIds.length) return true
	// Without an index we cannot inspect a directory subtree safely. Keep the
	// conservative behaviour and run the full guard in that case.
	if (!attachmentIndex) return false

	return fileIds.every((fileId) => {
		const item = attachmentIndex.getItemById(fileId) || attachmentIndex.getItemByKey(fileId)
		if (!item) return false

		// Folder moves used to always enter the O(n) canvas preflight. Inspect only
		// the selected subtree instead; ordinary folders can take the same fast path
		// as ordinary files, while folders containing canvas-managed files remain
		// protected.
		const descendantKeys = item.is_directory
			? (() => {
					const byId = attachmentIndex.getDescendantKeysById(fileId)
					return byId.length > 0 ? byId : attachmentIndex.getDescendantKeysByKey(fileId)
				})()
			: []
		const itemsToCheck = item.is_directory
			? [
					item,
					...descendantKeys
						.map((key) => attachmentIndex.getItemByKey(key))
						.filter((child): child is AttachmentItem => Boolean(child)),
				]
			: [item]

		return itemsToCheck.every((candidate) => !isCanvasManagedItem(candidate, attachmentIndex))
	})
}

export async function detectCanvasProjectOperationRisk({
	attachments,
	attachmentIndex,
	fileIds,
	items,
}: DetectCanvasProjectOperationRiskOptions): Promise<CanvasProjectOperationRisk> {
	const selectedItems = resolveSelectedItems({
		attachments,
		attachmentIndex,
		fileIds,
		items,
	})

	if (selectedItems.length === 0) return EMPTY_RISK

	// Prefer local parent-chain lookups whenever the index is available. The previous
	// `entriesById.values()` materialization forced an O(n) walk of every attachment.
	if (attachmentIndex) return detectRiskWithAttachmentIndex(selectedItems, attachmentIndex)

	const fileItems = flattenAttachments(attachments)
	return detectRiskForSelectedItems(selectedItems, collectCanvasProjects(fileItems))
}

export function hasCanvasProjectInAttachments(attachments: AttachmentItem[]): boolean {
	const fileItems = flattenAttachments(attachments)
	return collectCanvasProjects(fileItems).length > 0
}

export function getCanvasProjectOperationImpact(
	risk: CanvasProjectOperationRisk,
): CanvasProjectOperationImpact | null {
	if (!risk.shouldWarn || risk.riskTypes.length === 0) return null

	const impacts = new Set<Exclude<CanvasProjectOperationImpact, "mixed">>()
	for (const type of risk.riskTypes) {
		if (type === "project-entry") {
			impacts.add("open-failure")
			continue
		}
		impacts.add("content-loss")
	}

	if (impacts.size > 1) return "mixed"
	return impacts.values().next().value ?? null
}
