import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"

/** 与 `utils.normalizePath` 一致：去掉首尾 `/`，供索引键使用（避免与 utils 循环依赖） */
function normalizeRelativePathKey(path: string): string {
	if (!path) return ""
	return path.replace(/^\/+|\/+$/g, "")
}

/**
 * 扁平附件列表的统一索引：把路径 / file_id / 文件名维度的查找从反复 O(N) 扫描降为索引命中。
 * 在附件列表变更时由 {@link buildDesignAttachmentIndex} 构建一次，沿链路复用。
 */
export interface DesignAttachmentIndex {
	/** 构建代数，便于快照缓存与调试 */
	buildId: number
	/** 与 {@link buildAttachmentsSnapshotKeyFromFlatFiles} 一致的附件批次签名 */
	attachmentsSnapshotKey: string
	byFileId: Map<string, FileItem>
	byNormalizedPath: Map<string, FileItem>
	byPathWithoutLeadingSlash: Map<string, FileItem>
	byFileName: Map<string, FileItem[]>
}

let nextBuildId = 1

function pushFileNameIndex(map: Map<string, FileItem[]>, fileName: string, item: FileItem): void {
	const key = fileName.trim().toLowerCase()
	if (!key) return
	const bucket = map.get(key)
	if (bucket) bucket.push(item)
	else map.set(key, [item])
}

/**
 * 与 designFileInfoCache 中快照语义对齐：附件批次变更时用于失效换链缓存。
 */
export function buildAttachmentsSnapshotKeyFromFlatFiles(flatFiles: FileItem[]): string {
	const snapshotParts = flatFiles
		.filter((item) => !item.is_directory && item.relative_file_path)
		.map((item) => {
			const normalizedPath = normalizeRelativePathKey(item.relative_file_path || "")
			if (!normalizedPath) return ""
			return `${normalizedPath}\0${item.file_id || ""}\0${item.updated_at || ""}`
		})
		.filter(Boolean)
		.sort()

	return snapshotParts.join("\u0001")
}

export function buildDesignAttachmentIndex(flatAttachments: FileItem[]): DesignAttachmentIndex {
	const byFileId = new Map<string, FileItem>()
	const byNormalizedPath = new Map<string, FileItem>()
	const byPathWithoutLeadingSlash = new Map<string, FileItem>()
	const byFileName = new Map<string, FileItem[]>()

	for (const item of flatAttachments) {
		if (item.file_id) byFileId.set(item.file_id, item)

		const rawPath = item.relative_file_path
		if (!rawPath || item.is_directory) {
			const nm =
				item.file_name?.trim() || item.display_filename?.trim() || item.filename?.trim()
			if (nm) pushFileNameIndex(byFileName, nm, item)
			continue
		}

		const normalizedPath = normalizeRelativePathKey(rawPath)
		if (normalizedPath) {
			byNormalizedPath.set(normalizedPath, item)
			const noLeading = normalizedPath.startsWith("/")
				? normalizedPath.slice(1)
				: normalizedPath
			byPathWithoutLeadingSlash.set(noLeading, item)
		}

		const nm = item.file_name?.trim() || item.display_filename?.trim() || item.filename?.trim()
		if (nm) pushFileNameIndex(byFileName, nm, item)
	}

	return {
		buildId: nextBuildId++,
		attachmentsSnapshotKey: buildAttachmentsSnapshotKeyFromFlatFiles(flatAttachments),
		byFileId,
		byNormalizedPath,
		byPathWithoutLeadingSlash,
		byFileName,
	}
}

/** 规范化画布资源路径（与 useCanvasResourceRefresh 一致） */
export function normalizeCanvasAttachmentLookupPath(path?: string): string {
	if (!path) return ""
	return path.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "")
}

/**
 * 使用索引解析画布资源 workspace 相对路径对应的附件项；未建索引时返回 null，由调用方回退线性查找。
 */
export function findAttachmentByNormalizedWorkspacePath(
	index: DesignAttachmentIndex | null | undefined,
	normalizedTargetPath: string,
): FileItem | null {
	if (!index || !normalizedTargetPath) return null

	const direct = index.byNormalizedPath.get(normalizedTargetPath)
	if (direct && !direct.is_directory) return direct

	const noLeading = normalizedTargetPath.startsWith("/")
		? normalizedTargetPath.slice(1)
		: normalizedTargetPath
	const relaxed = index.byPathWithoutLeadingSlash.get(noLeading)
	if (relaxed && !relaxed.is_directory) return relaxed

	return null
}
