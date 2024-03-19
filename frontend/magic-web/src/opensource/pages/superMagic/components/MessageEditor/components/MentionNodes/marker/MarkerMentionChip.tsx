import TSIcon from "@/opensource/components/base/TSIcon"
import type { CanvasMarkerMentionData } from "@/opensource/components/business/MentionPanel/types"
import { useIsMobile } from "@/opensource/hooks/useIsMobile"
import { cn } from "@/opensource/lib/utils"
import { memo, type MouseEvent } from "react"
import MarkerNamePrefix from "./MarkerNamePrefix"
import { getMarkerMentionStyleConfig } from "./shared"

interface MarkerMentionChipProps {
	displayName: string
	markerData?: CanvasMarkerMentionData | null
	imageUrl?: string | null
	className?: string
	iconSize?: number
	selected?: boolean
	showArrow?: boolean
	onClick?: (event: MouseEvent) => void
	onRemove?: (event: MouseEvent) => void
	dataMentionItem?: string
}

function MarkerMentionChip({
	displayName,
	markerData,
	imageUrl,
	className,
	iconSize,
	selected = false,
	showArrow = true,
	onClick,
	onRemove,
	dataMentionItem,
}: MarkerMentionChipProps) {
	const isMobile = useIsMobile()

	const styleConfig = getMarkerMentionStyleConfig({ size: "small", isMobile, iconSize })

	const removeClassName = onRemove
		? isMobile
			? "opacity-100"
			: "opacity-0 group-hover:opacity-100"
		: "pointer-events-none opacity-0"

	const previewClassName = onRemove
		? isMobile
			? "opacity-0"
			: "opacity-100 group-hover:opacity-0"
		: "opacity-100"

	return (
		<div
			className={cn(
				"group relative inline-flex h-[22px] min-w-[30px] shrink-0 cursor-pointer items-center gap-1 overflow-hidden rounded-md border border-[#D5D5D5] px-1 align-bottom transition-colors",
				styleConfig.maxWidthClassName,
				selected && "border-primary bg-primary/5",
				className,
			)}
			onClick={onClick}
			data-mention-item={dataMentionItem}
		>
			<div className="relative flex size-[14px] flex-none shrink-0 items-center justify-center">
				<div
					data-marker-remove="true"
					className={cn(
						"absolute inset-0 flex cursor-pointer items-center justify-center transition-opacity",
						removeClassName,
					)}
					onClick={onRemove}
				>
					<TSIcon type="ts-close-line" size="14" />
				</div>
				{imageUrl ? (
					<img
						src={imageUrl}
						alt="marker"
						className={cn(
							"absolute inset-0 size-[14px] rounded object-cover transition-opacity",
							previewClassName,
						)}
					/>
				) : (
					<div
						className={cn(
							"absolute inset-0 flex items-center justify-center transition-opacity",
							previewClassName,
						)}
					>
						<TSIcon type="ts-image" size="14" radius={4} />
					</div>
				)}
			</div>
			<span
				className={cn(
					"flex min-w-0 flex-none items-center text-xs leading-4 text-foreground",
				)}
			>
				<MarkerNamePrefix data={markerData || undefined} />
				<span className="overflow-hidden whitespace-nowrap">{displayName}</span>
			</span>
			{showArrow && (
				<div className="flex size-[14px] flex-none shrink-0 items-center justify-center">
					<TSIcon type="ts-arrow-bottom" size={styleConfig.arrowSize.toString()} />
				</div>
			)}
		</div>
	)
}

export default memo(MarkerMentionChip)
