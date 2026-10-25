import { NodeViewWrapper } from "@/infrastructure/editors/tiptap/react"
import { memo, useCallback, type MouseEvent } from "react"
import {
	getMentionDisplayName,
	type MentionNodeViewRendererProps,
} from "@/components/business/MentionPanel/tiptap-plugin/types"
import { useIsMobile } from "@/hooks/useIsMobile"
import MarkerTooltip from "./index"
import MarkerMentionChip from "./MarkerMentionChip"
import { useMarkerImageUrl } from "./useMarkerImageUrl"
import { useMarkerClickHandler } from "../../../hooks/useMarkerClickHandler"
import {
	getCanvasMarkerMentionImagePath,
	normalizeCanvasMarkerMentionData,
} from "@/components/business/MentionPanel/utils/canvasMarkerMention"
import { useOptionalMessageEditorStore } from "../../../stores"

function MarkerMentionNodeView({ attrs, deleteNode, selected }: MentionNodeViewRendererProps) {
	const isMobile = useIsMobile()
	const editorStore = useOptionalMessageEditorStore()
	const projectFilesStore = editorStore?.fileUploadStore.getProjectFilesStore()
	const markerData = normalizeCanvasMarkerMentionData(attrs.data)
	const { imageUrl } = useMarkerImageUrl(
		markerData ? getCanvasMarkerMentionImagePath(markerData) : undefined,
		markerData?.design_project_id,
		projectFilesStore,
	)
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
		// Mentions are atomic nodes; prevent the browser and ProseMirror from
		// turning a pointer drag into a text selection.
		event.preventDefault()
		event.stopPropagation()
	}, [])

	const chip = (
		<MarkerMentionChip
			displayName={displayName}
			markerData={markerData}
			imageUrl={imageUrl}
			maxWidthClassName="max-w-full"
			contentDrivenWidth
			selected={selected}
			onClick={handleClick}
			onRemove={handleRemove}
		/>
	)

	return (
		<NodeViewWrapper
			as="span"
			className="magic-mention-node magic-mention-node--marker inline-flex cursor-grab select-none align-top active:cursor-grabbing"
			contentEditable={false}
			data-type={attrs.type}
			data-data={JSON.stringify(attrs.data || {})}
			draggable={false}
			data-magic-editor-node
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
