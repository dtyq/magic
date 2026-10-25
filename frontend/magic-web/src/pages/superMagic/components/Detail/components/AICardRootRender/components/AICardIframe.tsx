import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@/utils/cn"
import { useFileApi } from "@/pages/superMagic/fileAccess/fileApi"
import { processHtmlContent } from "../../../contents/HTML/htmlProcessor"
import { flattenAttachments } from "../../../contents/HTML/utils"
import { injectFetchInterceptorScript } from "../../../contents/HTML/utils/fetchInterceptor"
import type { FileItem } from "../../../contents/HTML/utils/fetchInterceptor"
import IsolatedHTMLRenderer from "../../../contents/HTML/IsolatedHTMLRenderer"
import { AICardIframeLoadingState } from "./AICardIframeLoadingState"

interface AICardIframeProps {
	fileId?: string
	attachmentList?: any[]
	selectedProject?: { id?: string; name?: string } | null
	className?: string
	style?: React.CSSProperties
	/** When true, the component shows a skeleton loader */
	showSkeleton?: boolean
	/** When true, hides vertical scroll (useful for thumbnail previews) */
	hideVerticalScroll?: boolean
	onLoad?: () => void
}

const EMPTY_FILE_PATH_MAPPING = new Map<string, string>()
const NOOP_OPEN_NEW_TAB = () => undefined

/**
 * Lightweight iframe renderer for AI Cards.
 * Delegates to IsolatedHTMLRenderer — no editing, no DevConsole.
 */
function AICardIframe({
	fileId,
	attachmentList,
	selectedProject,
	className,
	style,
	showSkeleton = true,
	hideVerticalScroll = false,
	onLoad,
}: AICardIframeProps) {
	const { t } = useTranslation("super")
	// Card HTML is readable in read-only share previews; bind the ambient identity so
	// the download-url request is not rejected by the share guard.
	const fileApi = useFileApi()
	const [processedContent, setProcessedContent] = useState<string | null>(null)
	const [filePathMapping, setFilePathMapping] =
		useState<Map<string, string>>(EMPTY_FILE_PATH_MAPPING)
	const [loading, setLoading] = useState(true)
	// 跨域 shell 下，内容写入 iframe 到真正渲染完成之间存在异步间隙；
	// 仅凭数据加载完成无法代表页面已经画出来，需额外等待 iframe 上报渲染就绪。
	const [isRenderReady, setIsRenderReady] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const flattenedFiles = useMemo(
		() =>
			(attachmentList?.length ? flattenAttachments(attachmentList) : []).filter(
				(item): item is FileItem =>
					Boolean(item?.file_id) &&
					Boolean(item?.relative_file_path) &&
					!item?.is_directory,
			),
		[attachmentList],
	)

	const currentFile = useMemo(
		() => flattenedFiles.find((item) => item.file_id === fileId) || null,
		[flattenedFiles, fileId],
	)

	const relativeFolderPath = useMemo(() => {
		const path = currentFile?.relative_file_path || ""
		if (!path) return "/"
		if (currentFile?.file_name && path.endsWith(currentFile.file_name)) {
			return path.slice(0, -currentFile.file_name.length)
		}
		const slashIndex = path.lastIndexOf("/")
		return slashIndex >= 0 ? path.slice(0, slashIndex + 1) : "/"
	}, [currentFile])
	const currentFileFingerprint = useMemo(
		() =>
			[
				currentFile?.file_id || "",
				currentFile?.file_name || "",
				currentFile?.relative_file_path || "",
				currentFile?.updated_at,
			].join(":"),
		[currentFile],
	)

	const attachmentListRef = useRef(attachmentList)
	attachmentListRef.current = attachmentList

	// Load and process HTML content
	useEffect(() => {
		if (!fileId) {
			setProcessedContent(null)
			setFilePathMapping(EMPTY_FILE_PATH_MAPPING)
			setLoading(false)
			return
		}

		let cancelled = false
		setLoading(true)
		setIsRenderReady(false)
		setError(null)
		setProcessedContent(null)
		setFilePathMapping(EMPTY_FILE_PATH_MAPPING)
		;(async () => {
			try {
				const urls = await fileApi.getTemporaryDownloadUrl({ file_ids: [fileId] })
				const url = urls?.[0]?.url
				if (!url) throw new Error("No download URL")
				if (cancelled) return

				const resp = await fetch(url, { credentials: "omit" })
				if (!resp.ok) throw new Error("Failed to load HTML")
				const html = await resp.text()
				if (cancelled) return

				let finalContent = html
				let mapping = EMPTY_FILE_PATH_MAPPING
				const currentAttachmentList = attachmentListRef.current
				if (currentAttachmentList?.length) {
					const result = await processHtmlContent({
						content: html,
						attachments: currentAttachmentList,
						attachmentList: currentAttachmentList,
						fileId,
						fileName: currentFile?.file_name,
						html_relative_path: relativeFolderPath,
					})
					finalContent = result.processedContent || html
					mapping = result.filePathMapping
				}

				finalContent = injectFetchInterceptorScript(finalContent, { fileId })

				if (cancelled) return
				setProcessedContent(finalContent)
				setFilePathMapping(mapping)
				setLoading(false)
			} catch (err) {
				if (cancelled) return
				setError(err instanceof Error ? err.message : "Load error")
				setLoading(false)
			}
		})()

		return () => {
			cancelled = true
		}
	}, [fileApi, fileId, currentFile?.file_name, currentFileFingerprint, relativeFolderPath])

	const handleRenderReady = useCallback(() => {
		setLoading(false)
		setIsRenderReady(true)
		onLoad?.()
	}, [onLoad])

	// 数据已加载但 iframe 尚未渲染就绪时仍保持骨架屏，避免出现"loading 消失但页面空白"的间隙。
	const showLoadingSkeleton =
		showSkeleton && (loading || (Boolean(processedContent) && !isRenderReady))

	if (error) {
		return (
			<div
				className={cn(
					"flex h-full w-full items-center justify-center rounded-lg bg-muted/50 text-sm text-muted-foreground",
					className,
				)}
				style={style}
			>
				<span>Failed to load card</span>
			</div>
		)
	}

	return (
		<div className={cn("relative h-full w-full overflow-hidden", className)} style={style}>
			{showLoadingSkeleton && (
				<AICardIframeLoadingState label={t("detail.aiCard.detail.loadingCard")} />
			)}
			{processedContent && (
				<IsolatedHTMLRenderer
					content={processedContent}
					fileId={fileId}
					filePathMapping={filePathMapping}
					openNewTab={NOOP_OPEN_NEW_TAB}
					attachmentList={attachmentList}
					htmlRelativeFolderPath={relativeFolderPath}
					selectedProject={selectedProject}
					isVisible
					containIframeOverscroll
					hideVerticalScroll={hideVerticalScroll}
					disableIframeDocumentClickBridge
					disableDynamicResourceInterception
					onRenderReady={handleRenderReady}
				/>
			)}
		</div>
	)
}

export default memo(AICardIframe)
