import { FileText, X } from "lucide-react"
import { cn } from "@/utils/cn"
import type { ReferenceFileValue } from "../../types"

interface ReferenceFileChipsProps {
	files: ReferenceFileValue[]
	compact?: boolean
	disabled?: boolean
	onRemove: (index: number) => void
	getRemoveLabel: (fileName: string) => string
}

export default function ReferenceFileChips({
	files,
	compact = false,
	disabled = false,
	onRemove,
	getRemoveLabel,
}: ReferenceFileChipsProps) {
	if (files.length === 0) return null

	return (
		<div className={cn("flex flex-wrap gap-1.5", compact ? "items-center" : "mb-2")}>
			{files.map((file, index) => (
				<div
					key={`${file.name}-${index}`}
					className={cn(
						"group flex items-center gap-1.5 border transition-colors",
						compact
							? "rounded-md bg-background px-2 py-1 text-foreground hover:bg-accent"
							: "rounded-md border-border/60 bg-muted/40 px-2 py-1 hover:border-border hover:bg-muted/70",
					)}
				>
					<FileText
						className={cn(
							"size-3 shrink-0",
							compact ? "text-zinc-500" : "text-primary/70",
						)}
					/>
					<span
						className={cn(
							"truncate font-medium",
							compact
								? "max-w-[70px] text-[11px]"
								: "max-w-[140px] text-xs text-foreground/90",
						)}
					>
						{file.name}
					</span>
					<button
						type="button"
						aria-label={getRemoveLabel(file.name)}
						className={cn(
							"shrink-0 transition-all",
							compact
								? "p-0.5 text-zinc-400 hover:bg-zinc-200/80 hover:text-destructive"
								: "ml-0.5 rounded-full p-0.5 text-muted-foreground/60 opacity-0 hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100",
						)}
						onClick={() => onRemove(index)}
						disabled={disabled}
						data-testid="on-remove"
					>
						<X className={compact ? "size-2.5" : "size-3"} />
					</button>
				</div>
			))}
		</div>
	)
}
