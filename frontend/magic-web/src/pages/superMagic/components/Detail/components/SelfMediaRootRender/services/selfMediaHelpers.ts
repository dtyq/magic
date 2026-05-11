import { resolveRelativePath } from "../../../contents/HTML/utils"
import type {
	SelfMediaCard,
	SelfMediaConfig,
	SelfMediaPost,
	SelfMediaPostEntry,
	SelfMediaPostManifest,
} from "../types"
import type { SelfMediaPlatform } from "../../../types"

/** Shape of any attachment tree node consumed by self-media flows */
export interface AttachmentNode {
	file_id?: string
	file_name?: string
	relative_file_path?: string
	is_directory?: boolean
	updated_at?: string
	children?: AttachmentNode[]
	[key: string]: unknown
}

/** Per-platform slice parsed from the root manifest */
export interface PlatformSlice {
	platform: SelfMediaPlatform
	postEntries: SelfMediaPostEntry[]
}

/** Minimal per-file metadata tracked across diffs */
export interface TreeFingerprint {
	relative_file_path?: string
	updated_at?: string
}

/** Snapshot of a flattened attachment tree keyed by file_id */
export interface TreeSnapshot {
	byFileId: Map<string, TreeFingerprint>
	byRelativePath: Map<string, string>
}

/** Structured diff between two tree snapshots */
export interface AttachmentDiff {
	added: Set<string>
	removed: Set<string>
	updated: Set<string>
	hasChanges: boolean
}

/** Business role of a file_id relative to the self-media project */
export type FileRoleKind = "root" | "postJson" | "card" | "article" | "heroCover" | "thumbnailCover"

export interface FileRole {
	kind: FileRoleKind
	platform?: SelfMediaPlatform
	postId?: string
	cardIndex?: number
}

/** Known, translatable error codes surfaced to the UI */
const KNOWN_SELF_MEDIA_ERRORS = new Set([
	"magicProjectNotFound",
	"selfMediaConfigMissing",
	"postManifestMissing",
	"postManifestInvalid",
	"unknownError",
])

/** Find a directory node whose path matches the normalized relative path. */
export function findDirectoryByRelativePath(
	tree: AttachmentNode[] | undefined,
	relativePath: string,
): AttachmentNode | null {
	if (!tree?.length || !relativePath) return null
	const want = relativePath.replace(/\\/g, "/")
	const normalizedWant = want.endsWith("/") ? want : `${want}/`
	const stack: AttachmentNode[] = [...tree]
	while (stack.length) {
		const node = stack.pop()
		if (!node?.is_directory) continue
		const p = (node.relative_file_path || "").replace(/\\/g, "/")
		const n = p.endsWith("/") ? p : `${p}/`
		if (n === normalizedWant) return node
		if (node.children?.length) stack.push(...node.children)
	}
	return null
}

/** Walk attachment tree to find a folder/file by id */
export function findNodeById(
	tree: AttachmentNode[] | undefined,
	fileId?: string,
): AttachmentNode | null {
	if (!fileId || !tree?.length) return null
	const stack: AttachmentNode[] = [...tree]
	while (stack.length) {
		const node = stack.pop()
		if (!node) continue
		if (node.file_id === fileId) return node
		if (node.is_directory && node.children?.length) {
			stack.push(...node.children)
		}
	}
	return null
}

/** Resolve folder relative path with a trailing slash */
export function folderPathWithSlash(folder: AttachmentNode | null): string {
	const path = folder?.relative_file_path || ""
	if (!path) return "/"
	return path.endsWith("/") ? path : `${path}/`
}

/** Resolve the directory of a file (with trailing slash) */
export function fileDirWithSlash(file: AttachmentNode | null): string {
	const path = file?.relative_file_path || ""
	if (!path) return "/"
	const slashIndex = path.lastIndexOf("/")
	if (slashIndex === -1) return "/"
	return path.slice(0, slashIndex + 1)
}

/** Base filename for an attachment; tree APIs may set `name` or `file_name` */
function attachmentFileBaseName(node: AttachmentNode | undefined | null): string {
	if (!node) return ""
	return String(
		(node as { name?: string }).name ||
			node.file_name ||
			(node as { filename?: string }).filename ||
			"",
	).trim()
}

/** Locate magic.project.js directly under the given folder */
export function findMagicProjectJsInFolder(folder: AttachmentNode | null): AttachmentNode | null {
	if (!folder?.is_directory || !folder.children?.length) return null
	return (
		folder.children.find(
			(child) =>
				!child.is_directory &&
				attachmentFileBaseName(child).toLowerCase() === "magic.project.js",
		) || null
	)
}

/**
 * Prefer `magic.project.js` as a direct child of the self-media root; if
 * missing, search any file in the subtree (some trees only expose `name`).
 */
export function findMagicProjectJsUnderSelfMediaRoot(
	root: AttachmentNode | null,
): AttachmentNode | null {
	if (!root) return null
	const direct = findMagicProjectJsInFolder(root)
	if (direct) return direct
	if (!root.children?.length) return null
	const stack: AttachmentNode[] = [...root.children]
	while (stack.length) {
		const n = stack.pop()!
		if (n.is_directory) {
			if (n.children?.length) stack.push(...n.children)
			continue
		}
		if (attachmentFileBaseName(n).toLowerCase() === "magic.project.js") return n
	}
	return null
}

/** Find file by full relative path in the flattened list */
export function findFileByRelativePath(
	allFiles: AttachmentNode[],
	relativePath: string,
): AttachmentNode | null {
	return (
		allFiles.find((file) => !file.is_directory && file.relative_file_path === relativePath) ||
		null
	)
}

/** Parse the raw `posts` array into normalized entries */
export function parsePostEntries(rawPosts: unknown[]): SelfMediaPostEntry[] {
	return rawPosts
		.map((post) => {
			if (!post || typeof post !== "object") return null
			const candidate = post as Partial<SelfMediaPostEntry>
			if (!candidate.id || !candidate.entry) return null
			return {
				id: String(candidate.id),
				name: String(candidate.name || candidate.id),
				entry: String(candidate.entry),
			}
		})
		.filter((post): post is SelfMediaPostEntry => Boolean(post))
}

/** Parse the `self-media` object into per-platform slices */
export function parseSelfMediaSlices(selfMedia: SelfMediaConfig): PlatformSlice[] {
	return (
		Object.entries(selfMedia) as Array<[SelfMediaPlatform, SelfMediaConfig[SelfMediaPlatform]]>
	)
		.map(([platform, block]) => {
			if (!block || typeof block !== "object") return null
			const postsField = (block as { posts?: unknown }).posts
			const entries = parsePostEntries(Array.isArray(postsField) ? postsField : [])
			return { platform, postEntries: entries } as PlatformSlice
		})
		.filter((slice): slice is PlatformSlice => Boolean(slice))
}

/** Parse a post.json payload, returning null when the shape is invalid */
export function parsePostManifest(content: string): SelfMediaPostManifest | null {
	if (!content) return null
	try {
		const parsed = JSON.parse(content) as SelfMediaPostManifest
		if (!parsed || typeof parsed !== "object" || !parsed.id) return null
		return parsed
	} catch {
		return null
	}
}

/** Map arbitrary errors to a stable, UI-safe error code */
export function normalizeSelfMediaError(error: unknown): string {
	const message = error instanceof Error ? error.message : "unknownError"
	return KNOWN_SELF_MEDIA_ERRORS.has(message) ? message : "unknownError"
}

/** Minimal post used while the real manifest is still loading */
export function buildPlaceholderPost(entry: SelfMediaPostEntry): SelfMediaPost {
	return {
		meta: {
			id: entry.id,
			title: entry.name,
			feedTitle: entry.name,
		},
		cards: [],
	}
}

function resolveCardByRelativePath(
	rawPath: string | undefined,
	postBasePath: string,
	allFiles: AttachmentNode[],
): SelfMediaCard | undefined {
	if (!rawPath) return undefined
	const resolved = resolveRelativePath(postBasePath, rawPath)
	const matched = findFileByRelativePath(allFiles, resolved)
	return {
		path: rawPath,
		fileId: matched?.file_id,
		version: matched?.updated_at,
	}
}

/** Build the fully-resolved post from its manifest + surrounding files */
export function buildResolvedPost(
	entry: SelfMediaPostEntry,
	manifest: SelfMediaPostManifest,
	allFiles: AttachmentNode[],
	postFile: AttachmentNode,
): SelfMediaPost {
	const postBasePath = fileDirWithSlash(postFile)
	const rawCards = Array.isArray(manifest.cards) ? manifest.cards : []
	const cards: SelfMediaCard[] = rawCards.map((cardPath) => {
		const resolved = resolveRelativePath(postBasePath, cardPath)
		const matched = findFileByRelativePath(allFiles, resolved)
		return {
			path: cardPath,
			fileId: matched?.file_id,
			version: matched?.updated_at,
		}
	})

	const article = resolveCardByRelativePath(manifest.article, postBasePath, allFiles)
	const heroCover = resolveCardByRelativePath(manifest.heroCover, postBasePath, allFiles)
	const thumbnailCover = resolveCardByRelativePath(
		manifest.thumbnailCover,
		postBasePath,
		allFiles,
	)

	return {
		meta: {
			id: entry.id,
			title: entry.name,
			feedTitle: entry.name,
			...(manifest.meta || {}),
		},
		cards,
		...(article ? { article } : {}),
		...(heroCover ? { heroCover } : {}),
		...(thumbnailCover ? { thumbnailCover } : {}),
	}
}

/** Cache key scoped by platform + post id */
export function cacheKey(platform: SelfMediaPlatform, postId: string): string {
	return `${platform}::${postId}`
}

/** Build a per-file_id snapshot of the current flat attachment list */
export function buildTreeSnapshot(allFiles: AttachmentNode[]): TreeSnapshot {
	const byFileId = new Map<string, TreeFingerprint>()
	const byRelativePath = new Map<string, string>()
	for (const file of allFiles) {
		if (file.is_directory) continue
		if (!file.file_id) continue
		byFileId.set(file.file_id, {
			relative_file_path: file.relative_file_path,
			updated_at: file.updated_at,
		})
		if (file.relative_file_path) {
			byRelativePath.set(file.relative_file_path, file.file_id)
		}
	}
	return { byFileId, byRelativePath }
}

/** Diff two snapshots by file_id; updates compare updated_at only */
export function diffTreeSnapshots(prev: TreeSnapshot | null, next: TreeSnapshot): AttachmentDiff {
	const added = new Set<string>()
	const removed = new Set<string>()
	const updated = new Set<string>()

	if (!prev) {
		next.byFileId.forEach((_meta, fileId) => {
			added.add(fileId)
		})
		return {
			added,
			removed,
			updated,
			hasChanges: added.size > 0,
		}
	}

	next.byFileId.forEach((meta, fileId) => {
		const prevMeta = prev.byFileId.get(fileId)
		if (!prevMeta) {
			added.add(fileId)
			return
		}
		if (prevMeta.updated_at !== meta.updated_at) {
			updated.add(fileId)
		}
	})
	prev.byFileId.forEach((_meta, fileId) => {
		if (!next.byFileId.has(fileId)) removed.add(fileId)
	})

	return {
		added,
		removed,
		updated,
		hasChanges: added.size > 0 || removed.size > 0 || updated.size > 0,
	}
}

/** Collect the role bindings produced by a successfully-resolved post */
export function collectPostFileRoles(
	platform: SelfMediaPlatform,
	post: SelfMediaPost,
	postFileId: string | undefined,
): Array<{ fileId: string; role: FileRole }> {
	const out: Array<{ fileId: string; role: FileRole }> = []
	if (postFileId) {
		out.push({
			fileId: postFileId,
			role: { kind: "postJson", platform, postId: post.meta.id },
		})
	}
	post.cards.forEach((card, cardIndex) => {
		if (card.fileId) {
			out.push({
				fileId: card.fileId,
				role: { kind: "card", platform, postId: post.meta.id, cardIndex },
			})
		}
	})
	if (post.article?.fileId) {
		out.push({
			fileId: post.article.fileId,
			role: { kind: "article", platform, postId: post.meta.id },
		})
	}
	if (post.heroCover?.fileId) {
		out.push({
			fileId: post.heroCover.fileId,
			role: { kind: "heroCover", platform, postId: post.meta.id },
		})
	}
	if (post.thumbnailCover?.fileId) {
		out.push({
			fileId: post.thumbnailCover.fileId,
			role: { kind: "thumbnailCover", platform, postId: post.meta.id },
		})
	}
	return out
}

/** Update a single card with a fresh file_id/version from the latest allFiles */
export function reresolveCard(
	card: SelfMediaCard,
	postBasePath: string,
	allFiles: AttachmentNode[],
): SelfMediaCard {
	const resolved = resolveRelativePath(postBasePath, card.path)
	const matched = findFileByRelativePath(allFiles, resolved)
	const newFileId = matched?.file_id
	const newVersion = matched?.updated_at
	// Clear cached url when the underlying file changed so consumers re-fetch
	const urlStale = newFileId !== card.fileId || newVersion !== card.version
	return {
		...card,
		fileId: newFileId,
		version: newVersion,
		...(urlStale ? { url: undefined } : {}),
	}
}

/** Apply reresolve to all card-like fields of a post */
export function reresolvePost(
	post: SelfMediaPost,
	postBasePath: string,
	allFiles: AttachmentNode[],
): SelfMediaPost {
	return {
		...post,
		cards: post.cards.map((card) => reresolveCard(card, postBasePath, allFiles)),
		...(post.article ? { article: reresolveCard(post.article, postBasePath, allFiles) } : {}),
		...(post.heroCover
			? { heroCover: reresolveCard(post.heroCover, postBasePath, allFiles) }
			: {}),
		...(post.thumbnailCover
			? { thumbnailCover: reresolveCard(post.thumbnailCover, postBasePath, allFiles) }
			: {}),
	}
}
