import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** Tailwind arbitrary value: single primary button (48px) + top padding (8px) + safe bottom. */
const SINGLE_ACTION_SCROLL_SPACER = "calc(3.5rem+max(var(--safe-area-inset-bottom),16px))"

/** Tailwind arbitrary value: two stacked buttons (~104px) + gaps + safe bottom. */
const DUAL_ACTION_SCROLL_SPACER = "calc(6.75rem+max(var(--safe-area-inset-bottom),16px))"

interface ProjectShareFloatingActionBarProps {
	children: ReactNode
	/** Reserves scroll space so the last form row is not covered by the floating bar. */
	scrollSpacerVariant?: "single" | "dual"
	className?: string
	testId?: string
}

/**
 * Sticky floating action bar for share sheet forms; safe-area inset is applied on this bar only (not MagicPopup).
 */
export function ProjectShareFloatingActionBar({
	children,
	scrollSpacerVariant = "single",
	className,
	testId,
}: ProjectShareFloatingActionBarProps) {
	const scrollSpacerHeight =
		scrollSpacerVariant === "dual" ? DUAL_ACTION_SCROLL_SPACER : SINGLE_ACTION_SCROLL_SPACER

	return (
		<>
			<div
				aria-hidden
				className="shrink-0"
				style={{ height: scrollSpacerHeight }}
				data-testid={testId ? `${testId}-scroll-spacer` : undefined}
			/>
			<div
				className={cn(
					"sticky bottom-0 z-10 -mx-3.5 bg-[#F7F7F6] px-3.5 pb-[var(--safe-area-inset-bottom)] pt-2",
					className,
				)}
				data-testid={testId}
			>
				{children}
			</div>
		</>
	)
}
