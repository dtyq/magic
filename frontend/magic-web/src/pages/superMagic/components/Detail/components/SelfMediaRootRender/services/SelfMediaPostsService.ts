import { getFileContentById } from "@/pages/superMagic/utils/api"
import { logger as rootLogger } from "@/utils/log"
import { flattenAttachments, resolveRelativePath } from "../../../contents/HTML/utils"
import type { SelfMediaPlatform } from "../../../types"
import type { SelfMediaConfig, SelfMediaPost, SelfMediaPostEntry } from "../types"
import { parseMagicProjectJs } from "../../../contents/HTML/utils/magicProjectUpdater"
import {
	buildResolvedPost,
	buildTreeSnapshot,
	cacheKey,
	collectPostFileRoles,
	diffTreeSnapshots,
	fileDirWithSlash,
	findFileByRelativePath,
	findMagicProjectJsUnderSelfMediaRoot,
	findNodeById,
	folderPathWithSlash,
	parsePostManifest,
	parseSelfMediaSlices,
	reresolvePost,
	type AttachmentDiff,
	type AttachmentNode,
	type FileRole,
	type PlatformSlice,
	type TreeSnapshot,
} from "./selfMediaHelpers"

/** Derived view of the attachment tree required to resolve posts */
export interface TreeContext {
	allFiles: AttachmentNode[]
	folderNode: AttachmentNode | null
	magicProjectFileId: string | null
	folderRelativePath: string
}

/** Snapshot mirrored into React state after every lifecycle transition */
export interface SelfMediaSnapshot {
	slices: PlatformSlice[]
	loadedPosts: Record<string, SelfMediaPost>
	error: string | null
	folderRelativePath: string
	/**
	 * File IDs of card/article/cover assets whose fileId or version changed during
	 * the last reconcile pass, plus any unindexed assets (embedded images, CSS, etc.)
	 * that live in a known post directory and were added/updated/removed.
	 * Consumers use this to bust the frame-source cache so stale HTML is not shown.
	 * Only populated by `reconcile()`; `initialize()` leaves it undefined.
	 */
	invalidatedCardFileIds?: Set<string>
}

/** Args every lifecycle entry point receives */
export interface LifecycleArgs {
	tree: AttachmentNode[] | undefined
	folderFileId: string | undefined
}

interface LoadPostParams {
	platform: SelfMediaPlatform
	entry: SelfMediaPostEntry
	folderRelativePath: string
	allFiles: AttachmentNode[]
}

interface PostResolutionMeta {
	platform: SelfMediaPlatform
	entry: SelfMediaPostEntry
	/** file_id of the post.json (source of truth for refetch keying) */
	postFileId?: string
}

const EMPTY_SNAPSHOT: SelfMediaSnapshot = {
	slices: [],
	loadedPosts: {},
	error: null,
	folderRelativePath: "/",
}

const log = rootLogger.createLogger("SelfMediaPostsService")

/** Short, privacy-safe preview for diff payloads (cap to avoid huge dumps) */
function sampleIds(ids: Set<string>, max = 5): string[] {
	const out: string[] = []
	ids.forEach((id) => {
		if (out.length < max) out.push(id)
	})
	return out
}

function summarizeDiff(diff: AttachmentDiff): Record<string, unknown> {
	return {
		added: diff.added.size,
		removed: diff.removed.size,
		updated: diff.updated.size,
		addedSample: sampleIds(diff.added),
		removedSample: sampleIds(diff.removed),
		updatedSample: sampleIds(diff.updated),
	}
}

function sumSlicePosts(slices: PlatformSlice[]): number {
	return slices.reduce((n, s) => n + (s.postEntries?.length || 0), 0)
}

/**
 * SelfMediaPostsService
 *
 * Owns the full lifecycle of a self-media project:
 *   - initialize(args): first-time root + index hydration
 *   - reconcile(args): diff the attachment tree and apply incremental updates
 *   - dispose(): drop all caches and stop propagating in-flight results
 *
 * The service keeps slices, loaded posts, a fileId reverse index and the
 * last tree snapshot so diff-driven updates avoid full reloads.
 * `reconcile` is silent: it never toggles the global loading/rootLoading
 * flags; callers can assume the returned snapshot is safe to merge.
 */
export class SelfMediaPostsService {
	private snapshot: SelfMediaSnapshot = { ...EMPTY_SNAPSHOT }
	private readonly pendingPostLoads = new Map<string, Promise<SelfMediaPost>>()
	private readonly fileIdIndex = new Map<string, FileRole>()
	private readonly postMeta = new Map<string, PostResolutionMeta>()
	private lastTreeSnapshot: TreeSnapshot | null = null
	private lastMagicProjectFileId: string | null = null
	private lastFolderFileId: string | null = null
	private disposed = false

	/** Current cached snapshot (useful for tests / debugging) */
	getSnapshot(): SelfMediaSnapshot {
		return this.snapshot
	}

	/** Reverse index for diff classification */
	getFileIdIndex(): ReadonlyMap<string, FileRole> {
		return this.fileIdIndex
	}

	/** Derive the attachment-tree context required by subsequent loads */
	resolveTreeContext(
		tree: AttachmentNode[] | undefined,
		folderFileId: string | undefined,
	): TreeContext {
		const allFiles = this.flattenTree(tree)
		const folderNode = findNodeById(tree, folderFileId)
		const magicProjectFileId =
			findMagicProjectJsUnderSelfMediaRoot(folderNode)?.file_id?.toString() || null
		const folderRelativePath = folderPathWithSlash(folderNode)
		return { allFiles, folderNode, magicProjectFileId, folderRelativePath }
	}

	/**
	 * Initialize the service for a given folder.
	 * Loads magic.project.js, parses slices and returns the fresh snapshot.
	 * Safe to call multiple times; previous state is reset.
	 */
	async initialize(args: LifecycleArgs): Promise<SelfMediaSnapshot> {
		this.disposed = false
		this.hardReset()

		if (!args.folderFileId) {
			log.log("⏭️ 初始化跳过：缺少 folderFileId")
			this.snapshot = { ...EMPTY_SNAPSHOT }
			return this.snapshot
		}

		const ctx = this.resolveTreeContext(args.tree, args.folderFileId)
		this.lastFolderFileId = args.folderFileId
		this.lastMagicProjectFileId = ctx.magicProjectFileId
		this.lastTreeSnapshot = buildTreeSnapshot(ctx.allFiles)

		log.log("🚀 初始化开始", {
			folderFileId: args.folderFileId,
			magicProjectFileId: ctx.magicProjectFileId,
			folderRelativePath: ctx.folderRelativePath,
			totalFiles: ctx.allFiles.length,
		})

		if (!ctx.magicProjectFileId) {
			log.warn("⚠️ 初始化失败：未找到 magic.project.js", {
				folderFileId: args.folderFileId,
				folderRelativePath: ctx.folderRelativePath,
			})
			this.snapshot = {
				...EMPTY_SNAPSHOT,
				folderRelativePath: ctx.folderRelativePath,
				error: "magicProjectNotFound",
			}
			return this.snapshot
		}

		const startedAt = Date.now()
		try {
			const slices = await this.loadRootSlicesInternal(ctx.magicProjectFileId)
			if (this.disposed) {
				log.log("🛑 初始化已中止：加载期间被 dispose", {
					folderFileId: args.folderFileId,
				})
				return this.snapshot
			}
			this.indexRoot(ctx.magicProjectFileId)
			this.snapshot = {
				slices,
				loadedPosts: {},
				error: null,
				folderRelativePath: ctx.folderRelativePath,
			}
			log.log("✅ 初始化完成", {
				folderFileId: args.folderFileId,
				platforms: slices.length,
				posts: sumSlicePosts(slices),
				durationMs: Date.now() - startedAt,
			})
			return this.snapshot
		} catch (err) {
			if (this.disposed) return this.snapshot
			const code = toErrorCode(err)
			log.error("❌ 初始化失败", {
				folderFileId: args.folderFileId,
				code,
				durationMs: Date.now() - startedAt,
				error: err,
			})
			this.snapshot = {
				...EMPTY_SNAPSHOT,
				folderRelativePath: ctx.folderRelativePath,
				error: code,
			}
			return this.snapshot
		}
	}

	/**
	 * Reconcile against a new attachment tree.
	 * Returns a merged snapshot without toggling any loading flags.
	 * If the root source (folder or magic.project.js) changed, falls
	 * back to initialize() semantics; otherwise applies per-post and
	 * per-card updates in place.
	 */
	async reconcile(args: LifecycleArgs): Promise<SelfMediaSnapshot> {
		if (this.disposed) {
			log.log("🛑 reconcile 跳过：实例已 dispose")
			return this.snapshot
		}
		if (!args.folderFileId) {
			log.log("↩️ reconcile 回落到 initialize：folderFileId 缺失")
			return this.initialize(args)
		}

		const ctx = this.resolveTreeContext(args.tree, args.folderFileId)

		const rootIdentityChanged =
			this.lastFolderFileId !== args.folderFileId ||
			this.lastMagicProjectFileId !== ctx.magicProjectFileId ||
			ctx.magicProjectFileId === null
		if (rootIdentityChanged) {
			log.log("🔄 reconcile 回落到 initialize：根目录或 magic.project.js 身份变化", {
				prevFolderFileId: this.lastFolderFileId,
				nextFolderFileId: args.folderFileId,
				prevMagicProjectFileId: this.lastMagicProjectFileId,
				nextMagicProjectFileId: ctx.magicProjectFileId,
			})
			return this.initialize(args)
		}

		const nextSnapshot = buildTreeSnapshot(ctx.allFiles)
		const diff = diffTreeSnapshots(this.lastTreeSnapshot, nextSnapshot)
		// Keep the previous snapshot for path-lookup of removed files inside
		// collectPostsToReresolve (needed for embedded-asset change detection).
		const prevSnapshot = this.lastTreeSnapshot
		this.lastTreeSnapshot = nextSnapshot

		if (!diff.hasChanges) {
			this.snapshot = {
				...this.snapshot,
				folderRelativePath: ctx.folderRelativePath,
			}
			return this.snapshot
		}

		log.log("🧩 reconcile 检测到附件树变更", summarizeDiff(diff))

		// 1. magic.project.js 内容变化 -> 整体重载
		if (ctx.magicProjectFileId && diff.updated.has(ctx.magicProjectFileId)) {
			log.log("🧨 magic.project.js 内容变化，触发整体重载", {
				magicProjectFileId: ctx.magicProjectFileId,
			})
			return this.initialize(args)
		}

		// 2 & 3: 按文章刷新 与 按卡片本地重建
		const toRefetch = this.collectPostsToRefetch(diff)
		const toReresolve = this.collectPostsToReresolve(diff, ctx, toRefetch, prevSnapshot)

		let nextLoadedPosts = { ...this.snapshot.loadedPosts }
		const folderRelativePath = ctx.folderRelativePath
		let errorAfterReconcile = this.snapshot.error
		const startedAt = Date.now()
		let refetchedCount = 0
		let reresolvedCount = 0
		let failedCount = 0
		// Collects card/article/cover fileIds whose content changed so callers can
		// bust the iframe source cache for those specific cards.
		const invalidatedCardFileIds = new Set<string>()

		// 2. post.json 变化 -> 清缓存并静默重新拉取
		const refetchKeys = Array.from(toRefetch)
		if (refetchKeys.length > 0) {
			log.log("📥 静默重新拉取受影响的文章", {
				count: refetchKeys.length,
				sample: refetchKeys.slice(0, 5),
			})
		}
		for (const key of refetchKeys) {
			const meta = this.postMeta.get(key)
			if (!meta) continue
			this.evictPost(key)
			try {
				const freshPost = await this.ensurePostLoaded({
					platform: meta.platform,
					entry: meta.entry,
					folderRelativePath,
					allFiles: ctx.allFiles,
				})
				if (this.disposed) return this.snapshot
				nextLoadedPosts = { ...nextLoadedPosts, [key]: freshPost }
				refetchedCount += 1
			} catch (err) {
				failedCount += 1
				errorAfterReconcile = toErrorCode(err)
				log.error("❌ 静默重新拉取文章失败", {
					postKey: key,
					platform: meta.platform,
					postId: meta.entry?.id,
					code: errorAfterReconcile,
					error: err,
				})
			}
		}

		// 3. 文件增删改影响到已缓存文章 -> 仅本地重解析（不发网络）
		const reresolveKeys = Array.from(toReresolve)
		if (reresolveKeys.length > 0) {
			log.log("🧷 本地重解析受影响文章的卡片路径/版本", {
				count: reresolveKeys.length,
				sample: reresolveKeys.slice(0, 5),
			})
		}
		for (const key of reresolveKeys) {
			const cachedPost = nextLoadedPosts[key]
			const meta = this.postMeta.get(key)
			if (!cachedPost || !meta) continue
			const postFile = meta.postFileId
				? ctx.allFiles.find((f) => f.file_id === meta.postFileId)
				: null
			const postBasePath = postFile
				? fileDirWithSlash(postFile as AttachmentNode)
				: this.derivePostBasePath(meta, folderRelativePath)
			const rebuilt = reresolvePost(cachedPost, postBasePath, ctx.allFiles)
			nextLoadedPosts = { ...nextLoadedPosts, [key]: rebuilt }
			this.reindexPost(meta.platform, rebuilt, meta.postFileId)
			reresolvedCount += 1

			// Collect card fileIds whose version or identity changed so the source
			// cache (iframe HTML) can be busted for those specific cards.
			const collectChangedFileIds = (
				oldCard: { fileId?: string; version?: string } | undefined,
				newCard: { fileId?: string; version?: string } | undefined,
			) => {
				if (!oldCard?.fileId) return
				if (oldCard.fileId !== newCard?.fileId || oldCard.version !== newCard?.version) {
					invalidatedCardFileIds.add(oldCard.fileId)
				}
			}
			cachedPost.cards.forEach((oldCard, i) =>
				collectChangedFileIds(oldCard, rebuilt.cards[i]),
			)
			collectChangedFileIds(cachedPost.article, rebuilt.article)
			collectChangedFileIds(cachedPost.heroCover, rebuilt.heroCover)
			collectChangedFileIds(cachedPost.thumbnailCover, rebuilt.thumbnailCover)
		}

		this.snapshot = {
			slices: this.snapshot.slices,
			loadedPosts: nextLoadedPosts,
			error: errorAfterReconcile,
			folderRelativePath,
			invalidatedCardFileIds:
				invalidatedCardFileIds.size > 0 ? invalidatedCardFileIds : undefined,
		}

		log.log("✅ reconcile 完成", {
			refetched: refetchedCount,
			reresolved: reresolvedCount,
			failed: failedCount,
			durationMs: Date.now() - startedAt,
		})
		return this.snapshot
	}

	/** Clear all state; after dispose the service is inert */
	dispose(): void {
		if (this.disposed) return
		log.log("🧹 dispose：清理所有缓存", {
			folderFileId: this.lastFolderFileId,
			cachedPosts: Object.keys(this.snapshot.loadedPosts).length,
			pendingLoads: this.pendingPostLoads.size,
			indexedFiles: this.fileIdIndex.size,
		})
		this.disposed = true
		this.hardReset()
		this.snapshot = { ...EMPTY_SNAPSHOT }
	}

	/**
	 * Ensure a post is loaded. Returns a cached value when possible and
	 * dedups concurrent callers for the same (platform, postId) pair.
	 * Also updates the internal snapshot & fileId index on success so
	 * future diffs can target it.
	 */
	ensurePostLoaded(params: LoadPostParams): Promise<SelfMediaPost> {
		const key = cacheKey(params.platform, params.entry.id)

		const cached = this.snapshot.loadedPosts[key]
		if (cached) return Promise.resolve(cached)

		const pending = this.pendingPostLoads.get(key)
		if (pending) return pending

		const next = this.doLoadPost(params)
			.then((post) => {
				if (this.disposed) return post
				this.snapshot = {
					...this.snapshot,
					loadedPosts: { ...this.snapshot.loadedPosts, [key]: post },
				}
				this.reindexPost(
					params.platform,
					post,
					this.resolvePostFileId(params, params.entry),
				)
				this.postMeta.set(key, {
					platform: params.platform,
					entry: params.entry,
					postFileId: this.resolvePostFileId(params, params.entry),
				})
				return post
			})
			.finally(() => {
				this.pendingPostLoads.delete(key)
			})

		this.pendingPostLoads.set(key, next)
		return next
	}

	/** Load every post for the given platform (export flow) */
	async ensureAllPostsLoaded(
		platform: SelfMediaPlatform,
		entries: SelfMediaPostEntry[],
		folderRelativePath: string,
		allFiles: AttachmentNode[],
	): Promise<SelfMediaPost[]> {
		log.log("📦 批量加载全部文章", {
			platform,
			total: entries.length,
		})
		const startedAt = Date.now()
		const out: SelfMediaPost[] = []
		for (const entry of entries) {
			const post = await this.ensurePostLoaded({
				platform,
				entry,
				folderRelativePath,
				allFiles,
			})
			if (this.disposed) {
				log.log("🛑 批量加载中止：已 dispose", {
					platform,
					loaded: out.length,
					total: entries.length,
				})
				return out
			}
			out.push(post)
		}
		log.log("✅ 批量加载完成", {
			platform,
			total: entries.length,
			durationMs: Date.now() - startedAt,
		})
		return out
	}

	// ------------------------------------------------------------------
	// Internals
	// ------------------------------------------------------------------

	private hardReset(): void {
		this.pendingPostLoads.clear()
		this.fileIdIndex.clear()
		this.postMeta.clear()
		this.lastTreeSnapshot = null
		this.lastMagicProjectFileId = null
		this.lastFolderFileId = null
	}

	private flattenTree(tree: AttachmentNode[] | undefined): AttachmentNode[] {
		if (!tree?.length) return []
		try {
			return flattenAttachments(tree) as AttachmentNode[]
		} catch {
			return []
		}
	}

	private async loadRootSlicesInternal(magicProjectFileId: string): Promise<PlatformSlice[]> {
		const content = (await getFileContentById(magicProjectFileId, {
			responseType: "text",
		})) as string

		const parsed = parseMagicProjectJs(content)
		const config = parsed?.config || {}
		const selfMediaRaw = config["self-media"] || config.selfMedia

		if (!selfMediaRaw || typeof selfMediaRaw !== "object") {
			throw new Error("selfMediaConfigMissing")
		}

		return parseSelfMediaSlices(selfMediaRaw as SelfMediaConfig)
	}

	private async doLoadPost({
		platform,
		entry,
		folderRelativePath,
		allFiles,
	}: LoadPostParams): Promise<SelfMediaPost> {
		const postFilePath = resolveRelativePath(folderRelativePath, entry.entry)
		const postFile = findFileByRelativePath(allFiles, postFilePath)
		if (!postFile?.file_id) {
			log.warn("⚠️ 找不到 post.json 对应的附件", {
				platform,
				postId: entry.id,
				postFilePath,
			})
			throw new Error("postManifestMissing")
		}

		const startedAt = Date.now()
		const content = (await getFileContentById(postFile.file_id, {
			responseType: "text",
		})) as string

		const manifest = parsePostManifest(content)
		if (!manifest) {
			log.warn("⚠️ post.json 解析失败", {
				platform,
				postId: entry.id,
				postFileId: postFile.file_id,
			})
			throw new Error("postManifestInvalid")
		}

		const post = buildResolvedPost(entry, manifest, allFiles, postFile)
		log.log("📄 文章加载完成", {
			platform,
			postId: entry.id,
			postFileId: postFile.file_id,
			cards: post.cards.length,
			durationMs: Date.now() - startedAt,
		})
		return post
	}

	private resolvePostFileId(
		params: LoadPostParams,
		entry: SelfMediaPostEntry,
	): string | undefined {
		const postFilePath = resolveRelativePath(params.folderRelativePath, entry.entry)
		return findFileByRelativePath(params.allFiles, postFilePath)?.file_id
	}

	private indexRoot(magicProjectFileId: string): void {
		this.fileIdIndex.set(magicProjectFileId, { kind: "root" })
	}

	private reindexPost(
		platform: SelfMediaPlatform,
		post: SelfMediaPost,
		postFileId: string | undefined,
	): void {
		for (const [existingFileId, role] of Array.from(this.fileIdIndex)) {
			if (role.kind === "root") continue
			if (role.platform === platform && role.postId === post.meta.id) {
				this.fileIdIndex.delete(existingFileId)
			}
		}
		for (const { fileId, role } of collectPostFileRoles(platform, post, postFileId)) {
			this.fileIdIndex.set(fileId, role)
		}
	}

	private evictPost(key: string): void {
		const nextLoaded = { ...this.snapshot.loadedPosts }
		delete nextLoaded[key]
		this.snapshot = { ...this.snapshot, loadedPosts: nextLoaded }
		this.pendingPostLoads.delete(key)
		const meta = this.postMeta.get(key)
		if (!meta) return
		for (const [fileId, role] of Array.from(this.fileIdIndex)) {
			if (role.platform === meta.platform && role.postId === meta.entry.id) {
				this.fileIdIndex.delete(fileId)
			}
		}
	}

	private collectPostsToRefetch(diff: AttachmentDiff): Set<string> {
		const out = new Set<string>()
		diff.updated.forEach((fileId) => {
			const role = this.fileIdIndex.get(fileId)
			if (role?.kind === "postJson" && role.platform && role.postId) {
				out.add(cacheKey(role.platform, role.postId))
			}
		})
		return out
	}

	private collectPostsToReresolve(
		diff: AttachmentDiff,
		ctx: TreeContext,
		alreadyRefetching: Set<string>,
		prevSnapshot: TreeSnapshot | null,
	): Set<string> {
		const out = new Set<string>()

		const markByRole = (role: FileRole | undefined) => {
			if (!role) return
			if (!role.platform || !role.postId) return
			if (role.kind === "root" || role.kind === "postJson") return
			const key = cacheKey(role.platform, role.postId)
			if (alreadyRefetching.has(key)) return
			out.add(key)
		}

		diff.updated.forEach((fileId) => markByRole(this.fileIdIndex.get(fileId)))
		diff.removed.forEach((fileId) => markByRole(this.fileIdIndex.get(fileId)))

		if (diff.added.size > 0) {
			this.postMeta.forEach((meta, key) => {
				if (alreadyRefetching.has(key)) return
				const post = this.snapshot.loadedPosts[key]
				if (!post) return
				const basePath = this.derivePostBasePath(meta, ctx.folderRelativePath)
				if (postHasUnresolvedPath(post, basePath, ctx.allFiles)) {
					out.add(key)
				}
			})
		}

		// Detect changes to files that are NOT directly indexed (e.g. images/CSS
		// embedded inside a card HTML).  When such a file is updated or removed in
		// a directory that belongs to a known post, we must also re-resolve that
		// post so consumers know to bust the iframe source cache.
		const changedUnindexedPaths: string[] = []
		const recordUnindexedPath = (fileId: string, path: string | undefined) => {
			if (path && !this.fileIdIndex.has(fileId)) {
				changedUnindexedPaths.push(path)
			}
		}
		diff.updated.forEach((fileId) => {
			const file = ctx.allFiles.find((f) => f.file_id === fileId)
			recordUnindexedPath(fileId, file?.relative_file_path as string | undefined)
		})
		diff.removed.forEach((fileId) => {
			// Use the previous snapshot to look up the path of a removed file.
			const path = prevSnapshot?.byFileId.get(fileId)?.relative_file_path
			recordUnindexedPath(fileId, path)
		})
		diff.added.forEach((fileId) => {
			const file = ctx.allFiles.find((f) => f.file_id === fileId)
			recordUnindexedPath(fileId, file?.relative_file_path as string | undefined)
		})

		if (changedUnindexedPaths.length > 0) {
			this.postMeta.forEach((meta, key) => {
				if (alreadyRefetching.has(key) || out.has(key)) return
				const post = this.snapshot.loadedPosts[key]
				if (!post) return
				const basePath = this.derivePostBasePath(meta, ctx.folderRelativePath)
				const hasEmbeddedAssetChange = changedUnindexedPaths.some((p) =>
					p.startsWith(basePath),
				)
				if (hasEmbeddedAssetChange) {
					out.add(key)
				}
			})
		}

		return out
	}

	private derivePostBasePath(meta: PostResolutionMeta, folderRelativePath: string): string {
		const postFilePath = resolveRelativePath(folderRelativePath, meta.entry.entry)
		const lastSlash = postFilePath.lastIndexOf("/")
		return lastSlash === -1 ? "/" : postFilePath.slice(0, lastSlash + 1)
	}
}

function toErrorCode(error: unknown): string {
	const message = error instanceof Error ? error.message : "unknownError"
	const known = new Set([
		"magicProjectNotFound",
		"selfMediaConfigMissing",
		"postManifestMissing",
		"postManifestInvalid",
		"unknownError",
	])
	return known.has(message) ? message : "unknownError"
}

function postHasUnresolvedPath(
	post: SelfMediaPost,
	postBasePath: string,
	allFiles: AttachmentNode[],
): boolean {
	const probe = (card: { path: string; fileId?: string } | undefined): boolean => {
		if (!card) return false
		if (card.fileId) return false
		const resolved = resolveRelativePath(postBasePath, card.path)
		return Boolean(findFileByRelativePath(allFiles, resolved))
	}
	if (post.cards.some(probe)) return true
	if (probe(post.article)) return true
	if (probe(post.heroCover)) return true
	if (probe(post.thumbnailCover)) return true
	return false
}
