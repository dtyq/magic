import {
	AttachmentSource,
	type AttachmentItem,
} from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import {
	createAttachmentNodeComparator,
	flattenAttachmentTree,
} from "@/pages/superMagic/utils/projectAttachments/treeUtils"

export const DESIGN_PROJECT_OVERLAY_TTL_MS = 10 * 60 * 1000
export const DESIGN_PROJECT_MAX_REFRESH_ATTEMPTS = 3
export const DESIGN_PROJECT_CONFIG_FILE_NAME = "magic.project.js"

export type OptimisticDesignProjectStatus = "confirmed" | "ambiguous"

export interface OptimisticDesignProject {
	workspaceKind: string
	projectId: string
	folderId: string
	configFileId: string
	parentId: string
	folderName: string
	displayConfig: { type: "design"; name: string }
	status: OptimisticDesignProjectStatus
	generation: number
	createdAt: number
	refreshAttempts: number
	serverFolderConfirmed: boolean
	serverConfigFileConfirmed: boolean
}

export interface OptimisticDesignProjectRegistration {
	workspaceKind: string
	projectId: string
	folderId: string
	configFileId: string
	parentId?: string | number | null
	folderName: string
	status: OptimisticDesignProjectStatus
	generation?: number
	createdAt?: number
}

function normalizeId(value: unknown) {
	return value === undefined || value === null ? "" : String(value)
}

function isRootParent(value: unknown) {
	const normalized = normalizeId(value)
	return normalized === "" || normalized === "0" || normalized === "918559425666367489"
}

function getName(item: AttachmentItem) {
	return item.file_name || item.filename || item.display_filename || item.name || ""
}

function getFileId(item: AttachmentItem) {
	return normalizeId(item.file_id)
}

function findById(items: AttachmentItem[], fileId: string): AttachmentItem | undefined {
	for (const item of items) {
		if (getFileId(item) === fileId) return item
		if (item.children?.length) {
			const found = findById(item.children, fileId)
			if (found) return found
		}
	}
	return undefined
}

function sortSiblings(items: AttachmentItem[]) {
	return [...items].sort(createAttachmentNodeComparator())
}

function dedupeSiblingsByFileId(items: AttachmentItem[]) {
	const seen = new Set<string>()
	return items.filter((item) => {
		const fileId = getFileId(item)
		if (!fileId) return true
		if (seen.has(fileId)) return false
		seen.add(fileId)
		return true
	})
}

function createConfigFile(entry: OptimisticDesignProject, folderPath?: string): AttachmentItem {
	return {
		file_id: entry.configFileId,
		file_name: DESIGN_PROJECT_CONFIG_FILE_NAME,
		filename: DESIGN_PROJECT_CONFIG_FILE_NAME,
		display_filename: DESIGN_PROJECT_CONFIG_FILE_NAME,
		name: DESIGN_PROJECT_CONFIG_FILE_NAME,
		parent_id: entry.folderId,
		type: "file",
		is_directory: false,
		source: AttachmentSource.PROJECT_DIRECTORY,
		relative_file_path: folderPath
			? `${folderPath.replace(/\/$/, "")}/${DESIGN_PROJECT_CONFIG_FILE_NAME}`
			: undefined,
	}
}

function createFolder(
	entry: OptimisticDesignProject,
	relativePath = entry.folderName,
): AttachmentItem {
	return {
		file_id: entry.folderId,
		file_name: entry.folderName,
		filename: entry.folderName,
		display_filename: entry.folderName,
		name: entry.folderName,
		parent_id: entry.parentId || "",
		type: "directory",
		is_directory: true,
		display_config: entry.displayConfig,
		children: [createConfigFile(entry, relativePath)],
		relative_file_path: relativePath,
	}
}

function insertUnderParent(
	items: AttachmentItem[],
	parentId: string,
	entry: OptimisticDesignProject,
): { items: AttachmentItem[]; inserted: boolean } {
	let inserted = false
	const next = items.map((item) => {
		if (getFileId(item) === parentId && item.type !== "file" && item.is_directory !== false) {
			inserted = true
			const parentPath = item.relative_file_path || getName(item)
			const folderPath = parentPath
				? `${parentPath.replace(/\/$/, "")}/${entry.folderName}`
				: entry.folderName
			return {
				...item,
				children: sortSiblings([createFolder(entry, folderPath), ...(item.children || [])]),
			}
		}
		if (!item.children?.length) return item
		const nested = insertUnderParent(item.children, parentId, entry)
		if (!nested.inserted) return item
		inserted = true
		return { ...item, children: nested.items }
	})
	return { items: next, inserted }
}

function mergeFolder(item: AttachmentItem, entry: OptimisticDesignProject): AttachmentItem {
	if (item.type === "file" || item.is_directory === false) return item
	const originalChildren = item.children || []
	const children = dedupeSiblingsByFileId(originalChildren)
	const configFile = children.find((child) => getFileId(child) === entry.configFileId)
	const folderName = getName(item) || entry.folderName
	const hasAuthoritativeDisplayConfig = Boolean(
		item.display_config?.type &&
		(item.display_config.type !== "design" || entry.serverFolderConfirmed),
	)
	const needsDisplayConfig =
		!hasAuthoritativeDisplayConfig &&
		(!item.display_config?.type || item.display_config.name !== folderName)
	const childrenChanged = children.length !== originalChildren.length
	if (configFile && !needsDisplayConfig && !childrenChanged) return item
	const nextChildren = configFile
		? children
		: sortSiblings([createConfigFile(entry, item.relative_file_path), ...children])
	return {
		...item,
		display_config: hasAuthoritativeDisplayConfig
			? item.display_config
			: {
					...entry.displayConfig,
					...item.display_config,
					type: "design",
					name: folderName,
				},
		children: nextChildren,
	}
}

function mergeEntry(
	tree: AttachmentItem[],
	entry: OptimisticDesignProject,
): { tree: AttachmentItem[]; changed: boolean } {
	const folder = findById(tree, entry.folderId)
	if (!folder) {
		if (!isRootParent(entry.parentId)) {
			const inserted = insertUnderParent(tree, entry.parentId, entry)
			return { tree: inserted.items, changed: inserted.inserted }
		}
		return { tree: sortSiblings([createFolder(entry), ...tree]), changed: true }
	}

	const visit = (items: AttachmentItem[]): { items: AttachmentItem[]; changed: boolean } => {
		let changed = false
		const nextItems = items.map((item) => {
			if (getFileId(item) === entry.folderId) {
				const nextFolder = mergeFolder(item, entry)
				changed = nextFolder !== item
				return nextFolder
			}
			if (!item.children?.length) return item
			const children = visit(item.children)
			if (!children.changed) return item
			changed = true
			return { ...item, children: children.items }
		})
		return { items: nextItems, changed }
	}
	const visited = visit(tree)
	return { tree: visited.items, changed: visited.changed }
}

export function createOptimisticDesignProject(
	registration: OptimisticDesignProjectRegistration,
): OptimisticDesignProject {
	const folderName = registration.folderName.trim()
	return {
		workspaceKind: registration.workspaceKind,
		projectId: String(registration.projectId),
		folderId: String(registration.folderId),
		configFileId: String(registration.configFileId),
		parentId: normalizeId(registration.parentId),
		folderName,
		displayConfig: { type: "design", name: folderName },
		status: registration.status,
		generation: registration.generation ?? 0,
		createdAt: registration.createdAt ?? Date.now(),
		refreshAttempts: 0,
		serverFolderConfirmed: false,
		serverConfigFileConfirmed: false,
	}
}

export function applyOptimisticDesignProjects(
	tree: AttachmentItem[],
	entries: Iterable<OptimisticDesignProject>,
	now = Date.now(),
) {
	let nextTree = tree
	let changed = false
	for (const entry of entries) {
		if (now - entry.createdAt > DESIGN_PROJECT_OVERLAY_TTL_MS) continue
		if (entry.status !== "confirmed") continue
		const merged = mergeEntry(nextTree, entry)
		nextTree = merged.tree
		changed = changed || merged.changed
	}
	if (!changed) return { tree, list: undefined, changed: false }
	return {
		tree: nextTree,
		list: flattenAttachmentTree(nextTree),
		changed: true,
	}
}

export function reconcileOptimisticDesignProjectSnapshot(
	entry: OptimisticDesignProject,
	tree: AttachmentItem[],
	now = Date.now(),
) {
	if (now - entry.createdAt > DESIGN_PROJECT_OVERLAY_TTL_MS) return "expired" as const
	const folder = findById(tree, entry.folderId)
	if (folder && (folder.type === "file" || folder.is_directory === false)) {
		return "conflict" as const
	}
	const configFile = folder?.children?.find((child) => getFileId(child) === entry.configFileId)
	if (folder?.display_config?.type && folder.display_config.type !== "design") {
		return "conflict" as const
	}
	if (entry.status === "ambiguous") {
		if (folder?.display_config?.type === "design" && configFile) return "confirmed" as const
		return "pending" as const
	}
	if (folder?.display_config?.type === "design" && configFile) {
		return "server-confirmed" as const
	}
	return "pending" as const
}

export function getAttachmentById(items: AttachmentItem[], fileId: string) {
	return findById(items, fileId)
}

export function normalizeOptimisticAttachmentId(value: unknown) {
	return normalizeId(value)
}
