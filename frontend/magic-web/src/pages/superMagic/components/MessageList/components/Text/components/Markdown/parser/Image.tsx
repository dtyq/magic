import { ImageOff } from "lucide-react"
import { observer } from "mobx-react-lite"
import { memo, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { IMAGE_EXTENSIONS } from "@/constants/file"
import { useFileApi, type FileApi } from "@/pages/superMagic/fileAccess/fileApi"
import { useFileAccess } from "@/pages/superMagic/fileAccess/FileAccessProvider"
import { shouldWaitForShareAccess } from "@/pages/superMagic/fileAccess/fileAccessContext"
import { decodePathForDisplay } from "./helper"
import {
	findAttachmentByPath,
	parseCanonicalWorkspaceHref,
} from "@/pages/superMagic/utils/markdownFileReference"
import { useMessageListProjectFilesStore } from "@/pages/superMagic/components/MessageList/context"

const IMAGE_EXTENSION_SET = new Set(
	[...IMAGE_EXTENSIONS, "avif", "bmp", "ico", "tif", "tiff"].map((extension) =>
		extension.toLowerCase(),
	),
)
const IMAGE_URL_CACHE_TTL_MS = 60_000
const IMAGE_URL_CACHE_MAX_SIZE = 200
const imageUrlPromiseCache = new Map<
	string,
	{ expiresAt: number; promise: Promise<string | null> }
>()

type ImageFailureReason = "empty" | "missing" | "notImage" | "url" | "load"

const ImageLoadFailure = memo(({ src, reason }: { src: string; reason: ImageFailureReason }) => {
	const { t } = useTranslation("super")
	const displaySrc = decodePathForDisplay(src)
	const message =
		reason === "empty"
			? t("common.markdownImage.emptySource")
			: reason === "missing"
				? t("common.markdownImage.fileMissing")
				: reason === "notImage"
					? t("common.markdownImage.notImage")
					: reason === "url"
						? t("common.markdownImage.urlFailed")
						: t("common.markdownImage.loadFailed")

	// Keep the error state visually close to a responsive image frame without forcing message width.
	return (
		<div
			className="my-2 flex min-h-32 w-full max-w-[480px] flex-col items-center justify-center gap-2 overflow-hidden rounded-md border border-dashed border-border bg-muted/30 px-4 py-5 text-center text-xs text-muted-foreground"
			data-testid="markdown-image-failed"
			data-image-failure-reason={reason}
			title={displaySrc}
		>
			<ImageOff aria-hidden="true" className="size-4" />
			<span className="font-medium text-foreground">{message}</span>
			<span className="max-w-full break-all">
				{t("common.markdownImage.address")}: {displaySrc || "-"}
			</span>
		</div>
	)
})

function isExternalImageSource(src: string): boolean {
	return /^(?:https?:|data:|blob:|\/\/)/i.test(src)
}

function isImageAttachment(fileInfo: Record<string, unknown> | undefined, src: string): boolean {
	if (!fileInfo) return false
	if (fileInfo.is_directory === true) return false

	const mimeType = [fileInfo.mime_type, fileInfo.content_type, fileInfo.file_type].find(
		(value): value is string =>
			typeof value === "string" && value.toLowerCase().startsWith("image/"),
	)
	if (mimeType) return true

	const fileName =
		typeof fileInfo.file_name === "string"
			? fileInfo.file_name
			: typeof fileInfo.filename === "string"
				? fileInfo.filename
				: src
	const extensionValue =
		typeof fileInfo.file_extension === "string"
			? fileInfo.file_extension
			: fileName.split(".").pop()
	const extension = extensionValue?.toLowerCase().replace(/^\./, "")
	return Boolean(extension && IMAGE_EXTENSION_SET.has(extension))
}

function resolveImageUrl(fileId: string, fileApi: FileApi): Promise<string | null> {
	const cacheKey = `${fileApi.identityKey}:${fileId}`
	const cached = imageUrlPromiseCache.get(cacheKey)
	if (cached && cached.expiresAt > Date.now()) return cached.promise
	imageUrlPromiseCache.delete(cacheKey)

	const request = fileApi
		.getTemporaryDownloadUrl({
			file_ids: [fileId],
		})
		.then((result) => result?.[0]?.url || null)
		.catch((error) => {
			console.error("Failed to resolve markdown image URL", error)
			return null
		})

	// Streaming messages can remount an image repeatedly; keep a small, short-lived cache without
	// retaining expired signed URLs or an unbounded number of workspace file IDs.
	if (imageUrlPromiseCache.size >= IMAGE_URL_CACHE_MAX_SIZE) {
		const oldestFileId = imageUrlPromiseCache.keys().next().value
		if (oldestFileId) imageUrlPromiseCache.delete(oldestFileId)
	}
	imageUrlPromiseCache.set(cacheKey, {
		expiresAt: Date.now() + IMAGE_URL_CACHE_TTL_MS,
		promise: request,
	})
	return request
}

const ResolvedImage = memo(
	({
		alt,
		src,
		title,
		fileId,
		isExternal,
	}: {
		alt?: string
		src: string
		title?: string
		fileId?: string
		isExternal: boolean
	}) => {
		const [resolvedSrc, setResolvedSrc] = useState<string>()
		const [failureReason, setFailureReason] = useState<ImageFailureReason>()
		const fileAccess = useFileAccess()
		// Bind the ambient share/session identity so relative images are readable in
		// share previews instead of failing closed.
		const fileApi = useFileApi()

		useEffect(() => {
			let isActive = true
			setResolvedSrc(undefined)
			setFailureReason(undefined)

			if (isExternal || !fileId || shouldWaitForShareAccess(fileAccess)) {
				return () => undefined
			}

			// Cache in-flight requests because streaming Markdown may remount the same image node.
			resolveImageUrl(fileId, fileApi).then((url) => {
				if (!isActive) return
				if (url) setResolvedSrc(url)
				else setFailureReason("url")
			})

			return () => {
				isActive = false
			}
		}, [fileAccess, fileApi, fileId, isExternal])

		if (failureReason) {
			return <ImageLoadFailure src={src} reason={failureReason} />
		}

		return (
			<img
				src={isExternal ? src : resolvedSrc}
				alt={alt}
				title={title || decodePathForDisplay(src)}
				data-testid="markdown-image"
				onError={() => setFailureReason("load")}
			/>
		)
	},
)

export const Image = observer(
	({ alt, src, title }: { alt?: unknown; src?: unknown; title?: unknown }) => {
		const projectFilesStore = useMessageListProjectFilesStore()
		const normalizedAlt = typeof alt === "string" ? alt : undefined
		const normalizedSrc = typeof src === "string" ? src : ""
		const normalizedTitle = typeof title === "string" ? title : undefined
		const attachments = projectFilesStore?.workspaceFilesList ?? []
		const filePath = parseCanonicalWorkspaceHref(normalizedSrc, { allowWorkspaceRoot: true })
		const fileInfo = filePath ? findAttachmentByPath(attachments, filePath) : undefined
		const hasExternalSource = isExternalImageSource(normalizedSrc)

		if (!normalizedSrc) {
			return <ImageLoadFailure src={normalizedSrc} reason="empty" />
		}

		if (!hasExternalSource && !fileInfo) {
			return <ImageLoadFailure src={normalizedSrc} reason="missing" />
		}

		if (!hasExternalSource && !isImageAttachment(fileInfo, normalizedSrc)) {
			return <ImageLoadFailure src={normalizedSrc} reason="notImage" />
		}

		return (
			<ResolvedImage
				alt={normalizedAlt}
				src={normalizedSrc}
				title={normalizedTitle}
				fileId={fileInfo?.file_id}
				isExternal={hasExternalSource}
			/>
		)
	},
)
