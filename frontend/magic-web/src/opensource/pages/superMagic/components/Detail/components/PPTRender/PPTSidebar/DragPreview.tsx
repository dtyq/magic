import { memo } from "react"
import { Image, Loader2 } from "lucide-react"
import type { SlideItem, SlideScreenshot } from "./types"
import { cn } from "@/opensource/lib/utils"

export interface DragPreviewProps {
	item: SlideItem
	screenshot?: SlideScreenshot
}

function DragPreview({ item, screenshot }: DragPreviewProps) {
	// Render thumbnail based on screenshot state
	const renderThumbnail = () => {
		if (screenshot?.isLoading) {
			return (
				<div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
					<Loader2 className="size-4 animate-spin" />
				</div>
			)
		}

		if (screenshot?.error) {
			return (
				<div className="flex h-full w-full flex-col items-center justify-center gap-1 text-xs text-destructive">
					<Image className="size-4" />
					<span>Failed</span>
				</div>
			)
		}

		if (screenshot?.thumbnailUrl) {
			return (
				<img
					src={screenshot.thumbnailUrl}
					alt={`Slide ${item.index + 1}`}
					className="h-full w-full object-cover"
					draggable={false}
				/>
			)
		}

		// Fallback for no screenshot
		return (
			<div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
				<Image className="size-4" />
			</div>
		)
	}

	return (
		<div
			className={cn(
				"relative flex h-full min-h-20 w-[calc(100%-30px)] shrink-0 items-center justify-center overflow-hidden  rounded-md border-2 bg-muted p-0.5 shadow-sm transition-shadow group-hover:shadow",
			)}
		>
			{renderThumbnail()}
		</div>
	)
}

export default memo(DragPreview)
