import type { UploadFileResponse } from "../../types.magic"

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

export function normalizePathSeparators(path: string): string {
	return path.replace(/\\/g, "/")
}

export function isRemoteOrSpecialPath(path: string): boolean {
	const trimmed = path.trim()
	if (!trimmed) return false
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

/**
 * 当前画布工程内的弱规范化：统一分隔符、合并重复斜杠、修补历史上传拼接错误。
 *
 * 注意：仅靠字符串不能判断 `./a/b` 与工作区绝对路径 `a/b` 是否同一资源；判断是否为同一资源应使用
 * {@link resolveCanonicalResourcePath}（在宿主提供 `resolveAbsolutePath` 时归一到同一逻辑路径）。
 */
export function normalizePathLocal(path: string): string {
	const trimmed = path.trim()
	if (!trimmed) return trimmed
	if (isRemoteOrSpecialPath(trimmed)) return trimmed
	let p = normalizePathSeparators(trimmed).replace(/\/+/g, "/")
	p = repairUploadResultJoinedResourcePath(p)
	return p
}

/**
 * @deprecated 请使用 {@link normalizePathLocal} 或 {@link resolveCanonicalResourcePath}
 */
export function normalizeCanvasResourceCacheKey(path: string): string {
	return normalizePathLocal(path)
}

/**
 * 同步弱规范化，等同于 {@link normalizePathLocal}。
 */
export function normalizePath(path: string): string {
	return normalizePathLocal(path)
}

/**
 * 将画布/协议层路径归一为可与宿主对齐的规范键：若注入 `resolveAbsolutePath`，则以其解析结果为准
 *（相对 `./…`、裸路径、前导 `/` 等不同写法在宿主侧合一后再做上传路径清洗）；否则退化为 {@link normalizePathLocal}。
 */
export function resolveCanonicalResourcePath(
	path: string,
	resolveAbsolutePath?: (path: string) => string,
): string {
	const trimmed = path.trim()
	if (!trimmed) return trimmed
	if (isRemoteOrSpecialPath(trimmed)) return trimmed
	if (resolveAbsolutePath) {
		const resolveCandidates = [trimmed]
		const stripped = stripCurrentDirectoryPrefix(trimmed)
		if (stripped && stripped !== trimmed) {
			resolveCandidates.push(stripped)
		}
		for (const candidate of resolveCandidates) {
			try {
				const absolute = resolveAbsolutePath(candidate)
				return normalizeUploadResultPath(absolute)
			} catch {
				// 继续尝试下一个候选，最终再退回工程内弱规范化
			}
		}
	}
	return normalizePathLocal(trimmed)
}

export function pathsReferToSameResource(
	a: string,
	b: string,
	resolveAbsolutePath?: (path: string) => string,
): boolean {
	const ka = resolveCanonicalResourcePath(a, resolveAbsolutePath)
	const kb = resolveCanonicalResourcePath(b, resolveAbsolutePath)
	return ka === kb
}

/**
 * 规范上传接口返回的 path：非 URL 时移除旧格式前导 "/"、合并重复斜杠，并修补目录名与文件名之间漏写斜杠的常见拼接错误（如 .../videosvideo_ → .../videos/video_）。
 */
export function normalizeUploadResultPath(path: string): string {
	const trimmed = path.trim()
	if (!trimmed) {
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
	return p.replace(/^\/+/, "")
}

/**
 * 将接口分字段返回的目录与文件名拼成逻辑 path（不依赖 file_dir 末尾是否带 "/"）。
 */
export function joinUploadStoragePath(fileDir: string, fileName: string): string {
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
		const pattern = new RegExp(`/${rule.root}(?=${rule.fileNamePrefix})`, "gi")
		return result.replace(pattern, `/${rule.root}/`)
	}, path)
}
