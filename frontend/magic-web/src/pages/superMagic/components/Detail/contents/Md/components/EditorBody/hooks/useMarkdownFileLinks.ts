import { useCallback, useMemo } from "react"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import { getFilePresentationIndex } from "@/pages/superMagic/components/TopicFilesButton/utils/file-presentation"
import { normalizeWorkspacePathForComparison } from "@/pages/superMagic/utils/markdownFileReference"
import { parseAnchorLink } from "@/utils/slug"
import { resolveRelativePath } from "../../../utils"
import { useFileApi } from "@/pages/superMagic/fileAccess/fileApi"

export type ResolveMarkdownLinkedFile = (
	href: string,
	signal?: AbortSignal,
) => Promise<AttachmentItem | undefined>

export function useMarkdownFileLinks({
	documentPath,
	attachments,
	resolveRelativeFile,
	projectId,
	enabled,
}: {
	documentPath?: string
	attachments?: AttachmentItem[]
	resolveRelativeFile?: (href: string) => Promise<AttachmentItem | undefined>
	projectId?: string
	enabled: boolean
}): ResolveMarkdownLinkedFile {
	const fileApi = useFileApi()
	const index = useMemo(
		() => (attachments ? getFilePresentationIndex(attachments) : null),
		[attachments],
	)
	// 作用域变化后不复用旧目录／身份的查询；只合并正在进行的请求，失败不缓存。
	const scope = useMemo(
		() => ({
			documentPath,
			projectId,
			index,
			resolveRelativeFile,
			identity: fileApi.identityKey,
			enabled,
			requests: new Map<string, Promise<AttachmentItem | undefined>>(),
		}),
		[documentPath, projectId, index, resolveRelativeFile, fileApi.identityKey, enabled],
	)
	return useCallback(
		async (href, signal) => {
			const assertActive = () => {
				if (signal?.aborted) throw new DOMException("File lookup cancelled", "AbortError")
			}
			assertActive()
			if (!scope.enabled) return undefined
			const { filePath } = parseAnchorLink(href)
			if (!filePath) return undefined
			const { resolveRelativeFile, requests, documentPath, index } = scope
			if (resolveRelativeFile) {
				let request = requests.get(filePath)
				if (!request) {
					request = resolveRelativeFile(filePath).finally(() => requests.delete(filePath))
					requests.set(filePath, request)
				}
				const file = await request
				assertActive()
				return file
			}
			// Handle relative path (with or without anchor)
			if (!documentPath || !index) return undefined
			// Get document directory path
			const documentDir = documentPath.substring(0, documentPath.lastIndexOf("/"))
			let decodedPath: string
			try {
				decodedPath = decodeURIComponent(filePath)
			} catch {
				return undefined
			}
			// Resolve relative path to project root path
			const resolvedPath = documentDir
				? resolveRelativePath(documentDir, decodedPath)
				: decodedPath
			const normalized = normalizeWorkspacePathForComparison(resolvedPath)
			assertActive()
			// Find file by path
			return normalized ? index.byPath.get(normalized) : undefined
		},
		[scope],
	)
}
