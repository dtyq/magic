import styles from "./index.module.css"
import { ImagePlus, LoaderCircle } from "lucide-react"
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react"
import { useReferenceImageUrls } from "../../hooks/useReferenceImageUrls"
import { useReferenceVideoPoster } from "../ReferenceImageThumbnailImage/useReferenceVideoPoster"
import { computeReferenceImageCroppedDisplayLayout } from "../../canvas/utils/imageCropUtils"
import type { CropConfig } from "../../canvas/types"
import { getMediaResourcePathKind } from "../../canvas/utils/mediaResourcePathKind"
import type { MediaResourceFullscreenPreviewItem } from "../MediaResourceFullscreenPreview"
import { CanvasFileIcon, ReferenceSlotAudioIcon, ReferenceSlotVideoIcon } from "../ui/icons"
import { buildPreviewMediaResourceItem } from "./mediaPreviewItem"

interface ReferenceImageItemProps {
	path: string
	/** 基于源图像素的裁剪区 */
	sourceCrop?: Pick<CropConfig, "width" | "height" | "x" | "y">
	onPreviewMediaResource: (resource: MediaResourceFullscreenPreviewItem) => void
}

function useObserveBoxSize(active: boolean) {
	const ref = useRef<HTMLDivElement>(null)
	const [size, setSize] = useState({ w: 0, h: 0 })
	useLayoutEffect(() => {
		if (!active) {
			return
		}
		const el = ref.current
		if (!el) {
			return
		}
		const read = () => {
			const cr = el.getBoundingClientRect()
			setSize({ w: cr.width, h: cr.height })
		}
		read()
		const ro = new ResizeObserver(read)
		ro.observe(el)
		return () => ro.disconnect()
	}, [active])
	return { ref, w: size.w, h: size.h }
}

function ReferenceImageItemVideo(props: {
	path: string
	onPreviewMediaResource: (resource: MediaResourceFullscreenPreviewItem) => void
}) {
	const { path, onPreviewMediaResource } = props
	const { loadState, posterClone } = useReferenceVideoPoster(path)
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const displayName = useMemo(() => path.split("/").pop() ?? path, [path])
	const previewItem = useMemo(() => buildPreviewMediaResourceItem(path), [path])

	const openPreview = useCallback(() => {
		if (!previewItem) return
		onPreviewMediaResource(previewItem)
	}, [previewItem, onPreviewMediaResource])

	const handlePreviewKeyDown = useCallback(
		(e: KeyboardEvent<HTMLDivElement>) => {
			if (e.key !== "Enter" && e.key !== " ") return
			e.preventDefault()
			openPreview()
		},
		[openPreview],
	)

	useLayoutEffect(() => {
		const el = canvasRef.current
		if (!el || !posterClone || loadState !== "ready") return
		el.width = posterClone.width
		el.height = posterClone.height
		const ctx = el.getContext("2d")
		if (!ctx) return
		ctx.clearRect(0, 0, el.width, el.height)
		ctx.drawImage(posterClone, 0, 0)
	}, [posterClone, loadState])

	if (loadState === "loading") {
		return (
			<div className={styles.image} style={{ cursor: "default" }}>
				<div className={styles.imageLoading}>
					<LoaderCircle size={16} className={styles.loadingIcon} />
				</div>
			</div>
		)
	}

	if (loadState === "error" || !posterClone) {
		return (
			<div className={styles.image} style={{ cursor: "default" }}>
				<div className="flex h-full w-full items-center justify-center bg-muted/40">
					<ReferenceSlotVideoIcon size={28} />
				</div>
			</div>
		)
	}

	return (
		<div
			className={styles.image}
			role="button"
			tabIndex={0}
			style={{ cursor: "pointer" }}
			onClick={openPreview}
			onKeyDown={handlePreviewKeyDown}
			aria-label={displayName}
		>
			<canvas ref={canvasRef} role="img" aria-hidden />
		</div>
	)
}

export default function ReferenceImageItem({
	path,
	sourceCrop,
	onPreviewMediaResource,
}: ReferenceImageItemProps) {
	const fileType = useMemo(() => getMediaResourcePathKind(path), [path])
	const isImageLike = fileType === "image"
	const { thumbnailUrl, isLoading, hasError, imageInfo } = useReferenceImageUrls(path)

	const canCropLayout =
		Boolean(sourceCrop) && Boolean(imageInfo?.naturalWidth && imageInfo?.naturalHeight)

	const { ref: thumbBoxRef, w: thumbBoxW, h: thumbBoxH } = useObserveBoxSize(canCropLayout)

	const thumbCroppedStyle = useMemo(() => {
		if (!canCropLayout || !sourceCrop || !imageInfo) {
			return undefined
		}
		return computeReferenceImageCroppedDisplayLayout(
			thumbBoxW,
			thumbBoxH,
			imageInfo.naturalWidth,
			imageInfo.naturalHeight,
			sourceCrop,
		)
	}, [canCropLayout, sourceCrop, imageInfo, thumbBoxW, thumbBoxH])

	const previewItem = useMemo(() => buildPreviewMediaResourceItem(path), [path])

	const openPreview = useCallback(() => {
		if (!previewItem) return
		onPreviewMediaResource(previewItem)
	}, [previewItem, onPreviewMediaResource])

	const handlePreviewKeyDown = useCallback(
		(e: KeyboardEvent<HTMLDivElement>) => {
			if (e.key !== "Enter" && e.key !== " ") return
			e.preventDefault()
			openPreview()
		},
		[openPreview],
	)

	if (fileType === "video") {
		return (
			<ReferenceImageItemVideo path={path} onPreviewMediaResource={onPreviewMediaResource} />
		)
	}

	if (!isImageLike) {
		const slotIcon =
			fileType === "audio" ? (
				<ReferenceSlotAudioIcon size={28} />
			) : (
				<CanvasFileIcon size={28} className="text-muted-foreground" />
			)
		const interactive = previewItem != null
		return (
			<div
				className={styles.image}
				role={interactive ? "button" : undefined}
				tabIndex={interactive ? 0 : undefined}
				style={{ cursor: interactive ? "pointer" : "default" }}
				onClick={interactive ? openPreview : undefined}
				onKeyDown={interactive ? handlePreviewKeyDown : undefined}
			>
				<div className="flex h-full w-full items-center justify-center bg-muted/40">
					{slotIcon}
				</div>
			</div>
		)
	}

	const interactive = previewItem != null

	return (
		<div
			ref={thumbBoxRef}
			className={styles.image}
			role={interactive ? "button" : undefined}
			tabIndex={interactive ? 0 : undefined}
			style={{ cursor: interactive ? "pointer" : "default" }}
			onClick={interactive ? openPreview : undefined}
			onKeyDown={interactive ? handlePreviewKeyDown : undefined}
		>
			{isLoading && (
				<div className={styles.imageLoading}>
					<LoaderCircle size={16} className={styles.loadingIcon} />
				</div>
			)}
			{hasError && (
				<div className={styles.imageError}>
					<ImagePlus size={16} />
				</div>
			)}
			{thumbnailUrl &&
				(thumbCroppedStyle ? (
					<img src={thumbnailUrl} alt="" style={thumbCroppedStyle} />
				) : (
					<img src={thumbnailUrl} alt="" />
				))}
		</div>
	)
}
