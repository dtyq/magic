import { comparer, makeAutoObservable, reaction, runInAction, type IReactionDisposer } from "mobx"
import { logger as rootLogger } from "@/utils/log"
import type { SelfMediaInitialNavigation, SelfMediaPlatform } from "../../../types"
import type { SelfMediaPost, SelfMediaPostEntry, SelfMediaView } from "../types"
import {
	buildPlaceholderPost,
	cacheKey,
	normalizeSelfMediaError,
	SelfMediaPostsService,
	type AttachmentNode,
	type PlatformSlice,
	type SelfMediaSnapshot,
} from "../services"
import { invalidateCardFrameSourceCache } from "../components/CardFrame"

const log = rootLogger.createLogger("SelfMediaStore")

/** Payload used to drive the store's sync lifecycle */
export interface SelfMediaSyncArgs {
	folderFileId?: string
	attachmentList?: AttachmentNode[]
	attachments?: AttachmentNode[]
	/** One-shot in-memory open target from the file tree (if any) */
	initialNavigation?: SelfMediaInitialNavigation | null
}

/**
 * SelfMediaStore
 *
 * Single source of truth for a `SelfMediaRootRender` instance. Owns both the
 * data layer (slices / posts / loading / error / folderRelativePath) and the
 * navigation layer (activePlatform / activePostIndex / view / activeCardIndex).
 *
 * Internally it delegates all I/O and diffing to `SelfMediaPostsService`,
 * replicating the three lifecycle branches previously housed in the
 * `useSelfMediaPosts` hook:
 *
 *   - **initialize**: first hydration per folder. `rootLoading` + `loading` go true
 *     while the root manifest loads.
 *   - **reconcile**: silent tree-diff driven updates. Never touches the global
 *     loading flags; only the changed posts/cards propagate.
 *   - **dispose**: clears service state on unmount.
 *
 * Also replicates the "relay-retry" semantics: when a sync is cancelled
 * mid-initialize (e.g. upstream tree identity changes during await), the next
 * sync picks up the init that was left pending so `rootLoading`/`loading` are
 * always closed out cleanly.
 */
export class SelfMediaStore {
	slices: PlatformSlice[] = []
	loadedPosts: Record<string, SelfMediaPost> = {}
	rootLoading = true
	loading = true
	error: string | null = null
	folderRelativePath = "/"

	activePlatform: SelfMediaPlatform | undefined = undefined
	activePostIndex = 0
	view: SelfMediaView = "detail"
	activeCardIndex = 0

	// ------------------------------------------------------------------
	// Non-observable internals (explicitly excluded from makeAutoObservable
	// via the override map, so MobX strict-mode won't complain about plain
	// assignments outside `runInAction`).
	// ------------------------------------------------------------------
	private _service: SelfMediaPostsService
	private _initializedKey: string | null = null
	private _pendingInitKey: string | null = null
	private _syncToken = 0
	private _currentTree: AttachmentNode[] | undefined = undefined
	private _currentFolderFileId: string | undefined = undefined
	/** One-shot: folder switches reset; re-open from tree re-applies. */
	private _lastNavScopeFolderId: string | undefined = undefined
	private _lastInitialNavRequestKey: string | null = null
	private _pendingInitialNav: SelfMediaInitialNavigation | null = null
	private _initialNavConsumed = false
	private _disposed = false
	private _reactionDisposer: IReactionDisposer | null = null

	constructor(service?: SelfMediaPostsService) {
		this._service = service ?? new SelfMediaPostsService()
		makeAutoObservable(
			this,
			{
				_service: false,
				_initializedKey: false,
				_pendingInitKey: false,
				_syncToken: false,
				_currentTree: false,
				_currentFolderFileId: false,
				_lastNavScopeFolderId: false,
				_lastInitialNavRequestKey: false,
				_pendingInitialNav: false,
				_initialNavConsumed: false,
				_disposed: false,
				_reactionDisposer: false,
			} as never,
			{ autoBind: true },
		)

		// Auto-load the currently active post whenever it changes (entry id,
		// platform, the initial rootLoading -> false transition, or when the
		// cache entry for the current post disappears - e.g. reconcile evicts
		// it after a root manifest change).
		// Include activePostIndex so a tab/switch always re-evaluates even if
		// entry ids were duplicated or shallow compare skipped an edge case.
		this._reactionDisposer = reaction(
			() => {
				const platform = this.resolvedPlatform
				const entry = this.activePostEntry
				const cached =
					platform && entry
						? Boolean(this.loadedPosts[cacheKey(platform, entry.id)])
						: false
				return {
					activePostIndex: this.activePostIndex,
					entryId: entry?.id,
					platform,
					rootLoading: this.rootLoading,
					cached,
				}
			},
			() => {
				void this.loadActivePostIfNeeded()
			},
			{ equals: comparer.shallow, fireImmediately: true },
		)
	}

	// ------------------------------------------------------------------
	// Computed
	// ------------------------------------------------------------------

	get platforms(): SelfMediaPlatform[] {
		return this.slices.map((slice) => slice.platform)
	}

	get resolvedPlatform(): SelfMediaPlatform | null {
		if (!this.slices.length) return null
		if (this.activePlatform && this.platforms.includes(this.activePlatform)) {
			return this.activePlatform
		}
		return this.slices[0].platform
	}

	get postEntries(): SelfMediaPostEntry[] {
		const platform = this.resolvedPlatform
		if (!platform) return []
		return this.slices.find((s) => s.platform === platform)?.postEntries || []
	}

	get posts(): SelfMediaPost[] {
		const platform = this.resolvedPlatform
		return this.postEntries.map((entry) => {
			if (!platform) return buildPlaceholderPost(entry)
			return this.loadedPosts[cacheKey(platform, entry.id)] || buildPlaceholderPost(entry)
		})
	}

	get activePost(): SelfMediaPost | null {
		return this.posts[this.activePostIndex] ?? null
	}

	get activePostEntry(): SelfMediaPostEntry | null {
		return this.postEntries[this.activePostIndex] ?? null
	}

	// ------------------------------------------------------------------
	// UI actions
	// ------------------------------------------------------------------

	setActivePlatform(next: SelfMediaPlatform | undefined): void {
		if (this.activePlatform === next) return
		this.activePlatform = next
	}

	setActivePostIndex(next: number): void {
		if (this.activePostIndex === next) return
		this.activePostIndex = next
		this.activeCardIndex = 0
	}

	setView(next: SelfMediaView): void {
		if (this.view === next) return
		this.view = next
	}

	setActiveCardIndex(next: number): void {
		if (this.activeCardIndex === next) return
		this.activeCardIndex = next
	}

	/** Switch platform; mirrors the reset previously done in index.tsx */
	handleChangePlatform(next: SelfMediaPlatform): void {
		this.activePlatform = next
		this.activePostIndex = 0
		this.activeCardIndex = 0
		this.view = "detail"
	}

	// ------------------------------------------------------------------
	// Lifecycle
	// ------------------------------------------------------------------

	/**
	 * Drive initialize / reconcile / dispose based on the latest upstream
	 * inputs. Safe to call repeatedly; concurrent calls are de-duplicated via
	 * a sync token so only the most recent call's result is applied.
	 */
	async sync(args: SelfMediaSyncArgs): Promise<void> {
		this._disposed = false
		const tree = args.attachmentList?.length ? args.attachmentList : args.attachments
		const hasTree = (tree?.length || 0) > 0
		this._currentTree = tree
		this._currentFolderFileId = args.folderFileId
		this._syncToken += 1
		const token = this._syncToken

		const scopeFolder = args.folderFileId
		if (scopeFolder) {
			const prev = this._lastNavScopeFolderId
			if (prev !== undefined && prev !== scopeFolder) {
				this._resetInitialNavigationOneShot()
			}
			this._lastNavScopeFolderId = scopeFolder
		} else {
			this._lastNavScopeFolderId = undefined
			this._resetInitialNavigationOneShot()
		}
		if (args.initialNavigation != null) {
			const navKey = this._getInitialNavigationKey(args.initialNavigation)
			if (navKey !== this._lastInitialNavRequestKey) {
				this._lastInitialNavRequestKey = navKey
				this._pendingInitialNav = args.initialNavigation
				this._initialNavConsumed = false
			}
		}

		if (!args.folderFileId) {
			log.log("🧹 Store 清理：folderFileId 为空，dispose service")
			this._service.dispose()
			this._initializedKey = null
			this._pendingInitKey = null
			runInAction(() => {
				this.slices = []
				this.loadedPosts = {}
				this.error = null
				this.folderRelativePath = "/"
				this.rootLoading = false
				this.loading = false
			})
			return
		}

		if (!hasTree) {
			log.log("🧹 Store 清理：附件树为空，重置为空状态", {
				folderFileId: args.folderFileId,
			})
			this._service.dispose()
			this._initializedKey = null
			this._pendingInitKey = null
			runInAction(() => {
				this.slices = []
				this.loadedPosts = {}
				this.error = null
				this.folderRelativePath = "/"
				this.rootLoading = false
				this.loading = false
			})
			return
		}

		const shouldInitialize =
			this._initializedKey !== args.folderFileId || this._pendingInitKey === args.folderFileId
		if (shouldInitialize) {
			const isRetry = this._pendingInitKey === args.folderFileId
			log.log(isRetry ? "🔁 Store 接力重跑初始化（上次被 cancel）" : "🚀 Store 触发初始化", {
				folderFileId: args.folderFileId,
				prevKey: this._initializedKey,
				pending: this._pendingInitKey,
			})
			this._initializedKey = args.folderFileId
			this._pendingInitKey = args.folderFileId
			runInAction(() => {
				this.rootLoading = true
				this.loading = true
				this.error = null
			})

			let snap: SelfMediaSnapshot
			try {
				snap = await this._service.initialize({
					tree,
					folderFileId: args.folderFileId,
				})
			} catch (err) {
				if (token !== this._syncToken || this._disposed) return
				const code = normalizeSelfMediaError(err)
				log.error("❌ Store 初始化异常", {
					folderFileId: args.folderFileId,
					code,
					error: err,
				})
				runInAction(() => {
					this.error = code
					this.rootLoading = false
					this.loading = false
				})
				return
			}

			if (token !== this._syncToken || this._disposed) {
				log.log("⏸️ 初始化被 cancel，等待下一轮 sync 接力", {
					folderFileId: args.folderFileId,
				})
				return
			}

			runInAction(() => {
				this._pendingInitKey = null
				this.applySnapshot(snap, true)
				this.rootLoading = false
				this.loading = snap.slices.some((slice) => slice.postEntries.length > 0)
			})
			this.tryApplyInitialNavigationFromPending()
			// The initialize path can complete after a remount/cancel relay where the
			// reaction that normally kicks active-post loading doesn't re-fire.
			void this.loadActivePostIfNeeded()
			return
		}

		let snap: SelfMediaSnapshot
		try {
			snap = await this._service.reconcile({
				tree,
				folderFileId: args.folderFileId,
			})
		} catch (err) {
			if (token !== this._syncToken || this._disposed) return
			const code = normalizeSelfMediaError(err)
			log.error("❌ Store reconcile 异常", {
				folderFileId: args.folderFileId,
				code,
				error: err,
			})
			runInAction(() => {
				this.error = code
			})
			return
		}

		if (token !== this._syncToken || this._disposed) return
		// Bust iframe source cache for cards whose content changed (same fileId but
		// new version, or a new fileId at the same path) before committing the
		// new snapshot to MobX so the component re-renders with fresh HTML.
		snap.invalidatedCardFileIds?.forEach((fileId) => invalidateCardFrameSourceCache(fileId))
		runInAction(() => {
			this.applySnapshot(snap, false)
		})
		this.tryApplyInitialNavigationFromPending()
		void this.loadActivePostIfNeeded()
	}

	/** Ensure a specific post is loaded; returns cached / fresh post or null */
	async ensurePostLoaded(index: number): Promise<SelfMediaPost | null> {
		const platform = this.resolvedPlatform
		if (!platform) return null
		const entry = this.postEntries[index]
		if (!entry) return null
		const key = cacheKey(platform, entry.id)
		if (this.loadedPosts[key]) return this.loadedPosts[key]
		return this.loadPostFor(platform, entry)
	}

	/** Preload every post for the active platform (export flow) */
	async ensureAllPostsLoaded(): Promise<SelfMediaPost[]> {
		const platform = this.resolvedPlatform
		if (!platform) return []
		const { allFiles } = this._service.resolveTreeContext(
			this._currentTree,
			this._currentFolderFileId,
		)
		const entries = this.postEntries.slice()
		const resolved = await this._service.ensureAllPostsLoaded(
			platform,
			entries,
			this.folderRelativePath,
			allFiles,
		)
		runInAction(() => {
			resolved.forEach((post, idx) => {
				const entry = entries[idx]
				if (!entry) return
				const key = cacheKey(platform, entry.id)
				if (this.loadedPosts[key] !== post) {
					this.loadedPosts = { ...this.loadedPosts, [key]: post }
				}
			})
		})
		return entries.map((entry, idx) => resolved[idx] || buildPlaceholderPost(entry))
	}

	/** Tear down the store; the underlying service is also disposed. */
	dispose(): void {
		if (this._disposed) return
		log.log("🛑 Store 卸载，销毁 service 实例")
		this._disposed = true
		this._reactionDisposer?.()
		this._reactionDisposer = null
		this._service.dispose()
		this._initializedKey = null
		this._pendingInitKey = null
		this._lastNavScopeFolderId = undefined
		this._resetInitialNavigationOneShot()
	}

	/**
	 * Full reload from the last synced attachment tree: re-run
	 * `SelfMediaPostsService.initialize` (same as first open).
	 * @param options.preserveNavigation - keep current post, card, and view
	 *   after reload (clamped to valid ranges when the tree changes).
	 */
	async init(options?: { preserveNavigation?: boolean }): Promise<void> {
		const folderFileId = this._currentFolderFileId
		const tree = this._currentTree
		if (!folderFileId || !tree?.length) {
			log.log("⏭️ init skipped: missing folderFileId or attachment tree")
			return
		}
		const preserveNavigation = options?.preserveNavigation === true
		const savedPostIndex = this.activePostIndex
		const savedView = this.view
		const savedCardIndex = this.activeCardIndex
		if (!preserveNavigation) {
			runInAction(() => {
				this.activePostIndex = 0
				this.activeCardIndex = 0
				this.view = "detail"
			})
		}
		this._initializedKey = null
		this._pendingInitKey = null
		await this.sync({ folderFileId, attachments: tree })
		if (!preserveNavigation) return
		runInAction(() => {
			const n = this.postEntries.length
			if (n === 0) return
			const postIdx = Math.min(Math.max(0, savedPostIndex), n - 1)
			this.activePostIndex = postIdx
			this.view = savedView
			const cardCount = this.posts[postIdx]?.cards?.length ?? 0
			const maxCard = Math.max(0, cardCount - 1)
			this.activeCardIndex = Math.min(Math.max(0, savedCardIndex), maxCard)
		})
		void this.ensurePostLoaded(this.activePostIndex)
	}

	// ------------------------------------------------------------------
	// Internal helpers (called from inside runInAction / reaction only)
	// ------------------------------------------------------------------

	private _resetInitialNavigationOneShot(): void {
		this._lastInitialNavRequestKey = null
		this._pendingInitialNav = null
		this._initialNavConsumed = false
	}

	private _getInitialNavigationKey(nav: SelfMediaInitialNavigation): string {
		return `${nav.activePlatform || ""}::${nav.activePostId}::${nav.initialView}`
	}

	/** One-shot: apply file-tree open target after slices are available */
	private tryApplyInitialNavigationFromPending(): void {
		if (this._initialNavConsumed) return
		const nav = this._pendingInitialNav
		if (!nav) {
			this._initialNavConsumed = true
			return
		}
		if (this.rootLoading) return
		// Wait for manifest; a later `reconcile` may populate `slices`
		if (!this.slices.length) return

		const postId = nav.activePostId
		if (!postId) {
			this._initialNavConsumed = true
			this._pendingInitialNav = null
			return
		}

		let platform: SelfMediaPlatform | undefined
		let index = -1
		if (nav.activePlatform) {
			const slice = this.slices.find((s) => s.platform === nav.activePlatform)
			if (slice) {
				const idx = slice.postEntries.findIndex((e) => e.id === postId)
				if (idx >= 0) {
					platform = nav.activePlatform
					index = idx
				}
			}
		}
		if (index < 0) {
			for (const s of this.slices) {
				const idx = s.postEntries.findIndex((e) => e.id === postId)
				if (idx >= 0) {
					platform = s.platform
					index = idx
					break
				}
			}
		}

		this._initialNavConsumed = true
		this._pendingInitialNav = null
		if (index < 0 || !platform) return

		const initialView = nav.initialView
		runInAction(() => {
			this.activePlatform = platform
			this.activePostIndex = index
			this.view = initialView
			this.activeCardIndex = 0
		})
	}

	private applySnapshot(snap: SelfMediaSnapshot, replaceAll: boolean): void {
		if (replaceAll || slicesChanged(this.slices, snap.slices)) {
			this.slices = snap.slices
		}
		if (replaceAll || loadedPostsChanged(this.loadedPosts, snap.loadedPosts)) {
			this.loadedPosts = snap.loadedPosts
		}
		if (this.folderRelativePath !== snap.folderRelativePath) {
			this.folderRelativePath = snap.folderRelativePath
		}
		if (this.error !== snap.error) {
			this.error = snap.error
		}
	}

	private async loadPostFor(
		platform: SelfMediaPlatform,
		entry: SelfMediaPostEntry,
	): Promise<SelfMediaPost> {
		const { allFiles } = this._service.resolveTreeContext(
			this._currentTree,
			this._currentFolderFileId,
		)
		const post = await this._service.ensurePostLoaded({
			platform,
			entry,
			folderRelativePath: this.folderRelativePath,
			allFiles,
		})
		if (this._disposed) return post
		runInAction(() => {
			const key = cacheKey(platform, entry.id)
			if (this.loadedPosts[key] !== post) {
				this.loadedPosts = { ...this.loadedPosts, [key]: post }
			}
		})
		return post
	}

	private async loadActivePostIfNeeded(): Promise<void> {
		if (this.rootLoading) return
		const platform = this.resolvedPlatform
		const entry = this.activePostEntry
		if (!platform || !entry) {
			if (this.loading) {
				runInAction(() => {
					this.loading = false
				})
			}
			return
		}
		const key = cacheKey(platform, entry.id)
		if (this.loadedPosts[key]) {
			runInAction(() => {
				this.error = null
				this.loading = false
			})
			return
		}
		runInAction(() => {
			this.loading = true
			this.error = null
		})
		try {
			log.log("🧭 用户切换文章，按需加载", {
				platform,
				postId: entry.id,
			})
			await this.loadPostFor(platform, entry)
			if (this._disposed) return
			runInAction(() => {
				this.loading = false
			})
		} catch (err) {
			if (this._disposed) return
			const code = normalizeSelfMediaError(err)
			log.error("❌ 按需加载文章失败", {
				platform,
				postId: entry.id,
				code,
				error: err,
			})
			runInAction(() => {
				this.error = code
				this.loading = false
			})
		}
	}
}

function slicesChanged(prev: PlatformSlice[], next: PlatformSlice[]): boolean {
	if (prev === next) return false
	if (prev.length !== next.length) return true
	for (let i = 0; i < prev.length; i += 1) {
		const a = prev[i]
		const b = next[i]
		if (a.platform !== b.platform) return true
		if (a.postEntries.length !== b.postEntries.length) return true
		for (let j = 0; j < a.postEntries.length; j += 1) {
			const ae = a.postEntries[j]
			const be = b.postEntries[j]
			if (ae.id !== be.id || ae.name !== be.name || ae.entry !== be.entry) return true
		}
	}
	return false
}

function loadedPostsChanged(
	prev: Record<string, SelfMediaPost>,
	next: Record<string, SelfMediaPost>,
): boolean {
	if (prev === next) return false
	const prevKeys = Object.keys(prev)
	const nextKeys = Object.keys(next)
	if (prevKeys.length !== nextKeys.length) return true
	for (const key of nextKeys) {
		if (prev[key] !== next[key]) return true
	}
	return false
}
