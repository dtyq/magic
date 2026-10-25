import { Filter, RotateCcw } from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { Button } from "@magic-admin-v2/components/ui/button"
import {
	Sheet,
	SheetContent,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@magic-admin-v2/components/ui/sheet"
import { useIsMobile } from "@magic-admin-v2/hooks/use-is-mobile"
import { cn } from "@magic-admin-v2/utils/cn"

/**
 * Layout the field renderer is currently used in.
 *
 * - `grid`: desktop search area, fields are applied as the user edits them.
 * - `sheet`: mobile bottom sheet, fields edit a draft that is applied on confirmation.
 */
export type ListFilterPanelLayout = "grid" | "sheet"

export type ListFilterPanelFieldsProps<T> = {
	/** Applied value on desktop; the unsaved draft inside the mobile panel. */
	value: T
	/** Merges a partial change into `value`. */
	onChange: (patch: Partial<T>) => void
	layout: ListFilterPanelLayout
}

export type ListFilterPanelProps<T extends object> = {
	/** Currently applied filter state owned by the page. */
	value: T
	/** Desktop live-apply handler. Pages route debounced text fields here. */
	onChange: (patch: Partial<T>) => void
	/** Resets the applied filter state (desktop reset button). */
	onReset: () => void
	/** Creates the empty draft used by the mobile panel reset button. */
	createDefaultValue: () => T
	/**
	 * Applies the mobile draft. Defaults to `onChange(draft)`; pages whose
	 * `onChange` debounces text fields should pass an immediate writer instead.
	 */
	onApply?: (draft: T) => void
	/** Panel heading and accessible name of the mobile trigger button. */
	title: string
	applyLabel: string
	resetLabel: string
	/** Renders the page-owned fields; every control must fill its grid cell (`w-full`). */
	renderFields: (props: ListFilterPanelFieldsProps<T>) => ReactNode
	/**
	 * Optional page actions (for example an "add" button). Desktop shows them in a row
	 * above the fields; mobile shows them next to the filter trigger.
	 */
	actions?: ReactNode
	/** Controlled mobile panel state for triggers rendered outside this component. */
	mobileOpen?: boolean
	/** Controlled mobile panel state change handler. */
	onMobileOpenChange?: (open: boolean) => void
	/** Hide the default mobile filter trigger when the page renders its own trigger. */
	showMobileTrigger?: boolean
	className?: string
	/** Stable selectors for the desktop/mobile filter surfaces. */
	desktopTestId?: string
	desktopResetTestId?: string
	mobileTriggerTestId?: string
	mobileContentTestId?: string
	mobileBodyTestId?: string
	mobileCloseButtonTestId?: string
	mobileResetTestId?: string
	mobileApplyTestId?: string
}

/**
 * Shared search area for admin list pages.
 *
 * Desktop renders every field in a responsive grid (up to four per row) with a
 * trailing reset button. Mobile collapses all fields behind a single Filter icon
 * button that opens a bottom sheet editing a draft with reset/apply actions.
 * The caller keeps ownership of the applied state and of API parameter mapping.
 */
export function ListFilterPanel<T extends object>({
	actions,
	applyLabel,
	className,
	createDefaultValue,
	onApply,
	onChange,
	onReset,
	renderFields,
	resetLabel,
	showMobileTrigger = true,
	title,
	value,
	mobileOpen,
	onMobileOpenChange,
	desktopTestId,
	desktopResetTestId,
	mobileTriggerTestId,
	mobileContentTestId,
	mobileBodyTestId,
	mobileCloseButtonTestId,
	mobileResetTestId,
	mobileApplyTestId,
}: ListFilterPanelProps<T>) {
	const isMobile = useIsMobile()
	const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
	const [draft, setDraft] = useState<T>(value)
	const open = mobileOpen ?? uncontrolledOpen
	const updateOpen = onMobileOpenChange ?? setUncontrolledOpen

	useEffect(() => {
		if (open) setDraft(value)
	}, [open, value])

	if (!isMobile) {
		const grid = (
			<div
				data-testid={desktopTestId}
				className={cn(
					// Four equal columns on wide screens, two on narrow desktop windows.
					"grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-4",
					!actions && className,
				)}
			>
				{renderFields({ value, onChange, layout: "grid" })}
				{/* Reset sits in the last column so it never shifts the field order. */}
				<div className="flex justify-end sm:col-start-2 xl:col-start-4">
					<Button
						data-testid={desktopResetTestId}
						onClick={onReset}
						type="button"
						variant="outline"
					>
						<RotateCcw className="size-4" aria-hidden="true" />
						{resetLabel}
					</Button>
				</div>
			</div>
		)

		if (!actions) return grid

		return (
			<div className={cn("space-y-3", className)}>
				<div className="flex justify-end">{actions}</div>
				{grid}
			</div>
		)
	}

	return (
		<Sheet
			open={open}
			onOpenChange={(nextOpen) => {
				// Reopening starts from the applied conditions; dismissing discards unsaved edits.
				if (nextOpen) setDraft(value)
				updateOpen(nextOpen)
			}}
		>
			{actions || showMobileTrigger ? (
				<div className={cn("flex items-center justify-end gap-2", className)}>
					{actions}
					{showMobileTrigger ? (
						<SheetTrigger asChild>
							<Button
								aria-label={title}
								data-testid={mobileTriggerTestId}
								size="icon"
								type="button"
								variant="outline"
							>
								<Filter className="size-4" aria-hidden="true" />
							</Button>
						</SheetTrigger>
					) : null}
				</div>
			) : null}
			<SheetContent
				data-testid={mobileContentTestId}
				closeButtonTestId={mobileCloseButtonTestId}
				side="bottom"
				className="h-[85vh] max-h-[85vh] rounded-t-xl gap-0 p-0"
				aria-describedby={undefined}
			>
				<SheetHeader className="shrink-0 border-b pr-12">
					<SheetTitle>{title}</SheetTitle>
				</SheetHeader>
				{/* `[&>div]:!block` keeps Radix' table-layout wrapper from widening the body. */}
				<ScrollArea className="min-h-0 flex-1" viewportClassName="[&>div]:!block">
					<div className="grid gap-3 p-4" data-testid={mobileBodyTestId}>
						{renderFields({
							value: draft,
							onChange: (patch) =>
								setDraft((previous) => ({ ...previous, ...patch })),
							layout: "sheet",
						})}
					</div>
				</ScrollArea>
				<SheetFooter className="grid shrink-0 grid-cols-2 gap-2 border-t bg-background px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
					<Button
						data-testid={mobileResetTestId}
						onClick={() => setDraft(createDefaultValue())}
						type="button"
						variant="outline"
					>
						<RotateCcw className="size-4" aria-hidden="true" />
						{resetLabel}
					</Button>
					<Button
						data-testid={mobileApplyTestId}
						onClick={() => {
							if (onApply) onApply(draft)
							else onChange(draft)
							updateOpen(false)
						}}
						type="button"
					>
						{applyLabel}
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	)
}
