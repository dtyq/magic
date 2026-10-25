import type { CSSProperties, ReactNode, RefCallback } from "react"
import type {
	ReferenceResourcePanelItem,
	ReferenceResourcePanelSelectContext,
} from "../../../../public/props"
import ReferenceResourcePopover from "./ReferenceResourcePopover"
import type {
	ReferenceAssetFileClass,
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
	includeAssetsSource?: boolean
	maxReferenceFiles?: number
	currentReferenceFiles?: string[]
	isReferenceFileLimitReached?: boolean
	referenceResourceType: ReferenceResourceTypeFilter
	referenceFileInfos: ReferenceResourceFileInfo[]
	assetLimits?: ReferenceAssetPerTypeLimits
	currentAssetCounts?: ReferenceAssetTypeCounts
	canAcceptNextAsset?: (
		fileClass: ReferenceAssetFileClass,
		currentAssetCounts: ReferenceAssetTypeCounts,
	) => boolean
	onProjectSelect?: (
		item: ReferenceResourcePanelItem,
		context?: ReferenceResourcePanelSelectContext,
	) => void
	beforeSourceActions?: ReactNode
	onProjectSelectPanelOpenChange?: (open: boolean) => void
	enableProjectSelectMultiSelect?: boolean
	maxProjectSelectBatchCount?: number
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
		includeAssetsSource,
		maxReferenceFiles,
		currentReferenceFiles,
		isReferenceFileLimitReached,
		referenceResourceType,
		referenceFileInfos,
		assetLimits,
		currentAssetCounts,
		canAcceptNextAsset,
		onProjectSelect,
		beforeSourceActions,
		onProjectSelectPanelOpenChange,
		enableProjectSelectMultiSelect,
		maxProjectSelectBatchCount,
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
			includeAssetsSource={includeAssetsSource}
			maxReferenceFiles={maxReferenceFiles}
			currentReferenceFiles={currentReferenceFiles}
			isReferenceFileLimitReached={isReferenceFileLimitReached}
			referenceResourceType={referenceResourceType}
			referenceFileInfos={referenceFileInfos}
			assetLimits={assetLimits}
			currentAssetCounts={currentAssetCounts}
			canAcceptNextAsset={canAcceptNextAsset}
			onProjectSelect={onProjectSelect}
			beforeSourceActions={beforeSourceActions}
			onProjectSelectPanelOpenChange={onProjectSelectPanelOpenChange}
			enableProjectSelectMultiSelect={enableProjectSelectMultiSelect}
			maxProjectSelectBatchCount={maxProjectSelectBatchCount}
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
