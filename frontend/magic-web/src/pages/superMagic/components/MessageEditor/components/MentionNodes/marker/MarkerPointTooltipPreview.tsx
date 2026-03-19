import { useIsMobile } from "@/hooks/useIsMobile"
import { showMobileImagePreview } from "../../AtItem/components/MobileImagePreview"
import CanvasMarkerIcon from "@/pages/superMagic/assets/svg/canvas-marker.svg"
import { CanvasMarkerMentionData } from "@/components/business/MentionPanel/types"
import { memo, useEffect, useMemo, useRef, useState } from "react"
import { createStyles } from "antd-style"
import { POINT_MARKER_STYLES } from "@/components/CanvasDesign/canvas/interaction/markers/markerStyles"
import { useMarkerImageUrl } from "./useMarkerImageUrl"

interface MarkerPointTooltipPreviewProps {
	markerData: CanvasMarkerMentionData
	className?: string
	imageUrl?: string | null
}

const useStyles = createStyles(({ css }) => ({
	previewFileName: css`
		font-size: 14px;
		color: white;
	`,
	previewContainer: css`
		border-radius: 4px;
		width: 232px;
		height: 232px;
		overflow: visible;
		position: relative;
	`,
	imageWrapper: css`
		width: 100%;
		height: 100%;
		position: relative;
		overflow: hidden;
		border-radius: 4px;
	`,
	markerContainer: css`
		position: absolute;
		transform: translate(-50%, -100%);
		pointer-events: none;
		z-index: 10;
	`,
	markerIcon: css`
		width: ${POINT_MARKER_STYLES.WIDTH}px;
		height: ${POINT_MARKER_STYLES.HEIGHT}px;
		filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
		max-width: unset;
		max-height: unset;
	`,
	markerNumber: css`
		position: absolute;
		left: 50%;
		top: 45%;
		transform: translate(-50%, -50%);
		color: ${POINT_MARKER_STYLES.TEXT_COLOR};
		font-size: ${POINT_MARKER_STYLES.TEXT_FONT_SIZE}px;
		font-weight: ${POINT_MARKER_STYLES.TEXT_FONT_WEIGHT};
		font-family: ${POINT_MARKER_STYLES.TEXT_FONT_FAMILY};
		line-height: ${POINT_MARKER_STYLES.TEXT_LINE_HEIGHT};
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
	`,
}))

function MarkerPointTooltipPreview({
	markerData,
	className,
	imageUrl: imageUrlProp,
}: MarkerPointTooltipPreviewProps) {
	const { styles, cx } = useStyles()
	const isMobile = useIsMobile()
	const imageRef = useRef<HTMLImageElement>(null)
	const [imageLoaded, setImageLoaded] = useState(false)
	const [isZoomed, setIsZoomed] = useState(false)
	const selectedIndex = markerData.data?.selectedSuggestionIndex || 0
	const suggestion = markerData.data?.result?.suggestions?.[selectedIndex]

	const { imageUrl: imageUrlFromHook } = useMarkerImageUrl(
		imageUrlProp !== undefined ? undefined : markerData.image_path,
	)
	const imageUrl = imageUrlProp !== undefined ? imageUrlProp : imageUrlFromHook

	const markerImageStyle = useMemo(() => {
		const containerSize = 232
		const imageWidth = markerData.element_width || 0
		const imageHeight = markerData.element_height || 0
		const imageScale = Math.max(containerSize / imageWidth, containerSize / imageHeight)
		const imageZoomScale = 1
		const width = imageWidth * imageScale * imageZoomScale
		const height = imageHeight * imageScale * imageZoomScale

		const relativeX = markerData.data?.relativeX || 0
		const relativeY = markerData.data?.relativeY || 0
		const markerAbsoluteX = width * relativeX
		const markerAbsoluteY = height * relativeY

		let offsetX = -markerAbsoluteX + containerSize / 2
		let offsetY = -markerAbsoluteY + containerSize / 2

		const minOffsetX = Math.min(0, -(width - containerSize))
		const maxOffsetX = 0
		const minOffsetY = Math.min(0, -(height - containerSize))
		const maxOffsetY = 0

		offsetX = Math.max(minOffsetX, Math.min(maxOffsetX, offsetX))
		offsetY = Math.max(minOffsetY, Math.min(maxOffsetY, offsetY))

		return {
			width,
			height,
			offsetX,
			offsetY,
			style: {
				width,
				height,
				maxWidth: "unset !important",
				maxHeight: "unset !important",
				transition: "all 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
				transform: `translate(${offsetX}px, ${offsetY}px) scale(${isZoomed ? 3 : 1.5})`,
				transformOrigin: `${markerAbsoluteX}px ${markerAbsoluteY}px`,
			},
		}
	}, [isZoomed, markerData.element_height, markerData.element_width, markerData.data])

	const markerPositionStyle = useMemo(() => {
		const relativeX = markerData.data?.relativeX || 0
		const relativeY = markerData.data?.relativeY || 0
		return {
			left: markerImageStyle.offsetX + markerImageStyle.width * relativeX,
			top: markerImageStyle.offsetY + markerImageStyle.height * relativeY,
		}
	}, [
		markerImageStyle.offsetX,
		markerImageStyle.width,
		markerImageStyle.offsetY,
		markerImageStyle.height,
		markerData.data,
	])

	useEffect(() => {
		if (!imageLoaded || !markerPositionStyle) return
		const timer = setTimeout(() => {
			setIsZoomed(true)
		}, 200)
		return () => clearTimeout(timer)
	}, [imageLoaded, markerPositionStyle])

	if (!imageUrl) {
		return <span className={cx(styles.previewFileName, className)}>{suggestion?.label}</span>
	}

	return (
		<div
			className={styles.previewContainer}
			onClick={() => {
				if (isMobile && imageUrl) {
					showMobileImagePreview({
						src: imageUrl,
						alt: suggestion?.label,
					})
				}
			}}
		>
			<div className={styles.imageWrapper}>
				<img
					ref={imageRef}
					src={imageUrl}
					alt={suggestion?.label}
					style={markerImageStyle.style}
					onLoad={() => setImageLoaded(true)}
				/>
			</div>
			{markerPositionStyle && (
				<div className={styles.markerContainer} style={markerPositionStyle}>
					<img src={CanvasMarkerIcon} alt="marker" className={styles.markerIcon} />
					{markerData.mark_number !== undefined && (
						<span className={styles.markerNumber}>{markerData.mark_number}</span>
					)}
				</div>
			)}
		</div>
	)
}

export default memo(MarkerPointTooltipPreview)
