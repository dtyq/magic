import { useIsMobile } from "@/opensource/hooks/useIsMobile"
import { showMobileImagePreview } from "../../AtItem/components/MobileImagePreview"
import { CanvasMarkerMentionData } from "@/opensource/components/business/MentionPanel/types"
import { memo, useMemo, useRef } from "react"
import { createStyles } from "antd-style"
import { AREA_MARKER_STYLES } from "@/opensource/components/CanvasDesign/canvas/interaction/markers/markerStyles"
import { MarkerTypeEnum } from "@/opensource/components/CanvasDesign/canvas/types"
import { useMarkerImageUrl } from "./useMarkerImageUrl"

interface MarkerAreaTooltipPreviewProps {
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
	areaMarkerContainer: css`
		position: absolute;
		pointer-events: none;
		z-index: 10;
	`,
	areaRect: css`
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background-color: ${AREA_MARKER_STYLES.AREA_FILL_COLOR};
		border: ${AREA_MARKER_STYLES.AREA_STROKE_WIDTH}px solid
			${AREA_MARKER_STYLES.AREA_STROKE_COLOR};
		border-radius: ${AREA_MARKER_STYLES.AREA_CORNER_RADIUS}px;
	`,
	areaCircle: css`
		position: absolute;
		width: ${AREA_MARKER_STYLES.CIRCLE_DIAMETER}px;
		height: ${AREA_MARKER_STYLES.CIRCLE_DIAMETER}px;
		border-radius: 50%;
		background-color: ${AREA_MARKER_STYLES.FILL_COLOR};
		border: ${AREA_MARKER_STYLES.STROKE_WIDTH}px solid ${AREA_MARKER_STYLES.STROKE_COLOR};
		display: flex;
		align-items: center;
		justify-content: center;
		transform: translate(-50%, -50%);
		left: 0;
		top: 0;
		box-sizing: border-box;
	`,
	areaMarkerNumber: css`
		color: ${AREA_MARKER_STYLES.TEXT_COLOR};
		font-size: ${AREA_MARKER_STYLES.TEXT_FONT_SIZE}px;
		font-weight: ${AREA_MARKER_STYLES.TEXT_FONT_WEIGHT};
		font-family: ${AREA_MARKER_STYLES.TEXT_FONT_FAMILY};
		line-height: ${AREA_MARKER_STYLES.TEXT_LINE_HEIGHT};
		text-align: center;
		margin: 0;
		padding: 0;
	`,
}))

function MarkerAreaTooltipPreview({
	markerData,
	className,
	imageUrl: imageUrlProp,
}: MarkerAreaTooltipPreviewProps) {
	const { styles, cx } = useStyles()
	const isMobile = useIsMobile()
	const imageRef = useRef<HTMLImageElement>(null)
	const selectedIndex = markerData.data?.selectedSuggestionIndex || 0
	const suggestion = markerData.data?.result?.suggestions?.[selectedIndex]

	const { imageUrl: imageUrlFromHook } = useMarkerImageUrl(
		imageUrlProp !== undefined ? undefined : markerData.image_path,
	)
	const imageUrl = imageUrlProp !== undefined ? imageUrlProp : imageUrlFromHook

	const imageStyle = useMemo(() => {
		const containerSize = 232
		const imageWidth = markerData.element_width || 0
		const imageHeight = markerData.element_height || 0
		if (!imageWidth || !imageHeight) {
			return null
		}

		const imageScale = Math.max(containerSize / imageWidth, containerSize / imageHeight)
		const width = imageWidth * imageScale
		const height = imageHeight * imageScale

		const marker = markerData.data
		if (!marker || marker.type !== MarkerTypeEnum.Area) return null
		const areaMarker = marker
		const relativeX = areaMarker.relativeX || 0
		const relativeY = areaMarker.relativeY || 0
		const areaWidth = areaMarker.areaWidth || 0
		const areaHeight = areaMarker.areaHeight || 0
		const pixelAreaWidth = areaWidth * imageWidth
		const pixelAreaHeight = areaHeight * imageHeight
		const areaCenterX = relativeX + pixelAreaWidth / imageWidth / 2
		const areaCenterY = relativeY + pixelAreaHeight / imageHeight / 2

		let offsetX = -width * areaCenterX + containerSize / 2
		let offsetY = -height * areaCenterY + containerSize / 2

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
				transform: `translate(${offsetX}px, ${offsetY}px)`,
			},
		}
	}, [markerData.element_width, markerData.element_height, markerData.data])

	const areaMarkerStyle = useMemo(() => {
		const marker = markerData.data
		if (!marker || marker.type !== MarkerTypeEnum.Area || !imageStyle) {
			return null
		}
		const areaMarker = marker
		const relativeX = areaMarker.relativeX || 0
		const relativeY = areaMarker.relativeY || 0
		const areaWidth = areaMarker.areaWidth || 0
		const areaHeight = areaMarker.areaHeight || 0

		const imageWidth = markerData.element_width || 0
		const imageHeight = markerData.element_height || 0
		const pixelAreaWidth = areaWidth * imageWidth
		const pixelAreaHeight = areaHeight * imageHeight
		const scaledAreaWidth = (pixelAreaWidth / imageWidth) * imageStyle.width
		const scaledAreaHeight = (pixelAreaHeight / imageHeight) * imageStyle.height

		return {
			width: scaledAreaWidth,
			height: scaledAreaHeight,
			left: imageStyle.offsetX + imageStyle.width * relativeX,
			top: imageStyle.offsetY + imageStyle.height * relativeY,
		}
	}, [markerData.data, markerData.element_width, markerData.element_height, imageStyle])

	if (!imageUrl) {
		return <span className={cx(styles.previewFileName, className)}>{suggestion?.label}</span>
	}

	if (!imageStyle || !areaMarkerStyle) {
		return null
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
					style={imageStyle.style}
				/>
			</div>
			<div className={styles.areaMarkerContainer} style={areaMarkerStyle}>
				<div className={styles.areaRect} />
				<div className={styles.areaCircle}>
					{markerData.mark_number !== undefined && (
						<span className={styles.areaMarkerNumber}>{markerData.mark_number}</span>
					)}
				</div>
			</div>
		</div>
	)
}

export default memo(MarkerAreaTooltipPreview)
