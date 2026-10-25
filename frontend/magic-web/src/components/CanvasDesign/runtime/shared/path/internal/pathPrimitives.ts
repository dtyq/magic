/**
 * @internal
 * CanvasDesign 路径底层原语。生产代码请统一从 `../canvasResourcePath` 导入语义 API。
 */
import type { UploadFileResponse } from "../../../../public/magic-types"

/**
 * 画布 DSL 约定的内部资源根目录。只有这些根目录下的裸路径才允许按
 * `./xxx` 的当前画布相对路径解释；其他裸路径默认是工作区路径。
 */
export const CANVAS_RESOURCE_ROOTS = ["images", "videos", "audios"] as const

/**
 * 上传接口历史上可能把目录和文件名直接拼接在一起，例如 `imagesimage_xxx`。
 * 修补规则跟随资源根集中维护，避免新增 audio 类资源时遗漏。
 */
const UPLOAD_RESULT_JOIN_REPAIR_RULES: Array<{
	root: (typeof CANVAS_RESOURCE_ROOTS)[number]
	fileNamePrefix: string
}> = [
	{ root: "images", fileNamePrefix: "image_" },
	{ root: "videos", fileNamePrefix: "video_" },
	{ root: "audios", fileNamePrefix: "audio_" },
]

const ASSET_RESOURCE_PATH_PATTERN = /^asset:\/\/([^/\\\s?#]+)$/i
const ASSET_RESOURCE_SCHEME_PATTERN = /^asset:/i

export function normalizePathSeparators(path: string): string {
	return path.replace(/\\/g, "/")
}

/**
 * Build the canonical Canvas path for an asset service ID.
 * Asset IDs are opaque single path segments and must never be assembled by callers.
 */
export function buildAssetResourcePath(assetId: string): string {
	const normalizedAssetId = assetId.trim()
	if (!normalizedAssetId || /[\\/\s?#]/.test(normalizedAssetId)) {
		throw new Error("Invalid asset ID")
	}
	return `asset://${normalizedAssetId}`
}

/** Extract the opaque asset ID from a canonical or whitespace-padded asset path. */
export function parseAssetResourcePath(path: string): string | undefined {
	return ASSET_RESOURCE_PATH_PATTERN.exec(path.trim())?.[1]
}

export function isAssetResourcePath(path: string): boolean {
	return parseAssetResourcePath(path) !== undefined
}

/** Distinguishes malformed asset references from ordinary workspace paths. */
export function isAssetResourceScheme(path: string): boolean {
	return ASSET_RESOURCE_SCHEME_PATTERN.test(path.trim())
}

/** Opaque asset references are supplied by an upstream asset service and must not be path-normalized. */
export function isOpaqueAssetReference(path: string): boolean {
	return isAssetResourcePath(path)
}

export function isRemoteOrSpecialPath(path: string): boolean {
	const trimmed = path.trim()
	if (!trimmed) return false
	if (isAssetResourceScheme(trimmed)) return true
	if (/^https?:\/\//i.test(trimmed)) return true
	if (trimmed.startsWith("data:") || trimmed.startsWith("blob:")) return true
	if (/^\/\/[^/]+/.test(trimmed)) return true
	return false
}

export function stripPathEdgeSlashes(path: string): string {
	if (!path) return ""
	return normalizePathSeparators(path).replace(/^\/+|\/+$/g, "")
}

export function stripCurrentDirectoryPrefix(path: string): string {
	return stripPathEdgeSlashes(normalizePathSeparators(path).replace(/^\.\/+/, ""))
}

export function getFirstPathSegment(path: string): string {
	return stripPathEdgeSlashes(path).split("/")[0] || ""
}

export function hasCurrentDirectoryPrefix(path: string): boolean {
	return path.startsWith("./") || path.startsWith(".\\")
}

export function isCanvasRelativeResourcePath(path: string): boolean {
	const firstSegment = getFirstPathSegment(path)
	return CANVAS_RESOURCE_ROOTS.some((root) => root === firstSegment)
}

export function formatCanvasRelativeResourcePath(path: string): string {
	const normalized = stripPathEdgeSlashes(path)
	if (!normalized || normalized === ".") return "."
	return `./${normalized}`
}

export function buildVirtualResourceScope(
	hostScope: string | undefined,
	designProjectId: string,
): string {
	const normalizedHostScope = stripPathEdgeSlashes(hostScope || "")
	const normalizedDesignProjectId = stripPathEdgeSlashes(designProjectId)
	const designScope = normalizedDesignProjectId ? `design/${normalizedDesignProjectId}` : ""
	if (!normalizedHostScope) return designScope
	if (!normalizedDesignProjectId) return normalizedHostScope
	if (normalizedHostScope.endsWith(designScope)) {
		return normalizedHostScope
	}
	return `${normalizedHostScope}/${designScope}`
}

/**
 * Namespace for SW offline bodies, persistent low images, and shared compressed bodies.
 * Host scope already identifies workspace/project; appending a runtime Canvas id would
 * store the same file once per preview instance.
 */
export function buildSharedMediaStorageScope(
	hostScope: string | undefined,
	fallbackCanvasId: string,
): string {
	return hostScope
		? buildVirtualResourceScope(hostScope, "")
		: buildVirtualResourceScope(undefined, fallbackCanvasId)
}

/**
 * 规范上传接口返回的 path：保留路径命名空间，只合并重复斜杠并修补目录名与文件名之间漏写斜杠的常见拼接错误。
 */
export function normalizeUploadResultPath(path: string): string {
	const trimmed = path.trim()
	if (!trimmed) {
		return trimmed
	}
	const assetId = parseAssetResourcePath(trimmed)
	if (assetId !== undefined) {
		return buildAssetResourcePath(assetId)
	}
	if (isAssetResourceScheme(trimmed)) {
		return trimmed
	}
	if (/^https?:\/\//i.test(trimmed)) {
		return trimmed
	}
	// 协议相对 URL（//host/...）不改动
	if (/^\/\/[^/]+/.test(trimmed)) {
		return trimmed
	}

	let p = trimmed.replace(/\/+/g, "/")
	// 普通工作区上传仍要修补历史拼接问题；private 上传不经过这里。
	p = repairUploadResultJoinedResourcePath(p)
	return p
}

/**
 * 将接口分字段返回的目录与文件名拼成逻辑 path（不依赖 file_dir 末尾是否带 "/"）。
 */
export function joinUploadResultPath(fileDir: string, fileName: string): string {
	const dir = fileDir.trim().replace(/\/+$/, "")
	const name = fileName.trim().replace(/^\/+/, "")
	if (!dir) {
		return normalizeUploadResultPath(name)
	}
	if (!name) {
		return normalizeUploadResultPath(dir)
	}
	return normalizeUploadResultPath(`${dir}/${name}`)
}

/**
 * 上传回调 / 返回值中的 path 统一规范化，其它字段原样透传。
 */
export function normalizeUploadFileResponse<T extends Pick<UploadFileResponse, "path">>(
	result: T,
): T {
	return { ...result, path: normalizeUploadResultPath(result.path) }
}

export function repairUploadResultJoinedResourcePath(path: string): string {
	// 只修补已知画布资源目录的拼接错误，避免误改用户自定义目录名。
	return UPLOAD_RESULT_JOIN_REPAIR_RULES.reduce((result, rule) => {
		const pattern = new RegExp(`(^|/)${rule.root}(?=${rule.fileNamePrefix})`, "gi")
		return result.replace(pattern, `$1${rule.root}/`)
	}, path)
}
