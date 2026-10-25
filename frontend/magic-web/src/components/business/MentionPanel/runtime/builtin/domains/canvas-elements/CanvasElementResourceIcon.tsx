import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { CSSProperties } from "react"
import { ImageElement as ImageElementClass } from "@/components/CanvasDesign/runtime/elements/image/ImageElement"
import type { ImageInfo } from "@/components/CanvasDesign/runtime/resources/image/ImageResourceManager"
import { getPersistedSourceCrop } from "@/components/CanvasDesign/runtime/resources/image/imageCropUtils"
import { useOptionalCanvas } from "@/components/CanvasDesign/app/providers/CanvasProvider"
import { Image as ImageIcon, Video, Volume2 } from "lucide-react"
import type { CanvasElementMentionSourcePreview } from "../../../../types"
import { MentionFileImagePreviewBox } from "../file-preview/MentionFileImagePreviewBox"
import { useCanvasElementResourceCanvas } from "./resource-registry"

type ResourceLoadPhase = "loading" | "loaded" | "error"

function CanvasElementFallbackIcon(props: {
	mediaType: CanvasElementMentionSourcePreview["mediaType"]
	iconSize: number
}) {
	const { mediaType, iconSize } = props
	const Icon = mediaType === "video" ? Video : mediaType === "audio" ? Volume2 : ImageIcon
	return (
		<Icon
			size={iconSize}
			className="text-slate-400"
			data-testid={`canvas-element-${mediaType}-icon`}
		/>
	)
}

function useCanvasElementLowImage(preview: CanvasElementMentionSourcePreview) {
	const canvasFromContext = useOptionalCanvas()
	const canvasFromRegistry = useCanvasElementResourceCanvas(preview.designProjectId)
	const canvas = canvasFromContext ?? canvasFromRegistry
	const requestIdRef = useRef(0)
	const releaseRef = useRef<(() => void) | null>(null)
	const [lowUrl, setLowUrl] = useState<string | null>(null)
	const [imageInfo, setImageInfo] = useState<ImageInfo | null>(null)
	const [phase, setPhase] = useState<ResourceLoadPhase>("loading")

	const releaseLowUrl = useCallback(() => {
		releaseRef.current?.()
		releaseRef.current = null
	}, [])

	useEffect(() => releaseLowUrl, [releaseLowUrl])

	useEffect(() => {
		const currentRequestId = requestIdRef.current + 1
		requestIdRef.current = currentRequestId
		releaseLowUrl()
		setLowUrl(null)
		setImageInfo(null)

		if (!canvas || !preview.src) {
			setPhase("error")
			return
		}

		setPhase("loading")
		void canvas.imageResourceManager
			.getLowImageUrl(preview.src)
			.then((loaded) => {
				if (requestIdRef.current !== currentRequestId) {
					loaded?.release()
					return
				}

				releaseRef.current = loaded?.release ?? null
				setLowUrl(loaded?.url ?? null)
				setImageInfo(loaded?.imageInfo ?? null)
				setPhase(loaded?.url ? "loaded" : "error")
			})
			.catch(() => {
				if (requestIdRef.current !== currentRequestId) return
				setLowUrl(null)
				setImageInfo(null)
				setPhase("error")
			})

		return () => {
			if (requestIdRef.current === currentRequestId) {
				requestIdRef.current += 1
			}
		}
	}, [canvas, preview.src, releaseLowUrl])

	return { canvas, lowUrl, imageInfo, phase }
}

function getCanvasElementImagePreviewLayout(params: {
	iconSize: number
	lowUrl: string
	imageInfo: ImageInfo | undefined
	crop: CanvasElementMentionSourcePreview["crop"]
}): {
	viewportStyle: CSSProperties
	contentStyle: CSSProperties
} {
	const { iconSize, lowUrl, imageInfo, crop } = params
	const baseViewportStyle: CSSProperties = {
		position: "absolute",
		overflow: "hidden",
		width: "100%",
		height: "100%",
		left: 0,
		top: 0,
	}
	const baseContentStyle: CSSProperties = {
		position: "absolute",
		inset: 0,
		backgroundImage: `url("${lowUrl}")`,
		backgroundPosition: "center",
		backgroundRepeat: "no-repeat",
		backgroundSize: "contain",
	}

	if (!imageInfo) {
		return {
			viewportStyle: baseViewportStyle,
			contentStyle: baseContentStyle,
		}
	}

	const sourceWidth = imageInfo.naturalWidth ?? 0
	const sourceHeight = imageInfo.naturalHeight ?? 0
	if (sourceWidth <= 0 || sourceHeight <= 0) {
		return {
			viewportStyle: baseViewportStyle,
			contentStyle: baseContentStyle,
		}
	}

	const sourceCrop = getPersistedSourceCrop(crop, {
		width: sourceWidth,
		height: sourceHeight,
	})
	if (sourceCrop.width <= 0 || sourceCrop.height <= 0) {
		return {
			viewportStyle: baseViewportStyle,
			contentStyle: baseContentStyle,
		}
	}

	const scale = Math.min(iconSize / sourceCrop.width, iconSize / sourceCrop.height)
	const viewportWidth = sourceCrop.width * scale
	const viewportHeight = sourceCrop.height * scale

	return {
		viewportStyle: {
			...baseViewportStyle,
			width: `${viewportWidth}px`,
			height: `${viewportHeight}px`,
			left: `${(iconSize - viewportWidth) / 2}px`,
			top: `${(iconSize - viewportHeight) / 2}px`,
		},
		contentStyle: {
			...baseContentStyle,
			inset: undefined,
			width: `${sourceWidth * scale}px`,
			height: `${sourceHeight * scale}px`,
			transform: `translate(${-sourceCrop.x * scale}px, ${-sourceCrop.y * scale}px)`,
			backgroundSize: "100% 100%",
		},
	}
}

function CanvasElementImageResourceIcon(props: {
	preview: CanvasElementMentionSourcePreview
	iconSize: number
}) {
	const { preview, iconSize } = props
	const { canvas, lowUrl, imageInfo: lowImageInfo, phase } = useCanvasElementLowImage(preview)
	const elementInstance = canvas?.elementManager.getElementInstance(preview.elementId)
	const imageInfo =
		(elementInstance instanceof ImageElementClass
			? elementInstance.getImageInfo()
			: undefined) ??
		lowImageInfo ??
		undefined

	const { viewportStyle, contentStyle } = useMemo(() => {
		if (!lowUrl) {
			return {
				viewportStyle: {},
				contentStyle: {},
			}
		}
		return getCanvasElementImagePreviewLayout({
			iconSize,
			lowUrl,
			imageInfo,
			crop: preview.crop,
		})
	}, [iconSize, imageInfo, lowUrl, preview.crop])

	if (phase === "error") {
		return <CanvasElementFallbackIcon mediaType="image" iconSize={iconSize} />
	}

	if (!lowUrl) {
		return <CanvasElementFallbackIcon mediaType="image" iconSize={iconSize} />
	}

	return (
		<MentionFileImagePreviewBox iconSize={iconSize}>
			<div className="relative h-full w-full" data-testid="canvas-element-image-preview">
				<div style={viewportStyle}>
					<div style={contentStyle} />
				</div>
			</div>
		</MentionFileImagePreviewBox>
	)
}

function drawPosterToCanvas(
	target: HTMLCanvasElement,
	poster: HTMLCanvasElement,
	iconSize: number,
) {
	const ratio = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1
	target.width = iconSize * ratio
	target.height = iconSize * ratio
	target.style.width = "100%"
	target.style.height = "100%"

	const ctx = target.getContext("2d")
	if (!ctx) return
	ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
	ctx.clearRect(0, 0, iconSize, iconSize)

	const posterWidth = poster.width || iconSize
	const posterHeight = poster.height || iconSize
	const scale = Math.max(iconSize / posterWidth, iconSize / posterHeight)
	const drawWidth = posterWidth * scale
	const drawHeight = posterHeight * scale
	ctx.drawImage(
		poster,
		(iconSize - drawWidth) / 2,
		(iconSize - drawHeight) / 2,
		drawWidth,
		drawHeight,
	)
}

function CanvasElementVideoResourceIcon(props: {
	preview: CanvasElementMentionSourcePreview
	iconSize: number
}) {
	const { preview, iconSize } = props
	const canvasFromContext = useOptionalCanvas()
	const canvasFromRegistry = useCanvasElementResourceCanvas(preview.designProjectId)
	const canvas = canvasFromContext ?? canvasFromRegistry
	const posterCanvasRef = useRef<HTMLCanvasElement | null>(null)
	const [poster, setPoster] = useState<HTMLCanvasElement | null>(null)
	const [phase, setPhase] = useState<ResourceLoadPhase>("loading")

	useEffect(() => {
		const currentRequestId = Symbol("video-preview")
		let activeRequestId: symbol | null = currentRequestId
		setPoster(null)

		if (!canvas || !preview.src) {
			setPhase("error")
			return
		}

		setPhase("loading")
		void canvas.videoResourceManager
			.getPreviewResource(preview.src)
			.then((resource) => {
				if (activeRequestId !== currentRequestId) return
				setPoster(resource?.poster ?? null)
				setPhase(resource?.poster ? "loaded" : "error")
			})
			.catch(() => {
				if (activeRequestId !== currentRequestId) return
				setPoster(null)
				setPhase("error")
			})

		return () => {
			activeRequestId = null
		}
	}, [canvas, preview.src])

	useEffect(() => {
		if (!posterCanvasRef.current || !poster) return
		drawPosterToCanvas(posterCanvasRef.current, poster, iconSize)
	}, [iconSize, poster])

	if (phase === "error") {
		return <CanvasElementFallbackIcon mediaType="video" iconSize={iconSize} />
	}

	if (!poster) {
		return <CanvasElementFallbackIcon mediaType="video" iconSize={iconSize} />
	}

	return (
		<MentionFileImagePreviewBox iconSize={iconSize}>
			<canvas ref={posterCanvasRef} className="block h-full w-full" aria-hidden />
		</MentionFileImagePreviewBox>
	)
}

export function CanvasElementResourceIcon(props: {
	preview: CanvasElementMentionSourcePreview
	iconSize: number
}) {
	const { preview, iconSize } = props
	if (preview.mediaType === "audio") {
		return <CanvasElementFallbackIcon mediaType="audio" iconSize={iconSize} />
	}
	if (preview.mediaType === "video") {
		return <CanvasElementVideoResourceIcon preview={preview} iconSize={iconSize} />
	}

	return <CanvasElementImageResourceIcon preview={preview} iconSize={iconSize} />
}
