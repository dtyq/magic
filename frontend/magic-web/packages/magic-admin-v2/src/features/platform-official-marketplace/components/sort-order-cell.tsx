import { Loader2 } from "lucide-react"
import { Input } from "@magic-admin-v2/components/ui/input"
import type {
	MarketRecord,
	MarketTableState,
} from "@magic-admin-v2/features/platform-official-marketplace/types"

export function SortOrderCell<TRecord extends MarketRecord>({
	ariaLabel,
	record,
	tableState,
}: {
	ariaLabel: string
	record: TRecord
	tableState: MarketTableState<TRecord>
}) {
	const isSaving = tableState.sortSavingIds.has(record.id)

	return (
		<div className="flex items-center gap-2 whitespace-nowrap">
			<Input
				aria-label={ariaLabel}
				className="h-8 w-24"
				defaultValue={record.sort_order ?? 0}
				disabled={!tableState.canEdit || isSaving}
				key={`${record.id}-${record.sort_order ?? 0}`}
				min={0}
				onBlur={(event) =>
					void tableState.updateSortOrder(record, Number(event.target.value || 0))
				}
				data-testid="platform-official-marketplace-input"
				onKeyDown={(event) => {
					if (event.key === "Enter") event.currentTarget.blur()
				}}
				type="number"/>
			{isSaving ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
		</div>
	)
}
