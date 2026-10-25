import type { TFunction } from "i18next"
import type { ColumnDef } from "@tanstack/react-table"
import { Switch } from "@magic-admin-v2/components/ui/switch"
import {
	type MarketRecord,
	type MarketTableState,
} from "@magic-admin-v2/features/platform-official-marketplace/types"
import {
	PublishStatusBadge,
	PublisherTypeBadge,
} from "@magic-admin-v2/features/platform-official-marketplace/components/market-table-cells"
import { SortOrderCell } from "@magic-admin-v2/features/platform-official-marketplace/components/sort-order-cell"

/** Columns shared by both tabs; each panel prepends its own identity columns. */
export function createSharedMarketColumns<TRecord extends MarketRecord>({
	afterStatusColumns = [],
	t,
	tableState,
}: {
	afterStatusColumns?: Array<ColumnDef<TRecord>>
	t: TFunction
	tableState: MarketTableState<TRecord>
}): Array<ColumnDef<TRecord>> {
	return [
		{
			id: "publisher_type",
			size: 150,
			header: t("officialMarketplace.column.publisherType"),
			cell: ({ row }) => <PublisherTypeBadge value={row.original.publisher_type} />,
		},
		{
			id: "publish_status",
			size: 150,
			header: t("officialMarketplace.column.publishStatus"),
			cell: ({ row }) => <PublishStatusBadge value={row.original.publish_status} />,
		},
		...afterStatusColumns,
		{
			id: "is_featured",
			size: 130,
			header: t("officialMarketplace.column.isFeatured"),
			cell: ({ row }) => {
				const record = row.original
				const saving = tableState.featuredSavingIds.has(record.id)

				return (
					<Switch
						checked={Boolean(record.is_featured)}
						disabled={!tableState.canEdit}
						loading={saving}
						onCheckedChange={(checked) => tableState.saveFeatured(record, checked)}
					 data-testid="platform-official-marketplace-switch"/>
				)
			},
		},
		{
			id: "is_hidden",
			size: 130,
			header: t("officialMarketplace.column.isHidden"),
			cell: ({ row }) => {
				const record = row.original
				const saving = tableState.hiddenSavingIds.has(record.id)

				return (
					<Switch
						checked={Boolean(record.is_hidden)}
						disabled={!tableState.canEdit}
						loading={saving}
						onCheckedChange={(checked) => tableState.saveHidden(record, checked)}
					 data-testid="platform-official-marketplace-switch"/>
				)
			},
		},
		{
			id: "install_count",
			size: 130,
			header: t("officialMarketplace.column.installCount"),
			cell: ({ row }) => (
				<span className="whitespace-nowrap">{row.original.install_count ?? 0}</span>
			),
		},
		{
			id: "sort_order",
			size: 140,
			header: t("officialMarketplace.column.sortOrder"),
			cell: ({ row }) => (
				<SortOrderCell
					ariaLabel={t("officialMarketplace.column.sortOrder")}
					record={row.original}
					tableState={tableState}
				/>
			),
		},
		{
			id: "publisher",
			size: 150,
			header: t("officialMarketplace.column.publisher"),
			cell: ({ row }) => (
				<span className="truncate">{row.original.publisher?.nickname || "-"}</span>
			),
		},
		{
			id: "created_at",
			size: 180,
			header: t("officialMarketplace.column.createdAt"),
			cell: ({ row }) => (
				<span className="whitespace-nowrap text-muted-foreground">
					{row.original.created_at || "-"}
				</span>
			),
		},
		{
			id: "updated_at",
			size: 180,
			header: t("officialMarketplace.column.updatedAt"),
			cell: ({ row }) => (
				<span className="whitespace-nowrap text-muted-foreground">
					{row.original.updated_at || "-"}
				</span>
			),
		},
	]
}
