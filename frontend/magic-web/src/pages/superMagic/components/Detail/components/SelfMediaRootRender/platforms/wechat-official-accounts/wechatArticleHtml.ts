import type { FileApi } from "@/pages/superMagic/fileAccess/fileApi"
import { processHtmlContent } from "../../../../contents/HTML/htmlProcessor"
import { flattenAttachments } from "../../../../contents/HTML/utils"
import type { FileItem } from "../../../../contents/HTML/utils/fetchInterceptor"
import { WECHAT_ARTICLE_IMAGE_PROCESS } from "../../constants/imageProcess"
import type { PlatformComponentProps, SelfMediaAttachmentNode } from "../../types"

function getFileFolderPath(
	file: Pick<FileItem, "file_name" | "relative_file_path"> | null,
): string {
	const path = file?.relative_file_path || ""
	if (!path) return "/"
	if (file?.file_name && path.endsWith(file.file_name)) {
		return path.slice(0, -file.file_name.length)
	}
	const slashIndex = path.lastIndexOf("/")
	return slashIndex >= 0 ? path.slice(0, slashIndex + 1) : "/"
}

export interface LoadWechatArticleHtmlResult {
	content: string
	filePathMapping: Map<string, string>
}

type AttachmentSource =
	PlatformComponentProps["attachmentList"] | PlatformComponentProps["attachments"]

function getAttachmentKey(item: SelfMediaAttachmentNode): string {
	return (
		item.file_id ||
		item.relative_file_path ||
		[item.file_name, item.updated_at].filter(Boolean).join(":")
	)
}

function mergeWechatArticleAttachmentSources(
	...sources: AttachmentSource[]
): SelfMediaAttachmentNode[] {
	const merged: SelfMediaAttachmentNode[] = []
	const indexByKey = new Map<string, number>()

	for (const source of sources) {
		if (!source?.length) continue
		for (const item of flattenAttachments(source)) {
			const key = getAttachmentKey(item)
			const existingIndex = key ? indexByKey.get(key) : undefined
			if (existingIndex !== undefined) {
				const existing = merged[existingIndex]
				merged[existingIndex] = {
					...existing,
					file_name: existing.file_name || item.file_name,
					relative_file_path: existing.relative_file_path || item.relative_file_path,
					is_directory: existing.is_directory ?? item.is_directory,
					updated_at: existing.updated_at || item.updated_at,
				}
				continue
			}
			if (key) indexByKey.set(key, merged.length)
			merged.push(item)
		}
	}

	return merged
}

export async function loadWechatArticleHtml({
	fileId,
	attachmentList,
	attachments,
	fileApi,
}: {
	fileId: string
	attachmentList?: PlatformComponentProps["attachmentList"]
	attachments?: PlatformComponentProps["attachments"]
	fileApi: FileApi
}): Promise<LoadWechatArticleHtmlResult> {
	const urls = await fileApi.getTemporaryDownloadUrl({ file_ids: [fileId] })
	const url = urls?.[0]?.url
	if (!url) throw new Error("noArticleUrl")

	const resp = await fetch(url, { credentials: "omit" })
	if (!resp.ok) throw new Error("loadArticleError")
	const html = await resp.text()

	const resourceAttachmentList = mergeWechatArticleAttachmentSources(attachmentList, attachments)

	if (!resourceAttachmentList.length) {
		return { content: html, filePathMapping: new Map() }
	}

	const currentFile =
		resourceAttachmentList.find((item): item is FileItem =>
			Boolean(item?.file_id === fileId),
		) || null
	const result = await processHtmlContent({
		content: html,
		attachments: resourceAttachmentList,
		attachmentList: resourceAttachmentList,
		fileId,
		fileName: currentFile?.file_name,
		html_relative_path: getFileFolderPath(currentFile),
		xMagicImageProcess: WECHAT_ARTICLE_IMAGE_PROCESS,
		fileApi,
	})

	return {
		content: result.processedContent || html,
		filePathMapping: result.filePathMapping || new Map(),
	}
}
