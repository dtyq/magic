/** magic.project.js 应始终以代码模式打开，图标使用 file_extension，不参与内容类型渲染 */
const MAGIC_PROJECT_JS = "magic.project.js"

export function isMagicProjectConfigFile(fileName?: string): boolean {
	return fileName === MAGIC_PROJECT_JS
}

export interface MagicProjectIconContext {
	file_name?: string
	display_filename?: string
	filename?: string
	name?: string
	file_extension?: string
	display_config?: any
}

function resolveMagicProjectIconType(item?: MagicProjectIconContext): string | undefined {
	const fileName = item?.file_name || item?.display_filename || item?.filename || item?.name
	if (!isMagicProjectConfigFile(fileName)) return undefined

	const extension = item?.file_extension?.trim()
	if (extension) return extension

	return "js"
}

export const getAttachmentType = (item?: MagicProjectIconContext): any => {
	const magicProjectIconType = resolveMagicProjectIconType(item)
	if (magicProjectIconType) return magicProjectIconType

	const { type } = item?.display_config || {}
	if (type === "slide") {
		return "ppt"
	}
	return item?.display_config?.type
}

export const getAttachmentExtension = (item?: MagicProjectIconContext): any => {
	const magicProjectIconType = resolveMagicProjectIconType(item)
	if (magicProjectIconType) return magicProjectIconType

	const { type } = item?.display_config || {}
	if (type === "slide") {
		return "pptx"
	}
	return item?.display_config?.type
}

/**
 * 获取文件项的图标类型（用于 MagicFileIcon）
 * magic.project.js 始终使用 file_extension
 */
export function getFileIconType(item: {
	file_name?: string
	display_filename?: string
	filename?: string
	name?: string
	file_extension?: string
	display_config?: any
}): string {
	return getAttachmentType(item) || item?.file_extension || ""
}

/**
 * 获取文件项的扩展名类型（用于 Tab 等场景）
 */
export function getFileExtensionType(item: {
	file_name?: string
	display_filename?: string
	filename?: string
	name?: string
	file_extension?: string
	display_config?: any
}): string {
	return getAttachmentExtension(item) || item?.file_extension || ""
}

function matchesPathSegment(segment: string, item: Record<string, unknown> | undefined): boolean {
	if (!item) return false
	const name = (item.name as string | undefined) ?? ""
	return segment === name
}

/**
 * 将相对路径（相对当前 display_config 文件夹根目录）规范为路径段
 */
export function normalizeRelativePathSegments(relativePath: string): string[] | null {
	const normalized = relativePath.trim().replace(/\\/g, "/")
	if (!normalized) return null
	const segments = normalized.split("/").filter(Boolean)
	for (const seg of segments) {
		if (seg === ".." || seg === ".") return null
	}
	return segments.length > 0 ? segments : null
}

/** @deprecated 使用 normalizeRelativePathSegments */
export const normalizeMainFilePathSegments = normalizeRelativePathSegments

/**
 * 在文件夹子树中按相对路径解析目标文件（仅匹配 item.name）
 */
export function resolveFileByRelativePath(
	children: unknown[] | undefined,
	relativePath: string,
): Record<string, unknown> | null {
	const segments = normalizeRelativePathSegments(relativePath)
	if (!segments) return null

	let currentLevel = (children || []) as Record<string, unknown>[]

	for (let i = 0; i < segments.length; i++) {
		const seg = segments[i]
		const isLast = i === segments.length - 1
		const found = currentLevel.find((child) => matchesPathSegment(seg, child))
		if (!found) return null

		if (isLast) {
			if (found.is_directory) return null
			return found
		}
		if (!found.is_directory) return null
		currentLevel = (found.children || []) as Record<string, unknown>[]
	}

	return null
}

/** @deprecated 使用 resolveFileByRelativePath */
export const resolveCustomMainFileFromChildren = resolveFileByRelativePath

/** custom 项目入口相对路径（相对带 display_config 的文件夹根目录） */
export function getCustomIndexPath(displayConfig: any): string | undefined {
	if (!displayConfig || displayConfig.type !== "custom") return undefined
	const next = displayConfig.index ?? displayConfig.root_path
	if (typeof next === "string" && next.trim()) return next.trim()
	return undefined
}

/**
 * custom / micro-app 文件夹图标配置字符串（display_config.icon，兼容旧字段 display_config.icon_path）。
 * 可为：相对文件夹根的路径；或以 http(s) / data: 开头的可直接作为 img src 的地址。
 */
export function getCustomIcon(displayConfig: any): string | undefined {
	if (!displayConfig || !["custom", "micro-app"].includes(displayConfig.type)) return undefined
	const p = displayConfig.icon ?? displayConfig.icon_path
	if (typeof p === "string" && p.trim()) return p.trim()
	return undefined
}

/** @deprecated 使用 getCustomIcon */
export const getCustomIconPath = getCustomIcon

/**
 * 若图标字符串为可直接作为 img src 的 http(s) 或 data URL，返回该字符串；否则返回 undefined（需按相对路径在子树中解析 file_id）。
 */
export function resolveCustomIconPathToDirectSrc(iconPath: string): string | undefined {
	const t = iconPath.trim()
	if (!t) return undefined
	if (/^https?:\/\//i.test(t)) return t
	if (/^data:/i.test(t)) return t
	return undefined
}

/**
 * 树/列表里「文件」行：合并了 custom/micro-app display_config 时仍可按扩展名作为 MagicFileIcon 回退（无 icon 或远程失败时）
 */
export function getFileTreeIconType(item?: MagicProjectIconContext): string | undefined {
	const magicProjectIconType = resolveMagicProjectIconType(item)
	if (magicProjectIconType) return magicProjectIconType

	if (
		(item?.display_config?.type === "custom" || item?.display_config?.type === "micro-app") &&
		typeof item?.file_extension === "string" &&
		item.file_extension.trim()
	) {
		return item.file_extension
	}
	return getAttachmentType(item) || item?.file_extension
}

export interface CustomMetadataIconPathItem {
	is_directory?: boolean
	parent_id?: string | number | null
	children?: unknown[]
	display_config?: {
		_customFolderId?: string
		[key: string]: unknown
	}
	metadata?: {
		_customFolderId?: string
		[key: string]: unknown
	}
}

/**
 * icon 相对「带 display_config 的 custom 文件夹」根解析：
 * - 目录行用自身 children
 * - 合并了文件夹 display_config 的入口文件：优先使用 _customFolderId 对应的文件夹 children，否则用父目录 children
 */
export function getChildrenForCustomMetadataIconPath(
	item: CustomMetadataIconPathItem,
	findNodeByFileId: (
		fileId: string,
	) => { children?: unknown[]; is_directory?: boolean } | null | undefined,
): unknown[] | undefined {
	if (item.is_directory) return item.children as unknown[] | undefined

	// If entry file has _customFolderId, use the original custom folder's children
	const customFolderId = item.display_config?._customFolderId ?? item.metadata?._customFolderId
	if (customFolderId) {
		const customFolder = findNodeByFileId(String(customFolderId))
		if (customFolder?.is_directory) {
			return customFolder.children as unknown[] | undefined
		}
	}

	// Fallback to parent_id
	const pid = item.parent_id
	if (pid === undefined || pid === null || pid === "") return undefined
	const parent = findNodeByFileId(String(pid))
	if (!parent?.is_directory) return undefined
	return parent.children as unknown[] | undefined
}

/** app.json / display_config 入口相对路径 */
function getDeclaredAppEntryPath(displayConfig: any): string | undefined {
	const entry = displayConfig?.entry
	if (typeof entry === "string" && entry.trim()) return entry.trim()
	return undefined
}

/**
 * 解析「应用入口」文件：app.json entry 优先；custom 兼容 index/root_path；否则默认 index.html
 */
export const getAppEntryFile = (treeNode: Array<any>, displayConfig?: any): any => {
	const entryPath = getDeclaredAppEntryPath(displayConfig)
	if (entryPath) {
		return resolveFileByRelativePath(treeNode, entryPath)
	}

	const indexPath = getCustomIndexPath(displayConfig)
	if (displayConfig?.type === "custom" && indexPath) {
		return resolveFileByRelativePath(treeNode, indexPath)
	}

	return treeNode?.find((item) => item?.name === "index.html")
}
