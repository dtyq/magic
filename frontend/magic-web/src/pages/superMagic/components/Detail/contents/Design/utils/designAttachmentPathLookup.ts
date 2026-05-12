import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import { normalizePath } from "./utils"
import { resolveDesignDslPathCandidatesToWorkspaceRelative } from "./designDslPathUtils"
import type { DesignAttachmentIndex } from "./designAttachmentIndex"

/**
 * 设计附件路径 → FileItem 解析（单一职责：仅负责「DSL path / workspace 相对路径」如何落到附件表）。
 *
 * 原则：
 * - 多候选若解析到不同 file_id，优先唯一 strict 命中；否则失败关闭，避免「串路径」误绑资源。
 * - 按 file_id 解析仅在 DSL 单段看起来像是服务端 id（UUID / 足够长的 opaque id）时启用。
 */

export interface ResolvedPathCandidate {
	resolvedPath: string
	normalizedPath: string
}

export interface FileItemLookupResult extends ResolvedPathCandidate {
	fileItem: FileItem
}

export type AttachmentPathMatchKind = "strict-normalized" | "leading-slash-relaxed" | "file-id"

interface AttachmentPathMatch {
	fileItem: FileItem
	matchKind: AttachmentPathMatchKind
}

interface CandidateMatch extends ResolvedPathCandidate {
	fileItem: FileItem
	matchKind: AttachmentPathMatchKind
}

/** DSL 中单段路径仅在形似服务端 file_id 时参与按 id 解析，避免短字符串误命中其它附件 */
export function isDslPathPlausibleFileIdSegment(path: string): boolean {
	const p = path.trim()
	if (!p || p.includes("/") || p.includes("\\")) return false
	if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p)) return true
	if (/^[0-9a-f]{32}$/i.test(p)) return true
	if (p.length >= 16 && /^[a-zA-Z0-9_-]+$/.test(p)) return true
	return false
}

function resolveAttachmentForWorkspacePath(
	storeFiles: FileItem[],
	normalizedPath: string,
	dslPath: string,
	index?: DesignAttachmentIndex | null,
): AttachmentPathMatch | null {
	if (index) {
		let fileItem = index.byNormalizedPath.get(normalizedPath)
		if (fileItem?.file_id && !fileItem.is_directory) {
			return { fileItem, matchKind: "strict-normalized" }
		}

		const pathWithoutLeadingSlash = normalizedPath.startsWith("/")
			? normalizedPath.slice(1)
			: normalizedPath
		fileItem = index.byPathWithoutLeadingSlash.get(pathWithoutLeadingSlash)
		if (fileItem?.file_id && !fileItem.is_directory) {
			return { fileItem, matchKind: "leading-slash-relaxed" }
		}

		if (dslPath && isDslPathPlausibleFileIdSegment(dslPath)) {
			const id = dslPath.trim()
			fileItem = index.byFileId.get(id)
			if (fileItem?.file_id && !fileItem.is_directory) {
				return { fileItem, matchKind: "file-id" }
			}
		}
	}

	if (storeFiles.length === 0) return null

	let fileItem = storeFiles.find((item) => {
		if (!item.relative_file_path || item.is_directory) return false
		return normalizePath(item.relative_file_path) === normalizedPath
	})
	if (fileItem?.file_id) {
		return { fileItem, matchKind: "strict-normalized" }
	}

	const pathWithoutLeadingSlash = normalizedPath.startsWith("/")
		? normalizedPath.slice(1)
		: normalizedPath

	fileItem = storeFiles.find((item) => {
		if (!item.relative_file_path || item.is_directory) return false
		const itemPath = normalizePath(item.relative_file_path)
		const itemPathWithoutLeadingSlash = itemPath.startsWith("/") ? itemPath.slice(1) : itemPath
		return itemPathWithoutLeadingSlash === pathWithoutLeadingSlash
	})
	if (fileItem?.file_id) {
		return { fileItem, matchKind: "leading-slash-relaxed" }
	}

	if (dslPath && isDslPathPlausibleFileIdSegment(dslPath)) {
		const id = dslPath.trim()
		fileItem = storeFiles.find((item) => !item.is_directory && item.file_id === id)
		if (fileItem?.file_id) {
			return { fileItem, matchKind: "file-id" }
		}
	}

	return null
}

function isStrictNormalizedAttachmentMatch(
	candidate: ResolvedPathCandidate,
	fileItem: FileItem,
): boolean {
	if (!fileItem.relative_file_path) return false
	return normalizePath(fileItem.relative_file_path) === candidate.normalizedPath
}

/**
 * 将 DSL 中的路径展开为与工作区 relative_file_path 一致的候选，并去重。
 */
export function getResolvedPathCandidates(
	filePath: string,
	designProjectBasePath?: string,
): ResolvedPathCandidate[] {
	const seen = new Set<string>()
	return resolveDesignDslPathCandidatesToWorkspaceRelative(filePath, designProjectBasePath)
		.map((resolvedPath) => ({
			resolvedPath,
			normalizedPath: normalizePath(resolvedPath),
		}))
		.filter((candidate) => {
			if (!candidate.normalizedPath || seen.has(candidate.normalizedPath)) return false
			seen.add(candidate.normalizedPath)
			return true
		})
}

/**
 * 已知单个 normalized workspace 路径时的附件解析（内存缓存校验等）。
 */
export function lookupAttachmentForSingleNormalizedPath(
	normalizedPath: string,
	dslPath: string,
	storeFiles: FileItem[],
	attachmentIndex?: DesignAttachmentIndex | null,
): FileItem | null {
	const match = resolveAttachmentForWorkspacePath(
		storeFiles,
		normalizedPath,
		dslPath,
		attachmentIndex,
	)
	return match?.fileItem ?? null
}

/**
 * 多候选路径下解析附件：歧义（指向不同 file_id）时返回 null，避免误绑。
 */
export function lookupAttachmentAmongCandidates(
	candidates: ResolvedPathCandidate[],
	dslPath: string,
	storeFiles: FileItem[],
	attachmentIndex?: DesignAttachmentIndex | null,
): FileItemLookupResult | null {
	const matches: CandidateMatch[] = []

	for (const candidate of candidates) {
		const resolved = resolveAttachmentForWorkspacePath(
			storeFiles,
			candidate.normalizedPath,
			dslPath,
			attachmentIndex,
		)
		if (!resolved) continue
		matches.push({
			resolvedPath: candidate.resolvedPath,
			normalizedPath: candidate.normalizedPath,
			fileItem: resolved.fileItem,
			matchKind: resolved.matchKind,
		})
	}

	if (matches.length === 0) return null
	if (matches.length === 1) {
		const m = matches[0]
		return {
			resolvedPath: m.resolvedPath,
			normalizedPath: m.normalizedPath,
			fileItem: m.fileItem,
		}
	}

	const fileIds = new Set(matches.map((m) => m.fileItem.file_id))
	if (fileIds.size === 1) {
		const m = matches[0]
		return {
			resolvedPath: m.resolvedPath,
			normalizedPath: m.normalizedPath,
			fileItem: m.fileItem,
		}
	}

	const strictMatches = matches.filter((m) => isStrictNormalizedAttachmentMatch(m, m.fileItem))
	if (strictMatches.length === 1) {
		const m = strictMatches[0]
		return {
			resolvedPath: m.resolvedPath,
			normalizedPath: m.normalizedPath,
			fileItem: m.fileItem,
		}
	}

	return null
}
