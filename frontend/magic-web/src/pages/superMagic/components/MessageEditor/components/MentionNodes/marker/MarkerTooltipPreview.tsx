import { CanvasMarkerMentionData } from "@/components/business/MentionPanel/types"
import { memo } from "react"
import MarkerPointTooltipPreview from "./MarkerPointTooltipPreview"
import MarkerAreaTooltipPreview from "./MarkerAreaTooltipPreview"
import { MarkerTypeEnum } from "@/components/CanvasDesign/canvas/types"

interface MarkerTooltipPreviewProps {
	markerData: CanvasMarkerMentionData
	className?: string
	imageUrl?: string | null
}

function MarkerTooltipPreview({ markerData, className, imageUrl }: MarkerTooltipPreviewProps) {
	const isAreaMarker = markerData.data?.type === MarkerTypeEnum.Area

	if (isAreaMarker) {
		return (
			<MarkerAreaTooltipPreview
				markerData={markerData}
				className={className}
				imageUrl={imageUrl}
			/>
		)
	}

	return (
		<MarkerPointTooltipPreview
			markerData={markerData}
			className={className}
			imageUrl={imageUrl}
		/>
	)
}

export default memo(MarkerTooltipPreview)
