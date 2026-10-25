import type { ColumnDef } from "@tanstack/react-table"
import { AlertCircle } from "lucide-react"
import { useTranslation } from "react-i18next"
import { DataTable } from "@magic-admin-v2/components/data-table"
import { EmptyState } from "@magic-admin-v2/components/empty-state"
import { ListFilterPanel } from "@magic-admin-v2/components/list-filter-panel"
import { ListPagination } from "@magic-admin-v2/components/list-pagination"
import {
	type PublishReviewFilterDraft,
	type PublishReviewKind,
	type PublishReviewVariant,
} from "@magic-admin-v2/features/platform-publish-review/types"
import {
	createDefaultFilterDraft,
	type ReviewDraftUpdater,
} from "@magic-admin-v2/features/platform-publish-review/params"
import { AdvancedFilterControls } from "@magic-admin-v2/features/platform-publish-review/components/review-filters"
import type { ApiError } from "@magic-admin-v2/api/types"

export function ReviewListPanel<TData>({
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
	mobileFilterOpen,
	onMobileFilterOpenChange,
	queryError,
	total,
	variant,
}: {
	columns: Array<ColumnDef<TData>>
	data: TData[]
	emptyDescription: string
	emptyIcon: typeof AlertCircle
	emptyTitle: string
	filterDraft: PublishReviewFilterDraft
	isFetching: boolean
	kind: PublishReviewKind
	minWidth: number
	onDraftChange: (value: ReviewDraftUpdater) => void
	onPageChange: (page: number) => void
	onPageSizeChange: (pageSize: number) => void
	page: number
	pageSize: number
	mobileFilterOpen: boolean
	onMobileFilterOpenChange: (open: boolean) => void
	queryError: ApiError | null
	total: number
	variant: PublishReviewVariant
}) {
	const { t } = useTranslation()

	return (
		<div className="space-y-4">
			<ListFilterPanel
				desktopResetTestId="platform-publish-review-reset-button"
				mobileApplyTestId="platform-publish-review-apply-button"
				mobileBodyTestId="platform-publish-review-filter-body"
				mobileCloseButtonTestId="platform-publish-review-filter-close-button"
				mobileContentTestId="platform-publish-review-filter-sheet"
				mobileResetTestId="platform-publish-review-reset-button"
				applyLabel={t("publishReview.filter.apply")}
				createDefaultValue={() => createDefaultFilterDraft(kind, variant)}
				onChange={(patch) => onDraftChange((previous) => ({ ...previous, ...patch }))}
				onReset={() => onDraftChange(createDefaultFilterDraft(kind, variant))}
				mobileOpen={mobileFilterOpen}
				onMobileOpenChange={onMobileFilterOpenChange}
				showMobileTrigger={false}
				renderFields={(props) => (
					<AdvancedFilterControls {...props} kind={kind} variant={variant} />
				)}
				resetLabel={t("publishReview.action.reset")}
				title={t("publishReview.filter.title")}
				value={filterDraft}
			/>

			{queryError ? (
				<div className="rounded-lg border border-border/50 p-4">
					<EmptyState
						icon={AlertCircle}
						testId="platform-publish-review-error"
						title={t("publishReview.error.loadTitle")}
						description={queryError.message || t("publishReview.error.loadFailed")}
					/>
				</div>
			) : (
				<DataTable
					columns={columns}
					containerTestId="platform-publish-review-list"
					data={data}
					emptyState={
						<div className="p-4">
							<EmptyState
								icon={emptyIcon}
								testId="platform-publish-review-empty"
								title={emptyTitle}
								description={emptyDescription}
							/>
						</div>
					}
					getRowId={(item, index) =>
						typeof item === "object" && item !== null && "id" in item
							? String(item.id)
							: String(index)
					}
					isLoading={isFetching && data.length === 0}
					loadingTestId="platform-publish-review-loading"
					minWidth={minWidth}
					rowTestId="platform-publish-review-row"
					stickyRightColumnId="actions"
				/>
			)}

			{!queryError ? (
				<ListPagination
					showQuickJumper
					className="px-1"
					jumpInputTestId="publish-review-jump-input"
					loading={isFetching}
					nextButtonTestId="publish-review-next-button"
					onPageChange={onPageChange}
					onPageSizeChange={onPageSizeChange}
					page={page}
					pageSize={pageSize}
					pageSizeOptionTestId="publish-review-page-size-option"
					pageSizeTriggerTestId="publish-review-page-size-trigger"
					previousButtonTestId="publish-review-previous-button"
					testId="publish-review-pagination"
					total={total}
				/>
			) : null}
		</div>
	)
}
