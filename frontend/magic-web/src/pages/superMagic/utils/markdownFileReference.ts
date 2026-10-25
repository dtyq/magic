import type { FileReference } from "@/apis/modules/superMagic"
import { env } from "@/utils/env"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"

const WORKSPACE_ROOT_PREFIX = ".workspace/"
const MAGIC_ROOT_PREFIX = ".magic/"
const DEFAULT_REFERENCED_PROJECT_MOUNT_BASE_PATH = "/mnt/agfs/magicfs/referenced-projects"
// 标准 Agent 镜像的 HOME；自定义镜像通过同名运行配置覆盖，不能使用 Web 服务的 HOME。
const DEFAULT_USER_HOME_PATH = "/root"

export type MarkdownFileTarget =
	| { scope: "user"; relativePath: string }
	| { scope: "workspace"; relativePath: string }
	| { scope: "referenced-project"; projectId: string; relativePath: string }

export interface MarkdownFileHrefClassification {
	target: MarkdownFileTarget | null
	explicitFileReference: boolean
}

interface MarkdownFileHrefOptions {
	/** 已有工作区图片资源接受 /图片.png；普通网页链接不启用此语义。 */
	allowWorkspaceRoot?: boolean
}

function decodeURIComponentOnce(value: string): string | null {
	try {
		return decodeURIComponent(value)
	} catch {
		return null
	}
}

function hasControlCharacters(value: string): boolean {
	for (const char of value) {
		const code = char.charCodeAt(0)
		if (code < 32 || code === 127) return true
	}
	return false
}

export function isValidProjectReferenceId(projectId: unknown): projectId is string {
	return typeof projectId === "string" && /^[1-9][0-9]*$/.test(projectId)
}

/** 用户路径保持 POSIX 文件名原样，不进行工作区前缀裁剪或再次解码。 */
export function normalizeUserRelativePath(path: string): string | null {
	if (!path || path.startsWith("/") || hasControlCharacters(path)) return null
	const normalized = path.replace(/\/+$/, "")
	if (normalized.split("/").some((segment) => !segment || segment === "." || segment === ".."))
		return null
	return normalized
}

function normalizeWorkspacePathSegments(path: string): string | null {
	const normalizedSlashes = path.replace(/\\/g, "/")
	if (!normalizedSlashes || normalizedSlashes.startsWith("/")) return null

	const segments: string[] = []
	for (const segment of normalizedSlashes.split("/")) {
		if (!segment || segment === ".") continue
		if (segment.includes("\0")) return null
		if (segment === "..") {
			if (segments.length === 0) return null
			segments.pop()
		} else {
			segments.push(segment)
		}
	}
	return segments.length > 0 ? segments.join("/") : null
}

function normalizeReferencedProjectMountBasePath(path: string): string | null {
	const normalized = path.trim().replace(/\\/g, "/").replace(/\/+$/g, "")
	if (
		!normalized.startsWith("/") ||
		normalized.startsWith("//") ||
		normalized.includes("\0") ||
		normalized.includes("?") ||
		normalized.includes("#") ||
		normalized.split("/").some((segment) => segment === "." || segment === "..")
	) {
		return null
	}
	return normalized
}

/** 获取与 Agent 跨项目挂载一致的前端运行时路径。 */
export function getReferencedProjectMountBasePath(): string {
	const configuredPath = normalizeReferencedProjectMountBasePath(
		env("AGENT_REFERENCED_PROJECT_MOUNT_BASE_PATH", true) || "",
	)
	return configuredPath ?? DEFAULT_REFERENCED_PROJECT_MOUNT_BASE_PATH
}

export function getUserHomePath(): string {
	const path = env("AGENT_USER_HOME_PATH", true)?.trim().replace(/\/+$/, "") || ""
	return path.startsWith("/") &&
		!hasControlCharacters(path) &&
		!path.includes("\\") &&
		!path
			.slice(1)
			.split("/")
			.some((segment) => !segment || segment === "." || segment === "..")
		? path
		: DEFAULT_USER_HOME_PATH
}

/** HOME 变更后仍识别旧绝对地址；完整目录前缀优先匹配更长的根，避免混淆嵌套目录。 */
function matchUserHomePrefix(path: string): string | undefined {
	return [...new Set([getUserHomePath(), DEFAULT_USER_HOME_PATH])]
		.sort((left, right) => right.length - left.length)
		.map((root) => root + "/")
		.find((prefix) => path.startsWith(prefix))
}

/** 将内部工作区相对路径规范化为不带 ./ 的比较形式。 */
export function normalizeWorkspaceRelativePath(path: string): string | null {
	if (!path) return null

	// 业务路径不是 URL；百分号和 HTML 实体可能就是文件名，不能在这里解码。
	const normalized = path.trim().replace(/\\/g, "/")
	if (normalized.startsWith("/")) return null
	const withoutPrefix = normalized.replace(/^(?:\.\/+)+/, "")
	const withoutWorkspaceRoot = withoutPrefix.startsWith(WORKSPACE_ROOT_PREFIX)
		? withoutPrefix.slice(WORKSPACE_ROOT_PREFIX.length).replace(/^\/+/, "")
		: withoutPrefix
	if (!withoutWorkspaceRoot || /^[a-z][a-z\d+.-]*:/i.test(withoutWorkspaceRoot)) return null
	return normalizeWorkspacePathSegments(withoutWorkspaceRoot)
}

/** 兼容附件树中以 / 表示工作区根的历史路径，只用于内部精确比较。 */
export function normalizeWorkspacePathForComparison(path: string): string | null {
	if (!path) return null

	const normalized = path.trim()
	if (normalized.startsWith("//")) return null
	const withoutRootPrefix = normalized.startsWith("/") ? normalized.slice(1) : normalized
	return normalizeWorkspaceRelativePath(withoutRootPrefix)
}

/** 只在 href 边界解码；调用方应传 Markdown 解析后的目标或 DOM 原始 href 属性。 */
export function classifyMarkdownFileHref(
	href: string,
	options: MarkdownFileHrefOptions = {},
): MarkdownFileHrefClassification {
	const notFile: MarkdownFileHrefClassification = {
		target: null,
		explicitFileReference: false,
	}
	const rawHref = href.trim()
	const invalidFile: MarkdownFileHrefClassification = {
		target: null,
		explicitFileReference: true,
	}
	const invalidResult =
		rawHref.startsWith("~") ||
		matchUserHomePrefix(rawHref) !== undefined ||
		rawHref.startsWith(getReferencedProjectMountBasePath() + "/")
			? invalidFile
			: notFile
	if (
		!rawHref ||
		/^[a-z][a-z\d+.-]*:/i.test(rawHref) ||
		rawHref.startsWith("//") ||
		rawHref.includes("#") ||
		rawHref.includes("?") ||
		hasControlCharacters(rawHref)
	)
		return invalidResult

	const decodedHref = decodeURIComponentOnce(rawHref)
	if (decodedHref === null || hasControlCharacters(decodedHref)) return invalidResult
	const userPrefix = matchUserHomePrefix(decodedHref)
	if (userPrefix) {
		// 用户根必须显式给出；编码斜杠不能改变空间边界，编码反斜杠仍属于 POSIX 文件名。
		if (!rawHref.startsWith("/") || /%2f/i.test(rawHref)) return invalidFile
		const relativePath = normalizeUserRelativePath(decodedHref.slice(userPrefix.length))
		return relativePath
			? { target: { scope: "user", relativePath }, explicitFileReference: true }
			: invalidFile
	}
	if (
		decodedHref.startsWith(getReferencedProjectMountBasePath() + "/") &&
		!rawHref.startsWith("/")
	)
		return invalidFile

	if (rawHref.startsWith("~") || decodedHref.startsWith("~")) {
		// 只有字面 ~/ 能选择用户根；编码分隔符不能改变所属空间。
		if (!rawHref.startsWith("~/") || /%2f/i.test(rawHref)) return invalidFile
		const relativePath = normalizeUserRelativePath(decodedHref.slice(2))
		return relativePath
			? { target: { scope: "user", relativePath }, explicitFileReference: true }
			: invalidFile
	}

	if (rawHref.startsWith("/")) {
		// 其余绝对地址按 Agent 已有挂载解释；项目 ID 不能被编码的分隔符重新切分。
		if (rawHref.includes("\\") || /%(?:2f|5c)/i.test(rawHref)) return invalidResult
		const mountPrefix = getReferencedProjectMountBasePath() + "/"
		if (!decodedHref.startsWith(mountPrefix)) {
			const relativePath = options.allowWorkspaceRoot
				? normalizeWorkspaceRelativePath(decodedHref.slice(1))
				: null
			return relativePath
				? { target: { scope: "workspace", relativePath }, explicitFileReference: true }
				: notFile
		}
		const mountedPath = decodedHref.slice(mountPrefix.length)
		const separatorIndex = mountedPath.indexOf("/")
		if (separatorIndex <= 0) return invalidFile
		const projectId = mountedPath.slice(0, separatorIndex)
		if (!isValidProjectReferenceId(projectId)) return invalidFile
		const relativePath = normalizeWorkspacePathSegments(mountedPath.slice(separatorIndex + 1))
		if (!relativePath) return invalidFile
		return {
			target: { scope: "referenced-project", projectId, relativePath },
			explicitFileReference: true,
		}
	}

	const relativePath = normalizeWorkspaceRelativePath(decodedHref)
	if (!relativePath) return notFile
	return {
		target: { scope: "workspace", relativePath },
		explicitFileReference:
			rawHref.startsWith("./") ||
			rawHref.startsWith(WORKSPACE_ROOT_PREFIX) ||
			rawHref.startsWith(MAGIC_ROOT_PREFIX),
	}
}

export function parseMarkdownFileHref(href: string): MarkdownFileTarget | null {
	return classifyMarkdownFileHref(href).target
}

/** 接受自然相对链接及历史工作区入口，返回已经解码的实际路径。 */
export function parseCanonicalWorkspaceHref(
	href: string,
	options: MarkdownFileHrefOptions = {},
): string | null {
	const { target } = classifyMarkdownFileHref(href, options)
	return target?.scope === "workspace" ? target.relativePath : null
}

export function parseReferencedProjectHref(
	href: string,
): Extract<MarkdownFileTarget, { scope: "referenced-project" }> | null {
	const target = parseMarkdownFileHref(href)
	return target?.scope === "referenced-project" ? target : null
}

export function isWorkspaceHrefCandidate(href: string): boolean {
	const result = classifyMarkdownFileHref(href)
	return result.explicitFileReference && result.target?.scope === "workspace"
}

export function isReferencedProjectHrefCandidate(href: string): boolean {
	return classifyMarkdownFileHref(href).target?.scope === "referenced-project"
}

export function isMarkdownFileHrefCandidate(href: string): boolean {
	return classifyMarkdownFileHref(href).explicitFileReference
}

/** 文件用途不取决于是否匹配成功；../ 等相对目标失败后也不能变成网页导航。 */
export function isMarkdownFileLink(href: string): boolean {
	const path = href.trim()
	if (!path || path.startsWith("#") || path.startsWith("?") || path.startsWith("//")) return false
	if (/^[a-z][a-z\d+.-]*:/i.test(path)) return false
	const filePath = path.split("#", 1)[0]
	// 站点根路由保留网页语义；只有已支持的用户／引用项目根属于文件。
	if (filePath.startsWith("/")) {
		return classifyMarkdownFileHref(filePath).explicitFileReference
	}
	return true
}

function encodePathSegment(segment: string): string {
	return segment.replace(/[#?%<>]/g, (char) => {
		const encoded: Record<string, string> = {
			"#": "%23",
			"?": "%3F",
			"%": "%25",
			"<": "%3C",
			">": "%3E",
		}
		return encoded[char]
	})
}

export function createCanonicalWorkspaceHref(path: string): string | null {
	const normalizedPath = normalizeWorkspaceRelativePath(path)
	if (!normalizedPath) return null

	return `./${normalizedPath.split("/").map(encodePathSegment).join("/")}`
}

export function createUserFileHref(path: string, isDirectory = false): string | null {
	const root = getUserHomePath()
	const normalized = normalizeUserRelativePath(
		path.startsWith(root + "/")
			? path.slice(root.length + 1)
			: path.startsWith("~/")
				? path.slice(2)
				: path,
	)
	if (!normalized) return null
	// 反斜杠按文件名编码，避免 Markdown 将其当作转义符；不改变 POSIX 路径。
	const encoded = normalized
		.split("/")
		.map((segment) =>
			encodeURIComponent(segment).replace(
				/[!'()*]/g,
				(char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
			),
		)
		.join("/")
	const encodedRoot = root.split("/").map(encodeURIComponent).join("/")
	return `${encodedRoot}/${encoded}${isDirectory ? "/" : ""}`
}

export function createReferencedProjectHref(
	projectId: string,
	relativePath: string,
): string | null {
	const normalizedProjectId = projectId.trim()
	if (!isValidProjectReferenceId(normalizedProjectId)) {
		return null
	}

	const normalizedRelativePath = normalizeWorkspaceRelativePath(relativePath)
	if (!normalizedRelativePath) return null

	const encodedBasePath = getReferencedProjectMountBasePath()
		.split("/")
		.map(encodePathSegment)
		.join("/")
	const encodedProjectId = encodePathSegment(normalizedProjectId)
	const encodedRelativePath = normalizedRelativePath.split("/").map(encodePathSegment).join("/")
	return `${encodedBasePath}/${encodedProjectId}/${encodedRelativePath}`
}

// 此入口只匹配实际路径；href 必须先由公共解析器处理，不能在查找时再次解码。
/**
 * 根据相对路径从附件列表中查找文件
 * @param attachments - 附件列表
 * @param relativePath - 相对路径 (例如: "./images/photo.png" 或 "/path/to/file.png")
 * @returns 找到的文件信息或 undefined
 */
export function findAttachmentByPath(
	attachments: AttachmentItem[],
	relativePath: string,
): AttachmentItem | undefined {
	if (!Array.isArray(attachments) || attachments.length === 0) {
		return undefined
	}

	const normalizedSearchPath = normalizeWorkspacePathForComparison(relativePath)
	if (!normalizedSearchPath) return undefined

	return getAttachmentPathIndex(attachments).get(normalizedSearchPath)
}

const attachmentPathIndexes = new WeakMap<AttachmentItem[], ReadonlyMap<string, AttachmentItem>>()

/** 同一文件快照只规范化一次；文件更新替换数组，旧索引随快照释放。 */
function getAttachmentPathIndex(
	attachments: AttachmentItem[],
): ReadonlyMap<string, AttachmentItem> {
	const cached = attachmentPathIndexes.get(attachments)
	if (cached) return cached

	const index = new Map<string, AttachmentItem>()
	const visited = new Set<AttachmentItem>()
	const stack: { item: AttachmentItem; childrenVisited: boolean }[] = []
	for (let position = attachments.length - 1; position >= 0; position -= 1) {
		stack.push({ item: attachments[position], childrenVisited: false })
	}

	while (stack.length > 0) {
		const frame = stack.pop()
		if (!frame) break
		const { item } = frame
		if (!frame.childrenVisited) {
			// 平铺列表仍可能包含同一子树；按对象去重，不合并同 file_id 的不同记录。
			if (visited.has(item)) continue
			visited.add(item)
			stack.push({ item, childrenVisited: true })
			const children = item.children ?? []
			for (let position = children.length - 1; position >= 0; position -= 1) {
				stack.push({ item: children[position], childrenVisited: false })
			}
			continue
		}

		// 与原查找一致：子节点先于父节点，重复路径保留首次匹配，两类路径均可查找。
		for (const path of [item.relative_file_path, item.path]) {
			if (!path) continue
			const normalizedPath = normalizeWorkspacePathForComparison(path)
			if (normalizedPath && !index.has(normalizedPath)) index.set(normalizedPath, item)
		}
	}

	attachmentPathIndexes.set(attachments, index)
	return index
}

/** 旧 file_path 优先按原始文件名匹配，只有未命中时才兼容一次 href 解码。 */
export function findLegacyAttachmentByPath(
	attachments: AttachmentItem[],
	path: string,
): AttachmentItem | undefined {
	const file = findAttachmentByPath(attachments, path)
	if (file) return file
	const decodedPath = parseCanonicalWorkspaceHref(path)
	return decodedPath && decodedPath !== path
		? findAttachmentByPath(attachments, decodedPath)
		: undefined
}

/** 显示路径保留原文件名，不编码 URL，也不改写 canonical 相对路径。 */
// 输入可识别实际 HOME 和历史绝对地址；界面与复制路径始终使用 ~/，不暴露沙盒 HOME。
export function getFileDisplayPath(file: {
	file_reference?: FileReference
	space_type?: FileReference["space_type"]
	relative_file_path?: string
	file_name?: string
}): string {
	const reference = file.file_reference
	const path = reference?.space_relative_path ?? file.relative_file_path
	if (reference?.space_type === "user" || (!reference && file.space_type === "user"))
		return path !== undefined ? "~/" + path : (file.file_name ?? "")
	return path || file.file_name || ""
}

/** 用户 Markdown 的普通链接相对于正文所在目录；用户根地址由公共解析器解释。 */
export function resolveUserFileHref(href: string, documentPath: string): string | null {
	// 新链接使用绝对用户根，旧正文仍按原有 ~/ 与包含目录解释。
	if (href.startsWith("~/") || href.startsWith("/")) {
		const target = parseMarkdownFileHref(href)
		return target?.scope === "user" ? target.relativePath : null
	}
	if (
		!href ||
		href.startsWith("/") ||
		href.startsWith("~") ||
		/^[a-z][a-z\d+.-]*:/i.test(href) ||
		/[?#]/.test(href)
	)
		return null
	const decoded = decodeURIComponentOnce(href)
	if (decoded === null || hasControlCharacters(decoded)) return null
	const segments = documentPath.split("/").slice(0, -1)
	for (const segment of decoded.split("/")) {
		if (!segment || segment === ".") continue
		if (segment === "..") {
			if (!segments.length) return null
			segments.pop()
		} else segments.push(segment)
	}
	return normalizeUserRelativePath(segments.join("/"))
}
