import { MoreHorizontal, Pencil, Tags, Trash2 } from "lucide-react"
import { forwardRef, useCallback, useImperativeHandle, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import type { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@magic-admin-v2/components/data-table"
import { EmptyState } from "@magic-admin-v2/components/empty-state"
import { FilterControlField } from "@magic-admin-v2/components/filter-control-field"
import { ListFilterPanel } from "@magic-admin-v2/components/list-filter-panel"
import { FilterSearchInput } from "@magic-admin-v2/components/filter-search-input"
import { ListPagination } from "@magic-admin-v2/components/list-pagination"
import { Button } from "@magic-admin-v2/components/ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@magic-admin-v2/components/ui/dropdown-menu"
import { Input } from "@magic-admin-v2/components/ui/input"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@magic-admin-v2/components/ui/select"
import { Switch } from "@magic-admin-v2/components/ui/switch"
import { useRuntime } from "@magic-admin-v2/runtime/context"
import type { ListQueryParamsState } from "@magic-admin-v2/hooks/use-list-query-params"
import { useSlidesTemplateCategoryMutations } from "@magic-admin-v2/features/platform-slides-template/mutations"
import { useSlidesTemplateCategoriesQuery } from "@magic-admin-v2/features/platform-slides-template/queries"
import { useRowPendingIds } from "@magic-admin-v2/features/platform-slides-template/hooks"
import {
	slidesTemplateStatus,
	type SlidesTemplateCategory,
	type SlidesTemplateCategoryQueryParams,
} from "@magic-admin-v2/features/platform-slides-template/types"
import {
	formatDateTime,
	resolveSlidesTemplateCategoryName,
	toStatus,
} from "@magic-admin-v2/features/platform-slides-template/utils"
import { CategoryDialog } from "@magic-admin-v2/features/platform-slides-template/components/category-dialog"
import { CopyableCode } from "@magic-admin-v2/features/platform-slides-template/components/copyable-code"

import {
	createDefaultCategoryFilterDraft,
	emptySlidesTemplateStatus,
	type CategoryFilterDraft,
} from "@magic-admin-v2/features/platform-slides-template/list-params"

type CategoryManagerProps = {
	canEdit: boolean
	mobileFilterOpen: boolean
	onDelete: (record: SlidesTemplateCategory) => void
	queryState: ListQueryParamsState<CategoryFilterDraft, SlidesTemplateCategoryQueryParams>
	onMobileFilterOpenChange: (open: boolean) => void
}

export type CategoryManagerHandle = {
	create: () => void
	reset: () => void
}

export const CategoryManager = forwardRef<CategoryManagerHandle, CategoryManagerProps>(
	function CategoryManager(
		{ canEdit, mobileFilterOpen, onDelete, onMobileFilterOpenChange, queryState },
		ref,
	) {
		const { t } = useTranslation()
		const { language } = useRuntime()
		const {
			filterDraft: filters,
			page,
			pageSize,
			params,
			setDebouncedField,
			setFilterDraft,
			setPage,
			setPageSize,
		} = queryState
		const [dialogOpen, setDialogOpen] = useState(false)
		const [editing, setEditing] = useState<SlidesTemplateCategory | null>(null)
		const query = useSlidesTemplateCategoriesQuery(params)
		const mutations = useSlidesTemplateCategoryMutations()
		const { pendingIds: statusPendingIds, run: runStatusPending } = useRowPendingIds()
		const { pendingIds: sortPendingIds, run: runSortPending } = useRowPendingIds()
		const create = useCallback(() => {
			if (!canEdit) return
			setEditing(null)
			setDialogOpen(true)
		}, [canEdit])

		const columns = useMemo<Array<ColumnDef<SlidesTemplateCategory>>>(
			() => [
				{
					accessorKey: "name",
					header: t("slidesTemplate.categoryName"),
					cell: ({ row }) => resolveSlidesTemplateCategoryName(row.original),
				},
				{
					accessorKey: "code",
					header: t("slidesTemplate.categoryCode"),
					cell: ({ row }) => <CopyableCode value={row.original.code} />,
				},
				{ accessorKey: "template_count", header: t("slidesTemplate.categoryCount") },
				{
					accessorKey: "status",
					header: t("slidesTemplate.status"),
					meta: { mobile: { kind: "control" } },
					cell: ({ row }) => (
						<Switch
							checked={row.original.status === slidesTemplateStatus.enabled}
							disabled={!canEdit}
							loading={statusPendingIds.has(row.original.id)}
							onCheckedChange={async (checked) => {
								try {
									await runStatusPending(row.original.id, () =>
										mutations.updateStatus.mutateAsync({
											id: row.original.id,
											status: toStatus(checked),
										}),
									)
								} catch (error) {
									toast.error(
										(error as { message?: string }).message ||
											t("common.requestFailed"),
									)
								}
							}}
							data-testid="platform-slides-template-switch"
						/>
					),
				},
				{
					accessorKey: "sort",
					header: t("slidesTemplate.sort"),
					cell: ({ row }) => (
						<Input
							className="h-8 w-20"
							defaultValue={row.original.sort}
							disabled={!canEdit || sortPendingIds.has(row.original.id)}
							key={`${row.original.id}-${row.original.sort}`}
							onBlur={async (event) => {
								const sort = Number(event.target.value)
								if (!Number.isFinite(sort) || sort === row.original.sort) return
								try {
									await runSortPending(row.original.id, () =>
										mutations.updateSort.mutateAsync({
											id: row.original.id,
											sort,
										}),
									)
								} catch (error) {
									toast.error(
										(error as { message?: string }).message ||
											t("common.requestFailed"),
									)
								}
							}}
							onKeyDown={(event) => {
								if (event.key === "Enter") event.currentTarget.blur()
							}}
							type="number"
							data-testid="platform-slides-template-input"
						/>
					),
				},
				{
					accessorKey: "updated_at",
					header: t("slidesTemplate.updatedAt"),
					cell: ({ row }) =>
						formatDateTime(
							row.original.updated_at,
							language === "en_US" ? "en-US" : "zh-CN",
						),
				},
				{
					id: "actions",
					header: t("slidesTemplate.actions"),
					enableSorting: false,
					meta: {
						fitContent: true,
					},
					cell: ({ row }) => (
						<div className="flex justify-end">
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										aria-label={t("slidesTemplate.actions")}
										size="icon"
										variant="ghost"
										data-testid="platform-slides-template-category-menu-trigger"
									>
										<MoreHorizontal className="size-4" aria-hidden="true" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									<DropdownMenuItem
										disabled={!canEdit}
										onSelect={() => {
											setEditing(row.original)
											setDialogOpen(true)
										}}
										data-testid="platform-slides-template-category-edit-item"
									>
										<Pencil className="mr-2 size-4" />
										{t("common.edit")}
									</DropdownMenuItem>
									<DropdownMenuSeparator />
									<DropdownMenuItem
										className="text-destructive focus:text-destructive"
										disabled={!canEdit}
										onSelect={() => onDelete(row.original)}
										data-testid="platform-slides-template-category-delete-item"
									>
										<Trash2 className="mr-2 size-4" />
										{t("common.delete")}
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					),
				},
			],
			[
				canEdit,
				language,
				mutations,
				onDelete,
				runSortPending,
				runStatusPending,
				sortPendingIds,
				statusPendingIds,
				t,
			],
		)
		const reset = useCallback(() => {
			setFilterDraft(createDefaultCategoryFilterDraft())
		}, [setFilterDraft])

		useImperativeHandle(ref, () => ({ create, reset }), [create, reset])

		return (
			<div className="space-y-4">
				<ListFilterPanel
					applyLabel={t("slidesTemplate.applyFilters")}
					mobileApplyTestId="platform-slides-template-apply-button"
					mobileBodyTestId="platform-slides-template-filter-body"
					mobileCloseButtonTestId="platform-slides-template-category-filter-close-button"
					mobileContentTestId="platform-slides-template-filter-sheet"
					mobileResetTestId="platform-slides-template-reset-button"
					createDefaultValue={createDefaultCategoryFilterDraft}
					mobileOpen={mobileFilterOpen}
					onMobileOpenChange={onMobileFilterOpenChange}
					showMobileTrigger={false}
					onApply={(draft) => setFilterDraft(draft)}
					onChange={(patch) => {
						if (patch.keyword !== undefined) setDebouncedField("keyword", patch.keyword)
						if (patch.code !== undefined) setDebouncedField("code", patch.code)
						if (patch.status !== undefined)
							setFilterDraft((previous) => ({ ...previous, status: patch.status! }))
					}}
					onReset={reset}
					renderFields={({ layout, onChange, value }) => (
						<>
							<FilterControlField label={t("slidesTemplate.keyword")}>
								<FilterSearchInput
									clearButtonTestId={
										layout === "sheet"
											? "platform-slides-template-advanced-search-clear-button"
											: "platform-slides-template-secondary-clear-button"
									}
									clearLabel={t("common.clear")}
									inputTestId={
										layout === "sheet"
											? "platform-slides-template-advanced-search-input"
											: "platform-slides-template-secondary-search-input"
									}
									onValueChange={(keyword) =>
										layout === "grid"
											? setDebouncedField("keyword", keyword)
											: onChange({ keyword })
									}
									placeholder={t("slidesTemplate.keyword")}
									value={value.keyword}
								/>
							</FilterControlField>
							<FilterControlField label={t("slidesTemplate.categoryCode")}>
								<FilterSearchInput
									clearButtonTestId={
										layout === "sheet"
											? "platform-slides-template-advanced-search-clear-button"
											: "platform-slides-template-tertiary-clear-button"
									}
									clearLabel={t("common.clear")}
									inputTestId={
										layout === "sheet"
											? "platform-slides-template-advanced-search-input"
											: "platform-slides-template-tertiary-search-input"
									}
									onValueChange={(code) =>
										layout === "grid"
											? setDebouncedField("code", code)
											: onChange({ code })
									}
									placeholder={t("slidesTemplate.categoryCode")}
									value={value.code}
								/>
							</FilterControlField>
							<FilterControlField label={t("slidesTemplate.status")}>
								<Select
									value={value.status}
									onValueChange={(status) => onChange({ status })}
								>
									<SelectTrigger
										className="w-full"
										data-testid="platform-slides-template-select-trigger"
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent data-testid="platform-slides-template-select-content">
										<SelectItem
											data-testid="platform-slides-template-option"
											value={emptySlidesTemplateStatus}
										>
											{t("slidesTemplate.all")}
										</SelectItem>
										<SelectItem
											data-testid="platform-slides-template-option"
											value="1"
										>
											{t("slidesTemplate.enabled")}
										</SelectItem>
										<SelectItem
											data-testid="platform-slides-template-option"
											value="0"
										>
											{t("slidesTemplate.disabled")}
										</SelectItem>
									</SelectContent>
								</Select>
							</FilterControlField>
						</>
					)}
					resetLabel={t("slidesTemplate.reset")}
					title={t("slidesTemplate.filterTitle")}
					value={filters}
				/>

				<div>
					<DataTable
						columns={columns}
						data={query.data?.list ?? []}
						emptyState={
							<EmptyState
								icon={Tags}
								title={t("slidesTemplate.emptyCategories")}
								testId="platform-slides-template-empty"
							/>
						}
						getRowId={(row) => row.id}
						isLoading={query.isLoading}
						minWidth={900}
						stickyRightColumnId="actions"
						containerTestId="platform-slides-template-list"
						loadingTestId="platform-slides-template-loading"
						rowTestId="platform-slides-template-row"
					/>
					<ListPagination
						previousButtonTestId="slides-template-category-previous-button"
						nextButtonTestId="slides-template-category-next-button"
						pageSizeTriggerTestId="slides-template-category-page-size-trigger"
						pageSizeOptionTestId="slides-template-category-page-size-option"
						jumpInputTestId="slides-template-category-jump-input"
						testId="slides-template-category-pagination"
						showQuickJumper
						loading={query.isFetching}
						onPageChange={setPage}
						onPageSizeChange={setPageSize}
						page={page}
						pageSize={pageSize}
						total={query.data?.total ?? 0}
					/>
				</div>
				<CategoryDialog
					editing={editing}
					mutations={mutations}
					onOpenChange={setDialogOpen}
					open={dialogOpen}
				/>
			</div>
		)
	},
)
