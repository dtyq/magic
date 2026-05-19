import { parseMagicProjectJs } from "../../../contents/HTML/utils/magicProjectUpdater"
import type { SelfMediaConfig, SelfMediaTreeNavigationTarget } from "../types"
import type { SelfMediaPlatform } from "../../../types"
import {
	findMagicProjectJsUnderSelfMediaRoot,
	findNodeById,
	folderPathWithSlash,
	parseSelfMediaSlices,
	type AttachmentNode,
	type PlatformSlice,
} from "../services/selfMediaHelpers"

const SELF_MEDIA_PLATFORM_SET: ReadonlySet<string> = new Set([
	"rednote",
	"instagram",
	"x",
	"facebook",
	"wechat-official-accounts",
	"tiktok",
	"wechat-channels",
])

function coerceSelfMediaPlatform(value: unknown): SelfMediaPlatform | null {
	if (typeof value !== "string" || !value) return null
	return SELF_MEDIA_PLATFORM_SET.has(value) ? (value as SelfMediaPlatform) : null
}

/** API often mirrors `magic.project.js` on the self-media root `display_config` */
function readSelfMediaConfigFromDisplayConfig(meta: unknown): SelfMediaConfig | null {
	if (!meta || typeof meta !== "object") return null
	const o = meta as Record<string, unknown>
	const raw = o["self-media"] ?? o.selfMedia
	if (!raw || typeof raw !== "object") return null
	return raw as SelfMediaConfig
}

/** Slices from root folder display_config when the backend embeds the manifest */
export function getPlatformSlicesFromRootFolderDisplayConfig(
	root: AttachmentNode | null | undefined,
): PlatformSlice[] {
	if (!root) return []
	const cfg = readSelfMediaConfigFromDisplayConfig(root.display_config)
	if (!cfg) return []
	return parseSelfMediaSlices(cfg)
}

function parsePlatformSlicesFromMagicContent(content: string): PlatformSlice[] {
	const parsed = parseMagicProjectJs(content)
	const cfg = (parsed?.config as Record<string, unknown> | undefined) ?? {}
	const raw = cfg["self-media"] ?? cfg.selfMedia
	if (!raw || typeof raw !== "object") return []
	return parseSelfMediaSlices(raw as SelfMediaConfig)
}

function getPlatformSlicesFromInlineMagic(
	root: AttachmentNode | null | undefined,
): PlatformSlice[] {
	if (!root) return []
	const magic = findMagicProjectJsUnderSelfMediaRoot(root) as
		| (AttachmentNode & { content?: string })
		| null
	const content = magic?.content
	if (typeof content !== "string" || !content.trim()) return []
	return parsePlatformSlicesFromMagicContent(content)
}

/** Single pure source for platform slices: root display_config first, inline magic second. */
export function getPlatformSlicesFromSelfMediaRoot(
	root: AttachmentNode | null | undefined,
): PlatformSlice[] {
	const fromDisplayConfig = getPlatformSlicesFromRootFolderDisplayConfig(root)
	if (fromDisplayConfig.length) return fromDisplayConfig
	return getPlatformSlicesFromInlineMagic(root)
}

function normPath(p: string): string {
	if (!p) return ""
	const s = p.replace(/\\/g, "/").replace(/\/+/g, "/")
	if (s === "/") return "/"
	return s.replace(/\/$/, "")
}

/**
 * Resolves a stable relative path for an attachment node.
 * Topic tree may use `path` or `relative_file_path`.
 */
export function getAttachmentNodePath(node: {
	relative_file_path?: string
	path?: string
}): string {
	const raw = (node.relative_file_path || (node as { path?: string }).path || "").trim()
	return normPath(raw)
}

function hasSelfMediaDisplayConfig(node: AttachmentNode | undefined): boolean {
	const t = (node?.display_config as { type?: string } | undefined)?.type
	return node?.is_directory === true && t === "self-media"
}

function emptyResolution(): SelfMediaTreeNodeResolution {
	return {
		navigationTarget: null,
		targetPlatform: null,
		folderIconPlatform: null,
	}
}

/** Collect all self-media root directory nodes in the tree */
function collectSelfMediaRoots(nodes: AttachmentNode[] | undefined, acc: AttachmentNode[]): void {
	if (!nodes?.length) return
	for (const n of nodes) {
		if (hasSelfMediaDisplayConfig(n)) acc.push(n)
		if (n.is_directory && n.children?.length) collectSelfMediaRoots(n.children, acc)
	}
}

function collectSelfMediaTreeIndex(
	nodes: AttachmentNode[] | undefined,
	roots: AttachmentNode[],
	nodeById: Map<string, AttachmentNode>,
): void {
	if (!nodes?.length) return
	for (const n of nodes) {
		if (n.file_id) nodeById.set(String(n.file_id), n)
		if (hasSelfMediaDisplayConfig(n)) roots.push(n)
		if (n.is_directory && n.children?.length) {
			collectSelfMediaTreeIndex(n.children, roots, nodeById)
		}
	}
}

/** For hooks: list every self-media project root in the topic attachment tree. */
export function getSelfMediaRootNodes(tree: AttachmentNode[] | undefined): AttachmentNode[] {
	const acc: AttachmentNode[] = []
	collectSelfMediaRoots(tree, acc)
	return acc
}

/** Match SelfMediaStore.tryApplyInitialNavigationFromPending slice scan */
export function findPlatformForPostInSlices(
	slices: PlatformSlice[] | undefined,
	postId: string,
): SelfMediaPlatform | null {
	if (!slices?.length) return null
	const want = String(postId)
	for (const s of slices) {
		if (s.postEntries.some((e) => String(e.id) === want)) return s.platform
	}
	return null
}

/** True when the clicked file path is inside the root folder, but not the root only */
function isDescendantPath(root: AttachmentNode, clickedNorm: string): boolean {
	const raw = folderPathWithSlash(root)
	const rootNorm = normPath(raw)
	if (!clickedNorm) return false
	if (rootNorm === "/") return clickedNorm !== "/"
	const prefix = rootNorm === "/" ? "/" : `${rootNorm}/`
	if (clickedNorm === rootNorm) return false
	return clickedNorm.startsWith(prefix)
}

/**
 * Pick the deepest self-media root whose path prefix contains the clicked path.
 * Supports multiple self-media projects in one attachment tree.
 */
function findContainingSelfMediaRoot(
	roots: AttachmentNode[],
	clickedPath: string,
): AttachmentNode | null {
	if (!roots.length || !clickedPath) return null

	const clickedNorm = normPath(clickedPath)
	let best: AttachmentNode | null = null
	let bestLen = -1
	for (const r of roots) {
		if (!isDescendantPath(r, clickedNorm)) continue
		const rootNorm = normPath(folderPathWithSlash(r))
		const len = rootNorm.length
		if (len > bestLen) {
			bestLen = len
			best = r
		}
	}
	return best
}

const POSTS_SEGMENT = /^posts\/([^/]+)(\/|$)/i

function resolveSelfMediaTreeNavigationTargetFromRoots(
	roots: AttachmentNode[],
	clicked: SelfMediaTreeNavigationItem,
): SelfMediaTreeNavigationTarget | null {
	if (!roots.length || !clicked?.file_id) return null

	const clickedPath = getAttachmentNodePath(clicked)
	if (!clickedPath) return null

	const root = findContainingSelfMediaRoot(roots, clickedPath)
	if (!root?.file_id) return null

	const rootPathNorm = normPath(folderPathWithSlash(root))
	if (!rootPathNorm) return null

	const clickedNorm = normPath(clickedPath)
	const prefix = rootPathNorm === "/" ? "/" : `${rootPathNorm}/`
	const rel = clickedNorm.startsWith(prefix) ? clickedNorm.slice(prefix.length) : null
	if (!rel) return null

	const m = rel.match(POSTS_SEGMENT)
	if (!m) return null
	const activePostId = m[1]
	if (!activePostId) return null

	return {
		rootFolderFileId: String(root.file_id),
		rootFolderRelativePath: rootPathNorm,
		activePostId,
		initialView: "detail",
	}
}

/**
 * When the clicked file lives under `posts/<postId>/...` inside a self-media
 * root, returns the root + post id. Platform is resolved later in the store
 * (first matching slice) unless explicitly provided elsewhere.
 */
export function resolveSelfMediaTreeNavigationTarget(
	tree: AttachmentNode[] | undefined,
	clicked: SelfMediaTreeNavigationItem,
): SelfMediaTreeNavigationTarget | null {
	if (!tree?.length || !clicked?.file_id) return null
	const roots: AttachmentNode[] = []
	collectSelfMediaRoots(tree, roots)
	return resolveSelfMediaTreeNavigationTargetFromRoots(roots, clicked)
}

const EXACT_POST_DIR = /^posts\/([^/]+)$/i

function isSelfMediaPostRootFolderRowForRoot(
	root: AttachmentNode | null | undefined,
	item: SelfMediaTreeNavigationItem,
	nav: SelfMediaTreeNavigationTarget | null,
): boolean {
	if (!nav || !root || !item.is_directory) return false
	const rootPathNorm = normPath(folderPathWithSlash(root))
	if (!rootPathNorm) return false
	const itemPath = getAttachmentNodePath(item)
	if (!itemPath) return false
	const clickedNorm = normPath(itemPath)
	const prefix = rootPathNorm === "/" ? "/" : `${rootPathNorm}/`
	const rel = clickedNorm.startsWith(prefix) ? clickedNorm.slice(prefix.length) : null
	if (rel == null) return false
	const relN = normPath(rel)
	const m = relN.match(EXACT_POST_DIR)
	if (!m?.[1]) return false
	return m[1].toLowerCase() === String(nav.activePostId).toLowerCase()
}

/**
 * Tree row: show platform icon only on the `posts/<postId>` folder, not
 * on nested subfolders or files.
 */
export function isSelfMediaPostRootFolderRow(
	tree: AttachmentNode[] | undefined,
	item: SelfMediaTreeNavigationItem,
	nav: SelfMediaTreeNavigationTarget | null,
): boolean {
	if (!nav || !tree?.length || !item.is_directory) return false
	const root = findNodeById(tree, nav.rootFolderFileId)
	return isSelfMediaPostRootFolderRowForRoot(root, item, nav)
}

/** Resolve one post platform from row display_config or root config. */
export function resolveSelfMediaPostPlatform(
	tree: AttachmentNode[] | undefined,
	rootFolderFileId: string,
	postId: string,
	postRowOrClickedItem?: { display_config?: unknown } | null,
): SelfMediaPlatform | null {
	if (!postId) return null
	const rowMeta = postRowOrClickedItem?.display_config
	if (rowMeta && typeof rowMeta === "object") {
		const rowPlatform = coerceSelfMediaPlatform((rowMeta as Record<string, unknown>).platform)
		if (rowPlatform) return rowPlatform
	}
	const root = findNodeById(tree, rootFolderFileId)
	const slices = getPlatformSlicesFromSelfMediaRoot(root)
	return findPlatformForPostInSlices(slices, postId)
}

export interface SelfMediaTreeNodeResolution {
	navigationTarget: SelfMediaTreeNavigationTarget | null
	targetPlatform: SelfMediaPlatform | null
	folderIconPlatform: SelfMediaPlatform | null
}

export interface SelfMediaTreeNavigationItem {
	file_id?: string
	relative_file_path?: string
	is_directory?: boolean
	display_config?: unknown
	path?: string
}

/** Resolve tree-click target and optional folder-row platform icon in one pass. */
export function resolveSelfMediaTreeNodeResolution(
	tree: AttachmentNode[] | undefined,
	item: SelfMediaTreeNavigationItem,
): SelfMediaTreeNodeResolution {
	const navigationTarget = resolveSelfMediaTreeNavigationTarget(tree, item)
	if (!navigationTarget) return emptyResolution()
	const targetPlatform = resolveSelfMediaPostPlatform(
		tree,
		navigationTarget.rootFolderFileId,
		navigationTarget.activePostId,
		{ display_config: item.display_config },
	)
	const folderIconPlatform =
		targetPlatform && isSelfMediaPostRootFolderRow(tree, item, navigationTarget)
			? targetPlatform
			: null

	return {
		navigationTarget,
		targetPlatform,
		folderIconPlatform,
	}
}

/** Resolve click navigation only for the exact `posts/<postId>` folder row. */
export function resolveSelfMediaPostRootFolderRowResolution(
	tree: AttachmentNode[] | undefined,
	item: SelfMediaTreeNavigationItem,
): SelfMediaTreeNodeResolution | null {
	const resolution = resolveSelfMediaTreeNodeResolution(tree, item)
	if (!resolution.navigationTarget) return null
	if (!isSelfMediaPostRootFolderRow(tree, item, resolution.navigationTarget)) return null
	return resolution
}

export interface SelfMediaTreeNavigationIndex {
	resolveNode: (item: SelfMediaTreeNavigationItem) => SelfMediaTreeNodeResolution
	resolvePostRootFolderClick: (
		item: SelfMediaTreeNavigationItem,
	) => SelfMediaTreeNodeResolution | null
}

export function createSelfMediaTreeNavigationIndex(
	tree: AttachmentNode[] | undefined,
): SelfMediaTreeNavigationIndex {
	const roots: AttachmentNode[] = []
	const nodeById = new Map<string, AttachmentNode>()
	const platformSlicesByRootId = new Map<string, PlatformSlice[]>()
	collectSelfMediaTreeIndex(tree, roots, nodeById)

	function getPlatformSlices(root: AttachmentNode | null | undefined): PlatformSlice[] {
		if (!root?.file_id) return []
		const rootId = String(root.file_id)
		const cached = platformSlicesByRootId.get(rootId)
		if (cached) return cached
		const slices = getPlatformSlicesFromSelfMediaRoot(root)
		platformSlicesByRootId.set(rootId, slices)
		return slices
	}

	function resolvePostPlatform(
		root: AttachmentNode | null | undefined,
		postId: string,
		postRowOrClickedItem?: { display_config?: unknown } | null,
	): SelfMediaPlatform | null {
		if (!postId) return null
		const rowMeta = postRowOrClickedItem?.display_config
		if (rowMeta && typeof rowMeta === "object") {
			const rowPlatform = coerceSelfMediaPlatform(
				(rowMeta as Record<string, unknown>).platform,
			)
			if (rowPlatform) return rowPlatform
		}
		return findPlatformForPostInSlices(getPlatformSlices(root), postId)
	}

	function resolveNode(item: SelfMediaTreeNavigationItem): SelfMediaTreeNodeResolution {
		const navigationTarget = resolveSelfMediaTreeNavigationTargetFromRoots(roots, item)
		if (!navigationTarget) return emptyResolution()
		const root = nodeById.get(navigationTarget.rootFolderFileId)
		const targetPlatform = resolvePostPlatform(root, navigationTarget.activePostId, {
			display_config: item.display_config,
		})
		const folderIconPlatform =
			targetPlatform && isSelfMediaPostRootFolderRowForRoot(root, item, navigationTarget)
				? targetPlatform
				: null

		return {
			navigationTarget,
			targetPlatform,
			folderIconPlatform,
		}
	}

	function resolvePostRootFolderClick(
		item: SelfMediaTreeNavigationItem,
	): SelfMediaTreeNodeResolution | null {
		const resolution = resolveNode(item)
		if (!resolution.navigationTarget) return null
		const root = nodeById.get(resolution.navigationTarget.rootFolderFileId)
		if (!isSelfMediaPostRootFolderRowForRoot(root, item, resolution.navigationTarget)) {
			return null
		}
		return resolution
	}

	return {
		resolveNode,
		resolvePostRootFolderClick,
	}
}
