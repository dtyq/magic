import type { ReactElement } from "react"
import { Tooltip, type TooltipProps } from "antd"
import { useIsMobile } from "@/hooks/useIsMobile"
import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import {
	type CanvasMarkerMentionData,
	MentionItemType,
} from "@/components/business/MentionPanel/types"
import MarkerTooltip from "../../MentionNodes/marker"
import { MentionTooltipContent } from "./MentionTooltipContent"

interface MentionTooltipWrapperProps {
	children: ReactElement
	data: TiptapMentionAttributes
	displayName?: string
	description?: string
	isInMessageList: boolean
	placement?: TooltipProps["placement"]
	tooltipProps?: Partial<TooltipProps>
	markerTooltipProps?: {
		popoverClassName?: string
		parentPopoverOpen?: boolean
		side?: "top" | "right" | "bottom" | "left"
	}
	transformedMarkerData?: CanvasMarkerMentionData | null
	markerLoading?: boolean
	markerImageUrl?: string | null
}

export function MentionTooltipWrapper(props: MentionTooltipWrapperProps) {
	const {
		children,
		data,
		displayName,
		description,
		isInMessageList,
		placement,
		tooltipProps,
		markerTooltipProps,
		transformedMarkerData,
		markerLoading,
		markerImageUrl,
	} = props

	const isMobile = useIsMobile()

	if (isMobile) {
		return children
	}

	if (data.type === MentionItemType.DESIGN_MARKER) {
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
				{children}
			</MarkerTooltip>
		)
	}

	return (
		<Tooltip
			{...tooltipProps}
			title={
				<MentionTooltipContent
					data={data}
					displayName={displayName}
					description={description}
				/>
			}
			placement={placement}
		>
			{children}
		</Tooltip>
	)
}
