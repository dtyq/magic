import type { TFunction } from "i18next"
import { RotateCcw, Search, Trash2 } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { Checkbox } from "@/components/shadcn-ui/checkbox"
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@/components/shadcn-ui/input-group"

interface RecycleBinToolbarProps {
	title: string
	searchValue: string
	hasSelection: boolean
	isAllSelected: boolean
	isPartiallySelected: boolean
	hasMixedSelectionTypes: boolean
	onToggleSelectAll: (checked: boolean) => void
	onCancelSelection: () => void
	onRestoreSelection: () => void
	onDeleteSelection: () => void
	onSearchChange: (value: string) => void
	onSearchReset: () => void
	t: TFunction
}

export function RecycleBinToolbar({
	title,
	searchValue,
	hasSelection,
	isAllSelected,
	isPartiallySelected,
	hasMixedSelectionTypes,
	onToggleSelectAll,
	onCancelSelection,
	onRestoreSelection,
	onDeleteSelection,
	onSearchChange,
	onSearchReset,
	t,
}: RecycleBinToolbarProps) {
	return (
		<>
			<div className="flex w-full items-stretch gap-3.5 rounded-[10px] bg-card px-3 py-2">
				<h2 className="text-lg font-medium leading-normal text-foreground">{title}</h2>
			</div>

			<div className="flex w-full items-center justify-between gap-[12px] rounded-[10px] bg-card px-3 py-2">
				<div className="flex items-center gap-2">
					<Checkbox
						id="select-all"
						data-testid="recycle-bin-select-all"
						checked={
							isAllSelected ? true : isPartiallySelected ? "indeterminate" : false
						}
						onCheckedChange={(checked) => onToggleSelectAll(checked === true)}
					/>
					<label
						htmlFor="select-all"
						className="cursor-pointer text-sm font-medium leading-none text-foreground"
					>
						{t("recycleBin.bulkActions.selectAll")}
					</label>
				</div>
				{hasSelection ? (
					<div className="flex items-center gap-[8px]">
						<Button
							variant="outline"
							size="default"
							className="h-9 rounded-lg px-4 shadow-sm"
							onClick={onCancelSelection}
							type="button"
							data-testid="recycle-bin-cancel-selection"
						>
							{t("recycleBin.bulkActions.cancelSelection")}
						</Button>
						<Button
							size="default"
							className="h-9 gap-[8px] rounded-lg px-4"
							onClick={onRestoreSelection}
							type="button"
							disabled={hasMixedSelectionTypes}
							data-testid="recycle-bin-restore-selection"
						>
							<RotateCcw className="size-4" />
							{t("recycleBin.bulkActions.restore")}
						</Button>
						<Button
							variant="destructive"
							size="default"
							className="h-9 gap-[8px] rounded-lg px-4"
							onClick={onDeleteSelection}
							type="button"
							data-testid="recycle-bin-delete-selection"
						>
							<Trash2 className="size-4" />
							{t("recycleBin.bulkActions.permanentDelete")}
						</Button>
					</div>
				) : (
					<div className="flex items-center gap-2">
						<InputGroup className="h-9 w-64 rounded-lg border border-border bg-background shadow-sm">
							<InputGroupAddon>
								<Search className="size-4" />
							</InputGroupAddon>
							<InputGroupInput
								placeholder={t("recycleBin.search.placeholder")}
								className="px-3 py-1 text-sm"
								value={searchValue}
								onChange={(event) => onSearchChange(event.target.value)}
								data-testid="recycle-bin-search-input"
							/>
						</InputGroup>
						<Button
							variant="outline"
							size="default"
							className="h-9 rounded-lg px-4 shadow-sm"
							onClick={onSearchReset}
							type="button"
							data-testid="recycle-bin-search-reset"
						>
							{t("recycleBin.search.reset")}
						</Button>
					</div>
				)}
			</div>
		</>
	)
}
