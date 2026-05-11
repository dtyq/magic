import {
	forwardRef,
	memo,
	useCallback,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
} from "react"
import { snapdom } from "@zumer/snapdom"
import { getTemporaryDownloadUrl } from "@/pages/superMagic/utils/api"
import type { ImageProcessOptions } from "@/utils/image-processing"
import { cn } from "@/lib/utils"
import { useTranslation } from "react-i18next"
import { processHtmlContent } from "../../../contents/HTML/htmlProcessor"
import { flattenAttachments } from "../../../contents/HTML/utils"
import type { FileItem } from "../../../contents/HTML/utils/fetchInterceptor"
import type { SelfMediaAttachmentNode } from "../types"
import { replaceFontAwesomeIconsWithSvg } from "../utils/fontAwesomeSvgFallback"

export interface CardFrameRef {
	/** Trigger a screenshot and return the dataUrl. */
	capture: (options?: { pixelRatio?: number; timeoutMs?: number }) => Promise<string>
	/** Get the underlying iframe element (for fallback host-side screenshot). */
	getIframeElement: () => HTMLIFrameElement | null
}

interface CardFrameProps {
	cardId: string
	fileId?: string
	/**
	 * Versioning token from `SelfMediaCard.version` (sourced from `updated_at`).
	 * When the underlying file is updated in-place (same fileId, new content),
	 * including this value in the cache key forces a fresh HTML fetch.
	 */
	version?: string
	attachmentList?: SelfMediaAttachmentNode[]
	autoHeight?: boolean
	className?: string
	style?: React.CSSProperties
	title?: string
	/** 图片处理参数，用于对卡片内嵌图片进行压缩/缩放 */
	imageProcessOptions?: ImageProcessOptions
	/** Forward render lifecycle to the parent (for skeleton hides) */
	onLoaded?: () => void
}

interface CardFrameSourceResult {
	processedContent: string
}

const cardFrameSourceCache = new Map<string, Promise<CardFrameSourceResult>>()

export function invalidateCardFrameSourceCache(fileId?: string) {
	if (!fileId) return

	for (const cacheKey of Array.from(cardFrameSourceCache.keys())) {
		if (!cacheKey.startsWith(`${fileId}::`)) continue
		cardFrameSourceCache.delete(cacheKey)
	}
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

function createAttachmentSignature(files: FileItem[]) {
	return files
		.map((item) => `${item.file_id}:${item.relative_file_path}:${item.file_name}`)
		.sort()
		.join("|")
}

function createCardFrameCacheKey({
	fileId,
	version,
	relativeFolderPath,
	attachmentSignature,
}: {
	fileId?: string
	version?: string
	relativeFolderPath: string
	attachmentSignature: string
}) {
	if (!fileId) return null
	return `${fileId}::${version ?? ""}::${relativeFolderPath}::${attachmentSignature}`
}

function getCaptureDimensions(doc: Document) {
	const body = doc.body
	const docEl = doc.documentElement

	return {
		width: Math.max(
			body?.scrollWidth || 0,
			docEl?.scrollWidth || 0,
			Math.ceil(body?.getBoundingClientRect?.().width || 0),
			Math.ceil(docEl?.getBoundingClientRect?.().width || 0),
			1,
		),
		height: Math.max(
			body?.scrollHeight || 0,
			docEl?.scrollHeight || 0,
			Math.ceil(body?.getBoundingClientRect?.().height || 0),
			Math.ceil(docEl?.getBoundingClientRect?.().height || 0),
			1,
		),
	}
}

function blobToDataUrl(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader.onloadend = () => {
			if (typeof reader.result === "string") {
				resolve(reader.result)
				return
			}
			reject(new Error("blob to dataUrl failed"))
		}
		reader.onerror = () => reject(reader.error || new Error("blob to dataUrl failed"))
		reader.readAsDataURL(blob)
	})
}

async function loadCardFrameSource({
	fileId,
	attachmentList,
	currentFileName,
	relativeFolderPath,
	imageProcessOptions,
}: {
	fileId: string
	attachmentList?: SelfMediaAttachmentNode[]
	currentFileName?: string
	relativeFolderPath: string
	imageProcessOptions?: ImageProcessOptions
}): Promise<CardFrameSourceResult> {
	const urls = await getTemporaryDownloadUrl({ file_ids: [fileId] })
	const url = urls?.[0]?.url
	if (!url) throw new Error("noCardUrl")
	const resp = await fetch(url, { credentials: "omit" })
	if (!resp.ok) throw new Error("loadCardError")
	const html = await resp.text()

	let processedContent = html
	if (attachmentList?.length) {
		const processedResult = await processHtmlContent({
			content: html,
			attachments: attachmentList,
			attachmentList,
			fileId,
			fileName: currentFileName,
			html_relative_path: relativeFolderPath,
			xMagicImageProcess: imageProcessOptions,
		})
		processedContent = processedResult.processedContent || html
	}

	return { processedContent }
}

function getCachedCardFrameSource(
	cacheKey: string,
	args: {
		fileId: string
		attachmentList?: SelfMediaAttachmentNode[]
		currentFileName?: string
		relativeFolderPath: string
		imageProcessOptions?: ImageProcessOptions
	},
) {
	const cachedPromise = cardFrameSourceCache.get(cacheKey)
	if (cachedPromise) return cachedPromise

	const nextPromise = loadCardFrameSource(args).catch((error) => {
		cardFrameSourceCache.delete(cacheKey)
		throw error
	})
	cardFrameSourceCache.set(cacheKey, nextPromise)
	return nextPromise
}

/**
 * Renders a single self-media card inside an isolated iframe.
 *
 * Loading strategy:
 * 1. Fetch the card HTML via temporary S3 URL.
 * 2. Reuse the HTML preview pipeline for relative assets.
 * 3. Render the processed HTML inside the iframe.
 */
const CardFrame = forwardRef<CardFrameRef, CardFrameProps>(function CardFrame(
	{
		cardId,
		fileId,
		version,
		attachmentList,
		autoHeight = false,
		className,
		style,
		title,
		imageProcessOptions,
		onLoaded,
	},
	ref,
) {
	const { t } = useTranslation("super")
	const frameRef = useRef<HTMLDivElement>(null)
	const iframeRef = useRef<HTMLIFrameElement>(null)
	const contentResizeObserverRef = useRef<ResizeObserver | null>(null)
	const stableAttachmentListRef = useRef<{
		signature: string
		list?: SelfMediaAttachmentNode[]
	}>({
		signature: "",
		list: attachmentList,
	})
	const [srcDoc, setSrcDoc] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [isLayoutReady, setIsLayoutReady] = useState(false)
	const [containerWidth, setContainerWidth] = useState(0)
	const [contentSize, setContentSize] = useState({ width: 0, height: 0 })
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
	const relativeFolderPath = useMemo(() => getFileFolderPath(currentFile), [currentFile])
	const attachmentSignature = useMemo(
		() => createAttachmentSignature(flattenedFiles),
		[flattenedFiles],
	)
	if (stableAttachmentListRef.current.signature !== attachmentSignature) {
		stableAttachmentListRef.current = {
			signature: attachmentSignature,
			list: attachmentList,
		}
	}
	const stableAttachmentList = stableAttachmentListRef.current.list
	const cacheKey = useMemo(
		() =>
			createCardFrameCacheKey({
				fileId,
				version,
				relativeFolderPath,
				attachmentSignature,
			}),
		[attachmentSignature, fileId, version, relativeFolderPath],
	)
	const scale =
		contentSize.width > 0 && containerWidth > 0
			? Math.min(containerWidth / contentSize.width, 1)
			: 1
	const scaledHeight =
		contentSize.height > 0 ? Math.max(contentSize.height * scale, 1) : undefined

	const measureFrame = useCallback(() => {
		const frameNode = frameRef.current
		const iframeNode = iframeRef.current
		if (frameNode) {
			const nextContainerWidth =
				frameNode.clientWidth || frameNode.getBoundingClientRect().width || 0
			setContainerWidth((prev) => (prev === nextContainerWidth ? prev : nextContainerWidth))
		}
		const doc = iframeNode?.contentDocument
		if (!doc) return
		const body = doc.body
		const docEl = doc.documentElement
		const nextWidth = Math.max(
			body?.scrollWidth || 0,
			docEl?.scrollWidth || 0,
			Math.ceil(body?.getBoundingClientRect?.().width || 0),
		)
		const nextHeight = Math.max(
			body?.scrollHeight || 0,
			docEl?.scrollHeight || 0,
			Math.ceil(body?.getBoundingClientRect?.().height || 0),
		)
		if (nextWidth <= 0 || nextHeight <= 0) return
		setContentSize((prev) =>
			prev.width === nextWidth && prev.height === nextHeight
				? prev
				: { width: nextWidth, height: nextHeight },
		)
	}, [])

	useEffect(() => {
		let cancelled = false
		setError(null)
		setContentSize({ width: 0, height: 0 })
		setIsLayoutReady(false)

		if (!fileId || !cacheKey) {
			setSrcDoc(null)
			return
		}
		setSrcDoc(null)
		;(async () => {
			try {
				const source = await getCachedCardFrameSource(cacheKey, {
					fileId,
					attachmentList: stableAttachmentList,
					currentFileName: currentFile?.file_name,
					relativeFolderPath,
					imageProcessOptions,
				})
				if (cancelled) return
				setSrcDoc(source.processedContent)
			} catch (err) {
				if (cancelled) return
				setSrcDoc(null)
				setError(err instanceof Error ? err.message : "loadCardError")
			}
		})()
		return () => {
			cancelled = true
			contentResizeObserverRef.current?.disconnect()
			contentResizeObserverRef.current = null
		}
	}, [
		attachmentSignature,
		cacheKey,
		cardId,
		currentFile?.file_name,
		fileId,
		version,
		relativeFolderPath,
		stableAttachmentList,
	])

	useEffect(() => {
		measureFrame()
		const node = frameRef.current
		if (!node || typeof ResizeObserver === "undefined") return
		const observer = new ResizeObserver(() => {
			measureFrame()
		})
		observer.observe(node)
		return () => observer.disconnect()
	}, [measureFrame])

	const capture = useCallback<CardFrameRef["capture"]>(
		async ({ pixelRatio = 2, timeoutMs = 15000 } = {}) => {
			const iframe = iframeRef.current
			if (!iframe?.contentWindow) throw new Error("iframe not ready")
			const iframeDoc = iframe.contentDocument
			const iframeBody = iframeDoc?.body
			if (!iframeDoc || !iframeBody) throw new Error("iframe body not ready")

			const { width, height } = getCaptureDimensions(iframeDoc)
			const svgFallback = replaceFontAwesomeIconsWithSvg(iframeDoc)

			let timeoutId: number | null = null
			const timeoutPromise = new Promise<never>((_, reject) => {
				timeoutId = window.setTimeout(() => {
					reject(new Error("capture timeout"))
				}, timeoutMs)
			})

			try {
				await iframeDoc.fonts?.ready

				const dataUrl = await Promise.race([
					(async () => {
						const result = await snapdom(iframeBody, {
							width,
							height,
							scale: pixelRatio,
							backgroundColor: "#ffffff",
							embedFonts: false,
						})
						const blob = await result.toBlob({ type: "png" })
						return blobToDataUrl(blob)
					})(),
					timeoutPromise,
				])
				return dataUrl
			} finally {
				if (timeoutId !== null) window.clearTimeout(timeoutId)
				svgFallback.restore()
			}
		},
		[],
	)

	useImperativeHandle(
		ref,
		() => ({
			capture,
			getIframeElement: () => iframeRef.current,
		}),
		[capture],
	)

	if (error) {
		const errorMessage =
			error === "noCardUrl"
				? t("detail.selfMedia.errors.noCardUrl")
				: t("detail.selfMedia.errors.loadCardError")

		return (
			<div
				className={cn(
					"flex h-full w-full items-center justify-center bg-muted text-xs text-muted-foreground",
					className,
				)}
				style={style}
				data-testid="self-media-card-error"
			>
				{errorMessage}
			</div>
		)
	}

	const showLoading = !srcDoc || !isLayoutReady

	return (
		<div
			ref={frameRef}
			className={cn("relative w-full overflow-hidden", !autoHeight && "h-full", className)}
			style={{
				...style,
				height: style?.height ?? scaledHeight,
			}}
			data-testid="self-media-card-frame"
		>
			{showLoading && (
				<div
					className="absolute inset-0 z-10 flex items-center justify-center bg-muted/30 text-xs text-muted-foreground"
					data-testid="self-media-card-loading"
				>
					{t("detail.selfMedia.common.loading")}
				</div>
			)}
			{srcDoc && (
				<iframe
					ref={iframeRef}
					title={title || cardId}
					srcDoc={srcDoc}
					className="block border-0 bg-white"
					style={{
						width: contentSize.width > 0 ? `${contentSize.width}px` : "100%",
						height: contentSize.height > 0 ? `${contentSize.height}px` : "100%",
						transform: `scale(${scale})`,
						transformOrigin: "top left",
						visibility: isLayoutReady ? "visible" : "hidden",
					}}
					onLoad={() => {
						contentResizeObserverRef.current?.disconnect()
						contentResizeObserverRef.current = null
						if (
							typeof ResizeObserver !== "undefined" &&
							iframeRef.current?.contentDocument
						) {
							const observer = new ResizeObserver(() => {
								measureFrame()
							})
							if (typeof observer.observe === "function") {
								const body = iframeRef.current.contentDocument.body
								const docEl = iframeRef.current.contentDocument.documentElement
								if (body) observer.observe(body)
								if (docEl && docEl !== body) observer.observe(docEl)
								contentResizeObserverRef.current = observer
							}
						}
						measureFrame()
						setIsLayoutReady(true)
						onLoaded?.()
					}}
					sandbox="allow-scripts allow-same-origin"
				/>
			)}
		</div>
	)
})

export default memo(CardFrame)
