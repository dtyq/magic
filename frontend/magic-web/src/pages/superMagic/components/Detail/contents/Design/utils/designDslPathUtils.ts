import type { LayerElement } from "@/components/CanvasDesign/canvas/types"
import {
	formatCanvasRelativeResourcePath,
	hasCurrentDirectoryPrefix,
	isCanvasRelativeResourcePath,
	isRemoteOrSpecialPath,
	stripCurrentDirectoryPrefix,
	stripPathEdgeSlashes,
} from "@/components/CanvasDesign/canvas/utils/pathUtils"

/**
 * 与 {@link normalizePath}（Design）一致：去掉首尾 `/`，用于与 relative_file_path 比对
 */
function stripEdgeSlashes(path: string): string {
	return stripPathEdgeSlashes(path)
}

function isLikelyLegacyCanvasRelativePath(path: string): boolean {
	return isCanvasRelativeResourcePath(path)
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
 * - 其他工作区资源：`foo/bar.png`
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

	if (trimmed.startsWith("/")) return stripEdgeSlashes(trimmed)
	if (!trimmed.includes("/") && !trimmed.includes("\\")) return trimmed

	return stripEdgeSlashes(trimmed)
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

	if (trimmed.startsWith("/")) return stripEdgeSlashes(trimmed)

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
 * - 非当前画布目录资源：`foo/bar.png`
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

	if (!s.startsWith("/")) return ws || "."

	return ws || workspacePath
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

	if (!norm.includes("/")) return storedPath

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
 * - 新语义的裸工作区路径（如 `其他画布/images/a.png`）优先按绝对路径找
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

	const relativeCandidate = stripEdgeSlashes(`${base}/${norm}`)
	const absoluteCandidate = norm
	// 历史数据中的 `images/a.png` 无法仅凭字符串区分语义：
	// 画布资源根先按当前画布找，非画布资源根先按工作区路径找。
	const candidates = isLikelyLegacyCanvasRelativePath(norm)
		? [relativeCandidate, absoluteCandidate]
		: [absoluteCandidate, relativeCandidate]

	return Array.from(new Set(candidates.filter(Boolean)))
}

export function resolveDesignDslPathToWorkspaceAbsoluteByCandidates(
	storedPath: string,
	projectBasePath: string | undefined,
	options?: {
		ensureTrailingSlash?: boolean
		pathExists?: (workspaceRelativePath: string) => boolean
	},
): string {
	if (!storedPath) return storedPath

	const trimmed = storedPath.trim()
	if (!trimmed) return storedPath
	if (isRemoteOrSpecialPath(trimmed)) return storedPath

	const base = stripEdgeSlashes(projectBasePath || "")
	if (
		base &&
		(trimmed === "." || trimmed === "./" || trimmed === ".\\" || trimmed === `/${base}`)
	) {
		let absolute = `/${base}`
		if (options?.ensureTrailingSlash && !absolute.endsWith("/")) {
			absolute = `${absolute}/`
		}
		return absolute
	}

	const candidates = resolveDesignDslPathCandidatesToWorkspaceRelative(trimmed, projectBasePath)
	// 同一个历史裸路径可能对应两个位置，优先选择附件树中真实存在的文件。
	const resolved = options?.pathExists
		? (candidates.find((candidate) => options.pathExists?.(candidate)) ?? candidates[0])
		: candidates[0]

	if (!resolved || isRemoteOrSpecialPath(resolved)) return resolved || storedPath
	if (!resolved.includes("/") && !resolved.includes("\\")) return storedPath

	let absolute = `/${stripEdgeSlashes(resolved)}`
	if (options?.ensureTrailingSlash && !absolute.endsWith("/")) {
		absolute = `${absolute}/`
	}
	return absolute
}

export function createDesignWorkspacePathExists(
	flatAttachments?: Array<{ is_directory?: boolean; relative_file_path?: string }>,
): (workspaceRelativePath: string) => boolean {
	return (workspaceRelativePath) => {
		// 统一生成/编辑接口的存在性判断，保证 fallback 候选不会因各 hook 比较规则不同而分叉。
		const normalizedPath = stripEdgeSlashes(workspaceRelativePath)
		if (!normalizedPath || !flatAttachments?.length) return false
		return flatAttachments.some(
			(item) =>
				!item.is_directory &&
				stripEdgeSlashes(item.relative_file_path || "") === normalizedPath,
		)
	}
}

/**
 * 将 DSL 中的路径还原为请求后端时使用的工作区绝对路径。
 * - `images/a.png` -> `/画布/images/a.png`（历史兼容）
 * - `./images/a.png` -> `/画布/images/a.png`
 * - `/画布/images/a.png` -> `/画布/images/a.png`
 * - `.` / `./` -> `/画布/`
 */
export function resolveDesignDslPathToWorkspaceAbsolute(
	storedPath: string,
	projectBasePath: string | undefined,
	options?: { ensureTrailingSlash?: boolean },
): string {
	if (!storedPath) return storedPath

	const trimmed = storedPath.trim()
	if (!trimmed) return storedPath
	if (isRemoteOrSpecialPath(trimmed)) return storedPath

	const base = stripEdgeSlashes(projectBasePath || "")
	if (!base) {
		if (!trimmed.startsWith("/")) return storedPath
		if (!options?.ensureTrailingSlash) return trimmed
		return trimmed.endsWith("/") ? trimmed : `${trimmed}/`
	}

	const isCurrentDirectory =
		trimmed === "." || trimmed === "./" || trimmed === ".\\" || trimmed === `/${base}`

	if (isCurrentDirectory) {
		let absolute = base ? `/${base}` : "/"
		if (options?.ensureTrailingSlash && !absolute.endsWith("/")) {
			absolute = `${absolute}/`
		}
		return absolute
	}

	return resolveDesignDslPathToWorkspaceAbsoluteByCandidates(trimmed, base, options)
}

/**
 * 供 Design 后端接口使用的相对路径：
 * - 当前设计目录内资源：`images/a.png`、`videos/a.mp4`、`audios/a.mp3`
 * - 其他项目资源：`foo/bar.png`
 * - 兼容历史绝对路径：`/foo/bar.png` -> `foo/bar.png`
 */
export function normalizeDesignApiPath(
	storedPath: string,
	projectBasePath: string | undefined,
	options?: { ensureTrailingSlash?: boolean },
): string {
	if (!storedPath) return storedPath

	const trimmed = storedPath.trim()
	if (!trimmed) return storedPath
	if (isRemoteOrSpecialPath(trimmed)) return storedPath

	let normalized = projectBasePath?.trim()
		? toDesignDslRelativeStoragePath(trimmed, projectBasePath.trim())
		: trimmed

	if (hasCurrentDirectoryPrefix(normalized)) {
		const relativePath = stripCurrentDirectoryPrefix(normalized)
		normalized = relativePath || "."
	}

	if (!isRemoteOrSpecialPath(normalized)) {
		if (normalized === ".") {
			normalized = options?.ensureTrailingSlash ? "./" : "."
		} else {
			normalized = normalized.replace(/^\/+/, "")
			if (options?.ensureTrailingSlash && normalized && !normalized.endsWith("/")) {
				normalized = `${normalized}/`
			}
		}
	}

	return normalized
}

function setPathFieldForDsl(target: Record<string, unknown>, key: string, base: string): void {
	const v = target[key]
	if (typeof v !== "string" || !v) return
	target[key] = toDesignDslRelativeStoragePath(v, base)
}

function setReferenceImageOptionsForDsl(
	target: Record<string, unknown>,
	key: string,
	base: string,
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
			path: toDesignDslRelativeStoragePath(path, base),
		}
	})
}

/**
 * 就地改写图层树中所有应持久化的路径字段（写入 magic.project.js 前调用，勿直接改 MobX/Immer 源数据）
 */
export function rewriteLayerElementsPathsForMagicProjectSave(
	elements: LayerElement[],
	projectBasePath: string,
): void {
	const base = stripEdgeSlashes(projectBasePath)
	if (!base || !elements?.length) return

	function walk(element: Record<string, unknown>): void {
		if (!element || typeof element !== "object") return

		if (element.type === "image") {
			setPathFieldForDsl(element, "src", base)

			const generateImageRequest = element.generateImageRequest as
				| {
						file_dir?: string
						reference_images?: string[]
						reference_image_options?: Array<Record<string, unknown>>
				  }
				| undefined
			if (generateImageRequest && typeof generateImageRequest === "object") {
				setPathFieldForDsl(
					generateImageRequest as Record<string, unknown>,
					"file_dir",
					base,
				)
				if (
					Array.isArray(generateImageRequest.reference_images) &&
					generateImageRequest.reference_images.length > 0
				) {
					generateImageRequest.reference_images =
						generateImageRequest.reference_images.map((ref) =>
							typeof ref === "string"
								? toDesignDslRelativeStoragePath(ref, base)
								: ref,
						)
				}
				setReferenceImageOptionsForDsl(
					generateImageRequest as Record<string, unknown>,
					"reference_image_options",
					base,
				)
			}

			const imageGenerationTaskMeta = element.imageGenerationTaskMeta as
				| Record<string, unknown>
				| undefined
			if (imageGenerationTaskMeta && typeof imageGenerationTaskMeta === "object") {
				setPathFieldForDsl(imageGenerationTaskMeta, "file_path", base)
				setPathFieldForDsl(imageGenerationTaskMeta, "canvas_path", base)
				setPathFieldForDsl(imageGenerationTaskMeta, "mask_path", base)
				setPathFieldForDsl(imageGenerationTaskMeta, "mark_path", base)
				setReferenceImageOptionsForDsl(
					imageGenerationTaskMeta,
					"reference_image_options",
					base,
				)
			}

			const generateHightImageRequest = element.generateHightImageRequest as
				| Record<string, unknown>
				| undefined
			if (generateHightImageRequest && typeof generateHightImageRequest === "object") {
				setPathFieldForDsl(generateHightImageRequest, "file_path", base)
				setPathFieldForDsl(generateHightImageRequest, "file_dir", base)
				setReferenceImageOptionsForDsl(
					generateHightImageRequest,
					"reference_image_options",
					base,
				)
			}
		}

		if (element.type === "video") {
			setPathFieldForDsl(element, "src", base)

			const generateVideoRequest = element.generateVideoRequest as
				| {
						file_dir?: string
						inputs?: {
							frames?: Array<{ uri?: string }>
							reference_images?: Array<{ uri?: string }>
							reference_videos?: Array<{ uri?: string }>
							reference_audios?: Array<{ uri?: string }>
							video?: { uri?: string }
							mask?: { uri?: string }
							audio?: Array<{ uri?: string }>
						}
				  }
				| undefined

			if (generateVideoRequest && typeof generateVideoRequest === "object") {
				setPathFieldForDsl(
					generateVideoRequest as Record<string, unknown>,
					"file_dir",
					base,
				)

				if (Array.isArray(generateVideoRequest.inputs?.frames)) {
					generateVideoRequest.inputs.frames.forEach((frame) => {
						if (frame?.uri && typeof frame.uri === "string") {
							frame.uri = toDesignDslRelativeStoragePath(frame.uri, base)
						}
					})
				}
				if (Array.isArray(generateVideoRequest.inputs?.reference_images)) {
					generateVideoRequest.inputs.reference_images.forEach((item) => {
						if (item?.uri && typeof item.uri === "string") {
							item.uri = toDesignDslRelativeStoragePath(item.uri, base)
						}
					})
				}
				if (Array.isArray(generateVideoRequest.inputs?.reference_videos)) {
					generateVideoRequest.inputs.reference_videos.forEach((item) => {
						if (item?.uri && typeof item.uri === "string") {
							item.uri = toDesignDslRelativeStoragePath(item.uri, base)
						}
					})
				}
				if (Array.isArray(generateVideoRequest.inputs?.reference_audios)) {
					generateVideoRequest.inputs.reference_audios.forEach((item) => {
						if (item?.uri && typeof item.uri === "string") {
							item.uri = toDesignDslRelativeStoragePath(item.uri, base)
						}
					})
				}
				if (generateVideoRequest.inputs?.video?.uri) {
					generateVideoRequest.inputs.video.uri = toDesignDslRelativeStoragePath(
						generateVideoRequest.inputs.video.uri,
						base,
					)
				}
				if (generateVideoRequest.inputs?.mask?.uri) {
					generateVideoRequest.inputs.mask.uri = toDesignDslRelativeStoragePath(
						generateVideoRequest.inputs.mask.uri,
						base,
					)
				}
				if (Array.isArray(generateVideoRequest.inputs?.audio)) {
					generateVideoRequest.inputs.audio.forEach((item) => {
						if (item?.uri && typeof item.uri === "string") {
							item.uri = toDesignDslRelativeStoragePath(item.uri, base)
						}
					})
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
