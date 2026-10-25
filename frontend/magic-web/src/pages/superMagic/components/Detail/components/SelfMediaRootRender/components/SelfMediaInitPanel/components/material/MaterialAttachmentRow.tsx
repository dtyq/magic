import { cn } from "@/utils/cn"
import InlineVoiceButton from "../ui/InlineVoiceButton"
import type { MaterialItem } from "../../types"

function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface MaterialAttachmentRowProps {
	item: MaterialItem
	compact: boolean
	descriptionPlaceholder: string
	onRemove: (id: string) => void
	onDescriptionChange: (id: string, description: string) => void
}

export default function MaterialAttachmentRow({
	item,
	compact,
	descriptionPlaceholder,
	onRemove,
	onDescriptionChange,
}: MaterialAttachmentRowProps) {
	return (
		<div
			className={cn(
				"group flex gap-2 rounded-lg border bg-background shadow-xs transition-all hover:border-primary/40 hover:bg-accent/30",
				compact ? "p-2" : "gap-3 p-3",
			)}
		>
			<div
				className={cn(
					"relative flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted/50",
					compact ? "h-10 w-10" : "h-16 w-16",
				)}
			>
				{item.previewUrl ? (
					<img
						src={item.previewUrl}
						alt={item.file.name}
						className="h-full w-full object-cover"
						data-testid="material-attachment-row-image"
					/>
				) : (
					<svg
						width={compact ? 16 : 24}
						height={compact ? 16 : 24}
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.5"
						className="text-muted-foreground"
						aria-hidden="true"
						data-testid="material-attachment-row-svg"
					>
						<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
						<polyline points="14 2 14 8 20 8" />
					</svg>
				)}
				<button
					type="button"
					className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center bg-destructive text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
					onClick={() => onRemove(item.id)}
					data-testid="on-remove"
				>
					<svg width="8" height="8" viewBox="0 0 12 12" fill="none" aria-hidden="true" data-testid="material-attachment-row-svg-2">
						<path
							d="M9 3L3 9M3 3l6 6"
							stroke="currentColor"
							strokeWidth="1.5"
							strokeLinecap="round"
						/>
					</svg>
				</button>
			</div>

			<div className="flex min-w-0 flex-1 flex-col gap-1">
				<div className="flex items-center gap-2">
					<span className="truncate text-xs font-medium text-foreground">
						{item.file.name}
					</span>
					<span className="shrink-0 text-[10px] text-muted-foreground">
						{formatFileSize(item.file.size)}
					</span>
				</div>
				<div className="group relative">
					<input
						type="text"
						className="w-full border-0 border-b border-zinc-200 bg-zinc-50/40 px-2 py-1 pr-6 text-xs outline-none transition-all placeholder:text-muted-foreground/60 focus:border-zinc-950 focus:bg-primary/[0.03]"
						placeholder={descriptionPlaceholder}
						value={item.description}
						onChange={(e) => onDescriptionChange(item.id, e.target.value)}
						data-testid="on-description-change"
					/>
					<InlineVoiceButton
						value={item.description}
						onResult={(text) => onDescriptionChange(item.id, text)}
					/>
				</div>
			</div>
		</div>
	)
}
