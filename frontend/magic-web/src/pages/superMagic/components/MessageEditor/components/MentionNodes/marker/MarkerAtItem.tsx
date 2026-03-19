import type { JSONContent } from "@tiptap/core"
import { memo, useCallback, useMemo, type MouseEvent } from "react"
import { getMentionDisplayName } from "@/components/business/MentionPanel/tiptap-plugin/types"
import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import { useMarkerClickHandler, type MarkerClickScene } from "../../../hooks/useMarkerClickHandler"
import MarkerMentionChip from "./MarkerMentionChip"
import MarkerTooltip from "./index"
import { useTransformedMarkerData } from "./useTransformedMarkerData"
import { useMarkerImageUrl } from "./useMarkerImageUrl"

interface MarkerAtItemProps {
	data: TiptapMentionAttributes
	onRemove?: (data: TiptapMentionAttributes) => void
	className?: string
	flag?: string
	iconSize?: number
	markerTooltipProps?: {
		popoverClassName?: string
		parentPopoverOpen?: boolean
		side?: "top" | "right" | "bottom" | "left"
	}
	markerClickScene?: MarkerClickScene
	messageContent?: JSONContent | string | Record<string, unknown>
}

function MarkerAtItem({
	data,
	onRemove,
	className,
	flag,
	iconSize = 20,
	markerTooltipProps,
	markerClickScene,
	messageContent,
}: MarkerAtItemProps) {
	const isInMessageList = !onRemove
	const displayName = getMentionDisplayName(data)
	const { markerData: transformedMarkerData, loading: markerLoading } = useTransformedMarkerData(
		data,
		isInMessageList,
	)
	const { imageUrl: markerImageUrl } = useMarkerImageUrl(transformedMarkerData?.image_path)

	const scene: MarkerClickScene = useMemo(() => {
		if (markerClickScene) return markerClickScene
		if (!onRemove) return "messageList"
		return "messageEditorMentionList"
	}, [markerClickScene, onRemove])

	const { handleMarkerClick } = useMarkerClickHandler({
		scene,
		disabled: scene === "draftBox",
		transformedMarkerData,
		messageContent,
	})

	const handleClick = useCallback(
		(event: MouseEvent) => {
			event.preventDefault()
			event.stopPropagation()
			handleMarkerClick(data)
		},
		[data, handleMarkerClick],
	)

	const handleRemove = useCallback(
		(event: MouseEvent) => {
			event.preventDefault()
			event.stopPropagation()
			onRemove?.(data)
		},
		[data, onRemove],
	)

	const content = (
		<MarkerMentionChip
			displayName={displayName}
			markerData={transformedMarkerData}
			imageUrl={markerImageUrl}
			className={className}
			iconSize={iconSize}
			showArrow={!isInMessageList}
			onClick={handleClick}
			onRemove={onRemove ? handleRemove : undefined}
			dataMentionItem={flag}
		/>
	)

	return (
		<MarkerTooltip
			markerData={transformedMarkerData ?? null}
			isInMessageList={isInMessageList}
			loading={markerLoading}
			popoverClassName={markerTooltipProps?.popoverClassName}
			parentPopoverOpen={markerTooltipProps?.parentPopoverOpen}
			side={markerTooltipProps?.side}
			imageUrl={markerImageUrl}
		>
			{content}
		</MarkerTooltip>
	)
}

export default memo(MarkerAtItem)
