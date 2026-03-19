import { NodeViewWrapper } from "@tiptap/react"
import { memo, useCallback, type MouseEvent } from "react"
import {
	getMentionDisplayName,
	type MentionNodeViewRendererProps,
} from "@/components/business/MentionPanel/tiptap-plugin/types"
import { useIsMobile } from "@/hooks/useIsMobile"
import MarkerTooltip from "./index"
import MarkerMentionChip from "./MarkerMentionChip"
import { useMarkerImageUrl } from "./useMarkerImageUrl"
import { isCanvasMarkerMentionData } from "./shared"
import { useMarkerClickHandler } from "../../../hooks/useMarkerClickHandler"

function MarkerMentionNodeView({ attrs, deleteNode, selected }: MentionNodeViewRendererProps) {
	const isMobile = useIsMobile()
	const markerData = isCanvasMarkerMentionData(attrs.data) ? attrs.data : null
	const { imageUrl } = useMarkerImageUrl(markerData?.image_path)
	const displayName = getMentionDisplayName(attrs)
	const { handleMarkerClick } = useMarkerClickHandler({
		scene: "messageEditorTiptap",
		transformedMarkerData: markerData,
	})

	const handleRemove = useCallback(
		(event: MouseEvent) => {
			event.preventDefault()
			event.stopPropagation()
			deleteNode?.()
		},
		[deleteNode],
	)

	const handleClick = useCallback(
		(event: MouseEvent) => {
			event.preventDefault()
			event.stopPropagation()
			handleMarkerClick(attrs)
		},
		[attrs, handleMarkerClick],
	)

	const handleMouseDown = useCallback((event: MouseEvent) => {
		event.preventDefault()
	}, [])

	const chip = (
		<MarkerMentionChip
			displayName={displayName}
			markerData={markerData}
			imageUrl={imageUrl}
			selected={selected}
			onClick={handleClick}
			onRemove={handleRemove}
		/>
	)

	return (
		<NodeViewWrapper
			as="span"
			className="magic-mention-node magic-mention-node--marker inline-flex align-top"
			contentEditable={false}
			data-type={attrs.type}
			data-data={JSON.stringify(attrs.data || {})}
			onMouseDown={handleMouseDown}
		>
			<span className="px-1">
				{isMobile ? (
					chip
				) : (
					<MarkerTooltip
						markerData={markerData}
						isInMessageList={false}
						loading={markerData?.loading ?? false}
						imageUrl={imageUrl}
					>
						{chip}
					</MarkerTooltip>
				)}
			</span>
		</NodeViewWrapper>
	)
}

export default memo(MarkerMentionNodeView)
