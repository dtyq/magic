import { Loader2, RotateCcw } from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"
import { Button } from "@magic-admin-v2/components/ui/button"
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@magic-admin-v2/components/ui/sheet"
import { cn } from "@magic-admin-v2/utils/cn"

const mobileMediaQuery = "(max-width: 767px)"

/**
 * Controls where a filter sheet is available and how it is presented.
 *
 * - `mobile-only`: desktop filter controls stay inline; the sheet is only
 *   rendered on mobile as a bottom sheet.
 * - `responsive`: the sheet is rendered on both breakpoints, using a right
 *   drawer on desktop and a bottom sheet on mobile.
 */
export type FilterSheetPresentation = "mobile-only" | "responsive"

/**
 * Shared layout contract for list filter sheets.
 *
 * The component owns only the sheet shell and the reset/apply actions. The
 * caller owns draft state, field rendering, search-field linkage, and API
 * parameter conversion so that business-specific filters remain local.
 */
export type FilterSheetProps = {
	/** Whether the filter sheet is currently open. */
	open: boolean
	/** Called when the sheet requests an open-state change. */
	onOpenChange: (open: boolean) => void
	/** Sheet heading shown above the filter fields. */
	title: ReactNode
	/** Optional supporting text shown below the heading. */
	description?: ReactNode
	/** Page-specific filter fields rendered inside the scrollable body. */
	children: ReactNode
	/** Controls mobile-only versus desktop-right/mobile-bottom presentation. */
	presentation?: FilterSheetPresentation
	/** Label for the draft reset action. */
	resetLabel: ReactNode
	/** Label for the draft apply action. */
	applyLabel: ReactNode
	/** Resets the page-owned draft state. */
	onReset: () => void
	/** Applies the page-owned draft state. */
	onApply: () => void
	/** Disables the apply action without changing the fields. */
	applyDisabled?: boolean
	/** Shows a loading indicator and disables the apply action. */
	applyLoading?: boolean
	/** Optional class names for page-specific body overflow requirements. */
	bodyClassName?: string
	contentTestId?: string
	bodyTestId?: string
	resetButtonTestId?: string
	applyButtonTestId?: string
	closeButtonTestId?: string
}

function useMediaQuery(query: string) {
	const [matches, setMatches] = useState(() =>
		typeof window !== "undefined" ? window.matchMedia(query).matches : false,
	)

	useEffect(() => {
		if (typeof window === "undefined") return

		const mediaQuery = window.matchMedia(query)
		const handleChange = () => setMatches(mediaQuery.matches)

		handleChange()
		mediaQuery.addEventListener("change", handleChange)

		return () => mediaQuery.removeEventListener("change", handleChange)
	}, [query])

	return matches
}

export function FilterSheet({
	applyDisabled = false,
	applyLabel,
	applyLoading = false,
	bodyClassName,
	contentTestId,
	bodyTestId,
	resetButtonTestId,
	applyButtonTestId,
	closeButtonTestId,
	children,
	description,
	onApply,
	onOpenChange,
	onReset,
	open,
	presentation = "responsive",
	resetLabel,
	title,
}: FilterSheetProps) {
	const isMobile = useMediaQuery(mobileMediaQuery)
	const isMobileOnly = presentation === "mobile-only"
	const shouldRender = !isMobileOnly || isMobile
	const effectiveOpen = open && shouldRender
	const side = presentation === "responsive" && !isMobile ? "right" : "bottom"

	return (
		<Sheet open={effectiveOpen} onOpenChange={onOpenChange}>
			{shouldRender ? (
				<SheetContent
					className={cn(
						"gap-0 p-0",
						isMobile || isMobileOnly
							? "max-h-[85vh] rounded-t-xl"
							: "w-full sm:max-w-md",
					)}
					data-testid={contentTestId}
					closeButtonTestId={closeButtonTestId}
					side={side}
				>
					<SheetHeader className="shrink-0 border-b px-4 py-4 text-left">
						<SheetTitle>{title}</SheetTitle>
						{description ? <SheetDescription>{description}</SheetDescription> : null}
					</SheetHeader>
					<div
						className={cn(
							"min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4",
							bodyClassName,
						)}
						data-testid={bodyTestId}
					>
						{children}
					</div>
					<SheetFooter
						className={cn(
							"shrink-0 grid grid-cols-2 gap-2 border-t bg-background px-4 pt-4",
							isMobile || isMobileOnly
								? "pb-[max(1rem,env(safe-area-inset-bottom))]"
								: "pb-4",
						)}
					>
						<Button
							data-testid={resetButtonTestId}
							onClick={onReset}
							type="button"
							variant="outline"
						>
							<RotateCcw className="size-4" aria-hidden="true" />
							{resetLabel}
						</Button>
						<Button
							data-testid={applyButtonTestId}
							disabled={applyDisabled || applyLoading}
							onClick={onApply}
							type="button"
						>
							{applyLoading ? (
								<Loader2 className="size-4 animate-spin" aria-hidden="true" />
							) : null}
							{applyLabel}
						</Button>
					</SheetFooter>
				</SheetContent>
			) : null}
		</Sheet>
	)
}
