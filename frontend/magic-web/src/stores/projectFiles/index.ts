import type { FileHelpContext } from "@/pages/superMagic/components/TopicFilesButton/utils/magic-system-folder"
import { getFilePresentationIndex } from "@/pages/superMagic/components/TopicFilesButton/utils/file-presentation"
import { makeAutoObservable, observable } from "mobx"
import { WorkspaceFolder } from "./types"
import type { AttachmentLoadState, AttachmentLoadStatus } from "./types"
import { ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"
import { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import { createFileTreePerfScope } from "@/pages/superMagic/utils/fileTreePerf"
import {
	applyProjectAttachmentsChangesToTree,
	type ApplyProjectAttachmentsChangesResult,
} from "@/pages/superMagic/utils/projectAttachments/changeReducer"
import {
	projectAttachmentsChangeLog,
	type ProjectAttachmentsChangeTraceContext,
} from "@/pages/superMagic/utils/projectAttachments/changeLogReporter"
import type { SuperMagicFileChangeItem } from "@/types/chat/intermediate_message"
import { clearAttachmentIndexSessionCache } from "@/pages/superMagic/components/TopicFilesButton/utils/attachmentIndexSessionCache"
import {
	applyOptimisticDesignProjects,
	createOptimisticDesignProject,
	DESIGN_PROJECT_MAX_REFRESH_ATTEMPTS,
	getAttachmentById,
	normalizeOptimisticAttachmentId,
	reconcileOptimisticDesignProjectSnapshot,
	type OptimisticDesignProject,
	type OptimisticDesignProjectRegistration,
} from "./optimisticDesignProjects"

type ProjectAttachmentsApplySource =
	| "ws_realtime"
	| "refresh_parent_ids"
	| "refresh_parent_merged"
	| "refresh_parent_children"
	| "unknown"

interface SetWorkspaceFileTreeOptions {
	list?: AttachmentItem[]
	source?: string
	/** False when tree is derived from the current UI projection rather than a server snapshot. */
	authoritative?: boolean
}

export class ProjectFilesStore {
	constructor(readonly workspaceKind: "project" | "crew" | "claw" = "project") {
		makeAutoObservable(
			this,
			{
				workspaceFileTree: observable.ref,
				workspaceFilesList: observable.ref,
				currentSelectedProject: observable.ref,
				attachmentLoadState: observable.ref,
			},
			{ autoBind: true },
		)
	}

	workspaceFileTree: AttachmentItem[] = []
	workspaceFilesList: AttachmentItem[] = []
	currentSelectedProject: ProjectListItem | null = null
	attachmentLoadState: AttachmentLoadState | undefined = undefined
	private optimisticDesignProjects = new Map<string, OptimisticDesignProject>()
	private optimisticDesignProjectGeneration = 0

	get filePresentationContext(): FileHelpContext {
		return this.currentSelectedProject?.id
			? { kind: this.workspaceKind, projectId: String(this.currentSelectedProject.id) }
			: { kind: "unknown" }
	}

	get filePresentationIndex() {
		return getFilePresentationIndex(this.workspaceFileTree)
	}

	isSameProject(project1: ProjectListItem | null, project2: ProjectListItem | null) {
		return project1?.id === project2?.id
	}

	setSelectedProject(selectedProject: ProjectListItem | null) {
		if (!selectedProject || !this.isSameProject(this.currentSelectedProject, selectedProject)) {
			this.optimisticDesignProjects.clear()
			this.optimisticDesignProjectGeneration = 0
			this.workspaceFileTree = []
			this.workspaceFilesList = []
			this.attachmentLoadState = selectedProject
				? { projectId: selectedProject.id, status: "idle" }
				: undefined
			clearAttachmentIndexSessionCache()
		}
		this.currentSelectedProject = selectedProject
	}

	private getOptimisticDesignProjectKey(projectId: string, folderId: string) {
		return `${this.workspaceKind}:${String(projectId)}:${String(folderId)}`
	}

	registerCreatedDesignProject(
		registration: Omit<OptimisticDesignProjectRegistration, "workspaceKind">,
	) {
		const projectId = String(registration.projectId)
		const folderId = String(registration.folderId)
		if (!projectId || !folderId || !registration.configFileId) return
		if (this.currentSelectedProject?.id && String(this.currentSelectedProject.id) !== projectId)
			return
		const entry = createOptimisticDesignProject({
			...registration,
			workspaceKind: this.workspaceKind,
			projectId,
			folderId,
			generation: ++this.optimisticDesignProjectGeneration,
		})
		this.optimisticDesignProjects.set(
			this.getOptimisticDesignProjectKey(projectId, folderId),
			entry,
		)
		this.setWorkspaceFileTree(this.workspaceFileTree, {
			list: this.workspaceFilesList,
			source: "optimistic-design",
		})
	}

	clearCreatedDesignProject(fileId: string) {
		const normalizedFileId = normalizeOptimisticAttachmentId(fileId)
		const invalidatedFolderIds = new Set<string>()
		for (const [key, entry] of this.optimisticDesignProjects) {
			if (entry.folderId === normalizedFileId || entry.configFileId === normalizedFileId) {
				invalidatedFolderIds.add(entry.folderId)
				this.optimisticDesignProjects.delete(key)
			}
		}
		if (invalidatedFolderIds.size === 0) return

		this.workspaceFileTree = this.stripOptimisticDesignDisplayConfig(
			this.workspaceFileTree,
			invalidatedFolderIds,
		)
		this.workspaceFilesList = this.excludeHiddenItems(
			this.flattenWorkspaceFileTree(this.workspaceFileTree),
		)
		clearAttachmentIndexSessionCache()
	}

	private stripOptimisticDesignDisplayConfig(
		items: AttachmentItem[],
		folderIds: ReadonlySet<string>,
	): AttachmentItem[] {
		let changed = false
		const nextItems = items.map((item) => {
			let nextItem = item
			if (
				folderIds.has(normalizeOptimisticAttachmentId(item.file_id)) &&
				item.display_config?.type === "design"
			) {
				const displayConfig = { ...item.display_config }
				delete displayConfig.type
				nextItem = {
					...item,
					display_config:
						Object.keys(displayConfig).length > 0 ? displayConfig : undefined,
				}
				changed = true
			}
			if (!nextItem.children?.length) return nextItem
			const nextChildren = this.stripOptimisticDesignDisplayConfig(
				nextItem.children,
				folderIds,
			)
			if (nextChildren === nextItem.children) return nextItem
			changed = true
			return { ...nextItem, children: nextChildren }
		})
		return changed ? nextItems : items
	}

	private reconcileOptimisticDesignProjectChanges(changes: SuperMagicFileChangeItem[]) {
		for (const change of changes) {
			const changedId = normalizeOptimisticAttachmentId(
				change.file_id || change.file?.file_id,
			)
			if (!changedId) continue
			if (change.operation === "delete") {
				this.clearCreatedDesignProject(changedId)
				continue
			}

			const incoming = change.file as AttachmentItem | undefined
			if (!incoming) continue
			for (const [key, entry] of this.optimisticDesignProjects) {
				if (entry.folderId === changedId) {
					if (
						incoming.type === "file" ||
						incoming.is_directory === false ||
						(incoming.display_config?.type && incoming.display_config.type !== "design")
					) {
						this.clearCreatedDesignProject(entry.folderId)
						continue
					}
					entry.parentId = normalizeOptimisticAttachmentId(incoming.parent_id)
					entry.folderName =
						incoming.file_name ||
						incoming.name ||
						incoming.display_filename ||
						entry.folderName
					entry.displayConfig = {
						type: "design",
						name: entry.folderName,
					}
					if (incoming.display_config?.type === "design") {
						entry.serverFolderConfirmed = true
					}
				}
				if (entry.configFileId === changedId) {
					if (normalizeOptimisticAttachmentId(incoming.parent_id) !== entry.folderId) {
						this.clearCreatedDesignProject(entry.configFileId)
						continue
					}
					entry.serverConfigFileConfirmed = true
				}
				if (entry.serverFolderConfirmed && entry.serverConfigFileConfirmed) {
					this.optimisticDesignProjects.delete(key)
				}
			}
		}
	}

	private reconcileOptimisticDesignProjectSnapshots(
		tree: AttachmentItem[],
		authoritative: boolean,
		countRefreshAttempt: boolean,
	) {
		const now = Date.now()
		for (const [key, entry] of this.optimisticDesignProjects) {
			const folder = getAttachmentById(tree, entry.folderId)
			if (folder) {
				entry.parentId = normalizeOptimisticAttachmentId(folder.parent_id)
				entry.folderName =
					folder.file_name || folder.name || folder.display_filename || entry.folderName
				entry.displayConfig = { type: "design", name: entry.folderName }
			}
			if (!authoritative) continue
			if (folder?.display_config?.type === "design") {
				entry.serverFolderConfirmed = true
			}
			if (
				folder?.children?.some(
					(child) =>
						normalizeOptimisticAttachmentId(child.file_id) === entry.configFileId,
				)
			) {
				entry.serverConfigFileConfirmed = true
			}
			const state = reconcileOptimisticDesignProjectSnapshot(entry, tree, now)
			if (state === "expired" || state === "conflict" || state === "server-confirmed") {
				this.optimisticDesignProjects.delete(key)
				continue
			}
			if (entry.status === "ambiguous" && state === "confirmed") {
				// The raw server snapshot already contains both authoritative nodes.
				this.optimisticDesignProjects.delete(key)
				continue
			}
			if (countRefreshAttempt) {
				entry.refreshAttempts += 1
				if (entry.refreshAttempts >= DESIGN_PROJECT_MAX_REFRESH_ATTEMPTS) {
					this.optimisticDesignProjects.delete(key)
				}
			}
		}
	}

	private shouldCountOptimisticDesignRefresh(source: string) {
		if (source === "optimistic-design") return false
		if (source.includes(".batch.")) return source.endsWith(".final")
		return ![
			"ws_realtime",
			"refresh_parent_ids",
			"refresh_parent_merged",
			"refresh_parent_children",
			"parent_children_refresh",
		].includes(source)
	}

	private applyOptimisticDesignOverlay(tree: AttachmentItem[], list?: AttachmentItem[]) {
		const overlay = applyOptimisticDesignProjects(tree, this.optimisticDesignProjects.values())
		if (!overlay.changed) {
			return { tree, list: list ?? this.flattenWorkspaceFileTree(tree) }
		}
		return {
			tree: overlay.tree,
			list: overlay.list || this.flattenWorkspaceFileTree(overlay.tree),
		}
	}

	// 分批快照仍可能缺文件；只有当前项目的完整请求成功，才允许据此判断文件缺失。
	setAttachmentLoadStatus(projectId: string, status: AttachmentLoadStatus) {
		if (this.currentSelectedProject?.id !== projectId) return
		if (this.attachmentLoadState?.status === status) return
		this.attachmentLoadState = { projectId, status }
	}

	hasFolder(fileId: string) {
		return this.workspaceFilesList.some(
			(file) => file.type === "directory" && file.file_id === fileId,
		)
	}

	/**
	 * Get filenames in a specific folder path
	 * @param folderPath - The folder path prefix to filter files
	 * @returns Array of filenames in the specified folder
	 */
	getFileNamesInFolder(folderPath: string): string[] {
		return this.workspaceFilesList
			.filter((item) => {
				// Filter out folders, keep only files
				if (item.type !== "file") return false

				// Check if file is in the specified folder path
				return item.file_key.startsWith(folderPath)
			})
			.map((file) => {
				// Extract filename from file_key (get the last part after the last slash)
				const lastSlashIndex = file.file_key.lastIndexOf("/")
				return lastSlashIndex !== -1
					? file.file_key.slice(lastSlashIndex + 1)
					: file.file_key
			})
	}

	/**
	 * Get filenames by parent ID
	 * @param parentId - The parent directory ID (undefined for root)
	 * @returns Array of filenames in the specified parent directory
	 */
	getFileNamesByParentId(parentId?: string): string[] {
		return this.workspaceFilesList
			.filter((item) => {
				// Filter out folders, keep only files
				if (item.type !== "file") return false

				// Check if file is in the specified parent directory
				// Handle both undefined parentId (root) and string parentId
				return item.parent_id === parentId
			})
			.map((file) => file.file_name as string)
	}

	/**
	 * Get folder data
	 * @param parent_id - Folder ID
	 * @returns Folder data
	 */
	getFolderData(parent_id: string | number | undefined): WorkspaceFolder | undefined {
		return this.workspaceFilesList.find(
			(item) => item.type === "directory" && item.file_id === parent_id,
		) as WorkspaceFolder | undefined
	}

	setWorkspaceFileTree(tree: AttachmentItem[], options: SetWorkspaceFileTreeOptions = {}) {
		const source = options.source || "unknown"
		const authoritative = options.authoritative ?? source !== "optimistic-design"
		this.reconcileOptimisticDesignProjectSnapshots(
			tree,
			authoritative,
			authoritative && this.shouldCountOptimisticDesignRefresh(source),
		)
		const overlaid = this.applyOptimisticDesignOverlay(tree, options.list)
		tree = overlaid.tree
		if (overlaid.list) options = { ...options, list: overlaid.list }
		const perf = createFileTreePerfScope(tree)
		const commitStartedAt = perf.start()
		const hasReusableList = Array.isArray(options.list)
		const workspaceFilesList = hasReusableList
			? this.createWorkspaceFilesListFromReusableList(tree, options.list || [], perf, source)
			: perf.measure(
					"store_flatten_ms",
					() => this.flattenWorkspaceFileTree(tree),
					(result) => ({
						flattened_count: result.length,
						list_reused: false,
						source,
					}),
				)

		this.workspaceFileTree = this.excludeHiddenItems(tree)
		this.workspaceFilesList = this.excludeHiddenItems(workspaceFilesList)
		clearAttachmentIndexSessionCache()
		perf.recordDuration("store_commit_ms", commitStartedAt, {
			workspace_file_tree_count: this.workspaceFileTree.length,
			workspace_files_list_count: this.workspaceFilesList.length,
			list_reused: hasReusableList,
			source,
		})
		perf.snapshotHeap("after_setWorkspaceFileTree")
	}

	private createWorkspaceFilesListFromReusableList(
		tree: AttachmentItem[],
		list: AttachmentItem[],
		perf: ReturnType<typeof createFileTreePerfScope>,
		source: string,
	) {
		const treeItemByFileId = perf.measure(
			"store_tree_id_index_ms",
			() => this.indexWorkspaceFileTreeByFileId(tree),
			(result) => ({
				tree_id_index_count: result.size,
				provided_list_count: list.length,
				list_reused: true,
				source,
			}),
		)

		return perf.measure(
			"store_list_reuse_ms",
			() => this.reuseWorkspaceFilesList(list, treeItemByFileId),
			(result) => ({
				reused_list_count: result.length,
				provided_list_count: list.length,
				list_reused: true,
				source,
			}),
		)
	}

	private indexWorkspaceFileTreeByFileId(tree: AttachmentItem[]) {
		const itemByFileId = new Map<string, AttachmentItem>()
		const stack = [...tree].reverse()

		while (stack.length > 0) {
			const item = stack.pop()
			if (!item) continue

			if (item.file_id !== undefined && item.file_id !== null) {
				itemByFileId.set(String(item.file_id), item)
			}

			if (item.children?.length) {
				for (let index = item.children.length - 1; index >= 0; index -= 1) {
					stack.push(item.children[index])
				}
			}
		}

		return itemByFileId
	}

	private reuseWorkspaceFilesList(
		list: AttachmentItem[],
		treeItemByFileId: ReadonlyMap<string, AttachmentItem>,
	) {
		return list.map((item) => {
			const fileId = item.file_id
			if (fileId === undefined || fileId === null) return item
			return treeItemByFileId.get(String(fileId)) || item
		})
	}

	applyFileChanges(
		changes: SuperMagicFileChangeItem[],
		options: {
			locale?: string
			trace?: ProjectAttachmentsChangeTraceContext
			applySource?: ProjectAttachmentsApplySource
		} = {},
	): ApplyProjectAttachmentsChangesResult {
		this.reconcileOptimisticDesignProjectChanges(changes)
		const applySource = options.applySource || "unknown"
		const perf = createFileTreePerfScope(this.workspaceFileTree)
		const commitStartedAt = perf.start()
		projectAttachmentsChangeLog.storeApplyStart({
			trace: options.trace,
			changeCount: changes.length,
			beforeTreeCount: this.workspaceFileTree.length,
			beforeListCount: this.workspaceFilesList.length,
		})
		let result = perf.measure(
			"store_apply_file_changes_ms",
			() =>
				applyProjectAttachmentsChangesToTree(this.workspaceFileTree, changes, {
					locale: options.locale,
				}),
			() => ({
				apply_source: applySource,
				trace_id: options.trace?.traceId,
				project_id: options.trace?.projectId,
				change_count: changes.length,
			}),
		)

		if (!result.fallbackRequired) {
			// result.tree starts from the already-overlaid UI tree. Only explicit change
			// payloads above may prove server confirmation; never infer it from this tree.
			const overlaid = this.applyOptimisticDesignOverlay(result.tree, result.list)
			this.workspaceFileTree = overlaid.tree
			this.workspaceFilesList = overlaid.list || result.list
			result = { ...result, tree: this.workspaceFileTree, list: this.workspaceFilesList }
			clearAttachmentIndexSessionCache()
		}

		perf.recordDuration("store_apply_file_changes_commit_ms", commitStartedAt, {
			apply_source: applySource,
			trace_id: options.trace?.traceId,
			project_id: options.trace?.projectId,
			change_count: changes.length,
			applied_count: result.appliedCount,
			skipped_count: result.skippedCount,
			fallback_required: result.fallbackRequired,
			fallback_reason: result.fallbackReason || "",
			operation_add_count: result.operationCounts.add,
			operation_delete_count: result.operationCounts.delete,
			operation_update_count: result.operationCounts.update,
			operation_unknown_count: result.operationCounts.unknown,
		})
		projectAttachmentsChangeLog.storeApplyFinish({
			trace: options.trace,
			changeCount: changes.length,
			result,
			afterTreeCount: this.workspaceFileTree.length,
			afterListCount: this.workspaceFilesList.length,
		})

		return result
	}

	addWorkspaceFile(file: AttachmentItem) {
		// Skip if file is hidden
		if (file.is_hidden) return

		const normalizedFile: AttachmentItem = {
			...file,
			type: file.type ?? (file.is_directory ? "directory" : "file"),
		}
		const fileId = normalizedFile.file_id

		if (fileId !== undefined && fileId !== null) {
			const normalizedFileId = String(fileId)
			const hasExistingFile = this.workspaceFilesList.some(
				(item) => String(item.file_id) === normalizedFileId,
			)
			if (hasExistingFile) {
				this.workspaceFilesList = this.workspaceFilesList.map((item) =>
					String(item.file_id) === normalizedFileId
						? this.mergeWorkspaceFile(item, normalizedFile)
						: item,
				)
				this.workspaceFileTree = this.updateFileInTree(
					this.workspaceFileTree,
					normalizedFile,
				)
				return
			}
		}

		this.workspaceFilesList = [...this.workspaceFilesList, normalizedFile]

		// Add to tree
		if (normalizedFile.parent_id) {
			this.workspaceFileTree = this.insertFileIntoTree(
				this.workspaceFileTree,
				normalizedFile.parent_id,
				normalizedFile,
			)
		} else {
			// Add to root level
			this.workspaceFileTree = [...this.workspaceFileTree, normalizedFile]
		}
	}

	private mergeWorkspaceFile(existing: AttachmentItem, incoming: AttachmentItem): AttachmentItem {
		return {
			...existing,
			...incoming,
			children: incoming.children ?? existing.children,
		}
	}

	private updateFileInTree(tree: AttachmentItem[], file: AttachmentItem): AttachmentItem[] {
		const fileId = file.file_id
		if (fileId === undefined || fileId === null) return tree
		const normalizedFileId = String(fileId)

		let updated = false
		const nextTree = tree.map((node) => {
			if (String(node.file_id) === normalizedFileId) {
				updated = true
				return this.mergeWorkspaceFile(node, file)
			}

			if (!node.children?.length) return node

			const nextChildren = this.updateFileInTree(node.children, file)
			if (nextChildren === node.children) return node

			updated = true
			return {
				...node,
				children: nextChildren,
			}
		})

		return updated ? nextTree : tree
	}

	/**
	 * Insert a node without mutating the existing tree. This keeps observable.ref updates visible.
	 */
	private insertFileIntoTree(
		tree: AttachmentItem[],
		parentId: string,
		file: AttachmentItem,
	): AttachmentItem[] {
		let inserted = false

		const nextTree = tree.map((node) => {
			if (node.file_id === parentId) {
				inserted = true
				return {
					...node,
					children: [...(node.children || []), file],
				}
			}

			if (!node.children?.length) return node

			const nextChildren = this.insertFileIntoTree(node.children, parentId, file)
			if (nextChildren === node.children) return node

			inserted = true
			return {
				...node,
				children: nextChildren,
			}
		})

		return inserted ? nextTree : tree
	}

	flattenWorkspaceFileTree(tree: AttachmentItem[]) {
		const flattenedTree: AttachmentItem[] = []
		const stack = [...tree].reverse()

		while (stack.length > 0) {
			const item = stack.pop()
			if (!item) continue

			flattenedTree.push(item)

			if (item.children?.length) {
				for (let index = item.children.length - 1; index >= 0; index -= 1) {
					stack.push(item.children[index])
				}
			}
		}

		return flattenedTree
	}

	excludeHiddenItems(items: AttachmentItem[]): AttachmentItem[] {
		return items.filter((item) => !item.is_hidden)
	}

	hasProjectFile(fileId: string) {
		const matches = this.workspaceFilesList.filter((file) => file.file_id === fileId)
		const hasMatch = matches.some((file) => file.type === "file")
		return hasMatch
	}
}

const projectFilesStore = new ProjectFilesStore()

export const createProjectFilesStore = () => {
	return new ProjectFilesStore()
}

export default projectFilesStore
