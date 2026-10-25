import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react"
import type { MediaPreviewSource } from "@/components/base/MediaPreview"
import {
	mediaResourceRegistry,
	useMediaResourceSnapshot,
	type MediaResourceRef,
	type MediaResourceResolver,
} from "@/services/media/MediaResourceRegistry"
import { useOptionalCanvas } from "../../../app/providers/CanvasProvider"
import { useReferenceImageUrls } from "../../../app/hooks/resources/useReferenceImageUrls"
import { getMediaResourcePathKind } from "../../../runtime/resources/media-common/mediaResourcePathKind"
import { useReferenceAudioSrc } from "../../previews/reference-media/useReferenceAudioSrc"
import { useReferenceVideoPoster } from "../../previews/reference-media/useReferenceVideoPoster"
import type { CanvasAssetMediaType } from "../../../public/magic-types"
import { useCanvasImagePreviewActions } from "../../previews/reference-media/useCanvasImagePreviewActions"

interface CanvasPosterProps {
	poster: HTMLCanvasElement
	className: string
	fileName: string
}

function CanvasPoster({ poster, className, fileName }: CanvasPosterProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null)

	useLayoutEffect(() => {
		const target = canvasRef.current
		if (!target) return
		target.width = poster.width
		target.height = poster.height
		const context = target.getContext("2d")
		if (!context) return
		context.clearRect(0, 0, target.width, target.height)
		context.drawImage(poster, 0, 0)
	}, [poster])

	return <canvas ref={canvasRef} className={className} role="img" aria-label={fileName} />
}

interface UseCanvasMentionMediaSourceOptions {
	path?: string
	fileName: string
	fileExtension?: string
	mediaType?: CanvasAssetMediaType | null
	enabled?: boolean
}

function getMediaKind(
	path: string | undefined,
	fileName: string,
	fileExtension?: string,
	mediaType?: CanvasAssetMediaType | null,
) {
	const extension = fileExtension?.replace(/^\./, "")
	const probe = path || (extension ? `${fileName}.${extension}` : fileName)
	return getMediaResourcePathKind(probe, { mediaType })
}

/**
 * Resolves Canvas mention media through the existing Canvas resource managers
 * and publishes their lifecycle through the shared registry facade. The
 * managers remain the owners of low-image/poster release semantics.
 */
export function useCanvasMentionMediaSource(
	options: UseCanvasMentionMediaSourceOptions,
): MediaPreviewSource | null {
	const { path, fileName, fileExtension, mediaType, enabled = true } = options
	const canvas = useOptionalCanvas()
	const mediaKind = getMediaKind(path, fileName, fileExtension, mediaType)
	const resourcePath = path || ""
	const resourceEnabled = enabled && Boolean(canvas)
	const imageActions = useCanvasImagePreviewActions(
		resourceEnabled && mediaKind === "image" ? path : undefined,
		fileName,
	)
	const image = useReferenceImageUrls(resourcePath, {
		enabled: resourceEnabled && mediaKind === "image",
	})
	const video = useReferenceVideoPoster(resourcePath, {
		enabled: resourceEnabled && mediaKind === "video",
	})
	const audio = useReferenceAudioSrc(resourcePath, {
		enabled: resourceEnabled && mediaKind === "audio",
	})

	const registryRef = useMemo<MediaResourceRef | null>(() => {
		if (!canvas || !path || mediaKind === "other") return null
		return {
			identity: path,
			provider: "canvas",
			projectId: canvas.id,
			path,
			fileName,
			mediaType: mediaKind,
		}
	}, [canvas, fileName, mediaKind, path])
	const registryResolver = useCallback<MediaResourceResolver>(async () => null, [])
	const registryResource = useMediaResourceSnapshot(registryRef, {
		enabled: false,
		loadThumbnail: false,
		resolver: registryResolver,
	})

	const imagePreviewWidth = image.previewSize.width
	const imagePreviewHeight = image.previewSize.height
	const videoPreviewWidth = video.posterClone?.width
	const videoPreviewHeight = video.posterClone?.height

	useEffect(() => {
		if (!registryRef) return
		if (mediaKind === "image") {
			mediaResourceRegistry.prime(registryRef, {
				status: image.hasError
					? "error"
					: image.isLoading || image.isFullUrlLoading
						? "loading"
						: image.lowUrl || image.fullUrl
							? "ready"
							: "idle",
				previewSize:
					imagePreviewWidth && imagePreviewHeight
						? { width: imagePreviewWidth, height: imagePreviewHeight }
						: undefined,
			})
			return
		}
		if (mediaKind === "video") {
			mediaResourceRegistry.prime(registryRef, {
				status:
					video.loadState === "error"
						? "error"
						: video.loadState === "loading"
							? "loading"
							: video.ossSrc
								? "ready"
								: "idle",
				previewSize:
					videoPreviewWidth && videoPreviewHeight
						? { width: videoPreviewWidth, height: videoPreviewHeight }
						: undefined,
			})
			return
		}
		if (mediaKind === "audio") {
			mediaResourceRegistry.prime(registryRef, {
				status: audio.hasError
					? "error"
					: audio.isLoading
						? "loading"
						: audio.src
							? "ready"
							: "idle",
			})
		}
	}, [
		audio.hasError,
		audio.isLoading,
		audio.src,
		image.fullUrl,
		image.hasError,
		image.isFullUrlLoading,
		image.isLoading,
		image.lowUrl,
		imagePreviewHeight,
		imagePreviewWidth,
		mediaKind,
		registryRef,
		video.loadState,
		video.ossSrc,
		videoPreviewHeight,
		videoPreviewWidth,
	])

	return useMemo(() => {
		if (!resourceEnabled || !path) return null
		const snapshot = registryResource.snapshot

		if (mediaKind === "image") {
			return {
				mediaType: "image",
				imageActions,
				thumbnailUrl: image.lowUrl,
				previewUrl: image.fullUrl,
				isLoading:
					image.isLoading || image.isFullUrlLoading || snapshot.status === "loading",
				hasError: image.hasError || snapshot.status === "error",
				loadPreview: image.loadTooltip,
				previewSize:
					image.previewSize.width && image.previewSize.height
						? { width: image.previewSize.width, height: image.previewSize.height }
						: undefined,
				sourceSize:
					image.imageInfo?.naturalWidth && image.imageInfo.naturalHeight
						? {
								width: image.imageInfo.naturalWidth,
								height: image.imageInfo.naturalHeight,
							}
						: undefined,
			} satisfies MediaPreviewSource
		}

		if (mediaKind === "video") {
			const thumbnailElement = video.posterClone ? (
				<CanvasPoster
					poster={video.posterClone}
					fileName={fileName}
					className="size-4 shrink-0 rounded object-cover"
				/>
			) : undefined
			const poster = video.posterClone ? (
				<CanvasPoster
					poster={video.posterClone}
					fileName={fileName}
					className="absolute inset-0 block h-full w-full object-contain"
				/>
			) : undefined
			return {
				mediaType: "video",
				thumbnailElement,
				previewUrl: video.ossSrc,
				poster,
				isLoading: video.loadState === "loading",
				hasError: video.loadState === "error",
				previewSize: video.posterClone
					? { width: video.posterClone.width, height: video.posterClone.height }
					: undefined,
				sourceSize: video.posterClone
					? { width: video.posterClone.width, height: video.posterClone.height }
					: undefined,
			} satisfies MediaPreviewSource
		}

		if (mediaKind === "audio") {
			return {
				mediaType: "audio",
				previewUrl: audio.src,
				audioUrl: audio.src,
				isLoading: audio.isLoading,
				hasError: audio.hasError,
				loadPreview: audio.load,
			} satisfies MediaPreviewSource
		}

		return null
	}, [
		audio,
		fileName,
		image,
		mediaKind,
		path,
		registryResource.snapshot,
		resourceEnabled,
		video,
		imageActions,
	])
}
