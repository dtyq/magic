import {
	computed,
	makeAutoObservable,
	observable,
	reaction,
	runInAction,
	type IComputedValue,
} from "mobx"
import type { MagicFSFile } from "@/apis"
import { SuperMagicApi } from "@/apis"
import { MAGIC_FS_TREE_DEPTH } from "@/apis/modules/magicFS"
import {
	getFileReferenceIdentityKey,
	invalidateFileReferenceCache,
} from "@/pages/superMagic/services/userFileReferenceResolver"
import {
	toUserAttachment,
	userSpaceFileService,
} from "@/pages/superMagic/components/UserSpace/services/userSpaceFileService"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import { compareMagicFolderPriority } from "@/pages/superMagic/utils/projectAttachments/treeUtils"

export interface UserDirectorySnapshot {
	ids: string[]
	loaded: boolean
	loading: boolean
	error: unknown | null
}

interface DirectoryRequest {
	controller: AbortController
	version: number
	promise: Promise<MagicFSFile[]>
}

interface ProjectNamesRequest {
	controller: AbortController
	promise: Promise<void>
}

export interface UserFileChangeInput {
	operation: "add" | "delete" | "update" | string
	file_id: string
	file?: {
		file_id?: string
		parent_id?: string | number | null
		[key: string]: unknown
	}
}

const EMPTY_ATTACHMENTS: AttachmentItem[] = []
const ROOT_QUERY = "root"
const EMPTY_DIRECTORY: UserDirectorySnapshot = {
	ids: [],
	loaded: false,
	loading: false,
	error: null,
}

/** 实体按 ID 共享，目录只保存直接子节点；切换项目不重载整个用户空间。 */
export class UserFilesStore {
	identityKey: string | null = null
	rootId: string | null = null
	changeVersion = 0
	mutationVersion = 0
	editingFileIds = observable.set<string>()
	private fileGuards = new Map<string, { path: string; check: () => Promise<boolean> }>()
	files = observable.map<string, MagicFSFile>(undefined, { deep: false })
	directories = observable.map<string, UserDirectorySnapshot>(undefined, { deep: false })
	expandedKeys = observable.map<string, string[]>(undefined, { deep: false })
	projectNames = observable.map<string, string>()
	private loadedProjectNames = new Set<string>()
	private namesRequests = new Map<string, ProjectNamesRequest>()
	private loadedTrees = new Set<string>()
	private treeRequests = new Map<string, DirectoryRequest>()
	private attachmentViews = new Map<string, IComputedValue<AttachmentItem>>()
	private requests = new Map<string, DirectoryRequest>()
	private requestVersion = 0
	private uploadCancellations = new Map<string, () => Promise<void>>()

	constructor() {
		makeAutoObservable<
			this,
			| "attachmentViews"
			| "requests"
			| "requestVersion"
			| "uploadCancellations"
			| "fileGuards"
			| "loadedTrees"
			| "treeRequests"
			| "loadedProjectNames"
			| "namesRequests"
		>(
			this,
			{
				attachmentViews: false,
				files: false,
				directories: false,
				expandedKeys: false,
				getAttachment: false,
				getTree: false,
				requests: false,
				requestVersion: false,
				uploadCancellations: false,
				fileGuards: false,
				editingFileIds: false,
				projectNames: false,
				loadedProjectNames: false,
				namesRequests: false,
				loadedTrees: false,
				treeRequests: false,
			},
			{ autoBind: true },
		)
		reaction(getFileReferenceIdentityKey, this.activateIdentity, { fireImmediately: true })
	}

	get currentIdentityKey(): string | null {
		return getFileReferenceIdentityKey()
	}

	getDirectory(parentId?: string): UserDirectorySnapshot {
		if (this.identityKey !== this.currentIdentityKey) return EMPTY_DIRECTORY
		return this.directories.get(parentId ?? ROOT_QUERY) ?? EMPTY_DIRECTORY
	}

	getChildren(parentId?: string): MagicFSFile[] {
		return this.getDirectory(parentId).ids.flatMap((id) => {
			const file = this.files.get(id)
			return file ? [file] : []
		})
	}

	/** 只派生已加载节点；子节点变化沿父链更新，未变化的节点继续复用。 */
	getAttachment = (id: string): AttachmentItem => {
		let view = this.attachmentViews.get(id)
		if (!view) {
			view = computed((): AttachmentItem => {
				const file = this.files.get(id)
				if (!file) throw new Error("User file is unavailable")
				const path = this.getPath(id)
					.map((node) => node.name)
					.join("/")
				const item = toUserAttachment(file, path)
				if (!file.is_directory) return item
				const directory = this.getDirectory(id)
				return {
					...item,
					directoryLoadState: directory.loading
						? "loading"
						: directory.error
							? "error"
							: directory.loaded
								? "loaded"
								: "unloaded",
					children: directory.ids
						.filter((child) => this.files.has(child))
						.map((child) => this.getAttachment(child))
						.sort(compareMagicFolderPriority),
				}
			})
			this.attachmentViews.set(id, view)
		}
		return view.get()
	}

	getTree = (parentId: string): AttachmentItem[] =>
		this.files.has(parentId)
			? (this.getAttachment(parentId).children ?? EMPTY_ATTACHMENTS)
			: EMPTY_ATTACHMENTS

	setExpandedKeys(rootId: string, keys: string[]): void {
		this.expandedKeys.set(rootId, keys)
	}

	/** 首次激活读取整个范围；后续展开复用目录缓存，只有深度边界继续请求。 */
	async loadTree(rootId: string, force = false): Promise<MagicFSFile[]> {
		const identity = this.currentIdentityKey
		this.activateIdentity(identity)
		if (!identity) throw new DOMException("User space is unavailable", "AbortError")
		const previous = this.treeRequests.get(rootId)
		if (previous && !force) return previous.promise
		if (!force && this.loadedTrees.has(rootId)) return this.getChildren(rootId)
		previous?.controller.abort()
		const controller = new AbortController()
		const version = ++this.requestVersion
		const mutationVersion = this.mutationVersion
		const isCurrent = () =>
			identity === this.currentIdentityKey &&
			this.treeRequests.get(rootId)?.version === version &&
			this.mutationVersion === mutationVersion
		this.directories.set(rootId, { ...this.getDirectory(rootId), loading: true, error: null })
		const promise = userSpaceFileService
			.readTree(rootId, controller.signal)
			.then((tree) => {
				if (!isCurrent()) throw new DOMException("Tree request cancelled", "AbortError")
				runInAction(() => {
					const pending = [{ file: tree, depth: 0 }]
					while (pending.length) {
						const entry = pending.pop()
						if (!entry) break
						const { children, ...file } = entry.file
						this.files.set(file.id, file)
						if (!file.is_directory || entry.depth >= MAGIC_FS_TREE_DEPTH) continue
						// 树快照覆盖该目录时取消更早的直接子节点请求，避免旧响应反向覆盖。
						this.requests.get(file.id)?.controller.abort()
						this.requests.delete(file.id)
						this.directories.set(file.id, {
							ids: (children ?? []).map((child) => child.id),
							loaded: true,
							loading: false,
							error: null,
						})
						this.loadedTrees.add(file.id)
						for (const child of children ?? [])
							pending.push({ file: child, depth: entry.depth + 1 })
					}
					this.changeVersion += 1
				})
				return this.getChildren(rootId)
			})
			.catch((error: unknown) => {
				const latest = this.treeRequests.get(rootId)
				if (identity === this.currentIdentityKey && latest && latest.version !== version)
					return latest.promise
				if (isCurrent())
					runInAction(() => {
						this.directories.set(rootId, {
							...this.getDirectory(rootId),
							loading: false,
							error: controller.signal.aborted ? null : error,
						})
					})
				throw error
			})
			.finally(() => {
				if (this.treeRequests.get(rootId)?.version === version)
					this.treeRequests.delete(rootId)
			})
		this.treeRequests.set(rootId, { controller, version, promise })
		return promise
	}

	/** 仅由已展开的其他项目分组调用；缺失名称也缓存，重复折叠不反复查询。 */
	async loadProjectNames(projectIds: string[], force = false): Promise<void> {
		const identity = this.currentIdentityKey
		this.activateIdentity(identity)
		if (!identity) throw new DOMException("User space is unavailable", "AbortError")
		const ids = [...new Set(projectIds)].sort()
		if (!ids.length || (!force && ids.every((id) => this.loadedProjectNames.has(id)))) return
		const key = ids.join(",")
		const previous = this.namesRequests.get(key)
		if (!force && previous) return previous.promise
		previous?.controller.abort()
		const controller = new AbortController()
		const promise = SuperMagicApi.getProjectNames(ids, controller.signal)
			.then(({ names }) => {
				if (
					identity !== this.currentIdentityKey ||
					this.namesRequests.get(key)?.controller !== controller
				)
					throw new DOMException("Project names request cancelled", "AbortError")
				runInAction(() => {
					for (const id of ids) {
						this.loadedProjectNames.add(id)
						if (names[id]) this.projectNames.set(id, names[id])
						else this.projectNames.delete(id)
					}
				})
			})
			.catch((error: unknown) => {
				const latest = this.namesRequests.get(key)
				if (
					identity === this.currentIdentityKey &&
					latest &&
					latest.controller !== controller
				)
					return latest.promise
				throw error
			})
			.finally(() => {
				if (this.namesRequests.get(key)?.controller === controller)
					this.namesRequests.delete(key)
			})
		this.namesRequests.set(key, { controller, promise })
		return promise
	}

	async loadDirectory(parentId?: string, force = false): Promise<MagicFSFile[]> {
		const identity = this.currentIdentityKey
		this.activateIdentity(identity)
		if (!identity) throw new DOMException("User space is unavailable", "AbortError")
		const key = parentId ?? ROOT_QUERY
		const previous = this.requests.get(key)
		if (previous && !force) return previous.promise
		if (!force && this.getDirectory(parentId).loaded) return this.getChildren(parentId)
		previous?.controller.abort()
		const controller = new AbortController()
		const version = ++this.requestVersion
		this.directories.set(key, { ...this.getDirectory(parentId), loading: true, error: null })
		const isCurrent = () =>
			identity === this.currentIdentityKey && this.requests.get(key)?.version === version
		const promise = userSpaceFileService
			.listDirectory(parentId, controller.signal)
			.then((files) => {
				if (!isCurrent())
					throw new DOMException("Directory request cancelled", "AbortError")
				runInAction(() => {
					this.cacheDirectory(parentId, files, identity)
					if (!parentId) this.rootId = files.find((file) => file.is_directory)?.id ?? null
				})
				return files
			})
			.catch((error: unknown) => {
				// 两个视图同时刷新同一目录时，旧调用等待替代它的新请求，避免误报加载失败。
				if (identity === this.currentIdentityKey && controller.signal.aborted) {
					const latest = this.requests.get(key)
					if (latest && latest.version !== version) return latest.promise
					const directory = this.getDirectory(parentId)
					if (directory.loaded && !directory.loading && !directory.error)
						return this.getChildren(parentId)
				}
				if (isCurrent())
					runInAction(() => {
						this.directories.set(key, {
							...this.getDirectory(parentId),
							loading: false,
							error: controller.signal.aborted ? null : error,
						})
					})
				throw error
			})
			.finally(() => {
				if (isCurrent()) this.requests.delete(key)
			})
		this.requests.set(key, { controller, version, promise })
		return promise
	}

	cacheDirectory(
		parentId: string | undefined,
		files: MagicFSFile[],
		identity: string | null,
	): void {
		if (identity !== this.currentIdentityKey || identity !== this.identityKey) return
		files.forEach((file) => this.files.set(file.id, file))
		this.directories.set(parentId ?? ROOT_QUERY, {
			ids: files.map((file) => file.id),
			loaded: true,
			loading: false,
			error: null,
		})
		this.changeVersion += 1
	}

	/**
	 * Apply the safe part of a user-space event and return directories that need
	 * an authoritative MagicFS read. User events currently carry the legacy task
	 * file DTO, so additions/updates are deliberately rehydrated instead of
	 * guessing missing MagicFS version fields.
	 */
	applyUserFileChanges(
		changes: readonly UserFileChangeInput[],
		refreshParentIds: readonly string[] = [],
	): { refreshParentIds: string[]; changed: boolean } {
		const parents = new Set(refreshParentIds.map(String).filter((id) => id && id !== "0"))
		let changed = false
		runInAction(() => {
			for (const change of changes) {
				const fileId = String(change.file_id || change.file?.file_id || "")
				if (!fileId) continue
				const parentId = change.file?.parent_id
				if (parentId !== undefined && parentId !== null && String(parentId) !== "0")
					parents.add(String(parentId))
				if (change.operation !== "delete") continue
				changed = this.files.delete(fileId) || changed
				this.directories.delete(fileId)
				for (const [directoryId, directory] of this.directories) {
					if (!directory.ids.includes(fileId)) continue
					this.directories.set(directoryId, {
						...directory,
						ids: directory.ids.filter((id) => id !== fileId),
					})
					changed = true
				}
				this.attachmentViews.delete(fileId)
			}
			if (changed) this.changeVersion += 1
		})
		return { refreshParentIds: [...parents], changed }
	}

	/** 只补齐所选子树；任何子目录读取或父子关系校验失败都不返回半棵树。 */
	async loadSubtrees(selected: AttachmentItem[]): Promise<AttachmentItem[]> {
		const identity = this.currentIdentityKey
		const trees: AttachmentItem[] = []
		const selectedIds = new Set(selected.map((item) => item.file_id))
		const roots = selected.filter(
			(item) =>
				item.file_id &&
				!this.getPath(item.file_id)
					.slice(0, -1)
					.some((parent) => selectedIds.has(parent.id)),
		)
		const uniqueRoots = [...new Map(roots.map((item) => [item.file_id, item])).values()]
		const discovered = new Set(uniqueRoots.map((item) => item.file_id))
		const pending = uniqueRoots.map((item) => ({ item, target: trees }))
		for (let cursor = 0; cursor < pending.length; cursor += 1) {
			if (!identity || identity !== this.currentIdentityKey)
				throw new DOMException("Identity changed", "AbortError")
			const entry = pending[cursor]
			if (!entry?.item.file_id) throw new Error("File identity is missing")
			const { item, target } = entry
			const node: AttachmentItem = { ...item }
			target.push(node)
			if (!node.is_directory) continue
			const files = await this.loadDirectory(item.file_id, true)
			if (identity !== this.currentIdentityKey)
				throw new DOMException("Identity changed", "AbortError")
			node.children = []
			for (const file of files) {
				if (file.parent_id !== item.file_id || discovered.has(file.id))
					throw new Error("Directory contents changed; reload before continuing")
				discovered.add(file.id)
				const path = this.getPath(file.id)
					.map((part) => part.name)
					.join("/")
				if (!path) throw new Error("File parent chain is incomplete")
				pending.push({ item: toUserAttachment(file, path), target: node.children })
			}
		}
		return trees
	}

	async getRoot(): Promise<MagicFSFile> {
		const roots = await this.loadDirectory()
		const root = roots.find((file) => file.is_directory)
		if (!root) throw new Error("User root is unavailable")
		return root
	}

	/** 只查询目标路径的各级目录；缺失返回 null，请求失败继续抛出。 */
	async findPath(segments: readonly string[]): Promise<MagicFSFile | null> {
		const identity = this.currentIdentityKey
		let current = await this.getRoot()
		for (const segment of segments) {
			const children = await this.loadDirectory(current.id)
			if (identity !== this.currentIdentityKey)
				throw new DOMException("Identity changed", "AbortError")
			const child = children.find((file) => file.name === segment)
			if (!child) return null
			current = child
		}
		return current
	}

	/** 仅在用户确认新建或上传后调用；并发同名时重新读取，不重试创建操作。 */
	async ensureDirectory(segments: readonly string[]): Promise<MagicFSFile> {
		const identity = this.currentIdentityKey
		let current = await this.getRoot()
		for (const name of segments) {
			if (identity !== this.currentIdentityKey)
				throw new DOMException("Identity changed", "AbortError")
			const children = await this.loadDirectory(current.id)
			if (identity !== this.currentIdentityKey)
				throw new DOMException("Identity changed", "AbortError")
			let child = children.find((file) => file.name === name)
			if (!child) {
				try {
					child = await userSpaceFileService.createNode({
						name,
						parentId: current.id,
						isDirectory: true,
					})
				} catch (error) {
					if (identity !== this.currentIdentityKey)
						throw new DOMException("Identity changed", "AbortError")
					const latest = await this.loadDirectory(current.id, true)
					child = latest.find((file) => file.name === name)
					if (!child) throw error
				}
				if (identity !== this.currentIdentityKey)
					throw new DOMException("Identity changed", "AbortError")
				await this.loadDirectory(current.id, true)
			}
			if (identity !== this.currentIdentityKey)
				throw new DOMException("Identity changed", "AbortError")
			if (!child.is_directory) throw new Error("A file occupies the directory path")
			current = child
		}
		return current
	}

	/** 目录加载已经保留各级父节点；只沿父链构造路径，不复制完整树。 */
	getPath(fileId: string): MagicFSFile[] {
		if (this.identityKey !== this.currentIdentityKey) return []
		const path: MagicFSFile[] = []
		const visited = new Set<string>()
		let file = this.files.get(fileId)
		while (file && file.id !== this.rootId && !visited.has(file.id)) {
			visited.add(file.id)
			path.unshift(file)
			file = this.files.get(file.parent_id)
		}
		return file?.id === this.rootId ? path : []
	}

	/** 删除结果确认后使相关目录失效；旧响应不得重新插入已删除的子树。 */
	removeFiles(fileIds: readonly string[]): void {
		this.invalidateTrees()
		const removed = new Set(fileIds)
		for (const file of this.files.values()) {
			if (this.getPath(file.id).some((parent) => removed.has(parent.id))) removed.add(file.id)
		}
		this.changeVersion += 1
		for (const id of removed) {
			this.requests.get(id)?.controller.abort()
			this.requests.delete(id)
			this.directories.delete(id)
			this.files.delete(id)
			this.attachmentViews.delete(id)
		}
		for (const [id, directory] of this.directories) {
			if (directory.ids.some((child) => removed.has(child))) {
				this.directories.set(id, {
					...directory,
					ids: directory.ids.filter((child) => !removed.has(child)),
					loaded: false,
				})
			}
		}
	}

	notifyMutation(): void {
		this.invalidateTrees()
		invalidateFileReferenceCache()
		this.mutationVersion += 1
	}
	setFileEditing(id: string, editing: boolean): void {
		if (editing) this.editingFileIds.add(id)
		else this.editingFileIds.delete(id)
	}
	registerFileGuard(id: string, path: string, check: () => Promise<boolean>): void {
		this.fileGuards.set(id, { path, check })
	}
	unregisterFileGuard(id: string): void {
		this.fileGuards.delete(id)
	}

	async confirmIdentityChange(): Promise<boolean> {
		for (const id of this.editingFileIds) {
			const guard = this.fileGuards.get(id)
			if (guard && !(await guard.check())) return false
		}
		return true
	}

	async confirmFileChanges(ids: readonly string[]): Promise<boolean> {
		const paths = ids
			.map((id) =>
				this.getPath(id)
					.map((file) => file.name)
					.join("/"),
			)
			.filter(Boolean)
		for (const [id, guard] of this.fileGuards) {
			if (
				(ids.includes(id) || paths.some((path) => guard.path.startsWith(path + "/"))) &&
				!(await guard.check())
			)
				return false
		}
		return true
	}

	trackUpload(id: string, cancel: () => Promise<void>): void {
		this.uploadCancellations.set(id, cancel)
	}
	finishUpload(id: string): void {
		this.uploadCancellations.delete(id)
	}

	private invalidateTrees(): void {
		for (const [id, request] of this.treeRequests) {
			request.controller.abort()
			this.directories.set(id, { ...this.getDirectory(id), loading: false })
		}
		this.treeRequests.clear()
		this.loadedTrees.clear()
	}

	private activateIdentity(identity: string | null): void {
		if (identity === this.identityKey) return
		this.invalidateTrees()
		for (const request of this.namesRequests.values()) request.controller.abort()
		this.namesRequests.clear()
		this.projectNames.clear()
		this.loadedProjectNames.clear()
		for (const request of this.requests.values()) request.controller.abort()
		for (const cancel of this.uploadCancellations.values()) void cancel().catch(() => undefined)
		this.uploadCancellations.clear()
		this.fileGuards.clear()
		this.editingFileIds.clear()
		this.requests.clear()
		this.files.clear()
		this.directories.clear()
		this.expandedKeys.clear()
		this.attachmentViews.clear()
		this.rootId = null
		this.identityKey = identity
	}
}

export default new UserFilesStore()
