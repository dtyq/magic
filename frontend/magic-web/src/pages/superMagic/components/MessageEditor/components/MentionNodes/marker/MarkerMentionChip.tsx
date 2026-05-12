import TSIcon from "@/components/base/TSIcon"
import type { CanvasMarkerMentionData } from "@/components/business/MentionPanel/types"
import { useIsMobile } from "@/hooks/useIsMobile"
import { cn } from "@/lib/utils"
import { memo, type MouseEvent } from "react"
import MarkerNamePrefix from "./MarkerNamePrefix"
import { getMarkerMentionStyleConfig } from "./shared"

interface MarkerMentionChipProps {
	displayName: string
	markerData?: CanvasMarkerMentionData | null
	imageUrl?: string | null
	className?: string
	iconSize?: number
	maxWidthClassName?: string
	contentDrivenWidth?: boolean
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
	maxWidthClassName,
	contentDrivenWidth = false,
	selected = false,
	showArrow = true,
	onClick,
	onRemove,
	dataMentionItem,
}: MarkerMentionChipProps) {
	const isMobile = useIsMobile()

	const styleConfig = getMarkerMentionStyleConfig({ size: "small", isMobile, iconSize })

	// 预览层叠在删除按钮之上；opacity-0 仍会拦截点击，需配合 pointer-events 才能把事件交给删除按钮
	const removeClassName = onRemove
		? isMobile
			? "pointer-events-auto opacity-100"
			: "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100"
		: "pointer-events-none opacity-0"

	const previewClassName = onRemove
		? isMobile
			? "pointer-events-none opacity-0"
			: "opacity-100 group-hover:pointer-events-none group-hover:opacity-0"
		: "opacity-100"

	return (
		<div
			className={cn(
				"group relative inline-flex h-[22px] min-w-[30px] cursor-pointer items-center gap-1 overflow-hidden rounded-md border border-[#D5D5D5] px-1 align-bottom transition-colors",
				contentDrivenWidth ? "w-fit max-w-full" : "shrink-0",
				maxWidthClassName ?? styleConfig.maxWidthClassName,
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
			<span className={cn("flex min-w-0 items-center text-xs leading-4 text-foreground")}>
				<MarkerNamePrefix data={markerData || undefined} />
				<span className="block max-w-full truncate">{displayName}</span>
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
