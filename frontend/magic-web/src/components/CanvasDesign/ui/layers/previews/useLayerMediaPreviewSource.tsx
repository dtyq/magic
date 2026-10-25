import {
	createElement,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from "react"
import type { MediaPreviewSource, MediaPreviewType } from "@/components/base/MediaPreview"
import { Image as ImageIcon, Mic, Video } from "lucide-react"
import { useCanvas } from "../../../app/providers/CanvasProvider"
import { useImageLowUrl } from "../../../app/hooks/resources/useImageUrls"
import { getActiveContent } from "../../../runtime/document/elementContent"
import { getPersistedSourceCrop } from "../../../runtime/resources/image/imageCropUtils"
import { calculateTooltipBoundedPreviewSize } from "../../../runtime/resources/image/imagePreviewUtils"
import {
	ElementTypeEnum,
	type AudioElement,
	type CropConfig,
	type ImageElement,
	type VideoElement,
} from "../../../runtime/document/types"
import { useReferenceAudioSrc } from "../../previews/reference-media/useReferenceAudioSrc"
import { useReferenceVideoPoster } from "../../previews/reference-media/useReferenceVideoPoster"
import { useCanvasImagePreviewActions } from "../../previews/reference-media/useCanvasImagePreviewActions"
import styles from "../drawer/index.module.css"

const TOOLTIP_PREVIEW_MAX_SIZE = 250

type LayerMediaElement = ImageElement | VideoElement | AudioElement
type LayerMediaContent = { src?: string; crop?: CropConfig }

interface LayerMediaPreviewSourceResult {
	mediaType: MediaPreviewType | null
	path: string | undefined
	source: MediaPreviewSource | null
	observeRef: (node: HTMLElement | null) => void
	fallback: ReactNode
}

function useVisibleLayerNode() {
	const [node, setNode] = useState<HTMLElement | null>(null)
	const [visible, setVisible] = useState(false)

	const observeRef = useCallback((nextNode: HTMLElement | null) => {
		setNode(nextNode)
	}, [])

	useEffect(() => {
		if (!node || visible) return
		if (typeof IntersectionObserver === "undefined") {
			setVisible(true)
			return
		}

		const observer = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return
				setVisible(true)
				observer.disconnect()
			},
			{ rootMargin: "120px" },
		)
		observer.observe(node)
		return () => observer.disconnect()
	}, [node, visible])

	return { visible, observeRef }
}

function getLayerContent(
	canvas: ReturnType<typeof useCanvas>["canvas"],
	element: LayerMediaElement,
): LayerMediaContent | undefined {
	return (
		(canvas?.getEffectiveContent(element.id) as LayerMediaContent | undefined) ??
		(getActiveContent(element) as LayerMediaContent | undefined)
	)
}

function CanvasPoster({
	poster,
	fileName,
	className,
}: {
	poster: HTMLCanvasElement
	fileName: string
	className: string
}) {
	const ref = useRef<HTMLCanvasElement>(null)

	useEffect(() => {
		const target = ref.current
		if (!target) return
		target.width = poster.width
		target.height = poster.height
		const context = target.getContext("2d")
		if (!context) return
		context.clearRect(0, 0, target.width, target.height)
		context.drawImage(poster, 0, 0)
	}, [poster])

	return createElement("canvas", { ref, className, role: "img", "aria-label": fileName })
}

export function useLayerMediaPreviewSource(
	element: LayerMediaElement,
	fileName: string,
): LayerMediaPreviewSourceResult {
	const { canvas } = useCanvas()
	const { visible, observeRef } = useVisibleLayerNode()
	const content = getLayerContent(canvas, element)
	const path = content?.src
	const mediaType: MediaPreviewType | null =
		element.type === ElementTypeEnum.Image
			? "image"
			: element.type === ElementTypeEnum.Video
				? "video"
				: element.type === ElementTypeEnum.Audio
					? "audio"
					: null

	const image = useImageLowUrl({
		elementId: element.id,
		src: path,
		enabled: visible && mediaType === "image",
	})
	const video = useReferenceVideoPoster(path ?? "", {
		enabled: visible && mediaType === "video",
	})
	const audio = useReferenceAudioSrc(path ?? "", {
		enabled: visible && mediaType === "audio",
	})
	const [fullImageUrl, setFullImageUrl] = useState<string | null>(null)
	const [isFullImageLoading, setIsFullImageLoading] = useState(false)
	const [hasFullImageError, setHasFullImageError] = useState(false)
	const imageRequestIdRef = useRef(0)

	useEffect(() => {
		imageRequestIdRef.current += 1
		setFullImageUrl(null)
		setIsFullImageLoading(false)
		setHasFullImageError(false)
	}, [path])

	const loadFullImage = useCallback(async () => {
		if (!canvas || !path || fullImageUrl || isFullImageLoading) return
		const requestId = imageRequestIdRef.current + 1
		imageRequestIdRef.current = requestId
		setIsFullImageLoading(true)
		setHasFullImageError(false)
		try {
			const url = await canvas.imageResourceManager.ensureFreshOssSrc(path)
			if (imageRequestIdRef.current !== requestId) return
			setFullImageUrl(url)
			setHasFullImageError(!url)
		} catch {
			if (imageRequestIdRef.current === requestId) {
				setFullImageUrl(null)
				setHasFullImageError(true)
			}
		} finally {
			if (imageRequestIdRef.current === requestId) setIsFullImageLoading(false)
		}
	}, [canvas, fullImageUrl, isFullImageLoading, path])

	const imageInfo = image.imageInfo ?? undefined
	const crop = (content as { crop?: Parameters<typeof getPersistedSourceCrop>[0] } | undefined)
		?.crop
	const imagePreviewSize = useMemo(() => {
		if (!imageInfo) return undefined
		const sourceCrop = getPersistedSourceCrop(crop, {
			width: imageInfo.naturalWidth,
			height: imageInfo.naturalHeight,
		})
		return calculateTooltipBoundedPreviewSize(
			{ naturalWidth: sourceCrop.width, naturalHeight: sourceCrop.height },
			TOOLTIP_PREVIEW_MAX_SIZE,
		)
	}, [crop, imageInfo])
	const normalizedCrop = useMemo(() => {
		if (!crop || !imageInfo) return undefined
		return getPersistedSourceCrop(crop, {
			width: imageInfo.naturalWidth,
			height: imageInfo.naturalHeight,
		})
	}, [crop, imageInfo])

	const imageActions = useCanvasImagePreviewActions(
		mediaType === "image" ? path : undefined,
		fileName,
		{
			crop: normalizedCrop,
			element: element.type === ElementTypeEnum.Image ? element : undefined,
		},
	)
	const source = useMemo<MediaPreviewSource | null>(() => {
		if (!path || !mediaType) return null

		if (mediaType === "image") {
			return {
				mediaType,
				imageActions,
				thumbnailUrl: image.lowUrl,
				previewUrl: fullImageUrl,
				crop: normalizedCrop,
				sourceSize:
					imageInfo?.naturalWidth && imageInfo.naturalHeight
						? { width: imageInfo.naturalWidth, height: imageInfo.naturalHeight }
						: undefined,
				previewSize:
					imagePreviewSize?.width && imagePreviewSize.height
						? { width: imagePreviewSize.width, height: imagePreviewSize.height }
						: undefined,
				isLoading: image.isLoading || isFullImageLoading,
				hasError: image.hasError || hasFullImageError,
				loadPreview: visible ? loadFullImage : undefined,
			}
		}

		if (mediaType === "video") {
			const thumbnailElement = video.posterClone
				? createElement(CanvasPoster, {
						poster: video.posterClone,
						fileName,
						className: "size-4 rounded object-cover",
					})
				: undefined
			const poster = video.posterClone
				? createElement(CanvasPoster, {
						poster: video.posterClone,
						fileName,
						className: "absolute inset-0 block h-full w-full object-contain",
					})
				: undefined
			const rawPreviewSize = video.posterClone
				? calculateTooltipBoundedPreviewSize(
						{
							naturalWidth: video.posterClone.width,
							naturalHeight: video.posterClone.height,
						},
						TOOLTIP_PREVIEW_MAX_SIZE,
					)
				: undefined
			const previewSize =
				rawPreviewSize?.width && rawPreviewSize.height
					? { width: rawPreviewSize.width, height: rawPreviewSize.height }
					: undefined
			return {
				mediaType,
				thumbnailElement,
				previewUrl: video.ossSrc,
				poster,
				previewSize,
				isLoading: visible && video.loadState === "loading",
				hasError: visible && video.loadState === "error",
			}
		}

		return {
			mediaType,
			isLoading: audio.isLoading,
			hasError: audio.hasError,
			audioUrl: visible ? audio.src : undefined,
			loadPreview: visible ? audio.load : undefined,
		}
	}, [
		audio,
		fileName,
		fullImageUrl,
		hasFullImageError,
		image,
		imageInfo,
		imagePreviewSize,
		isFullImageLoading,
		loadFullImage,
		mediaType,
		normalizedCrop,
		path,
		video,
		visible,
		imageActions,
	])

	const fallback =
		mediaType === "image"
			? createElement(ImageIcon, { size: 16, className: styles.layerNodeImageIcon })
			: mediaType === "video"
				? createElement(Video, { size: 16, className: styles.layerNodeVideoIcon })
				: createElement(Mic, { size: 16, className: styles.layerNodeVideoIcon })

	return { mediaType, path, source, observeRef, fallback }
}

export type { LayerMediaElement }
