import { stripPathEdgeSlashes } from "@/components/CanvasDesign/runtime/shared/path/canvasResourcePath"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"

/**
 * 扁平附件列表的统一索引：把 workspace path / file_id 查找从反复 O(N) 扫描降为索引命中。
 * 在附件列表变更时由 {@link buildDesignAttachmentIndex} 构建一次，沿链路复用。
 */
export interface DesignAttachmentIndex {
	/** 构建代数，便于快照缓存失效判断 */
	buildId: number
	/** 与 {@link buildAttachmentsSnapshotKeyFromFlatFiles} 一致的附件批次签名 */
	attachmentsSnapshotKey: string
	/** 仅描述附件路径解析语义；元数据变化不会触发 Canvas 运行时全量重绑。 */
	resourceReferenceSnapshotKey: string
	byFileId: Map<string, FileItem>
	byNormalizedPath: Map<string, FileItem[]>
}

let nextBuildId = 1

/**
 * 与 designFileInfoCache 中快照语义对齐：附件批次变更时用于失效换链缓存。
 */
export function buildAttachmentsSnapshotKeyFromFlatFiles(flatFiles: FileItem[]): string {
	const snapshotParts = flatFiles
		.filter((item) => !item.is_directory && item.relative_file_path)
		.map((item) => {
			const normalizedPath = stripPathEdgeSlashes(item.relative_file_path || "")
			if (!normalizedPath) return ""
			return `${normalizedPath}\0${item.file_id || ""}\0${item.updated_at || ""}\0${item.file_size ?? ""}`
		})
		.filter(Boolean)
		.sort()

	return snapshotParts.join("\u0001")
}

function buildResourceReferenceSnapshotKey(flatFiles: FileItem[]): string {
	return flatFiles
		.filter((item) => !item.is_directory && item.relative_file_path)
		.map((item) => {
			const normalizedPath = stripPathEdgeSlashes(item.relative_file_path || "")
			return normalizedPath ? `${normalizedPath}\0${item.file_id || ""}` : ""
		})
		.filter(Boolean)
		.sort()
		.join("\u0001")
}

export function buildDesignAttachmentIndex(flatAttachments: FileItem[]): DesignAttachmentIndex {
	const byFileId = new Map<string, FileItem>()
	const byNormalizedPath = new Map<string, FileItem[]>()

	for (const item of flatAttachments) {
		if (item.file_id) byFileId.set(item.file_id, item)

		const rawPath = item.relative_file_path
		if (!rawPath || !item.file_id || item.is_directory) continue

		const normalizedPath = stripPathEdgeSlashes(rawPath)
		if (normalizedPath) {
			const bucket = byNormalizedPath.get(normalizedPath)
			if (bucket) bucket.push(item)
			else byNormalizedPath.set(normalizedPath, [item])
		}
	}

	return {
		buildId: nextBuildId++,
		attachmentsSnapshotKey: buildAttachmentsSnapshotKeyFromFlatFiles(flatAttachments),
		resourceReferenceSnapshotKey: buildResourceReferenceSnapshotKey(flatAttachments),
		byFileId,
		byNormalizedPath,
	}
}
