import styles from "./index.module.css"
import { ImagePlus, LoaderCircle } from "lucide-react"
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react"
import { useReferenceImageUrls } from "../../../app/hooks/resources/useReferenceImageUrls"
import { useReferenceVideoPoster } from "../../previews/reference-media/useReferenceVideoPoster"
import { computeReferenceImageCroppedDisplayLayout } from "../../../runtime/resources/image/imageCropUtils"
import type { CropConfig } from "../../../runtime/document/types"
import { getMediaResourcePathKind } from "../../../runtime/resources/media-common/mediaResourcePathKind"
import {
	getCanvasResourceAvailability,
	getCanvasResourceFileName,
	isOpaqueAssetReference,
} from "../../../runtime/shared/path/canvasResourcePath"
import type { MediaResourceFullscreenPreviewItem } from "../../fullscreen/media-resource/index"
import type { ResolveCanvasResourceReference } from "../../../public/resource-reference"
import {
	CanvasFileIcon,
	ReferenceSlotAudioIcon,
	ReferenceSlotVideoIcon,
} from "../../primitives/icons/index"
import { Tooltip, TooltipTrigger } from "../../primitives/shadcn/tooltip"
import ResourcePathTooltipContent from "../../primitives/custom/ResourcePathTooltipContent"
import { buildPreviewMediaResourceItem } from "./mediaPreviewItem"
import type { CanvasAssetMediaType } from "../../../public/magic-types"

interface ReferenceImageItemProps {
	path: string
	/** asset:// 路径的媒体类型，由生成请求或显式引用 metadata 提供。 */
	mediaType?: CanvasAssetMediaType | null
	/** 基于源图像素的裁剪区 */
	sourceCrop?: Pick<CropConfig, "width" | "height" | "x" | "y">
	onPreviewMediaResource: (resource: MediaResourceFullscreenPreviewItem) => void
	resolveResourceReference?: ResolveCanvasResourceReference
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
	mediaType?: CanvasAssetMediaType | null
	onPreviewMediaResource: (resource: MediaResourceFullscreenPreviewItem) => void
	previewEnabled: boolean
}) {
	const { path, mediaType, onPreviewMediaResource, previewEnabled } = props
	const { loadState, posterClone } = useReferenceVideoPoster(path)
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const displayName = useMemo(() => getCanvasResourceFileName(path) || path, [path])
	const previewItem = useMemo(
		() => buildPreviewMediaResourceItem(path, mediaType),
		[mediaType, path],
	)
	const interactive = previewEnabled && previewItem != null

	const openPreview = useCallback(() => {
		if (!interactive || !previewItem) return
		onPreviewMediaResource(previewItem)
	}, [interactive, previewItem, onPreviewMediaResource])

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
			role={interactive ? "button" : undefined}
			tabIndex={interactive ? 0 : undefined}
			style={{ cursor: interactive ? "pointer" : "default" }}
			onClick={interactive ? openPreview : undefined}
			onKeyDown={interactive ? handlePreviewKeyDown : undefined}
			aria-label={interactive ? displayName : undefined}
		>
			<canvas ref={canvasRef} role="img" aria-hidden />
		</div>
	)
}

export default function ReferenceImageItem({
	path,
	mediaType,
	sourceCrop,
	onPreviewMediaResource,
	resolveResourceReference,
}: ReferenceImageItemProps) {
	const isOpaqueAsset = isOpaqueAssetReference(path) && !mediaType
	const fileType = useMemo(() => getMediaResourcePathKind(path, { mediaType }), [mediaType, path])
	const isImageLike = fileType === "image"
	const isDeleted = getCanvasResourceAvailability(path, resolveResourceReference) === "deleted"
	const { lowUrl, isLoading, hasError, imageInfo } = useReferenceImageUrls(path, {
		enabled: isImageLike,
	})

	const canCropLayout =
		Boolean(sourceCrop) && Boolean(imageInfo?.naturalWidth && imageInfo?.naturalHeight)

	const { ref: previewBoxRef, w: previewBoxW, h: previewBoxH } = useObserveBoxSize(canCropLayout)

	const previewCroppedStyle = useMemo(() => {
		if (!canCropLayout || !sourceCrop || !imageInfo) {
			return undefined
		}
		return computeReferenceImageCroppedDisplayLayout(
			previewBoxW,
			previewBoxH,
			imageInfo.naturalWidth,
			imageInfo.naturalHeight,
			sourceCrop,
		)
	}, [canCropLayout, sourceCrop, imageInfo, previewBoxW, previewBoxH])

	const previewItem = useMemo(
		() => buildPreviewMediaResourceItem(path, mediaType),
		[mediaType, path],
	)

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

	if (isOpaqueAsset) {
		return (
			<Tooltip delayDuration={200}>
				<TooltipTrigger asChild>
					<div className={styles.image} role="img" aria-label={path}>
						<CanvasFileIcon size={28} className="text-muted-foreground" />
					</div>
				</TooltipTrigger>
				<ResourcePathTooltipContent path={path} />
			</Tooltip>
		)
	}

	if (fileType === "video") {
		return (
			<ReferenceImageItemVideo
				path={path}
				mediaType={mediaType}
				onPreviewMediaResource={onPreviewMediaResource}
				previewEnabled={!isDeleted}
			/>
		)
	}

	if (!isImageLike) {
		const slotIcon =
			fileType === "audio" ? (
				<ReferenceSlotAudioIcon size={28} />
			) : (
				<CanvasFileIcon size={28} className="text-muted-foreground" />
			)
		const interactive = !isDeleted && previewItem != null
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

	const interactive = !isDeleted && previewItem != null

	return (
		<div
			ref={previewBoxRef}
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
			{lowUrl &&
				(previewCroppedStyle ? (
					<img src={lowUrl} alt="" style={previewCroppedStyle} />
				) : (
					<img src={lowUrl} alt="" />
				))}
		</div>
	)
}
