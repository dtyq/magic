import { memo } from "react"
import { cn } from "@/opensource/lib/utils"

export interface DropIndicatorProps {
	position: "top" | "bottom" | "left" | "right"
}

function DropIndicator({ position }: DropIndicatorProps) {
	const isVertical = position === "top" || position === "bottom"
	const isHorizontal = position === "left" || position === "right"

	return (
		<div
			className={cn(
				"relative flex items-center justify-center",
				isVertical && (position === "top" ? "-mt-0.5 mb-0.5" : "-mb-0.5 mt-0.5"),
				isHorizontal && (position === "left" ? "-ml-0.5 mr-0.5" : "-mr-0.5 ml-0.5"),
			)}
		>
			<div
				className={cn(
					"flex items-center justify-center rounded bg-primary/20",
					isVertical && "h-3 w-full px-2",
					isHorizontal && "h-full w-3 py-2",
				)}
			>
				<div
					className={cn(
						"rounded-full bg-primary opacity-30",
						isVertical && "h-1 w-full",
						isHorizontal && "h-full w-1",
					)}
				/>
			</div>
		</div>
	)
}

export default memo(DropIndicator)
