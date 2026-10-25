import { SlidersHorizontal, X } from "lucide-react"
import { cn } from "@/utils/cn"

export interface SelfMediaComposerConfigSummarySegment {
	label: string
	value: string
}

export function SelfMediaComposerConfigSummary({
	emptyLabel,
	segments,
	variant = "default",
}: {
	emptyLabel: string
	segments: SelfMediaComposerConfigSummarySegment[]
	variant?: "default" | "trigger"
}) {
	const isTrigger = variant === "trigger"

	return (
		<div
			className={cn(
				"inline-flex min-w-0 items-center gap-1.5",
				isTrigger ? "max-w-full overflow-hidden" : "flex-wrap",
			)}
		>
			{/* <span
				className={cn(
					"flex shrink-0 items-center justify-center rounded-full text-muted-foreground",
					isTrigger ? "size-6" : "size-7 bg-muted/50",
				)}
			>
				<SlidersHorizontal className="size-3.5" />
			</span> */}
			<div
				className={cn(
					"flex min-w-0 items-center gap-1.5",
					isTrigger ? "overflow-hidden" : "flex-wrap",
				)}
			>
				{segments.length > 0 ? (
					segments.map((segment) => (
						<span
							key={segment.label}
							className={cn(
								"inline-flex min-w-0 items-center gap-1.5",
								isTrigger
									? "h-6 rounded-none bg-transparent px-0"
									: "h-7 rounded-full bg-muted/45 px-2.5",
							)}
						>
							<span className="text-[11px] font-medium leading-none text-muted-foreground/65">
								{segment.label}
							</span>
							<span
								className={cn(
									"min-w-0 truncate font-semibold text-foreground",
									isTrigger ? "text-sm" : "text-sm",
								)}
							>
								{segment.value}
							</span>
						</span>
					))
				) : (
					<span
						className={cn(
							"inline-flex items-center font-medium text-muted-foreground",
							isTrigger
								? "h-6 min-w-0 truncate rounded-none bg-transparent px-0 text-sm"
								: "h-7 rounded-full bg-muted/45 px-2.5 text-sm",
						)}
					>
						{emptyLabel}
					</span>
				)}
			</div>
		</div>
	)
}

export function SelfMediaComposerConfigClearButton({
	label,
	onClick,
}: {
	label: string
	onClick: () => void
}) {
	return (
		<button
			type="button"
			aria-label="clear-self-media-composer-config"
			onClick={onClick}
			className={cn(
				"inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-xs font-medium text-muted-foreground shadow-xs transition-colors",
				"hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
			)}
			data-testid="self-media-composer-config-summary"
		>
			<X className="size-3.5" />
			{label}
		</button>
	)
}
