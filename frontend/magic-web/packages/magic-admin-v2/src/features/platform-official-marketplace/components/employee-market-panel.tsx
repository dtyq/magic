import type { ColumnDef } from "@tanstack/react-table"
import type { ReactNode } from "react"
import { Bot, Tags } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import type { ApiError } from "@magic-admin-v2/api/types"
import { Button } from "@magic-admin-v2/components/ui/button"
import { type ListQueryParamsState } from "@magic-admin-v2/hooks/use-list-query-params"
import { AgentMarketCategoryManagerDialog } from "@magic-admin-v2/features/platform-official-marketplace/components/agent-market-category-manager-dialog"
import { createSharedMarketColumns } from "@magic-admin-v2/features/platform-official-marketplace/components/market-columns"
import { MarketListPanel } from "@magic-admin-v2/features/platform-official-marketplace/components/market-list-panel"
import { MarketCategorySelectCell } from "@magic-admin-v2/features/platform-official-marketplace/components/market-category-select-cell"
import {
	EmployeeRoleDescriptionCell,
	MarketNameCell,
	OrganizationCell,
} from "@magic-admin-v2/features/platform-official-marketplace/components/market-table-cells"
import { useMarketTableState } from "@magic-admin-v2/features/platform-official-marketplace/hooks/use-market-table-state"
import {
	useUpdateAgentMarketCategoryRelationMutation,
	useUpdateAgentMarketInfoMutation,
} from "@magic-admin-v2/features/platform-official-marketplace/mutations"
import {
	useAgentMarketCategoryListQuery,
	useAgentMarketListQuery,
} from "@magic-admin-v2/features/platform-official-marketplace/queries"
import type {
	AgentMarketCategoryItem,
	AgentMarketItem,
	AgentMarketListParams,
	MarketCategoryOption,
	MarketFilterDraft,
} from "@magic-admin-v2/features/platform-official-marketplace/types"
import {
	areSameCategoryIds,
	getAgentMarketCategoryIds,
	getAgentMarketCategoryLabels,
	getApiErrorMessage,
	getLocalizedRoles,
	getLocalizedText,
	normalizeCategoryIds,
} from "@magic-admin-v2/features/platform-official-marketplace/utils"
import { useI18n } from "@magic-admin-v2/i18n/use-i18n"

const emptyAgentMarketCategories: AgentMarketCategoryItem[] = []
const emptyAgentMarketItems: AgentMarketItem[] = []

type EmployeeMarketPanelProps = {
	canEdit: boolean
	isActive: boolean
	onFetchingChange: (isFetching: boolean) => void
	onInitialLoadingChange: (isLoading: boolean) => void
	queryState: ListQueryParamsState<MarketFilterDraft, AgentMarketListParams>
	onMobileFilterOpenChange: (open: boolean) => void
	mobileFilterOpen: boolean
	onToolbarActionsChange: (actions: ReactNode) => void
	refreshToken: number
}

/** Employee-market tab, including its category-specific query and mutation flow. */
export function EmployeeMarketPanel({
	canEdit,
	isActive,
	onFetchingChange,
	onInitialLoadingChange,
	queryState,
	onMobileFilterOpenChange,
	mobileFilterOpen,
	onToolbarActionsChange,
	refreshToken,
}: EmployeeMarketPanelProps) {
	const { t } = useTranslation()
	const { language } = useI18n()
	const [categoryManagerOpen, setCategoryManagerOpen] = useState(false)
	const { filterDraft, page, pageSize, params, setFilterDraft, setPage, setPageSize } = queryState
	const query = useAgentMarketListQuery(params, isActive)
	const categoryQuery = useAgentMarketCategoryListQuery({}, isActive)
	const items = query.data?.list ?? emptyAgentMarketItems
	const categories = categoryQuery.data?.list ?? emptyAgentMarketCategories
	const isInitialLoading = query.isLoading && !query.data
	const refetch = query.refetch
	const refetchCategories = categoryQuery.refetch
	const updateMutation = useUpdateAgentMarketInfoMutation()
	const updateCategoryMutation = useUpdateAgentMarketCategoryRelationMutation()
	const [categorySavingIds, setCategorySavingIds] = useState<Set<string>>(new Set())
	const tableState = useMarketTableState<AgentMarketItem>({
		canEdit,
		updateMarketInfo: ({ id, values }) => updateMutation.mutateAsync({ id, values }),
	})
	const categoryOptions = useMemo<MarketCategoryOption[]>(() => {
		// Include category objects embedded in rows so historical data remains displayable.
		const optionMap = new Map<string, MarketCategoryOption>()
		const addCategory = (category: AgentMarketCategoryItem) => {
			optionMap.set(category.id, {
				label: getLocalizedText(category.name_i18n, language),
				value: category.id,
			})
		}

		categories.forEach(addCategory)
		items.forEach((item) => {
			item.categories?.forEach(addCategory)
			if (item.category) addCategory(item.category)
		})

		return Array.from(optionMap.values())
	}, [categories, items, language])
	const updateCategoryRelation = updateCategoryMutation.mutateAsync

	const saveCategories = useCallback(
		async (record: AgentMarketItem, nextCategoryIds: string[]) => {
			if (!canEdit) return

			const categoryIds = normalizeCategoryIds(nextCategoryIds)
			if (areSameCategoryIds(getAgentMarketCategoryIds(record), categoryIds)) return

			setCategorySavingIds((previous) => new Set(previous).add(record.id))

			try {
				await updateCategoryRelation({ id: record.id, categoryIds })
				toast.success(t("officialMarketplace.message.updateSuccess"))
			} catch (error) {
				toast.error(getApiErrorMessage(error, t("officialMarketplace.error.updateFailed")))
			} finally {
				setCategorySavingIds((previous) => {
					const next = new Set(previous)
					next.delete(record.id)
					return next
				})
			}
		},
		[canEdit, t, updateCategoryRelation],
	)

	const columns = useMemo<Array<ColumnDef<AgentMarketItem>>>(
		() => [
			{
				id: "name",
				size: 280,
				header: t("officialMarketplace.column.employeeName"),
				cell: ({ row }) => (
					<MarketNameCell
						name={getLocalizedText(row.original.name_i18n, language)}
						fallbackIcon={<Bot className="size-4" aria-hidden="true" />}
						secondaryCopyLabel={t("officialMarketplace.action.copyEmployeeCode")}
						secondaryLabel={t("officialMarketplace.column.employeeCode")}
						secondaryValue={row.original.agent_code}
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
				id: "role_description",
				size: 380,
				header: t("officialMarketplace.column.roleAndDescription"),
				cell: ({ row }) => (
					<EmployeeRoleDescriptionCell
						description={getLocalizedText(row.original.description_i18n, language)}
						role={getLocalizedRoles(row.original.role_i18n, language)}
					/>
				),
			},
			...createSharedMarketColumns<AgentMarketItem>({
				afterStatusColumns: [
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
									disabled={!canEdit || saving}
									categoryIds={getAgentMarketCategoryIds(record)}
									categoryLabels={getAgentMarketCategoryLabels(
										record,
										categoryOptions,
										language,
									)}
									categoryOptions={categoryOptions}
									clearLabel={t("officialMarketplace.filter.clearCategories")}
									emptyLabel={t("officialMarketplace.filter.uncategorized")}
									isLoading={categoryQuery.isLoading}
									isSaving={saving}
									noMatchingLabel={t(
										"officialMarketplace.filter.noMatchingCategories",
									)}
									onSave={(nextCategoryIds) =>
										saveCategories(record, nextCategoryIds)
									}
									searchPlaceholder={t(
										"officialMarketplace.filter.searchCategories",
									)}
									selectedCountLabel={(count) =>
										t("officialMarketplace.filter.selectedCategoryCount", {
											count,
										})
									}
								/>
							)
						},
					},
				],
				t,
				tableState,
			}),
		],
		[
			categoryOptions,
			categoryQuery.isLoading,
			categorySavingIds,
			canEdit,
			language,
			saveCategories,
			t,
			tableState,
		],
	)

	useEffect(() => {
		if (isActive) onInitialLoadingChange(isInitialLoading)
	}, [isActive, isInitialLoading, onInitialLoadingChange])

	useEffect(() => {
		if (!isActive) return

		onToolbarActionsChange(
			<Button
				aria-label={t("officialMarketplace.category.manageTitle")}
				className="h-9 w-9 px-0 md:w-auto md:px-3"
				data-testid="platform-official-marketplace-edit-button"
				onClick={() => setCategoryManagerOpen(true)}
				variant="outline"
			>
				<Tags className="size-4" aria-hidden="true" />
				<span className="hidden md:inline">
					{t("officialMarketplace.category.manageButton")}
				</span>
			</Button>,
		)
	}, [isActive, onToolbarActionsChange, t])

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
				codeLabel={t("officialMarketplace.filter.employeeCode")}
				codePlaceholder={t("officialMarketplace.placeholder.employeeCode")}
				columns={columns}
				data={items}
				emptyDescription={t("officialMarketplace.empty.employeeDescription")}
				emptyIcon={Bot}
				emptyTitle={t("officialMarketplace.empty.employeeTitle")}
				filterDraft={filterDraft}
				isFetching={query.isFetching}
				kind="employee"
				minWidth={2480}
				onDraftChange={setFilterDraft}
				mobileOpen={isActive && mobileFilterOpen}
				onMobileOpenChange={onMobileFilterOpenChange}
				onPageChange={setPage}
				page={page}
				queryError={query.error as ApiError | null}
				onPageSizeChange={setPageSize}
				pageSize={pageSize}
				showCategoryFilter
				showPackageName={false}
				stickyLeftColumnId="name"
				total={query.data?.total ?? 0}
			/>

			{categoryManagerOpen ? (
				<AgentMarketCategoryManagerDialog
					canEdit={canEdit}
					onOpenChange={setCategoryManagerOpen}
					open={categoryManagerOpen}
				/>
			) : null}
		</>
	)
}
