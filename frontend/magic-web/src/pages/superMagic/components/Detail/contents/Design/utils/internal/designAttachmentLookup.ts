/**
 * @internal
 * 仅供 `../designPath` 门面内部使用；生产业务代码请统一从 `designPath` 导入路径解析能力。
 */
import { stripPathEdgeSlashes } from "@/components/CanvasDesign/runtime/shared/path/canvasResourcePath"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import type { DesignAttachmentIndex } from "../designAttachmentIndex"

/**
 * 设计附件路径 → FileItem 解析（单一职责：仅负责「DSL path / workspace 相对路径」如何落到附件表）。
 *
 * 原则：
 * - 这里只匹配 workspace path；file_id 必须由上层显式 attachment namespace 解析。
 * - 多候选的歧义由统一 resolver 失败关闭，避免「串路径」误绑资源。
 */

export interface ResolvedPathCandidate {
	resolvedPath: string
	normalizedPath: string
}

export interface CandidateMatch extends ResolvedPathCandidate {
	fileItem: FileItem
}

function resolveAttachmentsForWorkspacePath(
	storeFiles: FileItem[],
	normalizedPath: string,
	index?: DesignAttachmentIndex | null,
): FileItem[] {
	if (index) {
		return index.byNormalizedPath.get(stripPathEdgeSlashes(normalizedPath)) ?? []
	}

	if (storeFiles.length === 0) return []
	return storeFiles.filter(
		(item) =>
			Boolean(item.file_id) &&
			!item.is_directory &&
			Boolean(item.relative_file_path) &&
			stripPathEdgeSlashes(item.relative_file_path || "") ===
				stripPathEdgeSlashes(normalizedPath),
	)
}

export function collectAttachmentMatchesAmongCandidates(
	candidates: ResolvedPathCandidate[],
	storeFiles: FileItem[],
	attachmentIndex?: DesignAttachmentIndex | null,
): CandidateMatch[] {
	const matches: CandidateMatch[] = []

	for (const candidate of candidates) {
		const resolvedItems = resolveAttachmentsForWorkspacePath(
			storeFiles,
			candidate.normalizedPath,
			attachmentIndex,
		)
		resolvedItems.forEach((fileItem) => {
			matches.push({
				resolvedPath: candidate.resolvedPath,
				normalizedPath: candidate.normalizedPath,
				fileItem,
			})
		})
	}

	return matches
}
