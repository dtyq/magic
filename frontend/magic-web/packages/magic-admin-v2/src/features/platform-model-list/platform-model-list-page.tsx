import type { ColumnDef } from "@tanstack/react-table"
import { AlertCircle, BrainCircuit, Eye, Pencil, Plus, RefreshCw } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { DataTable } from "@magic-admin-v2/components/data-table"
import { EmptyState } from "@magic-admin-v2/components/empty-state"
import { ListPagination } from "@magic-admin-v2/components/list-pagination"
import { ListShell } from "@magic-admin-v2/components/list-shell"
import { PageHeaderActionButton } from "@magic-admin-v2/components/page-header-action-button"
import { PageHeaderFilterButton } from "@magic-admin-v2/components/page-header-filter-button"
import { EntityAvatarRender } from "@magic-admin-v2/components/entity-avatar-render"
import { CopyableValue } from "@magic-admin-v2/components/copyable-value"
import { Badge } from "@magic-admin-v2/components/ui/badge"
import { Button } from "@magic-admin-v2/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@magic-admin-v2/components/ui/tabs"
import { useProviderModelDataSource } from "@magic-admin-v2/features/platform-model-list/utils/data-source"
import { ModelEditorDialog } from "@magic-admin-v2/features/platform-model-list/components/model-editor-dialog"
import { DefaultModelIcon } from "@magic-admin-v2/features/platform-model-list/components/default-model-icon"
import { ModelListFilters } from "@magic-admin-v2/features/platform-model-list/components/model-list-filters"
import {
	CategoryBadge,
	ModelDetailDialog,
	ModelTypeBadge,
} from "@magic-admin-v2/features/platform-model-list/components/model-detail-dialog"
import {
	getAccessibleProviderModelCategories,
	getEditableProviderModelCategories,
	getProviderModelAccessCategory,
	getProviderModelCategoryAccess,
} from "@magic-admin-v2/features/platform-model-list/utils/permissions"
import { useProviderModelGroupsQuery } from "@magic-admin-v2/features/platform-model-list/queries"
import {
	providerModelCategory,
	providerModelListSearchParam,
	providerModelType,
	type ProviderModelCategory,
	type ProviderModelGroup,
	type ProviderModelType,
} from "@magic-admin-v2/features/platform-model-list/types"
import {
	allCategoriesTab,
	createDefaultFilterDraft,
	type FilterOption,
	getCreateModelDefaults,
	type ModelCategoryTab,
	type ModelListFilterDraft,
	modelTypesByCategory,
	getModelListFilterActiveCount,
	resolveModelCategoryTab,
	restrictQueryParamsToAccess,
	toQueryParams,
} from "@magic-admin-v2/features/platform-model-list/utils/model-list"
import { useTranslation } from "react-i18next"
import type { ApiError } from "@magic-admin-v2/api/types"
import { useRuntime } from "@magic-admin-v2/runtime/context"
import { cn } from "@magic-admin-v2/utils/cn"
import { useListQueryParams } from "@magic-admin-v2/hooks/use-list-query-params"

export default function PlatformModelListPage() {
	const { t } = useTranslation()
	const { access } = useRuntime()
	const dataSource = useProviderModelDataSource()
	const categoryAccess = useMemo(
		() => getProviderModelCategoryAccess(access, dataSource.permissionScope),
		[access, dataSource.permissionScope],
	)
	const accessibleCategories = useMemo(
		() => getAccessibleProviderModelCategories(categoryAccess),
		[categoryAccess],
	)
	const editableCategories = useMemo(
		() => getEditableProviderModelCategories(categoryAccess),
		[categoryAccess],
	)
	const [searchParams] = useSearchParams()
	const serviceProviderConfigId =
		searchParams.get(providerModelListSearchParam.serviceProviderConfigId)?.trim() ?? ""
	const [activeCategory, setActiveCategory] = useState<ModelCategoryTab>(allCategoriesTab)
	const resolvedActiveCategory = resolveModelCategoryTab(activeCategory, accessibleCategories)
	const toParams = useCallback(
		(draft: ModelListFilterDraft, nextPage: number, currentPageSize: number) =>
			toQueryParams(
				draft,
				resolvedActiveCategory,
				accessibleCategories,
				nextPage,
				serviceProviderConfigId,
				currentPageSize,
			),
		[accessibleCategories, resolvedActiveCategory, serviceProviderConfigId],
	)
	const {
		filterDraft,
		pageSize: currentPageSize,
		params,
		setFilterDraft,
		setPage,
		setPageSize,
	} = useListQueryParams({
		debounceFields: ["keyword"],
		extraResetKey: `${resolvedActiveCategory}:${serviceProviderConfigId}`,
		initialDraft: createDefaultFilterDraft,
		toParams,
	})
	const [mobileFilterOpen, setMobileFilterOpen] = useState(false)
	const activeFilterCount = getModelListFilterActiveCount(filterDraft)
	const [detailTarget, setDetailTarget] = useState<ProviderModelGroup | null>(null)
	const [editorTarget, setEditorTarget] = useState<ProviderModelGroup | null>(null)
	const [isEditorOpen, setIsEditorOpen] = useState(false)
	const hasViewAccess = accessibleCategories.length > 0
	const permissionSafeParams = useMemo(
		() => restrictQueryParamsToAccess(params, accessibleCategories),
		[accessibleCategories, params],
	)
	const listQuery = useProviderModelGroupsQuery(permissionSafeParams, {
		enabled: hasViewAccess,
	})
	const queryError = listQuery.error as ApiError | null
	const items = listQuery.data?.list ?? []
	const total = listQuery.data?.total ?? 0
	const currentPage = listQuery.data?.page ?? permissionSafeParams.page
	const createModelDefaults = getCreateModelDefaults(resolvedActiveCategory, editableCategories)
	const canCreateModel =
		resolvedActiveCategory === allCategoriesTab
			? editableCategories.length > 0
			: categoryAccess[resolvedActiveCategory].canEdit
	const accessibleModelTypes = useMemo(
		() => accessibleCategories.flatMap((category) => modelTypesByCategory[category]),
		[accessibleCategories],
	)

	const allModelTypeOptions = useMemo<Array<FilterOption<ProviderModelType>>>(
		() => [
			{ value: providerModelType.textToImage, label: t("modelList.type.textToImage") },
			{ value: providerModelType.imageToImage, label: t("modelList.type.imageToImage") },
			{
				value: providerModelType.imageEnhancement,
				label: t("modelList.type.imageEnhancement"),
			},
			{
				value: providerModelType.largeLanguageModel,
				label: t("modelList.type.largeLanguageModel"),
			},
			{ value: providerModelType.embedding, label: t("modelList.type.embedding") },
			{ value: providerModelType.textToVideo, label: t("modelList.type.textToVideo") },
		],
		[t],
	)
	const modelTypeOptions = useMemo(
		() =>
			resolvedActiveCategory === allCategoriesTab
				? allModelTypeOptions.filter((option) =>
						accessibleModelTypes.includes(option.value),
					)
				: allModelTypeOptions.filter((option) =>
						modelTypesByCategory[resolvedActiveCategory].includes(option.value),
					),
		[accessibleModelTypes, allModelTypeOptions, resolvedActiveCategory],
	)
	const shouldShowModelTypeFilter = useMemo(
		() =>
			resolvedActiveCategory !== providerModelCategory.llm &&
			resolvedActiveCategory !== providerModelCategory.embedding &&
			resolvedActiveCategory !== providerModelCategory.vgm,
		[resolvedActiveCategory],
	)

	const columns = useMemo<Array<ColumnDef<ProviderModelGroup>>>(
		() => [
			{
				id: "model",
				enableSorting: false,
				size: 360,
				header: t("modelList.column.model"),
				cell: ({ row }) => <ModelCell item={row.original} />,
			},
			{
				accessorKey: "category",
				enableSorting: false,
				size: 140,
				header: t("modelList.column.category"),
				cell: ({ row }) => <CategoryBadge value={row.original.category} />,
			},
			{
				accessorKey: "model_type",
				enableSorting: false,
				size: 150,
				header: t("modelList.column.modelType"),
				cell: ({ row }) => <ModelTypeBadge value={row.original.model_type} />,
			},
			{
				accessorKey: "provider_count",
				enableSorting: false,
				size: 180,
				header: t("modelList.column.providers"),
				cell: ({ row }) => (
					<Badge variant="secondary">
						{t("modelList.providerCount", { count: row.original.provider_count })}
					</Badge>
				),
			},
			{
				id: "actions",
				enableSorting: false,
				size: 196,
				meta: { fitContent: true },
				header: t("modelList.column.actions"),
				cell: ({ row }) => {
					const rowCanEdit =
						categoryAccess[getProviderModelAccessCategory(row.original)].canEdit

					return (
						<div className="flex justify-end">
							<div className="flex items-center gap-2">
								<Button
									className="whitespace-nowrap md:w-auto md:gap-1.5 md:px-2.5"
									data-testid="model-list-view-button"
									onClick={() => setDetailTarget(row.original)}
									size="icon-sm"
									variant="outline"
								>
									<Eye className="size-4" aria-hidden="true" />
									<span className="hidden md:inline">
										{t("modelList.action.viewDetails")}
									</span>
								</Button>
								{rowCanEdit ? (
									<Button
										className="whitespace-nowrap md:w-auto md:gap-1.5 md:px-2.5"
										data-testid="model-list-edit-button"
										onClick={() => {
											setEditorTarget(row.original)
											setIsEditorOpen(true)
										}}
										size="icon-sm"
										variant="outline"
									>
										<Pencil className="size-4" aria-hidden="true" />
										<span className="hidden md:inline">
											{t("modelList.action.edit")}
										</span>
									</Button>
								) : null}
							</div>
						</div>
					)
				},
			},
		],
		[categoryAccess, t],
	)

	useEffect(() => {
		if (activeCategory !== resolvedActiveCategory) {
			setActiveCategory(resolvedActiveCategory)
		}
	}, [activeCategory, resolvedActiveCategory])

	useEffect(() => {
		setFilterDraft((previous) => {
			const modelTypes = previous.modelTypes.filter((modelType) =>
				accessibleModelTypes.includes(modelType),
			)
			return modelTypes.length === previous.modelTypes.length
				? previous
				: { ...previous, modelTypes }
		})
	}, [accessibleModelTypes, setFilterDraft])

	useEffect(() => {
		if (!isEditorOpen) {
			return
		}

		const canContinueEditing = editorTarget
			? categoryAccess[getProviderModelAccessCategory(editorTarget)].canEdit
			: editableCategories.length > 0
		if (!canContinueEditing) {
			setIsEditorOpen(false)
			setEditorTarget(null)
		}
	}, [categoryAccess, editableCategories.length, editorTarget, isEditorOpen])

	function handleCategoryChange(nextCategory: ModelCategoryTab) {
		if (nextCategory !== allCategoriesTab && !accessibleCategories.includes(nextCategory)) {
			return
		}

		setActiveCategory(nextCategory)
		setFilterDraft((previous) => {
			if (nextCategory === allCategoriesTab) {
				return previous
			}

			const allowedModelTypes = modelTypesByCategory[nextCategory]
			const modelTypes = previous.modelTypes.filter((modelType) =>
				allowedModelTypes.includes(modelType),
			)
			return modelTypes.length === previous.modelTypes.length
				? previous
				: { ...previous, modelTypes }
		})
	}

	return (
		<>
			<ListShell
				testId="model-list-page"
				actions={
					<div className="flex items-center gap-2">
						<PageHeaderFilterButton
							data-testid="model-list-advanced-trigger"
							count={activeFilterCount}
							label={t("modelList.filter.title")}
							onClick={() => setMobileFilterOpen(true)}
						/>
						<PageHeaderActionButton
							data-testid="model-list-refresh-button"
							disabled={!hasViewAccess || listQuery.isFetching}
							onClick={() => listQuery.refetch()}
							variant="outline"
						>
							<RefreshCw
								className={cn("size-4", listQuery.isFetching && "animate-spin")}
								aria-hidden="true"
							/>
							{t("common.refresh")}
						</PageHeaderActionButton>
						{canCreateModel ? (
							<PageHeaderActionButton
								data-testid="model-list-create-button"
								onClick={() => {
									setEditorTarget(null)
									setIsEditorOpen(true)
								}}
							>
								<Plus className="size-4" aria-hidden="true" />
								{t("modelList.action.create")}
							</PageHeaderActionButton>
						) : null}
					</div>
				}
				description={t("nav.desc.modelList")}
				title={t("nav.item.modelList")}
			>
				<ModelCategoryTabs
					activeCategory={resolvedActiveCategory}
					categories={accessibleCategories}
					onChange={handleCategoryChange}
				/>

				<div className="mt-5">
					<ModelListFilters
						mobileOpen={mobileFilterOpen}
						modelTypeOptions={modelTypeOptions}
						onChange={setFilterDraft}
						onMobileOpenChange={setMobileFilterOpen}
						showModelTypes={shouldShowModelTypeFilter}
						value={filterDraft}
					/>
				</div>

				{queryError && !listQuery.data ? (
					<div className="mt-5 rounded-lg border border-border/50 p-4">
						<EmptyState
							icon={AlertCircle}
							testId="model-list-error"
							title={t("modelList.error.loadTitle")}
							description={queryError.message}
						/>
					</div>
				) : (
					<>
						<DataTable
							columns={columns}
							containerClassName="mt-5"
							containerTestId="model-list-table"
							data={items}
							emptyState={
								<EmptyState
									icon={BrainCircuit}
									testId="model-list-empty"
									title={t("modelList.empty.title")}
									description={t("modelList.empty.description")}
								/>
							}
							getRowId={(item) => item.model_id}
							isLoading={listQuery.isLoading}
							loadingTestId="model-list-loading"
							minWidth={940}
							rowTestId="model-list-row"
							stickyRightColumnId="actions"
						/>

						<ListPagination
							showQuickJumper
							className="mt-4 px-1"
							jumpInputTestId="model-list-jump-input"
							loading={listQuery.isFetching}
							nextButtonTestId="model-list-next-button"
							onPageChange={setPage}
							onPageSizeChange={setPageSize}
							page={currentPage}
							pageSize={currentPageSize}
							pageSizeOptionTestId="model-list-page-size-option"
							pageSizeTriggerTestId="model-list-page-size-trigger"
							previousButtonTestId="model-list-previous-button"
							testId="model-list-pagination"
							total={total}
						/>
					</>
				)}
			</ListShell>

			<ModelDetailDialog
				item={detailTarget}
				onOpenChange={(open) => !open && setDetailTarget(null)}
			/>
			<ModelEditorDialog
				allowedCategories={editableCategories}
				initialCategory={createModelDefaults.category}
				initialModelType={createModelDefaults.modelType}
				model={editorTarget}
				open={isEditorOpen}
				onOpenChange={(open) => {
					setIsEditorOpen(open)
					if (!open) {
						setEditorTarget(null)
					}
				}}
			/>
		</>
	)
}

function ModelCategoryTabs({
	activeCategory,
	categories,
	onChange,
}: {
	activeCategory: ModelCategoryTab
	categories: readonly ProviderModelCategory[]
	onChange: (category: ModelCategoryTab) => void
}) {
	const { t } = useTranslation()

	return (
		<Tabs
			data-testid="model-list-category-tabs"
			value={activeCategory}
			onValueChange={(value) => onChange(value as ModelCategoryTab)}
		>
			<div className="overflow-x-auto">
				<TabsList className="min-w-max">
					<TabsTrigger data-testid="model-list-category-trigger" value={allCategoriesTab}>
						{t("modelList.tab.all")}
					</TabsTrigger>
					{categories.map((category) => (
						<TabsTrigger
							data-testid="model-list-category-trigger"
							key={category}
							value={category}
						>
							{t(`modelList.category.${category}`)}
						</TabsTrigger>
					))}
				</TabsList>
			</div>
		</Tabs>
	)
}

function ModelCell({ item }: { item: ProviderModelGroup }) {
	const { t } = useTranslation()
	const displayName = item.name.trim() || t("modelList.editor.modelPreview")

	return (
		<div className="flex min-w-0 items-center gap-3">
			<EntityAvatarRender
				alt=""
				className="size-9"
				fallbackIcon={<DefaultModelIcon />}
				imageClassName="object-cover"
				name={displayName}
				src={item.icon}
			/>
			<div className="min-w-0 flex flex-col gap-1">
				<CopyableValue
					className="min-w-0 font-sans text-sm font-medium text-foreground"
					value={displayName}
				/>
				<CopyableValue
					className="min-w-0 font-sans text-xs text-muted-foreground"
					label="ModelID"
					value={item.model_id}
				/>
			</div>
		</div>
	)
}
