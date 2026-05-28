import { Check, RotateCcw, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/shadcn-ui/sheet"
import {
	MY_CREW_MOBILE_FILTER_DEFAULT,
	type MyCrewMobileFilterState,
	type MyCrewMobileFilterType,
	type MyCrewMobileSortType,
} from "./my-crew-mobile-shared"

interface MyCrewFilterSheetProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	filter: MyCrewMobileFilterState
	onChange: (nextFilter: MyCrewMobileFilterState) => void
}

/** Single-select row with check indicator. */
function SelectRow(props: {
	label: string
	selected: boolean
	onSelect: () => void
	dataTestId: string
}) {
	const { label, selected, onSelect, dataTestId } = props

	return (
		<button
			type="button"
			onClick={onSelect}
			className="flex h-12 w-full items-center gap-3 bg-transparent px-[14px] transition-opacity active:opacity-60"
			data-testid={dataTestId}
		>
			<span className="flex-1 text-left text-[16px] leading-5 text-foreground">{label}</span>
			{selected ? (
				<Check className="h-5 w-5 shrink-0 text-primary" strokeWidth={2.5} />
			) : null}
		</button>
	)
}

/**
 * Filter + sort sheet for mobile My Crew page.
 * Sort section first (prototype order); type section supports tap-to-deselect back to "all".
 */
export default function MyCrewFilterSheet({
	open,
	onOpenChange,
	filter,
	onChange,
}: MyCrewFilterSheetProps) {
	const { t } = useTranslation("crew/market")

	function handleReset() {
		onChange(MY_CREW_MOBILE_FILTER_DEFAULT)
	}

	/** Toggle type selection: re-tapping the active type resets to "all". */
	function handleTypeChange(nextType: MyCrewMobileFilterType) {
		if (nextType === filter.type) {
			onChange({ ...filter, type: "all" })
		} else {
			onChange({ ...filter, type: nextType })
		}
	}

	function handleSortChange(nextSort: MyCrewMobileSortType) {
		onChange({ ...filter, sort: nextSort })
	}

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent
				side="bottom"
				showClose={false}
				aria-describedby={undefined}
				className="flex flex-col overflow-hidden rounded-t-[14px] border-0 bg-muted p-0"
				style={{ boxShadow: "0 -4px 24px rgba(0,0,0,0.08)" }}
				data-testid="my-crew-filter-sheet"
			>
				{/* Drag handle */}
				<div className="flex w-full shrink-0 flex-col items-center py-[6px]">
					<div className="h-1 w-20 rounded-full bg-muted-foreground" aria-hidden />
				</div>

				{/* Header: close + title + reset */}
				<div className="relative flex h-14 w-full shrink-0 items-center justify-center px-16 py-2">
					<Button
						type="button"
						variant="ghost"
						size="icon"
						onClick={() => onOpenChange(false)}
						className="absolute left-[10px] top-1/2 h-12 w-12 -translate-y-1/2 rounded-full bg-card shadow-[0px_8px_25px_0px_rgba(0,0,0,0.10)]"
						aria-label={t("myCrewPage.filterSheet.closeAria")}
						data-testid="my-crew-filter-sheet-close"
					>
						<X className="size-[22px] text-foreground" />
					</Button>

					<SheetTitle className="max-w-[247px] truncate text-center font-poppins text-[18px] font-medium leading-6 text-foreground">
						{t("myCrewPage.filterSheet.title")}
					</SheetTitle>

					<Button
						type="button"
						variant="ghost"
						size="icon"
						onClick={handleReset}
						className="absolute right-[10px] top-1/2 h-12 w-12 -translate-y-1/2 rounded-full bg-card shadow-[0px_8px_25px_0px_rgba(0,0,0,0.10)]"
						aria-label={t("myCrewPage.filterSheet.resetAria")}
						data-testid="my-crew-filter-sheet-reset"
					>
						<RotateCcw className="size-[22px] text-foreground" strokeWidth={2} />
					</Button>
				</div>

				{/* Body: sort section first, then type (prototype order) */}
				<div className="no-scrollbar flex flex-1 flex-col gap-2.5 overflow-y-auto px-[10px] pb-5 pt-2">
					{/* Sort section */}
					<div
						className="flex flex-col gap-2"
						data-testid="my-crew-filter-sort-section"
					>
						<p className="px-[14px] text-[14px] leading-5 text-muted-foreground">
							{t("myCrewPage.filterSheet.sortLabel")}
						</p>
						<div className="w-full overflow-hidden rounded-lg bg-card">
							<SelectRow
								label={t("myCrewPage.filterSheet.sort.updatedAt")}
								selected={filter.sort === "updated_at"}
								onSelect={() => handleSortChange("updated_at")}
								dataTestId="my-crew-filter-sort-updated-at"
							/>
							<div className="h-px w-full bg-border" />
							<SelectRow
								label={t("myCrewPage.filterSheet.sort.createdAt")}
								selected={filter.sort === "created_at"}
								onSelect={() => handleSortChange("created_at")}
								dataTestId="my-crew-filter-sort-created-at"
							/>
						</div>
					</div>

					{/* Type filter section — always shows all three scope options including team shared */}
					<div
						className="flex flex-col gap-2"
						data-testid="my-crew-filter-type-section"
					>
						<p className="px-[14px] text-[14px] leading-5 text-muted-foreground">
							{t("myCrewPage.filterSheet.typeLabel")}
						</p>
						<div className="w-full overflow-hidden rounded-lg bg-card">
							<SelectRow
								label={t("myCrewPage.filterSheet.type.created")}
								selected={filter.type === "created"}
								onSelect={() => handleTypeChange("created")}
								dataTestId="my-crew-filter-type-created"
							/>
							<div className="h-px w-full bg-border" />
							<SelectRow
								label={t("myCrewPage.filterSheet.type.teamShared")}
								selected={filter.type === "teamShared"}
								onSelect={() => handleTypeChange("teamShared")}
								dataTestId="my-crew-filter-type-team-shared"
							/>
							<div className="h-px w-full bg-border" />
							<SelectRow
								label={t("myCrewPage.filterSheet.type.fromMarket")}
								selected={filter.type === "fromMarket"}
								onSelect={() => handleTypeChange("fromMarket")}
								dataTestId="my-crew-filter-type-from-market"
							/>
						</div>
					</div>
				</div>
			</SheetContent>
		</Sheet>
	)
}
