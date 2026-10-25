import {
	hasCurrentDirectoryPrefix,
	isCanvasResourceRootPath,
	isRemoteOrSpecialPath,
	stripPathEdgeSlashes,
} from "@/components/CanvasDesign/runtime/shared/path/canvasResourcePath"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import type { DesignAttachmentIndex } from "./designAttachmentIndex"
import {
	collectAttachmentMatchesAmongCandidates,
	type CandidateMatch,
	type ResolvedPathCandidate,
} from "./internal/designAttachmentLookup"
import {
	normalizeDesignStoragePathForCanvas,
	normalizeMagicProjectDirToBase,
	resolveDesignDslPathCandidatesToWorkspaceRelative,
	resolveStrictDesignDslCanvasResourceCandidates,
	rewriteLayerElementsPathsForMagicProjectSave,
	type DesignDslPathRewrite,
} from "./internal/designPathPrimitives"

type DesignPathMode = "strict-current-canvas" | "legacy-recovery"

export interface DesignPathContext {
	/** 画布目录路径段，与 magic.project.js 同级，例如 `新建画布`。 */
	designProjectBasePath?: string
	/** 当前附件树扁平列表，用于 API 路径候选存在性判断和附件解析。 */
	flatAttachments?: FileItem[]
	attachmentIndex?: DesignAttachmentIndex | null
}

interface ResolveDesignAttachmentMatch {
	fileItem: FileItem
	resolvedPath: string
	normalizedPath: string
}

type DesignPathOperationResolution =
	| {
			status: "found"
			resolvedPath: string
			normalizedPath: string
			fileItem?: FileItem
			/** 旧裸路径经附件唯一确认后，读取时按它实际指向的位置处理。 */
			legacyRecovered: boolean
	  }
	| {
			status: "ambiguous" | "not-found" | "attachments-pending"
			candidates: ResolvedPathCandidate[]
	  }

type ResolveDesignAttachmentResult =
	| {
			status: "found"
			fileItem: FileItem
			resolvedPath: string
			normalizedPath: string
	  }
	| {
			status: "not-found"
			candidates: ResolvedPathCandidate[]
	  }
	| {
			status: "ambiguous"
			candidates: ResolvedPathCandidate[]
			matches: ResolveDesignAttachmentMatch[]
	  }

function normalizeWorkspacePathKey(path: string): string {
	if (!path) return ""
	return stripPathEdgeSlashes(path)
}

/**
 * `images/a.png` 这类没有 `./` 的历史裸资源路径，才需要读取期兼容解析。
 * `./images/a.png`、`/foo/images/a.png` 与普通工作区路径的语义均已明确，不能参与回退。
 */
export function isLegacyBareDesignResourcePath(path: string): boolean {
	const trimmed = path.trim()
	return (
		Boolean(trimmed) &&
		!trimmed.startsWith("/") &&
		!hasCurrentDirectoryPrefix(trimmed) &&
		!isRemoteOrSpecialPath(trimmed) &&
		isCanvasResourceRootPath(trimmed)
	)
}

function getStrictCurrentCanvasWorkspaceCandidates(
	rawPath: string,
	ctx: DesignPathContext,
): string[] {
	return resolveStrictDesignDslCanvasResourceCandidates(rawPath, ctx.designProjectBasePath)
		.workspaceRelative
}

function toResolvedPathCandidates(paths: string[]): ResolvedPathCandidate[] {
	const seen = new Set<string>()
	const candidates: ResolvedPathCandidate[] = []
	for (const resolvedPath of paths) {
		const normalizedPath = normalizeWorkspacePathKey(resolvedPath)
		if (!normalizedPath || seen.has(normalizedPath)) continue
		seen.add(normalizedPath)
		candidates.push({ resolvedPath, normalizedPath })
	}
	return candidates
}

function getAttachmentLookupCandidates(
	rawPath: string,
	ctx: DesignPathContext,
	mode: DesignPathMode,
): ResolvedPathCandidate[] {
	return toResolvedPathCandidates(toWorkspaceRelativeCandidates(rawPath, ctx, { mode }))
}

function toFoundAttachmentResult(match: CandidateMatch): ResolveDesignAttachmentResult {
	return {
		status: "found",
		fileItem: match.fileItem,
		resolvedPath: match.resolvedPath,
		normalizedPath: match.normalizedPath,
	}
}

function toAttachmentMatches(matches: CandidateMatch[]): ResolveDesignAttachmentMatch[] {
	return matches.map((match) => ({
		fileItem: match.fileItem,
		resolvedPath: match.resolvedPath,
		normalizedPath: match.normalizedPath,
	}))
}

/**
 * 写入 magic.project.js / Canvas storage 的路径。
 * 当前画布资源统一收口为 `./images|videos|audios/...`，其他工作区资源使用 `/...`。
 */
function toDesignDslPath(rawPath: string, ctx: DesignPathContext = {}): string {
	return normalizeDesignStoragePathForCanvas(rawPath, ctx.designProjectBasePath)
}

/**
 * 将附件树等来源中语义明确的工作区路径写入 Canvas DSL。
 * 即使附件路径是历史无前导 `/` 形式，也按工作区根解析，不套用裸 `images/...` 的旧 DSL 语义。
 */
export function toDesignDslPathFromWorkspacePath(
	rawPath: string,
	ctx: DesignPathContext = {},
): string {
	const trimmed = rawPath.trim()
	if (!trimmed || isRemoteOrSpecialPath(trimmed) || hasCurrentDirectoryPrefix(trimmed)) {
		return toDesignDslPath(rawPath, ctx)
	}
	const workspaceAbsolutePath = `/${normalizeWorkspacePathKey(trimmed)}`
	return toDesignDslPath(workspaceAbsolutePath, ctx)
}

/**
 * 与附件树 `relative_file_path` 对齐的候选路径。
 *
 * strict-current-canvas 只接受显式 `./images/a.png` 当前画布路径。
 * 历史裸 `images/a.png` 必须进入 legacy-recovery，由附件证据决定实际归属。
 */
export function toWorkspaceRelativeCandidates(
	rawPath: string,
	ctx: DesignPathContext = {},
	options?: { mode?: DesignPathMode },
): string[] {
	const mode = options?.mode ?? "strict-current-canvas"
	if (mode === "strict-current-canvas") {
		if (isLegacyBareDesignResourcePath(rawPath)) return []
		const strictCandidates = getStrictCurrentCanvasWorkspaceCandidates(rawPath, ctx)
		if (strictCandidates.length > 0) return strictCandidates
	}
	return resolveDesignDslPathCandidatesToWorkspaceRelative(rawPath, ctx.designProjectBasePath)
}

/**
 * DSL / workspace path 到附件树 FileItem 的统一解析入口。
 */
export function resolveDesignAttachment(
	rawPath: string,
	ctx: DesignPathContext = {},
	options?: { mode?: DesignPathMode },
): ResolveDesignAttachmentResult {
	const mode = options?.mode ?? "strict-current-canvas"
	const candidates = getAttachmentLookupCandidates(rawPath, ctx, mode)
	if (candidates.length === 0) return { status: "not-found", candidates }

	const matches = collectAttachmentMatchesAmongCandidates(
		candidates,
		ctx.flatAttachments ?? [],
		ctx.attachmentIndex,
	)
	if (matches.length === 0) return { status: "not-found", candidates }

	const fileIds = new Set(matches.map((match) => match.fileItem.file_id).filter(Boolean))
	if (fileIds.size <= 1) {
		return toFoundAttachmentResult(matches[0])
	}

	return {
		status: "ambiguous",
		candidates,
		matches: toAttachmentMatches(matches),
	}
}

/**
 * 读取/API 边界的过渡期解析器。
 *
 * 正常路径仍走严格语义；只有历史裸资源路径会同时检查“当前画布”和“工作区根”两个候选。
 * 双候选指向不同附件时返回 ambiguous，调用方必须失败关闭，不能回落到当前画布。
 */
export function resolveDesignPathForOperation(
	rawPath: string,
	ctx: DesignPathContext & { attachmentsReady?: boolean } = {},
): DesignPathOperationResolution {
	const candidates = isLegacyBareDesignResourcePath(rawPath)
		? getAttachmentLookupCandidates(rawPath, ctx, "legacy-recovery")
		: getAttachmentLookupCandidates(rawPath, ctx, "strict-current-canvas")

	if (candidates.length === 0) return { status: "not-found", candidates }

	if (!isLegacyBareDesignResourcePath(rawPath)) {
		const first = candidates[0]
		return {
			status: "found",
			resolvedPath: first.resolvedPath,
			normalizedPath: first.normalizedPath,
			legacyRecovered: false,
		}
	}

	const attachmentsReady =
		ctx.attachmentsReady !== undefined
			? ctx.attachmentsReady
			: Array.isArray(ctx.flatAttachments)
	if (!attachmentsReady) {
		return { status: "attachments-pending", candidates }
	}

	const resolved = resolveDesignAttachment(rawPath, ctx, { mode: "legacy-recovery" })
	if (resolved.status === "found") {
		return {
			status: "found",
			fileItem: resolved.fileItem,
			resolvedPath: resolved.resolvedPath,
			normalizedPath: resolved.normalizedPath,
			legacyRecovered: true,
		}
	}

	return { status: resolved.status, candidates }
}

export function toDesignProjectBasePath(
	designFolderPath: string | null | undefined,
): string | undefined {
	return normalizeMagicProjectDirToBase(designFolderPath)
}

export function rewriteLayerElementsToDesignDslPaths(
	elements: Parameters<typeof rewriteLayerElementsPathsForMagicProjectSave>[0],
	designProjectBasePath: string,
	options?: { rewritePath?: (path: string) => string },
): void {
	const rewritePath: DesignDslPathRewrite | undefined = options?.rewritePath
		? (path) => options.rewritePath?.(path) ?? path
		: undefined
	rewriteLayerElementsPathsForMagicProjectSave(elements, designProjectBasePath, { rewritePath })
}
