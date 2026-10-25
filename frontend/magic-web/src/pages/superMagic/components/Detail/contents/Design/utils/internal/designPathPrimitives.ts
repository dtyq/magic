/**
 * @internal
 * 仅供 `../designPath` 门面内部使用；生产业务代码请统一从 `designPath` 导入路径能力。
 */
import type { LayerElement } from "@/components/CanvasDesign/runtime/document/types"
import {
	formatCanvasRelativeResourcePath,
	hasCurrentDirectoryPrefix,
	isCanvasResourceRootPath,
	isRemoteOrSpecialPath,
	stripCurrentDirectoryPrefix,
	stripPathEdgeSlashes,
} from "@/components/CanvasDesign/runtime/shared/path/canvasResourcePath"

/**
 * 与 {@link normalizePath}（Design）一致：去掉首尾 `/`，用于与 relative_file_path 比对
 */
function stripEdgeSlashes(path: string): string {
	return stripPathEdgeSlashes(path)
}

function isLikelyLegacyCanvasRelativePath(path: string): boolean {
	return isCanvasResourceRootPath(path)
}

export function isDesignDslCanvasRelativeResourcePath(path: string): boolean {
	const trimmed = path.trim()
	if (!trimmed || isRemoteOrSpecialPath(trimmed)) return false
	// A leading slash is an explicit workspace-root anchor, even for `/images/...`.
	if (trimmed.startsWith("/")) return false

	const resourcePath = hasCurrentDirectoryPrefix(trimmed)
		? stripCurrentDirectoryPrefix(trimmed)
		: stripEdgeSlashes(trimmed)

	return isLikelyLegacyCanvasRelativePath(resourcePath)
}

export interface StrictDesignDslCanvasResourceCandidates {
	/** Workspace-relative paths that must live under the current design base path. */
	workspaceRelative: string[]
	/** DSL-relative paths that are valid only when the file is inside the current design root. */
	rootRelative: string[]
}

export function resolveStrictDesignDslCanvasResourceCandidates(
	path: string,
	projectBasePath: string | undefined,
): StrictDesignDslCanvasResourceCandidates {
	const empty: StrictDesignDslCanvasResourceCandidates = {
		workspaceRelative: [],
		rootRelative: [],
	}
	const trimmed = path.trim()
	const base = stripEdgeSlashes(projectBasePath?.trim() ?? "")
	if (
		!trimmed ||
		!base ||
		!hasCurrentDirectoryPrefix(trimmed) ||
		!isDesignDslCanvasRelativeResourcePath(trimmed)
	)
		return empty

	const resourcePath = stripEdgeSlashes(
		hasCurrentDirectoryPrefix(trimmed)
			? stripCurrentDirectoryPrefix(trimmed)
			: stripEdgeSlashes(trimmed),
	)
	if (!resourcePath || !isLikelyLegacyCanvasRelativePath(resourcePath)) return empty

	return {
		workspaceRelative: [stripEdgeSlashes(`${base}/${resourcePath}`)],
		rootRelative: [resourcePath],
	}
}

function formatCurrentDirectoryPath(path: string): string {
	return formatCanvasRelativeResourcePath(path)
}

export function isRelativeDesignDslPath(path: string): boolean {
	const trimmed = path.trim()
	if (!trimmed || isRemoteOrSpecialPath(trimmed) || trimmed.startsWith("/")) return false
	return (
		trimmed === "." ||
		trimmed === "./" ||
		trimmed === ".\\" ||
		hasCurrentDirectoryPrefix(trimmed) ||
		isLikelyLegacyCanvasRelativePath(trimmed)
	)
}

/**
 * 宿主把附件树文件路径传入 CanvasDesign 时，统一只输出两类合法值：
 * - 当前设计目录内资源：`./images/x.png`
 * - 其他工作区资源：`/foo/bar.png`
 */
export function normalizeDesignAttachmentPathForCanvas(
	workspacePath: string,
	projectBasePath: string | undefined,
): string {
	if (!workspacePath) return workspacePath

	const trimmed = workspacePath.trim()
	if (!trimmed || isRemoteOrSpecialPath(trimmed)) return workspacePath

	if (hasCurrentDirectoryPrefix(trimmed)) {
		const relativePath = stripCurrentDirectoryPrefix(trimmed)
		return formatCurrentDirectoryPath(relativePath)
	}

	if (projectBasePath?.trim()) {
		const dslPath = toDesignDslRelativeStoragePath(trimmed, projectBasePath.trim())
		if (dslPath !== trimmed) return dslPath
	}

	if (trimmed.startsWith("/")) return `/${stripEdgeSlashes(trimmed)}`
	if (!trimmed.includes("/") && !trimmed.includes("\\")) return trimmed

	return `/${stripEdgeSlashes(trimmed)}`
}

/**
 * 宿主读写 CanvasDesign storage 时，统一把设计目录内资源收口为 DSL 相对路径。
 * 兼容历史脏数据：`/画布/images/x`、`画布/images/x`、`./images/x`。
 */
export function normalizeDesignStoragePathForCanvas(
	storedPath: string,
	projectBasePath: string | undefined,
): string {
	if (!storedPath) return storedPath

	const trimmed = storedPath.trim()
	if (!trimmed || isRemoteOrSpecialPath(trimmed)) return storedPath

	if (projectBasePath?.trim()) {
		return toDesignDslRelativeStoragePath(trimmed, projectBasePath.trim())
	}

	if (hasCurrentDirectoryPrefix(trimmed)) {
		const relativePath = stripCurrentDirectoryPrefix(trimmed)
		return formatCurrentDirectoryPath(relativePath)
	}

	if (isLikelyLegacyCanvasRelativePath(trimmed)) {
		return formatCurrentDirectoryPath(trimmed)
	}

	if (trimmed.startsWith("/")) return `/${stripEdgeSlashes(trimmed)}`
	if (trimmed.includes("/") || trimmed.includes("\\")) {
		return `/${stripEdgeSlashes(trimmed)}`
	}

	return trimmed
}

/**
 * 画布目录路径（如 `/foo/` 或 `foo/`）转为 DSL 用的项目根段（`foo`）
 */
export function normalizeMagicProjectDirToBase(
	designFolderPath: string | null | undefined,
): string | undefined {
	if (!designFolderPath) return undefined
	const n = stripEdgeSlashes(designFolderPath.trim())
	return n || undefined
}

/**
 * 将工作区路径转为写入 magic.project.js 的路径：
 * - 当前画布目录内资源：`./images/a.png`
 * - 非当前画布目录资源：`/foo/bar.png`
 * - 历史裸相对资源根（如 `images/a.png`）保存时迁移为 `./images/a.png`
 * - URL、blob、不含 `/` 的单段（多为 file_id）保持原样
 */
export function toDesignDslRelativeStoragePath(
	workspacePath: string,
	projectBasePath: string,
): string {
	const s = workspacePath.trim()
	if (!s) return workspacePath
	if (isRemoteOrSpecialPath(s)) return workspacePath
	if (!s.includes("/") && !s.includes("\\")) return workspacePath

	const ws = stripEdgeSlashes(s)
	const base = stripEdgeSlashes(projectBasePath)
	if (!base) return s.startsWith("/") ? ws : workspacePath

	if (hasCurrentDirectoryPrefix(s)) {
		const rest = stripCurrentDirectoryPrefix(s)
		return formatCurrentDirectoryPath(rest)
	}

	if (ws === base) return "."

	if (ws.startsWith(base + "/")) {
		const rest = ws.slice(base.length + 1)
		return formatCurrentDirectoryPath(rest)
	}

	if (!s.startsWith("/") && isLikelyLegacyCanvasRelativePath(ws)) {
		return formatCurrentDirectoryPath(ws)
	}

	return ws ? `/${ws}` : workspacePath
}

/**
 * 将 DSL 中存储的路径解析为与工作区 relative_file_path 一致的形式（无首尾 `/` 的段），供 findFileItem / 缓存索引使用
 * 兼容：旧数据 `/画布名/images/x`、新数据 `./images/x`、历史 `images/x`
 */
export function resolveDesignDslPathToWorkspaceRelative(
	storedPath: string,
	projectBasePath: string | undefined,
): string {
	if (!storedPath || !projectBasePath?.trim()) return storedPath

	const trimmed = storedPath.trim()
	if (!trimmed) return storedPath
	if (isRemoteOrSpecialPath(trimmed)) return storedPath

	const base = stripEdgeSlashes(projectBasePath)
	if (!base) return storedPath

	const norm = stripEdgeSlashes(trimmed)

	if (trimmed === "." || trimmed === "./" || trimmed === ".\\") return base

	if (!norm.includes("/")) return trimmed.startsWith("/") ? norm : storedPath

	if (norm === base || norm.startsWith(base + "/")) return norm

	if (hasCurrentDirectoryPrefix(trimmed)) {
		const rel = stripCurrentDirectoryPrefix(trimmed)
		if (!rel) return base
		return stripEdgeSlashes(`${base}/${rel}`)
	}

	if (!trimmed.startsWith("/") && isLikelyLegacyCanvasRelativePath(norm)) {
		return stripEdgeSlashes(`${base}/${norm}`)
	}

	return norm
}

/**
 * 读取历史裸路径时提供候选：
 * - `images/a.png` 先按当前画布相对路径找，再按工作区绝对路径找
 * - 带目录前缀的项目路径（如 `其他画布/images/a.png`）始终从项目根解析
 *
 * 后者不是相对当前画布的路径，不能再拼接当前画布目录作为回退候选。
 */
export function resolveDesignDslPathCandidatesToWorkspaceRelative(
	storedPath: string,
	projectBasePath: string | undefined,
): string[] {
	if (!storedPath || !projectBasePath?.trim()) return [storedPath]

	const trimmed = storedPath.trim()
	if (!trimmed || isRemoteOrSpecialPath(trimmed)) return [storedPath]

	const base = stripEdgeSlashes(projectBasePath)
	const norm = stripEdgeSlashes(trimmed)
	if (
		!base ||
		!norm.includes("/") ||
		hasCurrentDirectoryPrefix(trimmed) ||
		trimmed.startsWith("/")
	) {
		return [resolveDesignDslPathToWorkspaceRelative(storedPath, base)]
	}

	if (norm === base || norm.startsWith(`${base}/`)) return [norm]

	// 历史数据中的 `images/a.png` 无法仅凭字符串区分语义：
	// 仅资源根裸路径允许在“当前画布”和“项目根”之间恢复。
	if (isLikelyLegacyCanvasRelativePath(norm)) {
		return Array.from(new Set([stripEdgeSlashes(`${base}/${norm}`), norm].filter(Boolean)))
	}

	// `foo/bar.png` 明确从项目根开始；不允许退回到 `${base}/foo/bar.png`。
	return [norm]
}

export type DesignDslPathRewrite = (path: string, projectBasePath: string) => string

function setPathFieldForDsl(
	target: Record<string, unknown>,
	key: string,
	base: string,
	rewritePath: DesignDslPathRewrite,
): void {
	const v = target[key]
	if (typeof v !== "string" || !v) return
	target[key] = rewritePath(v, base)
}

function setReferenceImageOptionsForDsl(
	target: Record<string, unknown>,
	key: string,
	base: string,
	rewritePath: DesignDslPathRewrite,
): void {
	const value = target[key]
	if (!Array.isArray(value) || !value.length) return

	target[key] = value.map((raw) => {
		if (!raw || typeof raw !== "object") return raw
		const entry = raw as Record<string, unknown>
		const path = entry.path
		if (typeof path !== "string" || !path) return raw
		return {
			...entry,
			path: rewritePath(path, base),
		}
	})
}

/**
 * 就地改写图层树中所有应持久化的路径字段（写入 magic.project.js 前调用，勿直接改 MobX/Immer 源数据）
 */
export function rewriteLayerElementsPathsForMagicProjectSave(
	elements: LayerElement[],
	projectBasePath: string,
	options?: { rewritePath?: DesignDslPathRewrite },
): void {
	const base = stripEdgeSlashes(projectBasePath)
	if (!base || !elements?.length) return
	const rewritePath = options?.rewritePath ?? toDesignDslRelativeStoragePath
	const rewriteImageContent = (content: Record<string, unknown>): void => {
		setPathFieldForDsl(content, "src", base, rewritePath)
		const request = content.generateImageRequest as Record<string, unknown> | undefined
		if (request) {
			setPathFieldForDsl(request, "file_dir", base, rewritePath)
			if (Array.isArray(request.reference_images)) {
				request.reference_images = request.reference_images.map((reference) =>
					typeof reference === "string" ? rewritePath(reference, base) : reference,
				)
			}
			setReferenceImageOptionsForDsl(request, "reference_image_options", base, rewritePath)
		}
		const taskMeta = content.imageGenerationTaskMeta as Record<string, unknown> | undefined
		if (taskMeta) {
			setPathFieldForDsl(taskMeta, "file_path", base, rewritePath)
			setReferenceImageOptionsForDsl(taskMeta, "reference_image_options", base, rewritePath)
		}
	}
	const rewriteVideoContent = (content: Record<string, unknown>): void => {
		setPathFieldForDsl(content, "src", base, rewritePath)
		const request = content.generateVideoRequest as Record<string, unknown> | undefined
		const inputs = request?.inputs as Record<string, unknown> | undefined
		if (!request) return
		setPathFieldForDsl(request, "file_dir", base, rewritePath)
		if (!inputs) return
		const rewriteUri = (value: unknown): void => {
			if (value && typeof value === "object") {
				setPathFieldForDsl(value as Record<string, unknown>, "uri", base, rewritePath)
			}
		}
		for (const field of [
			"frames",
			"reference_images",
			"reference_videos",
			"reference_audios",
			"audio",
		]) {
			const items = inputs[field]
			if (Array.isArray(items)) items.forEach(rewriteUri)
		}
		rewriteUri(inputs.video)
		rewriteUri(inputs.mask)
		rewriteUri(inputs.draft_task)
	}

	function walk(element: Record<string, unknown>): void {
		if (!element || typeof element !== "object") return
		if (Array.isArray(element.contents)) {
			for (const content of element.contents) {
				if (!content || typeof content !== "object") continue
				const contentRecord = content as Record<string, unknown>
				if (element.type === "image") rewriteImageContent(contentRecord)
				if (element.type === "video") rewriteVideoContent(contentRecord)
				if (element.type === "audio") {
					setPathFieldForDsl(contentRecord, "src", base, rewritePath)
				}
			}
		}

		if (Array.isArray(element.children)) {
			for (const child of element.children as Record<string, unknown>[]) {
				walk(child)
			}
		}
	}

	for (const el of elements as unknown as Record<string, unknown>[]) {
		walk(el)
	}
}
