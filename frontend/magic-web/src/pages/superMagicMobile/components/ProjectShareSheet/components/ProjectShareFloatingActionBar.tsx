import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** Tailwind arbitrary value: single primary button (48px) + top padding (8px) + safe bottom. */
const SINGLE_ACTION_SCROLL_SPACER = "calc(3.5rem+max(var(--safe-area-inset-bottom),16px))"

/** Tailwind arbitrary value: two stacked buttons (~104px) + gaps + safe bottom. */
const DUAL_ACTION_SCROLL_SPACER = "calc(6.75rem+max(var(--safe-area-inset-bottom),16px))"

export type ProjectShareActionBarVariant = "single" | "dual"

interface ProjectShareScrollSpacerProps {
	/** Matches the fixed footer height so the last form row stays visible above the bar. */
	variant?: ProjectShareActionBarVariant
	testId?: string
}

/**
 * Reserves scrollable space at the end of share sheet forms; pairs with ProjectShareActionFooter outside the scroll area.
 */
export function ProjectShareScrollSpacer({
	variant = "single",
	testId,
}: ProjectShareScrollSpacerProps) {
	const scrollSpacerHeight =
		variant === "dual" ? DUAL_ACTION_SCROLL_SPACER : SINGLE_ACTION_SCROLL_SPACER

	return (
		<div
			aria-hidden
			className="shrink-0"
			style={{ height: scrollSpacerHeight }}
			data-testid={testId ? `${testId}-scroll-spacer` : undefined}
		/>
	)
}

interface ProjectShareActionFooterProps {
	children: ReactNode
	className?: string
	testId?: string
}

/**
 * Fixed action footer pinned to the sheet bottom (not sticky); safe-area padding lives here only.
 */
export function ProjectShareActionFooter({
	children,
	className,
	testId,
}: ProjectShareActionFooterProps) {
	return (
		<div
			className={cn(
				"shrink-0 bg-[#F7F7F6] px-3.5 pb-[max(var(--safe-area-inset-bottom),16px)] pt-2",
				className,
			)}
			data-testid={testId}
		>
			{children}
		</div>
	)
}
