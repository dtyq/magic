import type { ColumnDef } from "@tanstack/react-table"
import type { ReactNode } from "react"
import { Sparkles, Tags, Upload } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import type { ApiError } from "@magic-admin-v2/api/types"
import { createSharedMarketColumns } from "@magic-admin-v2/features/platform-official-marketplace/components/market-columns"
import { MarketListPanel } from "@magic-admin-v2/features/platform-official-marketplace/components/market-list-panel"
import { MarketCategorySelectCell } from "@magic-admin-v2/features/platform-official-marketplace/components/market-category-select-cell"
import { CopyableValue } from "@magic-admin-v2/components/copyable-value"
import { Button } from "@magic-admin-v2/components/ui/button"
import { SkillMarketCategoryManagerDialog } from "@magic-admin-v2/features/platform-official-marketplace/components/skill-market-category-manager-dialog"
import { OfficialSkillImportDialog } from "@magic-admin-v2/features/platform-official-marketplace/components/official-skill-import-dialog"
import { type ListQueryParamsState } from "@magic-admin-v2/hooks/use-list-query-params"
import {
	DescriptionCell,
	MarketNameCell,
	OrganizationCell,
} from "@magic-admin-v2/features/platform-official-marketplace/components/market-table-cells"
import { useMarketTableState } from "@magic-admin-v2/features/platform-official-marketplace/hooks/use-market-table-state"
import {
	useUpdateSkillMarketCategoryRelationMutation,
	useUpdateSkillMarketInfoMutation,
} from "@magic-admin-v2/features/platform-official-marketplace/mutations"
import {
	useSkillMarketCategoryListQuery,
	useSkillMarketListQuery,
} from "@magic-admin-v2/features/platform-official-marketplace/queries"
import type {
	MarketFilterDraft,
	SkillMarketItem,
	SkillMarketListParams,
} from "@magic-admin-v2/features/platform-official-marketplace/types"
import {
	areSameCategoryIds,
	getSkillMarketCategoryIds,
	getSkillMarketCategoryLabels,
	getLocalizedText,
	normalizeCategoryIds,
	resolveSkillMarketCategoryName,
	skillMarketCategoryStatus,
} from "@magic-admin-v2/features/platform-official-marketplace/utils"
import { useI18n } from "@magic-admin-v2/i18n/use-i18n"

const emptySkillMarketItems: SkillMarketItem[] = []

type SkillMarketPanelProps = {
	canEdit: boolean
	isActive: boolean
	onFetchingChange: (isFetching: boolean) => void
	onInitialLoadingChange: (isLoading: boolean) => void
	queryState: ListQueryParamsState<MarketFilterDraft, SkillMarketListParams>
	onMobileFilterOpenChange: (open: boolean) => void
	mobileFilterOpen: boolean
	onToolbarActionsChange: (actions: ReactNode) => void
	refreshToken: number
}

/** Skill-market tab; it shares list mechanics while retaining its own query and columns. */
export function SkillMarketPanel({
	canEdit,
	isActive,
	onFetchingChange,
	onInitialLoadingChange,
	queryState,
	onMobileFilterOpenChange,
	mobileFilterOpen,
	onToolbarActionsChange,
	refreshToken,
}: SkillMarketPanelProps) {
	const { t } = useTranslation()
	const { language } = useI18n()
	const [categoryManagerOpen, setCategoryManagerOpen] = useState(false)
	const [importOpen, setImportOpen] = useState(false)
	const { filterDraft, page, pageSize, params, setFilterDraft, setPage, setPageSize } = queryState
	const query = useSkillMarketListQuery(params, isActive)
	const categoryQuery = useSkillMarketCategoryListQuery({}, isActive)
	const importCategoryQuery = useSkillMarketCategoryListQuery(
		{ status: skillMarketCategoryStatus.visible },
		importOpen,
	)
	const items = query.data?.list ?? emptySkillMarketItems
	const isInitialLoading = query.isLoading && !query.data
	const refetch = query.refetch
	const updateMutation = useUpdateSkillMarketInfoMutation()
	const categoryOptions = useMemo(() => {
		const optionMap = new Map<string, { label: string; value: string }>()
		;(categoryQuery.data?.list ?? []).forEach((category) =>
			optionMap.set(category.id, {
				label: resolveSkillMarketCategoryName(category, language),
				value: category.id,
			}),
		)
		items.forEach((item) =>
			item.categories?.forEach((category) =>
				optionMap.set(category.id, {
					label: resolveSkillMarketCategoryName(category, language),
					value: category.id,
				}),
			),
		)
		return Array.from(optionMap.values())
	}, [categoryQuery.data?.list, items, language])
	const [categorySavingIds, setCategorySavingIds] = useState<Set<string>>(new Set())
	const updateCategoryMutation = useUpdateSkillMarketCategoryRelationMutation()

	const saveCategories = useCallback(
		async (record: SkillMarketItem, nextCategoryIds: string[]) => {
			if (!canEdit) return
			const categoryIds = normalizeCategoryIds(nextCategoryIds)
			if (areSameCategoryIds(getSkillMarketCategoryIds(record), categoryIds)) return

			setCategorySavingIds((previous) => new Set(previous).add(record.id))
			try {
				await updateCategoryMutation.mutateAsync({ id: record.id, categoryIds })
				toast.success(t("officialMarketplace.message.updateSuccess"))
			} catch (error) {
				toast.error(
					(error as { message?: string } | null)?.message ||
						t("officialMarketplace.error.updateFailed"),
				)
			} finally {
				setCategorySavingIds((previous) => {
					const next = new Set(previous)
					next.delete(record.id)
					return next
				})
			}
		},
		[canEdit, t, updateCategoryMutation],
	)
	const tableState = useMarketTableState<SkillMarketItem>({
		canEdit,
		updateMarketInfo: ({ id, values }) => updateMutation.mutateAsync({ id, values }),
	})

	const columns = useMemo<Array<ColumnDef<SkillMarketItem>>>(
		() => [
			{
				id: "name",
				size: 280,
				header: t("officialMarketplace.column.skillName"),
				cell: ({ row }) => (
					<MarketNameCell
						imageUrl={row.original.logo ?? undefined}
						name={getLocalizedText(row.original.name_i18n, language)}
						secondaryCopyLabel={t("officialMarketplace.action.copyPackageName")}
						secondaryLabel={t("officialMarketplace.column.packageName")}
						secondaryValue={row.original.package_name}
						fallbackIcon={<Sparkles className="size-4" aria-hidden="true" />}
					/>
				),
			},
			{
				id: "skill_code",
				size: 280,
				header: t("officialMarketplace.column.skillCode"),
				cell: ({ row }) => (
					<CopyableValue
						className="h-10 min-w-0 w-full max-w-full items-center font-sans text-sm text-muted-foreground md:w-auto"
						contentClassName="min-w-0 max-w-full"
						copyLabel={t("officialMarketplace.action.copySkillCode")}
						value={row.original.skill_code}
					/>
				),
			},
			{
				id: "organization",
				size: 240,
				header: t("officialMarketplace.column.organization"),
				cell: ({ row }) => (
					<OrganizationCell
						name={row.original.organization?.name}
						code={row.original.organization_code}
					/>
				),
			},
			{
				id: "description",
				size: 260,
				header: t("officialMarketplace.column.description"),
				cell: ({ row }) => (
					<DescriptionCell
						value={getLocalizedText(row.original.description_i18n, language)}
					/>
				),
			},
			{
				id: "category",
				size: 280,
				header: t("officialMarketplace.column.category"),
				cell: ({ row }) => {
					const record = row.original
					const saving = categorySavingIds.has(record.id)

					return (
						<MarketCategorySelectCell
							ariaLabel={t("officialMarketplace.column.category")}
							canEdit={canEdit}
							categoryIds={getSkillMarketCategoryIds(record)}
							categoryLabels={getSkillMarketCategoryLabels(
								record,
								categoryOptions,
								language,
							)}
							categoryOptions={categoryOptions}
							clearLabel={t("officialMarketplace.filter.clearCategories")}
							emptyLabel={t("officialMarketplace.filter.uncategorized")}
							isLoading={categoryQuery.isLoading}
							isSaving={saving}
							noMatchingLabel={t("officialMarketplace.filter.noMatchingCategories")}
							onSave={(nextCategoryIds) => saveCategories(record, nextCategoryIds)}
							searchPlaceholder={t("officialMarketplace.filter.searchCategories")}
							selectedCountLabel={(count) =>
								t("officialMarketplace.filter.selectedCategoryCount", { count })
							}
						/>
					)
				},
			},
			...createSharedMarketColumns<SkillMarketItem>({ t, tableState }),
		],
		[
			canEdit,
			categoryOptions,
			categoryQuery.isLoading,
			categorySavingIds,
			language,
			saveCategories,
			t,
			tableState,
		],
	)

	const refetchCategories = categoryQuery.refetch

	useEffect(() => {
		if (isActive) onInitialLoadingChange(isInitialLoading)
	}, [isActive, isInitialLoading, onInitialLoadingChange])

	useEffect(() => {
		if (!isActive) return

		onToolbarActionsChange(
			<div className="flex items-center gap-2">
				<Button
					aria-label={t("officialMarketplace.skillCategory.manageTitle")}
					className="h-9 w-9 px-0 md:w-auto md:px-3"
					onClick={() => setCategoryManagerOpen(true)}
					variant="outline"
				>
					<Tags className="size-4" aria-hidden="true" />
					<span className="hidden md:inline">
						{t("officialMarketplace.skillCategory.manageButton")}
					</span>
				</Button>
				{canEdit ? (
					<Button
						data-testid="platform-official-marketplace-edit-button"
						onClick={() => setImportOpen(true)}
					>
						<Upload className="size-4" aria-hidden="true" />
						<span className="hidden md:inline">
							{t("officialMarketplace.skillImport.openButton")}
						</span>
					</Button>
				) : null}
			</div>,
		)
	}, [canEdit, isActive, onToolbarActionsChange, t])

	useEffect(() => {
		if (isActive) onFetchingChange(query.isFetching)
	}, [isActive, onFetchingChange, query.isFetching])

	useEffect(() => {
		if (isActive && refreshToken > 0) {
			void Promise.all([refetch(), refetchCategories()])
		}
	}, [isActive, refetch, refetchCategories, refreshToken])

	return (
		<>
			<MarketListPanel
				categoryOptions={categoryOptions}
				categoryOptionsLoading={categoryQuery.isLoading}
				codeLabel={t("officialMarketplace.filter.skillCode")}
				codePlaceholder={t("officialMarketplace.placeholder.skillCode")}
				columns={columns}
				data={items}
				emptyDescription={t("officialMarketplace.empty.skillDescription")}
				emptyIcon={Sparkles}
				emptyTitle={t("officialMarketplace.empty.skillTitle")}
				filterDraft={filterDraft}
				isFetching={query.isFetching}
				kind="skill"
				minWidth={1920}
				onDraftChange={setFilterDraft}
				mobileOpen={isActive && mobileFilterOpen}
				onMobileOpenChange={onMobileFilterOpenChange}
				queryError={query.error as ApiError | null}
				showPackageName
				showCategoryFilter
				stickyLeftColumnId="name"
				total={query.data?.total ?? 0}
				page={page}
				onPageChange={setPage}
				onPageSizeChange={setPageSize}
				pageSize={pageSize}
			/>
			<SkillMarketCategoryManagerDialog
				canEdit={canEdit}
				onOpenChange={setCategoryManagerOpen}
				open={categoryManagerOpen}
			/>
			<OfficialSkillImportDialog
				categories={importCategoryQuery.data?.list ?? []}
				categoriesLoading={importCategoryQuery.isLoading}
				onCancel={() => setImportOpen(false)}
				onSuccess={async () => {
					await Promise.all([refetch(), refetchCategories()])
				}}
				open={importOpen}
			/>
		</>
	)
}
