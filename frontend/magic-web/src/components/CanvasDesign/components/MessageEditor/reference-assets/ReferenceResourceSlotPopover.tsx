import type { CSSProperties, ReactNode, RefCallback } from "react"
import type {
	ReferenceResourcePanelItem,
	ReferenceResourcePanelSelectContext,
} from "../../../types"
import ReferenceResourcePopover from "./ReferenceResourcePopover"
import type {
	ReferenceAssetPerTypeLimits,
	ReferenceAssetTypeCounts,
	ReferenceResourceFileInfo,
	ReferenceResourceSourceType,
	ReferenceResourceTypeFilter,
} from "./reference-resource.types"

interface ReferenceResourceSlotPopoverProps {
	className: string
	style: CSSProperties
	content: ReactNode
	slotKey: string
	slotRootRef?: RefCallback<HTMLDivElement | null>
	isPopoverOpen: boolean
	selectedSlotKey: string | null
	onActivateSlot: () => void
	onPopoverOpenChange: (open: boolean) => void
	onMouseEnter: () => void
	onMouseLeave: () => void
	onSelectSource: (source: ReferenceResourceSourceType) => void
	maxReferenceFiles?: number
	currentReferenceFiles?: string[]
	isReferenceFileLimitReached?: boolean
	referenceResourceType: ReferenceResourceTypeFilter
	referenceFileInfos: ReferenceResourceFileInfo[]
	assetLimits?: ReferenceAssetPerTypeLimits
	currentAssetCounts?: ReferenceAssetTypeCounts
	onProjectSelect?: (
		item: ReferenceResourcePanelItem,
		context?: ReferenceResourcePanelSelectContext,
	) => void
	onProjectSelectPanelOpenChange?: (open: boolean) => void
}

export default function ReferenceResourceSlotPopover(props: ReferenceResourceSlotPopoverProps) {
	const {
		className,
		style,
		content,
		slotKey,
		slotRootRef,
		isPopoverOpen,
		selectedSlotKey,
		onActivateSlot,
		onPopoverOpenChange,
		onMouseEnter,
		onMouseLeave,
		onSelectSource,
		maxReferenceFiles,
		currentReferenceFiles,
		isReferenceFileLimitReached,
		referenceResourceType,
		referenceFileInfos,
		assetLimits,
		currentAssetCounts,
		onProjectSelect,
		onProjectSelectPanelOpenChange,
	} = props

	return (
		<ReferenceResourcePopover
			open={isPopoverOpen && selectedSlotKey === slotKey}
			onOpenChange={(open) => {
				if (open) {
					onActivateSlot()
				}
				onPopoverOpenChange(open)
			}}
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
			onSelectSource={onSelectSource}
			maxReferenceFiles={maxReferenceFiles}
			currentReferenceFiles={currentReferenceFiles}
			isReferenceFileLimitReached={isReferenceFileLimitReached}
			referenceResourceType={referenceResourceType}
			referenceFileInfos={referenceFileInfos}
			assetLimits={assetLimits}
			currentAssetCounts={currentAssetCounts}
			onProjectSelect={onProjectSelect}
			onProjectSelectPanelOpenChange={onProjectSelectPanelOpenChange}
			trigger={
				<div
					ref={slotRootRef}
					className={className}
					style={style}
					onPointerDown={onActivateSlot}
				>
					{content}
				</div>
			}
		/>
	)
}
