import type { LucideIcon } from "lucide-react"
import { Button } from "@magic-admin-v2/components/ui/button"
import { cn } from "@magic-admin-v2/utils/cn"

type EmptyStateProps = {
	icon: LucideIcon
	title: string
	description?: string
	actionLabel?: string
	testId?: string
	actionButtonTestId?: string
	className?: string
}

export function EmptyState({
	icon: Icon,
	title,
	description,
	actionLabel,
	testId,
	actionButtonTestId,
	className,
}: EmptyStateProps) {
	return (
		<div
			className={cn(
				"flex min-h-[280px] flex-col items-center justify-center rounded-lg bg-card px-6 py-10 text-center",
				className,
			)}
			data-testid={testId}
		>
			<div className="mb-4 flex size-10 items-center justify-center rounded-md border bg-background">
				<Icon className="size-5 text-muted-foreground" aria-hidden="true" />
			</div>
			<h2 className="text-base font-semibold text-foreground">{title}</h2>
			{description ? (
				<p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
			) : null}
			{actionLabel ? (
				<Button
					className="mt-5"
					data-testid={actionButtonTestId}
					variant="outline"
					disabled
				>
					{actionLabel}
				</Button>
			) : null}
		</div>
	)
}
