import { Filter } from "lucide-react"
import { PageHeaderActionButton } from "@magic-admin-v2/components/page-header-action-button"

type PageHeaderFilterButtonProps = {
	/** Stable selector for the rendered action button. */
	["data-testid"]?: string
	/** Number of applied conditions; zero keeps the neutral outlined state. */
	count: number
	/** Localized accessible name for the filter action. */
	label: string
	onClick: () => void
}

/**
 * Mobile-only PageHeader entry point for a page-owned ListFilterPanel.
 *
 * The list page owns the Sheet state and filter counting because default values
 * differ by feature; this component only keeps the header affordance consistent.
 */
export function PageHeaderFilterButton({
	count,
	label,
	onClick,
	"data-testid": testId,
}: PageHeaderFilterButtonProps) {
	const hasAppliedFilters = count > 0

	return (
		<PageHeaderActionButton
			data-testid={testId}
			aria-label={`${label}${hasAppliedFilters ? ` (${count})` : ""}`}
			className="relative md:hidden"
			onClick={onClick}
			variant={hasAppliedFilters ? "secondary" : "outline"}
		>
			<Filter className="size-4" aria-hidden="true" />
			{hasAppliedFilters ? (
				<span
					aria-hidden="true"
					className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-4 text-primary-foreground"
				>
					{count}
				</span>
			) : null}
		</PageHeaderActionButton>
	)
}
