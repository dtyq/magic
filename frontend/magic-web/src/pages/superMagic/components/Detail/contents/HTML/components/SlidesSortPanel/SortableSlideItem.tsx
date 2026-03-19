import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { IconGripVertical, IconPhoto } from "@tabler/icons-react"
import { cn } from "@/lib/tiptap-utils"
import type { SortableSlideItemProps } from "./types"

/**
 * Sortable slide item component
 * Uses pre-generated screenshot for lightweight rendering
 */
export function SortableSlideItem({ slide, index, screenshot }: SortableSlideItemProps) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: slide.id,
	})

	const style = {
		transform: CSS.Transform.toString(transform),
		transition: isDragging ? "none" : transition,
	}

	// Determine thumbnail content based on screenshot state
	const renderThumbnail = () => {
		if (screenshot?.isLoading) {
			return (
				<div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
					Loading...
				</div>
			)
		}

		if (screenshot?.error) {
			return (
				<div className="flex h-full w-full flex-col items-center justify-center gap-1 text-xs text-destructive">
					<IconPhoto size={16} />
					<span>Failed</span>
				</div>
			)
		}

		if (screenshot?.thumbnailUrl) {
			return (
				<img
					src={screenshot.thumbnailUrl}
					alt={`Slide ${index + 1}`}
					className="h-full w-full object-cover"
				/>
			)
		}

		// Fallback for no screenshot
		return (
			<div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
				<IconPhoto size={16} />
			</div>
		)
	}

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={cn(
				"group relative flex items-center gap-2.5 rounded-md border border-border bg-background p-2 transition-all duration-200 ease-out",
				"hover:border-primary/30 hover:bg-accent/30 hover:shadow-sm",
				isDragging &&
				"z-50 scale-105 cursor-grabbing border-primary/50 bg-background shadow-lg ring-2 ring-primary/20",
				!isDragging && "shadow-none",
			)}
		>
			{/* Drag handle */}
			<button
				type="button"
				className={cn(
					"shrink-0 touch-none text-muted-foreground transition-colors duration-150",
					"hover:text-foreground",
					isDragging ? "cursor-grabbing text-primary" : "cursor-grab",
				)}
				{...attributes}
				{...listeners}
			>
				<IconGripVertical size={18} />
			</button>

			{/* Thumbnail - Lightweight image rendering */}
			<div className="relative h-12 w-20 shrink-0 overflow-hidden rounded border border-border bg-muted shadow-sm transition-shadow duration-150 group-hover:shadow">
				{renderThumbnail()}
			</div>

			{/* Page info */}
			<div className="min-w-0 flex-1">
				<div className="truncate text-xs font-medium text-foreground">
					第 {index + 1} 页
				</div>
				<div className="truncate text-xs text-muted-foreground">{slide.path}</div>
			</div>
		</div>
	)
}
