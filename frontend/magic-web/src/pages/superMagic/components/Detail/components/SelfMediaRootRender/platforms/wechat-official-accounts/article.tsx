import { memo, useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { getTemporaryDownloadUrl } from "@/pages/superMagic/utils/api"
import IsolatedHTMLRenderer, {
	type IsolatedHTMLRendererRef,
} from "../../../../contents/HTML/IsolatedHTMLRenderer"
import { processHtmlContent } from "../../../../contents/HTML/htmlProcessor"
import { flattenAttachments } from "../../../../contents/HTML/utils"
import type { FileItem } from "../../../../contents/HTML/utils/fetchInterceptor"
import type { PlatformComponentProps, SelfMediaPost } from "../../types"

interface WechatArticleViewProps {
	post: SelfMediaPost
	attachmentList?: PlatformComponentProps["attachmentList"]
	selectedProject?: unknown
}

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

function WechatArticleView({ post, attachmentList, selectedProject }: WechatArticleViewProps) {
	const { t } = useTranslation("super")
	const article = post.article
	const fileId = article?.fileId
	const [content, setContent] = useState<string | null>(null)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [filePathMapping, setFilePathMapping] = useState<Map<string, string>>(new Map())
	const rendererRef = useRef<IsolatedHTMLRendererRef>(null)
	// Keep a ref so the effect can read the latest attachmentList without
	// treating reference changes as a reason to re-fetch the HTML content.
	const attachmentListRef = useRef(attachmentList)
	attachmentListRef.current = attachmentList

	// Derive a stable version key from the target file's updated_at so that
	// the effect re-runs when the file content actually changes (same fileId
	// but new content) without triggering on every attachmentList reference swap.
	const fileUpdatedAt = fileId
		? flattenAttachments(attachmentList ?? []).find(
				(item): item is FileItem => item?.file_id === fileId,
			)?.updated_at
		: undefined

	useEffect(() => {
		let cancelled = false
		if (!fileId) {
			setContent(null)
			setError(null)
			return
		}
		setLoading(true)
		setError(null)
		setContent(null)
		;(async () => {
			try {
				const urls = await getTemporaryDownloadUrl({ file_ids: [fileId] })
				const url = urls?.[0]?.url
				if (!url) throw new Error("noArticleUrl")
				if (cancelled) return

				const resp = await fetch(url, { credentials: "omit" })
				if (!resp.ok) throw new Error("loadArticleError")
				const html = await resp.text()
				if (cancelled) return

				let processedContent = html
				let mapping = new Map<string, string>()
				const currentAttachmentList = attachmentListRef.current
				if (currentAttachmentList?.length) {
					const flattened = flattenAttachments(currentAttachmentList)
					const currentFile =
						flattened.find((item): item is FileItem =>
							Boolean(item?.file_id === fileId),
						) || null
					const result = await processHtmlContent({
						content: html,
						attachments: currentAttachmentList,
						attachmentList: currentAttachmentList,
						fileId,
						fileName: currentFile?.file_name,
						html_relative_path: getFileFolderPath(currentFile),
					})
					processedContent = result.processedContent || html
					mapping = result.filePathMapping || new Map()
				}
				if (cancelled) return

				setContent(processedContent)
				setFilePathMapping(mapping)
			} catch (err) {
				if (cancelled) return
				setError(err instanceof Error ? err.message : "unknownError")
			} finally {
				if (!cancelled) setLoading(false)
			}
		})()

		return () => {
			cancelled = true
		}
	}, [fileId, fileUpdatedAt]) // attachmentList intentionally omitted: reference changes on every file-tree update; fileUpdatedAt tracks actual content changes

	const openNewTab = useCallback(() => {
		// No-op in read-only context
	}, [])

	if (!fileId) {
		return (
			<div
				className="flex h-full items-center justify-center text-sm text-muted-foreground"
				data-testid="wechat-article-empty"
			>
				{t("detail.selfMedia.common.noPosts")}
			</div>
		)
	}
	if (loading) {
		return (
			<div
				className="flex h-full items-center justify-center text-sm text-muted-foreground"
				data-testid="wechat-article-loading"
			>
				{t("detail.selfMedia.common.loading")}
			</div>
		)
	}
	if (error) {
		return (
			<div
				className="flex h-full items-center justify-center px-4 text-center text-sm text-destructive"
				data-testid="wechat-article-error"
			>
				{error}
			</div>
		)
	}
	if (!content) return null

	return (
		<div className="h-full w-full bg-white" data-testid="wechat-article-view">
			<IsolatedHTMLRenderer
				ref={rendererRef as React.RefObject<IsolatedHTMLRendererRef>}
				content={content}
				sandboxType="iframe"
				fileId={fileId}
				filePathMapping={filePathMapping}
				openNewTab={openNewTab}
				selectedProject={selectedProject}
				attachmentList={attachmentList}
				isVisible
				className="h-full w-full"
			/>
		</div>
	)
}

export default memo(WechatArticleView)
