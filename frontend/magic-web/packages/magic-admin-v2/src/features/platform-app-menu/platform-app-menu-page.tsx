import { Plus, RefreshCw } from "lucide-react"
import { useCallback, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import type { ApiError } from "@magic-admin-v2/api/types"
import { DeleteConfirmDialog } from "@magic-admin-v2/components/delete-confirm-dialog"
import { ListPagination } from "@magic-admin-v2/components/list-pagination"
import { ListShell } from "@magic-admin-v2/components/list-shell"
import { PageHeaderActionButton } from "@magic-admin-v2/components/page-header-action-button"
import { PageHeaderFilterButton } from "@magic-admin-v2/components/page-header-filter-button"
import { PlatformAppMenuFilters } from "@magic-admin-v2/features/platform-app-menu/components/platform-app-menu-filters"
import { PlatformAppMenuFormDialog } from "@magic-admin-v2/features/platform-app-menu/components/platform-app-menu-form-dialog"
import { PlatformAppMenuTable } from "@magic-admin-v2/features/platform-app-menu/components/platform-app-menu-table"
import {
	APP_MENU_ALL_VALUE,
	createDefaultAppMenuFilterDraft,
	getAppMenuFilterActiveCount,
	type AppMenuFilterDraft,
} from "@magic-admin-v2/features/platform-app-menu/utils"
import {
	useDeleteAppMenuMutation,
	useSaveAppMenuMutation,
	useUpdateAppMenuStatusMutation,
} from "@magic-admin-v2/features/platform-app-menu/mutations"
import {
	useAppMenuDetailQuery,
	useAppMenuListQuery,
} from "@magic-admin-v2/features/platform-app-menu/queries"
import { getMenuName } from "@magic-admin-v2/features/platform-app-menu/utils"
import {
	appMenuStatus,
	type AppMenuFormState,
	type AppMenuItem,
	type AppMenuListParams,
	type AppMenuStatus,
} from "@magic-admin-v2/features/platform-app-menu/types"
import { PERMISSION_KEY_MAP } from "@magic-admin-v2/constants/permissions"
import { useListQueryParams } from "@magic-admin-v2/hooks/use-list-query-params"
import { useRowPendingIds } from "@magic-admin-v2/hooks/use-row-pending-ids"
import { useRights } from "@magic-admin-v2/hooks/use-rights"
import { useI18n } from "@magic-admin-v2/i18n/use-i18n"
import { cn } from "@magic-admin-v2/utils/cn"

const defaultPageSize = 20

function toAppMenuListParams(
	draft: AppMenuFilterDraft,
	page: number,
	pageSize: number,
): AppMenuListParams {
	return {
		page,
		page_size: pageSize,
		name: draft.name.trim(),
		status: parseNullableNumber<AppMenuStatus>(draft.status),
	}
}

export default function PlatformAppMenuPage() {
	const { t } = useTranslation()
	const { language } = useI18n()
	const hasEditRight = useRights(PERMISSION_KEY_MAP.APP_MENU_EDIT)
	const {
		filterDraft,
		page,
		pageSize,
		params,
		setDebouncedField,
		setFilterDraft,
		setPage,
		setPageSize,
	} = useListQueryParams({
		debounceFields: ["name"],
		initialDraft: createDefaultAppMenuFilterDraft,
		initialPageSize: defaultPageSize,
		toParams: toAppMenuListParams,
	})
	const [mobileFilterOpen, setMobileFilterOpen] = useState(false)
	const activeFilterCount = getAppMenuFilterActiveCount(filterDraft)
	const [isFormOpen, setIsFormOpen] = useState(false)
	const [editingId, setEditingId] = useState<string | null>(null)
	const [editingFallback, setEditingFallback] = useState<AppMenuItem | null>(null)
	const [deleteTarget, setDeleteTarget] = useState<AppMenuItem | null>(null)
	const { pendingIds: statusPendingIds, run: runStatusPending } = useRowPendingIds()

	const listQuery = useAppMenuListQuery(params)
	const detailQuery = useAppMenuDetailQuery(editingId)
	const saveMutation = useSaveAppMenuMutation()
	const deleteMutation = useDeleteAppMenuMutation()
	const statusMutation = useUpdateAppMenuStatusMutation()
	const queryError = listQuery.error as ApiError | null
	const items = listQuery.data?.list ?? []
	const total = listQuery.data?.total ?? 0

	function openCreateForm() {
		if (!hasEditRight) return
		setEditingFallback(null)
		setEditingId(null)
		setIsFormOpen(true)
	}

	const openEditForm = useCallback(
		(item: AppMenuItem) => {
			if (!hasEditRight) return
			setEditingFallback(item)
			setEditingId(item.id)
			setIsFormOpen(true)
		},
		[hasEditRight],
	)

	function closeForm() {
		if (saveMutation.isPending) return
		setIsFormOpen(false)
		setEditingFallback(null)
		setEditingId(null)
	}

	async function handleSave(values: AppMenuFormState) {
		if (!hasEditRight) return

		try {
			await saveMutation.mutateAsync({ id: editingId ?? undefined, values })
			setIsFormOpen(false)
			setEditingFallback(null)
			setEditingId(null)
			toast.success(
				editingId ? t("appMenu.message.updateSuccess") : t("appMenu.message.createSuccess"),
			)
		} catch (error) {
			toast.error(getMutationErrorMessage(error, t("common.requestFailed")))
		}
	}

	async function handleDelete() {
		if (!hasEditRight || !deleteTarget) return

		try {
			await deleteMutation.mutateAsync(deleteTarget.id)
			toast.success(t("appMenu.message.deleteSuccess"))
			setDeleteTarget(null)
		} catch (error) {
			toast.error(getMutationErrorMessage(error, t("common.requestFailed")))
		}
	}

	const handleStatusChange = useCallback(
		(item: AppMenuItem, checked: boolean) => {
			if (!hasEditRight) return

			void runStatusPending(item.id, async () => {
				try {
					await statusMutation.mutateAsync({
						id: item.id,
						status: checked ? appMenuStatus.enabled : appMenuStatus.disabled,
					})
					toast.success(t("appMenu.message.statusSuccess"))
				} catch (error) {
					toast.error(getMutationErrorMessage(error, t("common.requestFailed")))
				}
			})
		},
		[hasEditRight, runStatusPending, statusMutation, t],
	)

	return (
		<>
			<ListShell
				testId="app-menu-page"
				actions={
					<>
						<PageHeaderFilterButton
							data-testid="app-menu-advanced-trigger"
							count={activeFilterCount}
							label={t("appMenu.filter.title")}
							onClick={() => setMobileFilterOpen(true)}
						/>
						<PageHeaderActionButton
							data-testid="app-menu-refresh-button"
							disabled={listQuery.isFetching}
							onClick={() => listQuery.refetch()}
							variant="outline"
						>
							<RefreshCw
								className={cn(
									"size-4",
									listQuery.isFetching ? "animate-spin" : null,
								)}
								aria-hidden="true"
							/>
							{t("common.refresh")}
						</PageHeaderActionButton>
						<PageHeaderActionButton
							data-testid="app-menu-create-button"
							disabled={!hasEditRight}
							onClick={openCreateForm}
						>
							<Plus className="size-4" aria-hidden="true" />
							{t("appMenu.action.create")}
						</PageHeaderActionButton>
					</>
				}
				description={t("nav.desc.appMenu")}
				title={t("nav.item.appMenu")}
			>
				<div className="space-y-4">
					<PlatformAppMenuFilters
						mobileOpen={mobileFilterOpen}
						onChange={setFilterDraft}
						onMobileOpenChange={setMobileFilterOpen}
						onSearchValueChange={(value) => setDebouncedField("name", value)}
						value={filterDraft}
					/>
					<PlatformAppMenuTable
						error={queryError}
						hasEditRight={hasEditRight}
						isLoading={listQuery.isLoading}
						items={items}
						onDelete={setDeleteTarget}
						onEdit={openEditForm}
						onStatusChange={handleStatusChange}
						statusPendingIds={statusPendingIds}
					/>

					{!queryError && !listQuery.isLoading ? (
						<ListPagination
							showQuickJumper
							className="px-1"
							jumpInputTestId="app-menu-jump-input"
							loading={listQuery.isFetching}
							nextButtonTestId="app-menu-next-button"
							onPageChange={setPage}
							page={page}
							pageSize={pageSize}
							pageSizeOptionTestId="app-menu-page-size-option"
							pageSizeTriggerTestId="app-menu-page-size-trigger"
							previousButtonTestId="app-menu-previous-button"
							onPageSizeChange={setPageSize}
							testId="app-menu-pagination"
							total={total}
						/>
					) : null}
				</div>
			</ListShell>

			<PlatformAppMenuFormDialog
				fallbackItem={editingFallback}
				formItem={detailQuery.data ?? editingFallback}
				isDetailLoading={Boolean(editingId && detailQuery.isLoading)}
				isOpen={isFormOpen}
				isSaving={saveMutation.isPending}
				onClose={closeForm}
				onSave={handleSave}
			/>

			<DeleteConfirmDialog
				cancelButtonTestId="app-menu-delete-cancel-button"
				confirmButtonTestId="app-menu-delete-confirm-button"
				confirmLabel={t("appMenu.action.confirmDelete")}
				contentTestId="app-menu-delete-dialog"
				description={formatTemplate(t("appMenu.confirm.deleteDescription"), {
					name: deleteTarget ? getMenuName(deleteTarget, language) : "",
				})}
				isPending={deleteMutation.isPending}
				onConfirm={handleDelete}
				onOpenChange={(open) => !open && setDeleteTarget(null)}
				open={Boolean(deleteTarget)}
				title={t("appMenu.confirm.deleteTitle")}
			/>
		</>
	)
}

function parseNullableNumber<T extends number>(value: string): T | null {
	return value === APP_MENU_ALL_VALUE ? null : (Number(value) as T)
}

function getMutationErrorMessage(error: unknown, fallback: string) {
	if (typeof error === "object" && error !== null && "message" in error) {
		const message = (error as { message?: unknown }).message
		if (typeof message === "string" && message.trim().length > 0) return message
	}

	return fallback
}

function formatTemplate(template: string | undefined, values: Record<string, string>) {
	return Object.entries(values).reduce(
		(message, [key, value]) => message.replace(`{{${key}}}`, value),
		template ?? "",
	)
}
