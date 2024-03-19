import type { LucideIcon } from "lucide-react"
import { cn } from "@/opensource/lib/utils"

interface ModelEmptyStateProps {
	icon: LucideIcon
	title: string
	description?: string
	className?: string
	testId?: string
}

export function ModelEmptyState({
	icon: Icon,
	title,
	description,
	className,
	testId,
}: ModelEmptyStateProps) {
	return (
		<div
			className={cn(
				"flex min-h-32 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center",
				className,
			)}
			data-testid={testId}
		>
			<div className="flex size-10 items-center justify-center rounded-full bg-background">
				<Icon size={18} className="text-muted-foreground" />
			</div>
			<div className="space-y-1">
				<p className="text-sm font-medium leading-5 text-foreground">{title}</p>
				{description && (
					<p className="text-xs leading-4 text-muted-foreground">{description}</p>
				)}
			</div>
		</div>
	)
}
