import type { CanvasMarkerMentionSuggestion } from "@/components/business/MentionPanel/types"
import { memo, useMemo } from "react"
import { getMarkerBboxCropLayout } from "./marker-bbox-crop-layout"

const PREVIEW_CONTAINER_SIZE = 220

interface MarkerSuggestionBboxHoverPreviewProps {
	imageUrl: string
	label: string
	bbox?: CanvasMarkerMentionSuggestion["bbox"]
	imageAspectRatio: number | null
	elementWidth?: number
	elementHeight?: number
}

function MarkerSuggestionBboxHoverPreview({
	imageUrl,
	label,
	bbox,
	imageAspectRatio,
	elementWidth,
	elementHeight,
}: MarkerSuggestionBboxHoverPreviewProps) {
	const layout = useMemo(
		() =>
			getMarkerBboxCropLayout({
				bbox,
				containerSize: PREVIEW_CONTAINER_SIZE,
				imageAspectRatio,
				elementWidth,
				elementHeight,
			}),
		[bbox, imageAspectRatio, elementWidth, elementHeight],
	)

	return (
		<div
			className="relative flex flex-none shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted/30"
			style={layout.outerContainerStyle}
		>
			<div style={layout.cropContainerStyle}>
				<img src={imageUrl} alt={label} style={layout.imageStyle} />
				{layout.highlightRectStyle ? (
					<div style={layout.highlightRectStyle} aria-hidden />
				) : null}
			</div>
		</div>
	)
}

export default memo(MarkerSuggestionBboxHoverPreview)
