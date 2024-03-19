import { CanvasMarkerMentionData } from "@/opensource/components/business/MentionPanel/types"
import { MarkerTypeEnum } from "@/opensource/components/CanvasDesign/canvas/types"
import {
	AREA_MARKER_STYLES,
	POINT_MARKER_STYLES,
} from "@/opensource/components/CanvasDesign/canvas/interaction/markers/markerStyles"
import CanvasMarkerIcon from "@/opensource/pages/superMagic/assets/svg/canvas-marker.svg"

interface MarkerNamePrefixProps {
	data?: CanvasMarkerMentionData
}

export default function MarkerNamePrefix({ data }: MarkerNamePrefixProps) {
	const markerNumber = data?.mark_number

	const markType = data?.data?.type

	if (markType === MarkerTypeEnum.Area) {
		const scale = 0.7
		const scaledDiameter = AREA_MARKER_STYLES.CIRCLE_DIAMETER * scale
		const scaledFontSize = `${AREA_MARKER_STYLES.TEXT_FONT_SIZE * 0.65}px`

		return (
			<div className="mr-1 inline-flex flex-shrink-0 items-center justify-center">
				<div
					className="flex items-center justify-center rounded-full border-2"
					style={{
						width: scaledDiameter,
						height: scaledDiameter,
						backgroundColor: AREA_MARKER_STYLES.FILL_COLOR,
						borderColor: AREA_MARKER_STYLES.STROKE_COLOR,
						borderWidth: `${AREA_MARKER_STYLES.STROKE_WIDTH}px`,
					}}
				>
					{markerNumber !== undefined && (
						<span
							className="pointer-events-none font-semibold leading-none text-white"
							style={{
								fontSize: scaledFontSize,
								fontWeight: AREA_MARKER_STYLES.TEXT_FONT_WEIGHT,
								fontFamily: AREA_MARKER_STYLES.TEXT_FONT_FAMILY,
								lineHeight: AREA_MARKER_STYLES.TEXT_LINE_HEIGHT,
							}}
						>
							{markerNumber}
						</span>
					)}
				</div>
			</div>
		)
	}

	const pointScale = 0.55
	const pointWidth = POINT_MARKER_STYLES.WIDTH * pointScale
	const pointHeight = POINT_MARKER_STYLES.HEIGHT * pointScale
	const pointFontSize = `${POINT_MARKER_STYLES.TEXT_FONT_SIZE * pointScale}px`
	const pointTopOffset = pointHeight * 0.48

	return (
		<div
			className="relative mr-1 inline-flex flex-shrink-0 items-center justify-center"
			style={{
				width: pointWidth,
				height: pointHeight,
			}}
		>
			<img src={CanvasMarkerIcon} alt="marker" className="h-full w-full object-cover" />
			{markerNumber !== undefined && (
				<span
					className="pointer-events-none absolute left-1/2 -translate-x-1/2 -translate-y-1/2 font-semibold text-white"
					style={{
						top: pointTopOffset,
						fontSize: pointFontSize,
						fontWeight: POINT_MARKER_STYLES.TEXT_FONT_WEIGHT,
						fontFamily: POINT_MARKER_STYLES.TEXT_FONT_FAMILY,
						lineHeight: POINT_MARKER_STYLES.TEXT_LINE_HEIGHT,
						color: POINT_MARKER_STYLES.TEXT_COLOR,
						textIndent: "-0.65px",
					}}
				>
					{markerNumber}
				</span>
			)}
		</div>
	)
}
