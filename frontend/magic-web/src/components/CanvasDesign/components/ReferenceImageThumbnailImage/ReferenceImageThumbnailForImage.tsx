import { useMemo, type CSSProperties } from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { usePortalContainer } from "../ui/custom/PortalContainerContext"
import { useReferenceImageUrls } from "../../hooks/useReferenceImageUrls"
import { ImagePlus, LoaderCircle } from "lucide-react"
import {
	TOOLTIP_THUMBNAIL_MIN_SIZE,
	calculateTooltipBoundedPreviewSize,
} from "../../canvas/utils/imageThumbnailUtils"
import {
	getPersistedSourceCrop,
	computeReferenceImageCroppedDisplayLayout,
} from "../../canvas/utils/imageCropUtils"
import { cn } from "../../lib/utils"
import styles from "../MessageEditor/index.module.css"
import type { ReferenceImageThumbnailImageProps } from "./types"
import { useObserveBoxSize } from "./useObserveBoxSize"

export function ReferenceImageThumbnailForImage(props: ReferenceImageThumbnailImageProps) {
	const { fileName, path, fillParent, objectFit = "cover", inlineOriginal, sourceCrop } = props
	const portalContainer = usePortalContainer()
	const {
		thumbnailUrl,
		fullUrl,
		isLoading,
		hasError,
		imageInfo,
		isFullUrlLoading,
		open,
		handleOpenChange,
	} = useReferenceImageUrls(path, inlineOriginal ? { eagerFullUrl: true } : undefined)

	const previewSize = useMemo(() => {
		if (!imageInfo) {
			return {}
		}
		if (sourceCrop) {
			const p = getPersistedSourceCrop(sourceCrop, {
				width: imageInfo.naturalWidth,
				height: imageInfo.naturalHeight,
			})
			if (p.width > 0 && p.height > 0) {
				return calculateTooltipBoundedPreviewSize({
					naturalWidth: p.width,
					naturalHeight: p.height,
				})
			}
		}
		return calculateTooltipBoundedPreviewSize(imageInfo)
	}, [imageInfo, sourceCrop])

	const canCropLayout =
		Boolean(sourceCrop) && Boolean(imageInfo?.naturalWidth && imageInfo?.naturalHeight)

	const {
		ref: thumbBoxRef,
		w: thumbBoxW,
		h: thumbBoxH,
	} = useObserveBoxSize(Boolean(canCropLayout && !inlineOriginal))
	const {
		ref: inlineBoxRef,
		w: inlineBoxW,
		h: inlineBoxH,
	} = useObserveBoxSize(Boolean(canCropLayout && inlineOriginal))

	const displayUrl = inlineOriginal ? (fullUrl ?? thumbnailUrl) : thumbnailUrl

	const thumbCroppedStyle = useMemo(() => {
		if (!canCropLayout || !sourceCrop || !imageInfo || inlineOriginal) {
			return undefined
		}
		return computeReferenceImageCroppedDisplayLayout(
			thumbBoxW,
			thumbBoxH,
			imageInfo.naturalWidth,
			imageInfo.naturalHeight,
			sourceCrop,
		)
	}, [canCropLayout, sourceCrop, imageInfo, thumbBoxW, thumbBoxH, inlineOriginal])

	const inlineCroppedStyle = useMemo(() => {
		if (!canCropLayout || !sourceCrop || !imageInfo || !inlineOriginal) {
			return undefined
		}
		return computeReferenceImageCroppedDisplayLayout(
			inlineBoxW,
			inlineBoxH,
			imageInfo.naturalWidth,
			imageInfo.naturalHeight,
			sourceCrop,
		)
	}, [canCropLayout, sourceCrop, imageInfo, inlineBoxW, inlineBoxH, inlineOriginal])

	const tooltipW = previewSize.width || TOOLTIP_THUMBNAIL_MIN_SIZE
	const tooltipH = previewSize.height || TOOLTIP_THUMBNAIL_MIN_SIZE
	const tooltipCroppedStyle = useMemo(() => {
		if (!canCropLayout || !sourceCrop || !imageInfo) {
			return undefined
		}
		return computeReferenceImageCroppedDisplayLayout(
			tooltipW,
			tooltipH,
			imageInfo.naturalWidth,
			imageInfo.naturalHeight,
			sourceCrop,
		)
	}, [canCropLayout, sourceCrop, imageInfo, tooltipW, tooltipH])

	const thumbWrapperClass = cn(
		styles.referenceImageThumbnail,
		fillParent && styles.referenceImageThumbnailFill,
		fillParent && objectFit === "contain" && styles.referenceImageThumbnailFillContain,
	)

	const renderThumbInner = (croppedStyle: CSSProperties | null | undefined) => (
		<>
			{isLoading && (
				<div className={styles.referenceImageLoading}>
					<LoaderCircle size={12} className={styles.loadingIcon} />
				</div>
			)}
			{hasError && (
				<div className={styles.referenceImageError}>
					<ImagePlus size={12} />
				</div>
			)}
			{displayUrl &&
				(croppedStyle ? (
					<img src={displayUrl} alt={fileName} style={croppedStyle} />
				) : (
					<img
						src={displayUrl}
						alt={fileName}
						className={styles.referenceImageThumbnailImgCover}
					/>
				))}
		</>
	)

	if (inlineOriginal) {
		return (
			<div ref={inlineBoxRef} className={thumbWrapperClass}>
				{renderThumbInner(inlineCroppedStyle)}
			</div>
		)
	}

	return (
		<Tooltip open={open} onOpenChange={handleOpenChange}>
			<TooltipTrigger asChild>
				<div ref={thumbBoxRef} className={thumbWrapperClass}>
					{renderThumbInner(thumbCroppedStyle)}
				</div>
			</TooltipTrigger>
			<TooltipPrimitive.Portal container={portalContainer || undefined}>
				<TooltipContent
					side="left"
					sideOffset={8}
					className={styles.referenceImageTooltip}
					style={{
						...(previewSize.width ? { width: previewSize.width } : {}),
						maxWidth: TOOLTIP_THUMBNAIL_MIN_SIZE,
						maxHeight: TOOLTIP_THUMBNAIL_MIN_SIZE,
					}}
				>
					{isFullUrlLoading ? (
						<div
							style={{
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								width: previewSize.width || TOOLTIP_THUMBNAIL_MIN_SIZE,
								height: previewSize.height || TOOLTIP_THUMBNAIL_MIN_SIZE,
							}}
						>
							<LoaderCircle
								size={16}
								className={styles.loadingIcon}
								style={{ animation: "spin 1s linear infinite" }}
							/>
						</div>
					) : (
						fullUrl && (
							<div
								style={{
									position: "relative",
									overflow: "hidden",
									width: tooltipW,
									height: tooltipH,
								}}
							>
								{tooltipCroppedStyle ? (
									<img
										src={fullUrl}
										alt={fileName}
										className={styles.referenceImagePreview}
										style={{
											...tooltipCroppedStyle,
											maxWidth: "none",
											maxHeight: "none",
										}}
									/>
								) : (
									<img
										src={fullUrl}
										alt={fileName}
										className={styles.referenceImagePreview}
										style={{
											...(previewSize.width ? previewSize : {}),
											maxWidth: TOOLTIP_THUMBNAIL_MIN_SIZE,
											maxHeight: TOOLTIP_THUMBNAIL_MIN_SIZE,
										}}
									/>
								)}
							</div>
						)
					)}
				</TooltipContent>
			</TooltipPrimitive.Portal>
		</Tooltip>
	)
}
