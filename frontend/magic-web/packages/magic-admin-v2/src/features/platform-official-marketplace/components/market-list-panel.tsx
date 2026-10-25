import type { ColumnDef } from "@tanstack/react-table"
import { AlertCircle, type LucideIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { ApiError } from "@magic-admin-v2/api/types"
import { DataTable } from "@magic-admin-v2/components/data-table"
import { EmptyState } from "@magic-admin-v2/components/empty-state"
import { ListPagination } from "@magic-admin-v2/components/list-pagination"
import { MarketFilters } from "@magic-admin-v2/features/platform-official-marketplace/components/market-filter-controls"
import {
	type MarketCategoryOption,
	type MarketDraftUpdater,
	type MarketFilterDraft,
	type MarketKind,
} from "@magic-admin-v2/features/platform-official-marketplace/types"

type MarketListPanelProps<TData> = {
	categoryOptions?: MarketCategoryOption[]
	categoryOptionsLoading?: boolean
	codeLabel: string
	codePlaceholder: string
	columns: Array<ColumnDef<TData>>
	data: TData[]
	emptyDescription: string
	emptyIcon: LucideIcon
	emptyTitle: string
	filterDraft: MarketFilterDraft
	isFetching: boolean
	kind: MarketKind
	minWidth: number
	onDraftChange: (value: MarketDraftUpdater) => void
	onPageChange: (page: number) => void
	onPageSizeChange: (pageSize: number) => void
	page: number
	pageSize: number
	queryError: ApiError | null
	showCategoryFilter?: boolean
	showPackageName: boolean
	mobileOpen?: boolean
	onMobileOpenChange?: (open: boolean) => void
	stickyLeftColumnId?: string
	total: number
}

/** Shared list frame; tab-specific queries and mutations stay in the owning panel. */
export function MarketListPanel<TData>({
	categoryOptions,
	categoryOptionsLoading,
	codeLabel,
	codePlaceholder,
	columns,
	data,
	emptyDescription,
	emptyIcon,
	emptyTitle,
	filterDraft,
	isFetching,
	kind,
	minWidth,
	onDraftChange,
	onPageChange,
	onPageSizeChange,
	page,
	pageSize,
	queryError,
	showCategoryFilter,
	showPackageName,
	mobileOpen,
	onMobileOpenChange,
	stickyLeftColumnId,
	total,
}: MarketListPanelProps<TData>) {
	const { t } = useTranslation()

	return (
		<div className="space-y-4">
			<MarketFilters
				categoryOptions={categoryOptions}
				categoryOptionsLoading={categoryOptionsLoading}
				codeLabel={codeLabel}
				codePlaceholder={codePlaceholder}
				filterDraft={filterDraft}
				kind={kind}
				onDraftChange={onDraftChange}
				showCategoryFilter={showCategoryFilter}
				showPackageName={showPackageName}
				mobileOpen={mobileOpen}
				onMobileOpenChange={onMobileOpenChange}
			/>

			{queryError ? (
				<div className="rounded-lg border border-border/50 p-4">
					<EmptyState
						icon={AlertCircle}
						title={t("officialMarketplace.error.loadTitle")}
						description={
							queryError.message || t("officialMarketplace.error.loadFailed")
						}
						testId="platform-official-marketplace-error"
					/>
				</div>
			) : (
				<DataTable
					columns={columns}
					data={data}
					emptyState={
						<div className="p-4">
							<EmptyState
								icon={emptyIcon}
								title={emptyTitle}
								description={emptyDescription}
								testId="platform-official-marketplace-empty"
							/>
						</div>
					}
					getRowId={(item, index) =>
						typeof item === "object" && item !== null && "id" in item
							? String(item.id)
							: String(index)
					}
					containerTestId="platform-official-marketplace-list"
					isLoading={isFetching && data.length === 0}
					loadingTestId="platform-official-marketplace-loading"
					minWidth={minWidth}
					rowTestId="platform-official-marketplace-row"
					stickyLeftColumnId={stickyLeftColumnId}
				/>
			)}

			{!queryError ? (
				<ListPagination
					showQuickJumper
					className="px-1"
					jumpInputTestId="official-marketplace-jump-input"
					loading={isFetching}
					nextButtonTestId="official-marketplace-next-button"
					onPageChange={onPageChange}
					onPageSizeChange={onPageSizeChange}
					page={page}
					pageSize={pageSize}
					pageSizeOptionTestId="official-marketplace-page-size-option"
					pageSizeTriggerTestId="official-marketplace-page-size-trigger"
					previousButtonTestId="official-marketplace-previous-button"
					testId="official-marketplace-pagination"
					total={total}
				/>
			) : null}
		</div>
	)
}
