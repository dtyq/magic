import type { ColumnDef } from "@tanstack/react-table"
import { AlertCircle, Pencil, Plus, RefreshCw, RotateCcw, Tags, Trash2 } from "lucide-react"
import { useDebounce } from "ahooks"
import { useCallback, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { DataTable } from "@magic-admin-v2/components/data-table"
import { DeleteConfirmDialog } from "@magic-admin-v2/components/delete-confirm-dialog"
import { EmptyState } from "@magic-admin-v2/components/empty-state"
import { FilterControlField } from "@magic-admin-v2/components/filter-control-field"
import { FilterSearchInput } from "@magic-admin-v2/components/filter-search-input"
import { Button } from "@magic-admin-v2/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@magic-admin-v2/components/ui/dialog"
import { Input } from "@magic-admin-v2/components/ui/input"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@magic-admin-v2/components/ui/select"
import { Switch } from "@magic-admin-v2/components/ui/switch"
import {
	buildAgentMarketCategorySaveParams,
	formatAgentMarketCategoryDateTime,
	normalizeAgentMarketCategorySortOrder,
	resolveAgentMarketCategoryName,
} from "@magic-admin-v2/features/platform-official-marketplace/utils"
import { AgentMarketCategoryFormDialog } from "@magic-admin-v2/features/platform-official-marketplace/components/agent-market-category-form-dialog"
import { useAgentMarketCategoryMutations } from "@magic-admin-v2/features/platform-official-marketplace/mutations"
import { useAgentMarketCategoryListQuery } from "@magic-admin-v2/features/platform-official-marketplace/queries"
import {
	agentMarketCategoryStatus,
	type AgentMarketCategoryFormValues,
	type AgentMarketCategoryItem,
	type AgentMarketCategoryListParams,
} from "@magic-admin-v2/features/platform-official-marketplace/types"
import { useI18n } from "@magic-admin-v2/i18n/use-i18n"
import { TEXT_FILTER_DEBOUNCE_MS } from "@magic-admin-v2/constants/filters"

const allStatusValue = "all"

type CategoryFilterDraft = {
	keyword: string
	status: string
}

const emptyFilterDraft: CategoryFilterDraft = {
	keyword: "",
	status: allStatusValue,
}

type AgentMarketCategoryManagerDialogProps = {
	canEdit: boolean
	onOpenChange: (open: boolean) => void
	open: boolean
}

export function AgentMarketCategoryManagerDialog({
	canEdit,
	onOpenChange,
	open,
}: AgentMarketCategoryManagerDialogProps) {
	const { t } = useTranslation()
	const { language } = useI18n()
	const [filterDraft, setFilterDraft] = useState<CategoryFilterDraft>(emptyFilterDraft)
	const debouncedKeyword = useDebounce(filterDraft.keyword, {
		wait: TEXT_FILTER_DEBOUNCE_MS,
	})
	const filters = useMemo<AgentMarketCategoryListParams>(
		() =>
			toCategoryListParams({
				// Clearing the input should remove the server filter immediately instead
				// of waiting for the previous non-empty value to finish debouncing.
				keyword: filterDraft.keyword ? debouncedKeyword : "",
				status: filterDraft.status,
			}),
		[debouncedKeyword, filterDraft.keyword, filterDraft.status],
	)
	const [editing, setEditing] = useState<AgentMarketCategoryItem | null>(null)
	const [formOpen, setFormOpen] = useState(false)
	const [formSaving, setFormSaving] = useState(false)
	const [deleteTarget, setDeleteTarget] = useState<AgentMarketCategoryItem | null>(null)
	const [statusPendingIds, setStatusPendingIds] = useState<Set<string>>(new Set())
	const [sortPendingIds, setSortPendingIds] = useState<Set<string>>(new Set())
	const query = useAgentMarketCategoryListQuery(filters, open)
	const mutations = useAgentMarketCategoryMutations()
	const categories = query.data?.list ?? []

	function resetFilters() {
		setFilterDraft(emptyFilterDraft)
	}

	const updateStatus = useCallback(
		async (record: AgentMarketCategoryItem, checked: boolean) => {
			if (!canEdit) return

			setStatusPendingIds((previous) => new Set(previous).add(record.id))
			try {
				await mutations.update.mutateAsync({
					id: record.id,
					values: {
						status: checked
							? agentMarketCategoryStatus.visible
							: agentMarketCategoryStatus.hidden,
					},
				})
				toast.success(t("officialMarketplace.category.message.updateSuccess"))
			} catch (error) {
				toast.error(
					getErrorMessage(error, t("officialMarketplace.category.message.updateFailed")),
				)
			} finally {
				setStatusPendingIds((previous) => removePendingId(previous, record.id))
			}
		},
		[canEdit, mutations.update, t],
	)

	const updateSortOrder = useCallback(
		async (record: AgentMarketCategoryItem, value: number) => {
			if (!canEdit) return

			const sortOrder = normalizeAgentMarketCategorySortOrder(value)
			if (sortOrder === (record.sort_order ?? 0)) return

			setSortPendingIds((previous) => new Set(previous).add(record.id))
			try {
				await mutations.update.mutateAsync({
					id: record.id,
					values: { sort_order: sortOrder },
				})
				toast.success(t("officialMarketplace.category.message.updateSuccess"))
			} catch (error) {
				toast.error(
					getErrorMessage(error, t("officialMarketplace.category.message.updateFailed")),
				)
			} finally {
				setSortPendingIds((previous) => removePendingId(previous, record.id))
			}
		},
		[canEdit, mutations.update, t],
	)

	async function saveCategory(values: AgentMarketCategoryFormValues) {
		setFormSaving(true)
		try {
			const data = buildAgentMarketCategorySaveParams(values)
			if (editing) {
				await mutations.update.mutateAsync({ id: editing.id, values: data })
				toast.success(t("officialMarketplace.category.message.updateSuccess"))
			} else {
				await mutations.create.mutateAsync(data)
				toast.success(t("officialMarketplace.category.message.createSuccess"))
			}
			setFormOpen(false)
		} catch (error) {
			toast.error(
				getErrorMessage(error, t("officialMarketplace.category.message.saveFailed")),
			)
			throw error
		} finally {
			setFormSaving(false)
		}
	}

	async function deleteCategory() {
		if (!deleteTarget || !canEdit) return

		try {
			await mutations.delete.mutateAsync(deleteTarget.id)
			toast.success(t("officialMarketplace.category.message.deleteSuccess"))
			setDeleteTarget(null)
		} catch (error) {
			toast.error(
				getErrorMessage(error, t("officialMarketplace.category.message.deleteFailed")),
			)
		}
	}

	const columns = useMemo<Array<ColumnDef<AgentMarketCategoryItem>>>(
		() => [
			{
				id: "name",
				size: 220,
				header: t("officialMarketplace.category.column.name"),
				cell: ({ row }) => (
					<span className="block truncate font-medium">
						{resolveAgentMarketCategoryName(row.original, language)}
					</span>
				),
			},
			{
				id: "status",
				size: 150,
				header: t("officialMarketplace.category.column.status"),
				meta: { mobile: { kind: "control" } },
				cell: ({ row }) => {
					const visible =
						(row.original.status ?? agentMarketCategoryStatus.visible) ===
						agentMarketCategoryStatus.visible
					const pending = statusPendingIds.has(row.original.id)

					return (
						<div className="flex items-center gap-2 whitespace-nowrap">
							<Switch
								aria-label={t("officialMarketplace.category.column.status")}
								checked={visible}
								disabled={!canEdit}
								loading={pending}
								onCheckedChange={(checked) =>
									void updateStatus(row.original, checked)
								}
								data-testid="platform-official-marketplace-switch"
							/>
							<span className="text-xs text-muted-foreground">
								{visible
									? t("officialMarketplace.category.status.visible")
									: t("officialMarketplace.category.status.hidden")}
							</span>
						</div>
					)
				},
			},
			{
				id: "sort_order",
				size: 130,
				header: t("officialMarketplace.category.column.sortOrder"),
				cell: ({ row }) => {
					const pending = sortPendingIds.has(row.original.id)
					return (
						<Input
							aria-label={t("officialMarketplace.category.column.sortOrder")}
							className="h-8 w-24"
							defaultValue={row.original.sort_order ?? 0}
							disabled={!canEdit || pending}
							key={`${row.original.id}-${row.original.sort_order ?? 0}`}
							min={0}
							onBlur={(event) =>
								void updateSortOrder(row.original, Number(event.target.value || 0))
							}
							onKeyDown={(event) => {
								if (event.key === "Enter") event.currentTarget.blur()
							}}
							type="number"
							data-testid="platform-official-marketplace-input"
						/>
					)
				},
			},
			{
				id: "updated_at",
				size: 190,
				header: t("officialMarketplace.category.column.updatedAt"),
				cell: ({ row }) => (
					<span className="whitespace-nowrap text-muted-foreground">
						{formatAgentMarketCategoryDateTime(
							row.original.updated_at,
							language === "en_US" ? "en-US" : "zh-CN",
						)}
					</span>
				),
			},
			{
				id: "actions",
				size: 120,
				header: t("officialMarketplace.category.column.actions"),
				enableSorting: false,
				cell: ({ row }) => (
					<div className="flex items-center gap-1">
						<Button
							aria-label={t("officialMarketplace.category.action.editAria", {
								name: resolveAgentMarketCategoryName(row.original, language),
							})}
							disabled={!canEdit}
							onClick={() => {
								setEditing(row.original)
								setFormOpen(true)
							}}
							size="icon-sm"
							variant="outline"
							data-testid="platform-official-marketplace-delete-button"
						>
							<Pencil className="size-4" aria-hidden="true" />
						</Button>
						<Button
							aria-label={t("officialMarketplace.category.action.deleteAria", {
								name: resolveAgentMarketCategoryName(row.original, language),
							})}
							disabled={!canEdit}
							onClick={() => setDeleteTarget(row.original)}
							size="icon-sm"
							variant="outline"
							data-testid="platform-official-marketplace-delete-button"
						>
							<Trash2 className="size-4 text-destructive" aria-hidden="true" />
						</Button>
					</div>
				),
			},
		],
		[canEdit, language, sortPendingIds, statusPendingIds, t, updateSortOrder, updateStatus],
	)

	return (
		<>
			<Dialog
				onOpenChange={(nextOpen) => {
					// Nested edit and delete dialogs render in separate portals; keep the
					// manager mounted while those overlays are active.
					if (!nextOpen && (formOpen || Boolean(deleteTarget))) return
					onOpenChange(nextOpen)
				}}
				open={open}
			>
				<DialogContent
					className="flex max-h-[calc(100vh-2rem)] min-w-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-[920px]"
					data-testid="platform-official-marketplace-dialog-content"
					closeButtonTestId="agent-market-category-manager-dialog-close-button"
				>
					<DialogHeader className="border-b px-5 py-4 pr-12">
						<DialogTitle>{t("officialMarketplace.category.manageTitle")}</DialogTitle>
						<DialogDescription>
							{t("officialMarketplace.category.manageDescription")}
						</DialogDescription>
					</DialogHeader>

					<div className="min-h-0 flex-1 overflow-y-auto">
						<div className="flex min-w-0 flex-wrap items-end gap-2 px-5 pt-5">
							{/* Keep the two filters side by side on narrow screens; actions can wrap below them. */}
							<div className="grid w-full min-w-0 grid-cols-2 gap-2 sm:contents">
								<FilterControlField
									className="w-full min-w-0 sm:w-[260px]"
									label={t("officialMarketplace.category.filter.keyword")}
								>
									<FilterSearchInput
										aria-label={t("officialMarketplace.category.filter.keyword")}
										clearLabel={t("common.clear")}
										onValueChange={(keyword) =>
											setFilterDraft((previous) => ({
												...previous,
												keyword,
											}))
										}
										placeholder={t(
											"officialMarketplace.category.filter.keywordPlaceholder",
										)}
										value={filterDraft.keyword}
										inputTestId="platform-official-marketplace-search-input"
										clearButtonTestId="platform-official-marketplace-search-clear-button"
									/>
								</FilterControlField>

								<FilterControlField
									className="w-full sm:w-auto"
									label={t("officialMarketplace.category.filter.status")}
								>
									<Select
										onValueChange={(status) =>
											setFilterDraft((previous) => ({ ...previous, status }))
										}
										value={filterDraft.status}
									>
										<SelectTrigger
											className="w-full sm:w-36"
											data-testid="platform-official-marketplace-select-trigger"
										>
											<SelectValue />
										</SelectTrigger>
										<SelectContent data-testid="platform-official-marketplace-select-content">
											<SelectItem
												value={allStatusValue}
												data-testid="platform-official-marketplace-option"
											>
												{t("officialMarketplace.category.filter.allStatus")}
											</SelectItem>
											<SelectItem
												value={String(agentMarketCategoryStatus.visible)}
												data-testid="platform-official-marketplace-option"
											>
												{t("officialMarketplace.category.status.visible")}
											</SelectItem>
											<SelectItem
												value={String(agentMarketCategoryStatus.hidden)}
												data-testid="platform-official-marketplace-option"
											>
												{t("officialMarketplace.category.status.hidden")}
											</SelectItem>
										</SelectContent>
									</Select>
								</FilterControlField>

							</div>
							<Button
								onClick={resetFilters}
								variant="outline"
								data-testid="platform-official-marketplace-refresh-button"
							>
								<RotateCcw className="size-4" aria-hidden="true" />
								{t("officialMarketplace.category.action.reset")}
							</Button>
							<Button
								disabled={query.isFetching}
								onClick={() => void query.refetch()}
								variant="outline"
								data-testid="platform-official-marketplace-refresh-button"
							>
								<RefreshCw
									className={query.isFetching ? "size-4 animate-spin" : "size-4"}
									aria-hidden="true"
								/>
								{t("officialMarketplace.category.action.refresh")}
							</Button>
							<Button
								className="sm:ml-auto"
								disabled={!canEdit}
								onClick={() => {
									setEditing(null)
									setFormOpen(true)
								}}
								data-testid="platform-official-marketplace-create-button"
							>
								<Plus className="size-4" aria-hidden="true" />
								{t("officialMarketplace.category.action.create")}
							</Button>
						</div>

						<div className="mx-5 mb-5 mt-4">
							{query.error ? (
								<div className="p-5">
									<EmptyState
										description={getErrorMessage(
											query.error,
											t("officialMarketplace.category.error.loadFailed"),
										)}
										icon={AlertCircle}
										title={t("officialMarketplace.category.error.loadTitle")}
										testId="platform-official-marketplace-error"
									/>
								</div>
							) : (
								<DataTable
									columns={columns}
									data={categories}
									emptyState={
										<div className="p-5">
											<EmptyState
												description={t(
													"officialMarketplace.category.emptyDescription",
												)}
												icon={Tags}
												title={t("officialMarketplace.category.emptyTitle")}
												testId="platform-official-marketplace-empty"
											/>
										</div>
									}
									getRowId={(record) => record.id}
									isLoading={query.isLoading}
									minWidth={810}
									stickyRightColumnId="actions"
									containerTestId="platform-official-marketplace-list"
									loadingTestId="platform-official-marketplace-loading"
									rowTestId="platform-official-marketplace-row"
								/>
							)}
						</div>
					</div>
				</DialogContent>
			</Dialog>

			<AgentMarketCategoryFormDialog
				editing={editing}
				isPending={formSaving}
				onOpenChange={setFormOpen}
				onSubmit={saveCategory}
				open={formOpen}
			/>

			<DeleteConfirmDialog
				contentTestId="agent-market-category-delete-dialog-content"
				cancelButtonTestId="agent-market-category-delete-cancel-button"
				confirmButtonTestId="agent-market-category-delete-confirm-button"
				description={t("officialMarketplace.category.deleteDescription", {
					name: resolveAgentMarketCategoryName(deleteTarget, language),
				})}
				isPending={mutations.delete.isPending}
				onConfirm={deleteCategory}
				onOpenChange={(nextOpen) => {
					if (!nextOpen) setDeleteTarget(null)
				}}
				open={Boolean(deleteTarget)}
				title={t("officialMarketplace.category.deleteTitle")}
			/>
		</>
	)
}

function toCategoryListParams(filters: CategoryFilterDraft): AgentMarketCategoryListParams {
	return {
		keyword: filters.keyword.trim() || undefined,
		status: filters.status === allStatusValue ? null : (Number(filters.status) as 0 | 1),
	}
}

function removePendingId(previous: Set<string>, id: string) {
	const next = new Set(previous)
	next.delete(id)
	return next
}

function getErrorMessage(error: unknown, fallback: string) {
	return (error as { message?: string } | null)?.message || fallback
}
